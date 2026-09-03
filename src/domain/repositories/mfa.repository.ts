import type { MfaSecret } from '../entities/mfa-secret.entity.js';
import type { MfaRecoveryCode } from '../entities/mfa-recovery-code.entity.js';

export interface IMfaRepository {
  findSecretByUserId(userId: string): Promise<MfaSecret | null>;
  createSecret(secret: MfaSecret): Promise<MfaSecret>;
  updateSecret(secret: MfaSecret): Promise<MfaSecret>;
  deleteSecretByUserId(userId: string): Promise<void>;

  // Recovery codes
  findRecoveryCodesByUserId(userId: string): Promise<MfaRecoveryCode[]>;
  createRecoveryCodes(codes: MfaRecoveryCode[]): Promise<void>;
  updateRecoveryCode(code: MfaRecoveryCode): Promise<void>;
  deleteRecoveryCodesByUserId(userId: string): Promise<void>;
  countUnusedRecoveryCodes(userId: string): Promise<number>;
}
