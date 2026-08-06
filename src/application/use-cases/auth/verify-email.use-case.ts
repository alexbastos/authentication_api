// ─── Use Case: Verify Email ───────────────────────────────────────────────

import crypto from 'node:crypto';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import { VerificationTokenType } from '../../../domain/entities/role.entity.js';
import {
  InvalidVerificationTokenError,
  ExpiredVerificationTokenError,
} from '../../../domain/errors/domain-errors.js';

export interface VerifyEmailInput {
  token: string;
}

export interface VerifyEmailOutput {
  message: string;
}

export class VerifyEmailUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly verificationTokenRepository: IVerificationTokenRepository,
  ) {}

  async execute(input: VerifyEmailInput): Promise<VerifyEmailOutput> {
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');

    const verificationToken = await this.verificationTokenRepository.findByTokenHash(
      tokenHash,
      VerificationTokenType.EMAIL_VERIFICATION,
    );

    if (!verificationToken || verificationToken.isUsed) {
      throw new InvalidVerificationTokenError();
    }

    if (verificationToken.isExpired) {
      throw new ExpiredVerificationTokenError();
    }

    // Mark token as used
    await this.verificationTokenRepository.markAsUsed(verificationToken.id);

    // Verify user email
    const user = await this.userRepository.findById(verificationToken.userId);
    if (!user) throw new InvalidVerificationTokenError();

    user.verifyEmail();
    await this.userRepository.update(user);

    return { message: 'Email verified successfully.' };
  }
}
