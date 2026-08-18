// ─── Use Case: OAuth Authorize ──────────────────────────────────────────────

import type { IClientAppRepository } from '../../../domain/repositories/client-app.repository.js';
import type { IAuthorizationCodeRepository } from '../../../domain/repositories/authorization-code.repository.js';
import type { IOAuthConsentRepository } from '../../../domain/repositories/oauth-consent.repository.js';
import {
  ClientAppNotFoundError,
  InvalidRedirectUriError,
  InvalidCodeChallengeError,
  ConsentRequiredError,
} from '../../../domain/errors/domain-errors.js';
import { AuthorizationCode } from '../../../domain/entities/authorization-code.entity.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';

export interface AuthorizeInput {
  userId: string;
  clientId: string;
  responseType: string;
  redirectUri: string;
  scope?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  nonce?: string;
  prompt?: string;
}

export interface AuthorizeOutput {
  redirectUri: string;
  code?: string;
  state?: string;
}

export class AuthorizeUseCase {
  constructor(
    private readonly clientAppRepository: IClientAppRepository,
    private readonly authCodeRepository: IAuthorizationCodeRepository,
    private readonly consentRepository: IOAuthConsentRepository,
    private readonly authCodeExpiryMinutes: number = 5,
  ) {}

  async execute(input: AuthorizeInput): Promise<AuthorizeOutput> {
    if (input.responseType !== 'code') {
      throw new Error('Unsupported response_type. Only "code" is supported.');
    }

    const clientApp = await this.clientAppRepository.findByClientId(input.clientId);
    if (!clientApp || !clientApp.isActive) {
      throw new ClientAppNotFoundError(input.clientId);
    }

    if (!clientApp.isValidRedirectUrl(input.redirectUri)) {
      throw new InvalidRedirectUriError();
    }

    // PKCE is recommended/required for public clients, we require it for all here unless configured otherwise.
    // To be flexible, we'll enforce it if it's provided, or enforce it globally depending on policy.
    // For now, let's accept it if provided.
    if (input.codeChallenge && !['S256', 'plain'].includes(input.codeChallengeMethod || 'plain')) {
      throw new InvalidCodeChallengeError();
    }

    // Resolve scopes
    const requestedScopes = input.scope ? input.scope.split(' ') : clientApp.scopes as string[];
    const invalidScopes = requestedScopes.filter((s) => !clientApp.scopes.includes(s));
    if (invalidScopes.length > 0) {
      throw new Error(`Invalid scopes requested: ${invalidScopes.join(', ')}`);
    }

    // Check Consent
    const consent = await this.consentRepository.findByUserAndClient(input.userId, clientApp.id);
    const needsConsent = !consent || !consent.hasScopes(requestedScopes);

    if (input.prompt === 'consent' || needsConsent) {
      throw new ConsentRequiredError();
    }

    // Generate Auth Code
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.authCodeExpiryMinutes * 60000);

    const authCode = new AuthorizationCode({
      id: uuidv4(),
      code,
      clientId: clientApp.id,
      userId: input.userId,
      redirectUri: input.redirectUri,
      scope: requestedScopes.join(' '),
      codeChallenge: input.codeChallenge ?? null,
      codeChallengeMethod: input.codeChallengeMethod ?? null,
      nonce: input.nonce ?? null,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    });

    await this.authCodeRepository.create(authCode);

    // Build the redirect URI
    const url = new URL(input.redirectUri);
    url.searchParams.append('code', code);
    if (input.state) {
      url.searchParams.append('state', input.state);
    }

    return {
      redirectUri: url.toString(),
      code,
      state: input.state,
    };
  }
}
