// ─── Use Case: Get MFA Status ─────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import type { MfaMethod } from '../../../domain/entities/role.entity.js';
import { UserNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface GetMfaStatusInput {
  userId: string;
}

export interface GetMfaStatusOutput {
  enabled: boolean;
  method: MfaMethod | null;
  recoveryCodesRemaining: number;
}

export class GetMfaStatusUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly mfaRepository: IMfaRepository,
  ) {}

  async execute(input: GetMfaStatusInput): Promise<GetMfaStatusOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    let recoveryCodesRemaining = 0;
    if (user.mfaEnabled) {
      recoveryCodesRemaining = await this.mfaRepository.countUnusedRecoveryCodes(user.id);
    }

    return {
      enabled: user.mfaEnabled,
      method: user.mfaMethod,
      recoveryCodesRemaining,
    };
  }
}
