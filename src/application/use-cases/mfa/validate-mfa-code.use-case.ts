// ─── Use Case: Validate MFA Code ──────────────────────────────────────────

import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import type { ITotpService } from '../../ports/totp.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import type { IHasher } from '../../ports/hasher.port.js';
import type { ISecureTokenService } from '../../ports/secure-token.port.js';
import { MfaMethod } from '../../../domain/entities/role.entity.js';
import {
  InvalidMfaCodeError,
  MfaAttemptsExceededError,
  MfaNotEnabledError,
} from '../../../domain/errors/domain-errors.js';
import type { MfaChallengeMethod } from '../../services/mfa-challenge.service.js';

const MFA_EMAIL_CODE_PREFIX = 'mfa_email_code:';
const MFA_TOTP_REPLAY_PREFIX = 'mfa_totp_replay:';
const MFA_VERIFICATION_ATTEMPTS_PREFIX = 'mfa_verification_attempts:';

export type MfaValidationMethod = MfaChallengeMethod;

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
    private readonly secureTokenService?: ISecureTokenService,
    private readonly maxAttempts: number = 5,
    private readonly attemptWindowSeconds: number = 5 * 60,
  ) {}

  async execute(input: ValidateMfaCodeInput): Promise<ValidateMfaCodeOutput> {
    const attemptsKey = `${MFA_VERIFICATION_ATTEMPTS_PREFIX}${input.userId}`;
    const previousAttempts = Number(await this.cacheProvider.get(attemptsKey) ?? 0);
    if (previousAttempts >= this.maxAttempts) {
      throw new MfaAttemptsExceededError();
    }

    const mfaSecret = await this.mfaRepository.findSecretByUserId(input.userId);
    if (!mfaSecret || !mfaSecret.verified) {
      throw new MfaNotEnabledError();
    }

    let isValid = false;

    if (input.method === 'TOTP') {
      isValid = this.totpService.verifyToken(mfaSecret.secret, input.code);
      if (isValid) {
        isValid = await this.cacheProvider.setIfNotExists(
          `${MFA_TOTP_REPLAY_PREFIX}${input.userId}:${input.code}`,
          '1',
          90,
        );
      }
    } else if (input.method === 'EMAIL') {
      const cacheKey = `${MFA_EMAIL_CODE_PREFIX}${input.userId}`;
      const expected = this.secureTokenService?.digest(input.code) ?? input.code;
      isValid = await this.cacheProvider.consumeIfValueMatches(cacheKey, expected);
    } else if (input.method === 'RECOVERY') {
      const recoveryCodes = await this.mfaRepository.findRecoveryCodesByUserId(input.userId);
      const unusedCodes = recoveryCodes.filter((c) => !c.isUsed);

      for (const rc of unusedCodes) {
        const matches = await this.hasher.compare(input.code, rc.codeHash);
        if (matches) {
          isValid = await this.mfaRepository.consumeRecoveryCode(rc.id);
          break;
        }
      }
    }

    if (!isValid) {
      const attempts = await this.cacheProvider.increment(
        attemptsKey,
        this.attemptWindowSeconds,
      );
      if (attempts >= this.maxAttempts) throw new MfaAttemptsExceededError();
      throw new InvalidMfaCodeError();
    }

    await this.cacheProvider.del(attemptsKey);
    return { valid: true };
  }
}
