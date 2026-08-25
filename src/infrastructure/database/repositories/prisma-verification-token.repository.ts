// ─── Prisma Verification Token Repository ────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import { VerificationToken } from '../../../domain/entities/verification-token.entity.js';
import { VerificationTokenType } from '../../../domain/entities/role.entity.js';

export class PrismaVerificationTokenRepository implements IVerificationTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(token: VerificationToken): Promise<VerificationToken> {
    const data = token.toJSON();
    const record = await this.prisma.verificationToken.create({
      data: {
        id: data.id,
        tokenHash: data.tokenHash,
        type: data.type as any,
        userId: data.userId,
        expiresAt: data.expiresAt,
        usedAt: data.usedAt,
        createdAt: data.createdAt,
      },
    });
    return this.toDomain(record);
  }

  async findByTokenHash(tokenHash: string, type: VerificationTokenType): Promise<VerificationToken | null> {
    const raw = await this.prisma.verificationToken.findFirst({
      where: {
        tokenHash,
        type: type as any,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!raw) return null;
    return this.toDomain(raw);
  }

  async findActiveByUserId(userId: string, type: VerificationTokenType): Promise<VerificationToken | null> {
    const raw = await this.prisma.verificationToken.findFirst({
      where: {
        userId,
        type: type as any,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!raw) return null;
    return this.toDomain(raw);
  }

  async markAsUsed(id: string): Promise<void> {
    await this.prisma.verificationToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteByUserId(userId: string, type: VerificationTokenType): Promise<void> {
    await this.prisma.verificationToken.deleteMany({
      where: { userId, type: type as any, usedAt: null },
    });
  }

  async findLatestByUserIdAndType(userId: string, type: VerificationTokenType): Promise<VerificationToken | null> {
    const record = await this.prisma.verificationToken.findFirst({
      where: { userId, type: type as any },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  private toDomain(record: any): VerificationToken {
    return new VerificationToken({
      id: record.id,
      tokenHash: record.tokenHash,
      type: record.type as VerificationTokenType,
      userId: record.userId,
      expiresAt: record.expiresAt,
      usedAt: record.usedAt,
      createdAt: record.createdAt,
    });
  }
}
