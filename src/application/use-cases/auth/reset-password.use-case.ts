// ─── Use Case: Reset Password ─────────────────────────────────────────────

import crypto from 'node:crypto';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import type { IAccountSecurityRepository } from '../../ports/account-security.port.js';
import { VerificationTokenType } from '../../../domain/entities/role.entity.js';
import {
  InvalidVerificationTokenError,
  ExpiredVerificationTokenError,
} from '../../../domain/errors/domain-errors.js';
import { assertStrongPassword } from '../../services/password-policy.service.js';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface ResetPasswordOutput {
  message: string;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly verificationTokenRepository: IVerificationTokenRepository,
    private readonly hasher: IHasher,
    private readonly accountSecurityRepository: IAccountSecurityRepository,
  ) {}

  async execute(input: ResetPasswordInput): Promise<ResetPasswordOutput> {
    // Validate password complexity first
    assertStrongPassword(input.newPassword);

    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');

    const resetToken = await this.verificationTokenRepository.findByTokenHash(
      tokenHash,
      VerificationTokenType.PASSWORD_RESET,
    );

    if (!resetToken || resetToken.isUsed) {
      throw new InvalidVerificationTokenError();
    }

    if (resetToken.isExpired) {
      throw new ExpiredVerificationTokenError();
    }

    const user = await this.userRepository.findById(resetToken.userId);
    if (!user) throw new InvalidVerificationTokenError();

    const passwordHash = await this.hasher.hash(input.newPassword);

    if (!(await this.accountSecurityRepository.resetPasswordAndRevokeSessions({
      verificationTokenId: resetToken.id,
      userId: user.id,
      passwordHash,
    }))) {
      throw new InvalidVerificationTokenError();
    }

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }

}
