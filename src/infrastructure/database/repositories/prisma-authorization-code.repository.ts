// ─── Prisma Authorization Code Repository ─────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IAuthorizationCodeRepository } from '../../../domain/repositories/authorization-code.repository.js';
import { AuthorizationCode } from '../../../domain/entities/authorization-code.entity.js';

export class PrismaAuthorizationCodeRepository implements IAuthorizationCodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(code: AuthorizationCode): Promise<AuthorizationCode> {
    const data = code.toJSON();
    const record = await this.prisma.authorizationCode.create({
      data: {
        id: data.id,
        code: data.code,
        clientId: data.clientId,
        userId: data.userId,
        redirectUri: data.redirectUri,
        scope: data.scope,
        codeChallenge: data.codeChallenge,
        codeChallengeMethod: data.codeChallengeMethod,
        nonce: data.nonce,
        expiresAt: data.expiresAt,
        usedAt: data.usedAt,
        createdAt: data.createdAt,
      },
    });
    return this.toDomain(record);
  }

  async findByCode(code: string): Promise<AuthorizationCode | null> {
    const record = await this.prisma.authorizationCode.findUnique({
      where: { code },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async update(code: AuthorizationCode): Promise<void> {
    const data = code.toJSON();
    await this.prisma.authorizationCode.update({
      where: { id: data.id },
      data: {
        usedAt: data.usedAt,
      },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.authorizationCode.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    });
    return result.count;
  }

  private toDomain(record: any): AuthorizationCode {
    return new AuthorizationCode({
      id: record.id,
      code: record.code,
      clientId: record.clientId,
      userId: record.userId,
      redirectUri: record.redirectUri,
      scope: record.scope,
      codeChallenge: record.codeChallenge,
      codeChallengeMethod: record.codeChallengeMethod,
      nonce: record.nonce,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt,
      createdAt: record.createdAt,
    });
  }
}
