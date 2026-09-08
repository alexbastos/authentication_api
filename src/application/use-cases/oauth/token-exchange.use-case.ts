// ─── Use Case: OAuth Token Exchange ───────────────────────────────────────

import type { IAuthorizationCodeRepository } from '../../../domain/repositories/authorization-code.repository.js';
import type { IClientAppRepository } from '../../../domain/repositories/client-app.repository.js';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import type { IHasher } from '../../ports/hasher.port.js';
import type { ISecureTokenService } from '../../ports/secure-token.port.js';
import {
  InvalidGrantError,
  InvalidCodeChallengeError,
  InvalidOAuthClientError,
  AuthorizationCodeExpiredError,
} from '../../../domain/errors/domain-errors.js';

export interface TokenExchangeInput {
  grantType: string;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string; // For confidential clients
  codeVerifier?: string; // For PKCE
  clientAuthMethod: 'basic' | 'post' | 'none';
}

export interface TokenExchangeOutput {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  id_token?: string; // OIDC
}

export class TokenExchangeUseCase {
  constructor(
    private readonly authCodeRepository: IAuthorizationCodeRepository,
    private readonly clientAppRepository: IClientAppRepository,
    private readonly userRepository: IUserRepository,
    private readonly tokenManager: ITokenManager,
    private readonly hasher: IHasher,
    private readonly secureTokenService: ISecureTokenService,
    private readonly accessTokenTtlSeconds: number,
  ) {}

  async execute(input: TokenExchangeInput): Promise<TokenExchangeOutput> {
    if (input.grantType !== 'authorization_code') {
      throw new InvalidGrantError('Unsupported grant type for this endpoint');
    }

    const codeDigest = this.secureTokenService.digest(input.code);
    let authCode = await this.authCodeRepository.findByCode(codeDigest);
    // Five-minute compatibility window for grants issued by the previous release.
    if (!authCode) authCode = await this.authCodeRepository.findByCode(input.code);
    if (!authCode) throw new InvalidGrantError('Invalid authorization code');

    if (authCode.isUsed) {
      throw new InvalidGrantError('Authorization code already used');
    }

    if (authCode.isExpired) {
      throw new AuthorizationCodeExpiredError();
    }

    const clientApp = await this.clientAppRepository.findById(authCode.clientId);
    if (!clientApp || clientApp.clientId !== input.clientId || !clientApp.isActive) {
      throw new InvalidOAuthClientError();
    }

    if (!clientApp.grantTypes.includes('authorization_code')) {
      throw new InvalidGrantError('Grant type is not allowed for this client');
    }

    // Authenticate confidential clients
    if (clientApp.tokenEndpointAuth === 'client_secret_post' || clientApp.tokenEndpointAuth === 'client_secret_basic') {
      const requiredMethod = clientApp.tokenEndpointAuth === 'client_secret_basic' ? 'basic' : 'post';
      if (input.clientAuthMethod !== requiredMethod) {
        throw new InvalidOAuthClientError();
      }
      if (!input.clientSecret) {
        throw new InvalidOAuthClientError();
      }
      const isSecretValid = await this.hasher.compare(input.clientSecret, clientApp.clientSecret);
      if (!isSecretValid) {
        throw new InvalidOAuthClientError();
      }
    } else if (clientApp.tokenEndpointAuth === 'none' && input.clientAuthMethod !== 'none') {
      throw new InvalidOAuthClientError();
    }

    if (authCode.redirectUri !== input.redirectUri) {
      throw new InvalidGrantError('Redirect URI mismatch');
    }

    // PKCE verification
    if (
      authCode.codeChallengeMethod !== 'S256'
      || !authCode.codeChallenge
      || !input.codeVerifier
      || !/^[A-Za-z0-9._~-]{43,128}$/.test(input.codeVerifier)
      || !this.secureTokenService.verifyPkceS256(input.codeVerifier, authCode.codeChallenge)
    ) {
      throw new InvalidCodeChallengeError();
    }

    // Fetch user for claims
    const user = await this.userRepository.findById(authCode.userId);
    if (!user || !user.isActive) throw new InvalidGrantError('User is unavailable');

    if (!(await this.authCodeRepository.consume(authCode.id))) {
      throw new InvalidGrantError('Authorization code already used or expired');
    }

    const scopes = authCode.scope.split(' ');
    
    // Generate Access Token
    const accessToken = await this.tokenManager.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      aud: clientApp.clientId,
      scopes,
    });

    const response: TokenExchangeOutput = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenTtlSeconds,
    };

    // OIDC - Generate ID Token if openid scope is present
    if (scopes.includes('openid')) {
      response.id_token = await this.tokenManager.generateIdToken({
        sub: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        aud: clientApp.clientId,
        nonce: authCode.nonce ?? undefined,
        auth_time: Math.floor(authCode.createdAt.getTime() / 1000),
      });
    }

    return response;
  }
}
