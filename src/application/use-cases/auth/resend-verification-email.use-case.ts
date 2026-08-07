// ─── Use Case: Resend Verification Email ─────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import type { IEmailService } from '../../ports/email.port.js';
import { SendVerificationEmailUseCase } from './send-verification-email.use-case.js';
import { UserNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface ResendVerificationEmailInput {
  email: string;
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
    const user = await this.userRepository.findByEmail(input.email);
    
    if (!user) {
      // Security: return a generic message to prevent email enumeration
      return { message: 'If your email exists and is not verified, a new link has been sent.' };
    }

    // If already verified, no-op (security: don't reveal state explicitly)
    if (user.emailVerified) {
      return { message: 'If your email exists and is not verified, a new link has been sent.' };
    }

    await this.sendVerificationEmailUC.execute({
      userId: user.id,
      appUrl: input.appUrl,
      expiryHours: input.expiryHours,
    });
    return { message: 'If your email exists and is not verified, a new link has been sent.' };
  }
}
