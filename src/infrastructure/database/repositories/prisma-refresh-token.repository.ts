// ─── Prisma Refresh Token Repository ──────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(refreshToken: RefreshToken): Promise<RefreshToken> {
    const record = await this.prisma.refreshToken.create({
      data: {
        id: refreshToken.id,
        token: refreshToken.token,
        userId: refreshToken.userId,
        family: refreshToken.family,
        expiresAt: refreshToken.expiresAt,
        revokedAt: refreshToken.revokedAt,
      },
    });

    return this.toDomain(record);
  }

  async findByToken(token: string): Promise<RefreshToken | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async revokeByToken(token: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllByFamily(family: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }

  private toDomain(record: any): RefreshToken {
    return new RefreshToken({
      id: record.id,
      token: record.token,
      userId: record.userId,
      family: record.family,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      revokedAt: record.revokedAt,
    });
  }
}
