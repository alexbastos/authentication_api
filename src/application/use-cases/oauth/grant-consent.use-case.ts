// ─── Use Case: Grant OAuth Consent ────────────────────────────────────────

import type { IOAuthConsentRepository } from '../../../domain/repositories/oauth-consent.repository.js';
import type { IClientAppRepository } from '../../../domain/repositories/client-app.repository.js';
import { ClientAppNotFoundError } from '../../../domain/errors/domain-errors.js';
import { OAuthConsent } from '../../../domain/entities/oauth-consent.entity.js';
import { v4 as uuidv4 } from 'uuid';

export interface GrantConsentInput {
  userId: string;
  clientId: string;
  scopes: string[];
}

export class GrantConsentUseCase {
  constructor(
    private readonly consentRepository: IOAuthConsentRepository,
    private readonly clientAppRepository: IClientAppRepository,
  ) {}

  async execute(input: GrantConsentInput): Promise<void> {
    const clientApp = await this.clientAppRepository.findByClientId(input.clientId);
    if (!clientApp || !clientApp.isActive) {
      throw new ClientAppNotFoundError(input.clientId);
    }

    // Validate scopes against client app allowed scopes
    const invalidScopes = input.scopes.filter((s) => !clientApp.scopes.includes(s));
    if (invalidScopes.length > 0) {
      throw new Error(`Invalid scopes requested: ${invalidScopes.join(', ')}`);
    }

    const consent = await this.consentRepository.findByUserAndClient(input.userId, clientApp.id);

    if (consent) {
      consent.updateScopes(input.scopes);
      await this.consentRepository.update(consent);
    } else {
      const newConsent = new OAuthConsent({
        id: uuidv4(),
        userId: input.userId,
        clientId: clientApp.id,
        scopes: input.scopes,
        grantedAt: new Date(),
      });
      await this.consentRepository.create(newConsent);
    }
  }
}
