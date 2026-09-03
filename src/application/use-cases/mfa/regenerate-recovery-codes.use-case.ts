// ─── Use Case: Regenerate Recovery Codes ──────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import type { ValidateMfaCodeUseCase } from './validate-mfa-code.use-case.js';
import { MfaRecoveryCode } from '../../../domain/entities/mfa-recovery-code.entity.js';
import {
  UserNotFoundError,
  MfaNotEnabledError,
} from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';

const RECOVERY_CODE_COUNT = 10;

export interface RegenerateRecoveryCodesInput {
  userId: string;
  code: string;
}

export interface RegenerateRecoveryCodesOutput {
  recoveryCodes: string[];
  message: string;
}

export class RegenerateRecoveryCodesUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly mfaRepository: IMfaRepository,
    private readonly hasher: IHasher,
    private readonly validateMfaCodeUC: ValidateMfaCodeUseCase,
  ) {}

  async execute(input: RegenerateRecoveryCodesInput): Promise<RegenerateRecoveryCodesOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    if (!user.mfaEnabled) {
      throw new MfaNotEnabledError();
    }

    // Require valid TOTP code to regenerate
    await this.validateMfaCodeUC.execute({
      userId: user.id,
      code: input.code,
      method: 'TOTP',
    });

    // Generate new recovery codes
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

    await this.mfaRepository.deleteRecoveryCodesByUserId(user.id);
    await this.mfaRepository.createRecoveryCodes(recoveryCodeEntities);

    return {
      recoveryCodes: plainCodes,
      message: 'Recovery codes have been regenerated. Save them securely.',
    };
  }
}
