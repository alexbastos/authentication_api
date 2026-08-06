// ─── Use Case: Reset Password ─────────────────────────────────────────────

import crypto from 'node:crypto';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import { VerificationTokenType } from '../../../domain/entities/role.entity.js';
import {
  InvalidVerificationTokenError,
  ExpiredVerificationTokenError,
  WeakPasswordError,
} from '../../../domain/errors/domain-errors.js';

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
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly hasher: IHasher,
  ) {}

  async execute(input: ResetPasswordInput): Promise<ResetPasswordOutput> {
    // Validate password complexity first
    this.validatePasswordComplexity(input.newPassword);

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

    // Mark token as used (one-time use)
    await this.verificationTokenRepository.markAsUsed(resetToken.id);

    // Hash and update password
    const passwordHash = await this.hasher.hash(input.newPassword);
    user.updatePassword(passwordHash);
    await this.userRepository.update(user);

    // Revoke all refresh tokens for security (log out from all devices)
    await this.refreshTokenRepository.revokeAllByUserId(user.id);

    return { message: 'Password has been reset successfully. Please log in with your new password.' };
  }

  private validatePasswordComplexity(password: string): void {
    const errors: string[] = [];
    if (password.length < 8) errors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('at least one digit');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('at least one special character');
    if (errors.length > 0) throw new WeakPasswordError(errors.join(', '));
  }
}
