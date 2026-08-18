import type { OAuthConsent } from '../entities/oauth-consent.entity.js';

export interface IOAuthConsentRepository {
  create(consent: OAuthConsent): Promise<OAuthConsent>;
  findByUserAndClient(userId: string, clientId: string): Promise<OAuthConsent | null>;
  update(consent: OAuthConsent): Promise<void>;
  revoke(userId: string, clientId: string): Promise<void>;
}
