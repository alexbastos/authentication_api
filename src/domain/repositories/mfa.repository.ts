import type { MfaSecret } from '../entities/mfa-secret.entity.js';
import type { MfaRecoveryCode } from '../entities/mfa-recovery-code.entity.js';
import type { MfaMethod } from '../entities/role.entity.js';

export interface IMfaRepository {
  findSecretByUserId(userId: string): Promise<MfaSecret | null>;
  createSecret(secret: MfaSecret): Promise<MfaSecret>;
  replacePendingSecret(secret: MfaSecret): Promise<MfaSecret>;
  updateSecret(secret: MfaSecret): Promise<MfaSecret>;
  deleteSecretByUserId(userId: string): Promise<void>;

  /** Atomically enables MFA, replaces recovery codes, and revokes prior sessions. */
  completeSetup(
    userId: string,
    secretId: string,
    method: MfaMethod,
    recoveryCodes: MfaRecoveryCode[],
  ): Promise<boolean>;
  /** Atomically disables MFA, removes its secrets, and revokes prior sessions. */
  disableAndRevokeSessions(userId: string): Promise<void>;

  // Recovery codes
  findRecoveryCodesByUserId(userId: string): Promise<MfaRecoveryCode[]>;
  createRecoveryCodes(codes: MfaRecoveryCode[]): Promise<void>;
  replaceRecoveryCodes(userId: string, codes: MfaRecoveryCode[]): Promise<void>;
  consumeRecoveryCode(id: string): Promise<boolean>;
  deleteRecoveryCodesByUserId(userId: string): Promise<void>;
  countUnusedRecoveryCodes(userId: string): Promise<number>;
}
