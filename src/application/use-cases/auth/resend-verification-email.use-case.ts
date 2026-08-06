// ─── Use Case: Resend Verification Email ─────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import type { IEmailService } from '../../ports/email.port.js';
import { SendVerificationEmailUseCase } from './send-verification-email.use-case.js';
import { UserNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface ResendVerificationEmailInput {
  userId: string;
  appUrl: string;
  expiryHours: number;
}

export class ResendVerificationEmailUseCase {
  private readonly sendVerificationEmailUC: SendVerificationEmailUseCase;

  constructor(
    private readonly userRepository: IUserRepository,
    verificationTokenRepository: IVerificationTokenRepository,
    emailService: IEmailService,
  ) {
    this.sendVerificationEmailUC = new SendVerificationEmailUseCase(
      userRepository,
      verificationTokenRepository,
      emailService,
    );
  }

  async execute(input: ResendVerificationEmailInput): Promise<{ message: string }> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    // If already verified, no-op (security: don't reveal state explicitly)
    if (user.emailVerified) {
      return { message: 'If your email is not verified, a new link has been sent.' };
    }

    await this.sendVerificationEmailUC.execute(input);
    return { message: 'If your email is not verified, a new link has been sent.' };
  }
}
