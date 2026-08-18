// ─── Use Case: OAuth Token Exchange ───────────────────────────────────────

import type { IAuthorizationCodeRepository } from '../../../domain/repositories/authorization-code.repository.js';
import type { IClientAppRepository } from '../../../domain/repositories/client-app.repository.js';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import type { IHasher } from '../../ports/hasher.port.js';
import {
  InvalidGrantError,
  InvalidCodeChallengeError,
  ClientAppNotFoundError,
  AuthorizationCodeExpiredError,
} from '../../../domain/errors/domain-errors.js';

export interface TokenExchangeInput {
  grantType: string;
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret?: string; // For confidential clients
  codeVerifier?: string; // For PKCE
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
  ) {}

  async execute(input: TokenExchangeInput): Promise<TokenExchangeOutput> {
    if (input.grantType !== 'authorization_code') {
      throw new InvalidGrantError('Unsupported grant type for this endpoint');
    }

    const authCode = await this.authCodeRepository.findByCode(input.code);
    if (!authCode) throw new InvalidGrantError('Invalid authorization code');

    if (authCode.isUsed) {
      // Threat mitigation: if a code is used twice, revoke all tokens issued to it.
      // For simplicity, we just throw here, but in a real system we'd log and revoke.
      throw new InvalidGrantError('Authorization code already used');
    }

    if (authCode.isExpired) {
      throw new AuthorizationCodeExpiredError();
    }

    const clientApp = await this.clientAppRepository.findById(authCode.clientId);
    if (!clientApp || clientApp.clientId !== input.clientId || !clientApp.isActive) {
      throw new ClientAppNotFoundError(input.clientId);
    }

    // Authenticate confidential clients
    if (clientApp.tokenEndpointAuth === 'client_secret_post' || clientApp.tokenEndpointAuth === 'client_secret_basic') {
      if (!input.clientSecret) {
        throw new InvalidGrantError('Client secret required');
      }
      const isSecretValid = await this.hasher.compare(input.clientSecret, clientApp.clientSecret);
      if (!isSecretValid) {
        throw new InvalidGrantError('Invalid client credentials');
      }
    }

    if (authCode.redirectUri !== input.redirectUri) {
      throw new InvalidGrantError('Redirect URI mismatch');
    }

    // PKCE verification
    if (authCode.codeChallenge) {
      if (!input.codeVerifier) {
        throw new InvalidCodeChallengeError();
      }
      if (!authCode.validatePkce(input.codeVerifier)) {
        throw new InvalidCodeChallengeError();
      }
    }

    // Mark code as used
    authCode.use();
    await this.authCodeRepository.update(authCode);

    // Fetch user for claims
    const user = await this.userRepository.findById(authCode.userId);
    if (!user) throw new InvalidGrantError('User not found');

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
      expires_in: 3600, // 1 hour (sync with tokenManager)
    };

    // OIDC - Generate ID Token if openid scope is present
    if (scopes.includes('openid')) {
      response.id_token = await this.tokenManager.generateIdToken({
        sub: user.id,
        email: user.email,
        name: user.name,
        aud: clientApp.clientId,
        nonce: authCode.nonce ?? undefined,
        auth_time: Math.floor(authCode.createdAt.getTime() / 1000),
      });
    }

    return response;
  }
}
