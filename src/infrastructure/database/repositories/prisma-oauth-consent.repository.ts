// ─── Prisma OAuth Consent Repository ──────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IOAuthConsentRepository } from '../../../domain/repositories/oauth-consent.repository.js';
import { OAuthConsent } from '../../../domain/entities/oauth-consent.entity.js';

export class PrismaOAuthConsentRepository implements IOAuthConsentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(consent: OAuthConsent): Promise<OAuthConsent> {
    const data = consent.toJSON();
    const record = await this.prisma.oAuthConsent.create({
      data: {
        id: data.id,
        userId: data.userId,
        clientId: data.clientId,
        scopes: data.scopes,
        grantedAt: data.grantedAt,
      },
    });
    return this.toDomain(record);
  }

  async findByUserAndClient(userId: string, clientId: string): Promise<OAuthConsent | null> {
    const record = await this.prisma.oAuthConsent.findUnique({
      where: {
        userId_clientId: { userId, clientId },
      },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async update(consent: OAuthConsent): Promise<void> {
    const data = consent.toJSON();
    await this.prisma.oAuthConsent.update({
      where: { id: data.id },
      data: {
        scopes: data.scopes,
        grantedAt: data.grantedAt,
      },
    });
  }

  async revoke(userId: string, clientId: string): Promise<void> {
    await this.prisma.oAuthConsent.deleteMany({
      where: { userId, clientId },
    });
  }

  private toDomain(record: any): OAuthConsent {
    return new OAuthConsent({
      id: record.id,
      userId: record.userId,
      clientId: record.clientId,
      scopes: record.scopes,
      grantedAt: record.grantedAt,
    });
  }
}
