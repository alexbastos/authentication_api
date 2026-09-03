// ─── Prisma MFA Repository ────────────────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import { MfaSecret } from '../../../domain/entities/mfa-secret.entity.js';
import { MfaRecoveryCode } from '../../../domain/entities/mfa-recovery-code.entity.js';
import type { MfaMethod } from '../../../domain/entities/role.entity.js';

export class PrismaMfaRepository implements IMfaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSecretByUserId(userId: string): Promise<MfaSecret | null> {
    const record = await this.prisma.mfaSecret.findFirst({
      where: { userId },
    });

    if (!record) return null;

    return new MfaSecret({
      id: record.id,
      userId: record.userId,
      secret: record.secret,
      method: record.method as MfaMethod,
      verified: record.verified,
      createdAt: record.createdAt,
    });
  }

  async createSecret(secret: MfaSecret): Promise<MfaSecret> {
    const data = secret.toJSON();
    const record = await this.prisma.mfaSecret.create({
      data: {
        id: data.id,
        userId: data.userId,
        secret: data.secret,
        method: data.method,
        verified: data.verified,
        createdAt: data.createdAt,
      },
    });

    return new MfaSecret({
      id: record.id,
      userId: record.userId,
      secret: record.secret,
      method: record.method as MfaMethod,
      verified: record.verified,
      createdAt: record.createdAt,
    });
  }

  async updateSecret(secret: MfaSecret): Promise<MfaSecret> {
    const data = secret.toJSON();
    const record = await this.prisma.mfaSecret.update({
      where: { id: data.id },
      data: {
        secret: data.secret,
        verified: data.verified,
      },
    });

    return new MfaSecret({
      id: record.id,
      userId: record.userId,
      secret: record.secret,
      method: record.method as MfaMethod,
      verified: record.verified,
      createdAt: record.createdAt,
    });
  }

  async deleteSecretByUserId(userId: string): Promise<void> {
    await this.prisma.mfaSecret.deleteMany({ where: { userId } });
  }

  async findRecoveryCodesByUserId(userId: string): Promise<MfaRecoveryCode[]> {
    const records = await this.prisma.mfaRecoveryCode.findMany({
      where: { userId },
    });

    return records.map(
      (r) =>
        new MfaRecoveryCode({
          id: r.id,
          userId: r.userId,
          codeHash: r.codeHash,
          usedAt: r.usedAt,
          createdAt: r.createdAt,
        }),
    );
  }

  async createRecoveryCodes(codes: MfaRecoveryCode[]): Promise<void> {
    await this.prisma.mfaRecoveryCode.createMany({
      data: codes.map((c) => ({
        id: c.id,
        userId: c.userId,
        codeHash: c.codeHash,
        usedAt: c.usedAt,
        createdAt: c.createdAt,
      })),
    });
  }

  async updateRecoveryCode(code: MfaRecoveryCode): Promise<void> {
    await this.prisma.mfaRecoveryCode.update({
      where: { id: code.id },
      data: { usedAt: code.usedAt },
    });
  }

  async deleteRecoveryCodesByUserId(userId: string): Promise<void> {
    await this.prisma.mfaRecoveryCode.deleteMany({ where: { userId } });
  }

  async countUnusedRecoveryCodes(userId: string): Promise<number> {
    return this.prisma.mfaRecoveryCode.count({
      where: { userId, usedAt: null },
    });
  }
}
