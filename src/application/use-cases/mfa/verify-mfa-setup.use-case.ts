// ─── Use Case: Verify MFA Setup ───────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import type { ITotpService } from '../../ports/totp.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import type { IHasher } from '../../ports/hasher.port.js';
import { MfaRecoveryCode } from '../../../domain/entities/mfa-recovery-code.entity.js';
import { MfaMethod } from '../../../domain/entities/role.entity.js';
import {
  UserNotFoundError,
  InvalidMfaCodeError,
  MfaAlreadyEnabledError,
} from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';

const MFA_EMAIL_CODE_PREFIX = 'mfa_email_code:';
const RECOVERY_CODE_COUNT = 10;

export interface VerifyMfaSetupInput {
  userId: string;
  code: string;
}

export interface VerifyMfaSetupOutput {
  recoveryCodes: string[];
  message: string;
}

export class VerifyMfaSetupUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly mfaRepository: IMfaRepository,
    private readonly totpService: ITotpService,
    private readonly hasher: IHasher,
    private readonly cacheProvider: ICacheProvider,
  ) {}

  async execute(input: VerifyMfaSetupInput): Promise<VerifyMfaSetupOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    if (user.mfaEnabled) {
      throw new MfaAlreadyEnabledError();
    }

    const mfaSecret = await this.mfaRepository.findSecretByUserId(user.id);
    if (!mfaSecret) {
      throw new InvalidMfaCodeError();
    }

    // Verify code based on method
    if (mfaSecret.method === MfaMethod.TOTP) {
      const isValid = this.totpService.verifyToken(mfaSecret.secret, input.code);
      if (!isValid) throw new InvalidMfaCodeError();
    } else {
      // EMAIL method — verify against cached code
      const cacheKey = `${MFA_EMAIL_CODE_PREFIX}${user.id}`;
      const storedCode = await this.cacheProvider.get(cacheKey);
      if (!storedCode || storedCode !== input.code) {
        throw new InvalidMfaCodeError();
      }
      await this.cacheProvider.del(cacheKey);
    }

    // Mark as verified
    mfaSecret.markVerified();
    await this.mfaRepository.updateSecret(mfaSecret);

    // Enable MFA on user
    user.enableMfa(mfaSecret.method);
    await this.userRepository.update(user);

    // Generate recovery codes
    const plainCodes: string[] = [];
    const recoveryCodeEntities: MfaRecoveryCode[] = [];

    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const code = `${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      plainCodes.push(code);

      const codeHash = await this.hasher.hash(code);
      recoveryCodeEntities.push(
        new MfaRecoveryCode({
          id: uuidv4(),
          userId: user.id,
          codeHash,
          usedAt: null,
          createdAt: new Date(),
        }),
      );
    }

    // Delete any old recovery codes and create new ones
    await this.mfaRepository.deleteRecoveryCodesByUserId(user.id);
    await this.mfaRepository.createRecoveryCodes(recoveryCodeEntities);

    return {
      recoveryCodes: plainCodes,
      message: 'Two-factor authentication has been enabled. Save your recovery codes securely.',
    };
  }
}
