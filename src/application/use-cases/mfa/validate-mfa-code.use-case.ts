// ─── Use Case: Validate MFA Code ──────────────────────────────────────────

import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import type { ITotpService } from '../../ports/totp.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import type { IHasher } from '../../ports/hasher.port.js';
import { MfaMethod } from '../../../domain/entities/role.entity.js';
import {
  InvalidMfaCodeError,
  MfaNotEnabledError,
  AccountLockedError,
} from '../../../domain/errors/domain-errors.js';

const MFA_EMAIL_CODE_PREFIX = 'mfa_email_code:';
const MFA_ATTEMPTS_PREFIX = 'mfa_attempts:';

export type MfaValidationMethod = 'TOTP' | 'EMAIL' | 'RECOVERY';

export interface ValidateMfaCodeInput {
  userId: string;
  code: string;
  method: MfaValidationMethod;
}

export interface ValidateMfaCodeOutput {
  valid: boolean;
}

export class ValidateMfaCodeUseCase {
  constructor(
    private readonly mfaRepository: IMfaRepository,
    private readonly totpService: ITotpService,
    private readonly hasher: IHasher,
    private readonly cacheProvider: ICacheProvider,
    private readonly maxAttempts: number = 5,
    private readonly lockoutMinutes: number = 5,
  ) {}

  async execute(input: ValidateMfaCodeInput): Promise<ValidateMfaCodeOutput> {
    const lockKey = `${MFA_ATTEMPTS_PREFIX}${input.userId}`;
    const lockoutTtl = this.lockoutMinutes * 60;

    // Check if locked out
    const attempts = await this.cacheProvider.get(lockKey);
    if (attempts && parseInt(attempts, 10) >= this.maxAttempts) {
      throw new AccountLockedError(this.lockoutMinutes);
    }

    const mfaSecret = await this.mfaRepository.findSecretByUserId(input.userId);
    if (!mfaSecret || !mfaSecret.verified) {
      throw new MfaNotEnabledError();
    }

    let isValid = false;

    if (input.method === 'TOTP') {
      isValid = this.totpService.verifyToken(mfaSecret.secret, input.code);
    } else if (input.method === 'EMAIL') {
      const cacheKey = `${MFA_EMAIL_CODE_PREFIX}${input.userId}`;
      const storedCode = await this.cacheProvider.get(cacheKey);
      isValid = storedCode !== null && storedCode === input.code;
      if (isValid) {
        await this.cacheProvider.del(cacheKey);
      }
    } else if (input.method === 'RECOVERY') {
      const recoveryCodes = await this.mfaRepository.findRecoveryCodesByUserId(input.userId);
      const unusedCodes = recoveryCodes.filter((c) => !c.isUsed);

      for (const rc of unusedCodes) {
        const matches = await this.hasher.compare(input.code, rc.codeHash);
        if (matches) {
          rc.markUsed();
          await this.mfaRepository.updateRecoveryCode(rc);
          isValid = true;
          break;
        }
      }
    }

    if (!isValid) {
      await this.cacheProvider.increment(lockKey, lockoutTtl);
      throw new InvalidMfaCodeError();
    }

    // Clear failed attempts on success
    await this.cacheProvider.del(lockKey);

    return { valid: true };
  }
}
