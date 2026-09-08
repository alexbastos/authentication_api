// ─── Prisma MFA Repository ────────────────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import { MfaSecret } from '../../../domain/entities/mfa-secret.entity.js';
import { MfaRecoveryCode } from '../../../domain/entities/mfa-recovery-code.entity.js';
import type { MfaMethod } from '../../../domain/entities/role.entity.js';
import type { IDataProtector } from '../../../application/ports/data-protector.port.js';

class MfaSetupStateConflict extends Error {}

export class PrismaMfaRepository implements IMfaRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly dataProtector?: IDataProtector,
  ) {}

  async findSecretByUserId(userId: string): Promise<MfaSecret | null> {
    const record = await this.prisma.mfaSecret.findFirst({
      where: { userId },
    });

    if (!record) return null;

    const plaintextSecret = this.dataProtector?.unprotect(record.secret) ?? record.secret;
    if (this.dataProtector && !this.dataProtector.isProtected(record.secret)) {
      await this.prisma.mfaSecret.update({
        where: { id: record.id },
        data: { secret: this.dataProtector.protect(record.secret) },
      });
    }

    return new MfaSecret({
      id: record.id,
      userId: record.userId,
      secret: plaintextSecret,
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
        secret: this.dataProtector?.protect(data.secret) ?? data.secret,
        method: data.method,
        verified: data.verified,
        createdAt: data.createdAt,
      },
    });

    return new MfaSecret({
      id: record.id,
      userId: record.userId,
      secret: data.secret,
      method: record.method as MfaMethod,
      verified: record.verified,
      createdAt: record.createdAt,
    });
  }

  async replacePendingSecret(secret: MfaSecret): Promise<MfaSecret> {
    const data = secret.toJSON();
    const record = await this.prisma.$transaction(async (tx) => {
      await tx.mfaSecret.deleteMany({ where: { userId: data.userId } });
      return tx.mfaSecret.create({
        data: {
          id: data.id,
          userId: data.userId,
          secret: this.dataProtector?.protect(data.secret) ?? data.secret,
          method: data.method,
          verified: data.verified,
          createdAt: data.createdAt,
        },
      });
    });

    return new MfaSecret({
      id: record.id,
      userId: record.userId,
      secret: data.secret,
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
        secret: this.dataProtector?.protect(data.secret) ?? data.secret,
        verified: data.verified,
      },
    });

    return new MfaSecret({
      id: record.id,
      userId: record.userId,
      secret: data.secret,
      method: record.method as MfaMethod,
      verified: record.verified,
      createdAt: record.createdAt,
    });
  }

  async deleteSecretByUserId(userId: string): Promise<void> {
    await this.prisma.mfaSecret.deleteMany({ where: { userId } });
  }

  async completeSetup(
    userId: string,
    secretId: string,
    method: MfaMethod,
    recoveryCodes: MfaRecoveryCode[],
  ): Promise<boolean> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const secretUpdated = await tx.mfaSecret.updateMany({
          where: { id: secretId, userId, verified: false, method },
          data: { verified: true },
        });
        const userUpdated = await tx.user.updateMany({
          where: { id: userId, mfaEnabled: false },
          data: { mfaEnabled: true, mfaMethod: method },
        });
        if (secretUpdated.count !== 1 || userUpdated.count !== 1) {
          throw new MfaSetupStateConflict();
        }

        await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
        await tx.mfaRecoveryCode.createMany({
          data: recoveryCodes.map((code) => ({
            id: code.id,
            userId: code.userId,
            codeHash: code.codeHash,
            usedAt: code.usedAt,
            createdAt: code.createdAt,
          })),
        });
        const revokedAt = new Date();
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt },
        });
        await tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt },
        });
      });
      return true;
    } catch (error) {
      if (error instanceof MfaSetupStateConflict) return false;
      throw error;
    }
  }

  async disableAndRevokeSessions(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { mfaEnabled: false, mfaMethod: null },
      });
      await tx.mfaSecret.deleteMany({ where: { userId } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      const revokedAt = new Date();
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt },
      });
    });
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

  async replaceRecoveryCodes(
    userId: string,
    codes: MfaRecoveryCode[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      await tx.mfaRecoveryCode.createMany({
        data: codes.map((code) => ({
          id: code.id,
          userId: code.userId,
          codeHash: code.codeHash,
          usedAt: code.usedAt,
          createdAt: code.createdAt,
        })),
      });
    });
  }

  async consumeRecoveryCode(id: string): Promise<boolean> {
    const result = await this.prisma.mfaRecoveryCode.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return result.count === 1;
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
