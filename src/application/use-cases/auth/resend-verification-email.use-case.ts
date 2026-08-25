// ─── Use Case: Resend Verification Email ─────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import type { IEmailService } from '../../ports/email.port.js';
import { SendVerificationEmailUseCase } from './send-verification-email.use-case.js';
import { VerificationTokenType } from '../../../domain/entities/role.entity.js';
import { EmailCooldownError } from '../../../domain/errors/domain-errors.js';

const COOLDOWN_SECONDS = 120; // 2 minutes between resend attempts per email

export interface ResendVerificationEmailInput {
  email: string;
  appUrl: string;
  expiryHours: number;
}

export class ResendVerificationEmailUseCase {
  private readonly sendVerificationEmailUC: SendVerificationEmailUseCase;

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly verificationTokenRepository: IVerificationTokenRepository,
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

    // ─── Cooldown check: prevent abuse per email address ───────────────
    const latestToken = await this.verificationTokenRepository.findLatestByUserIdAndType(
      user.id,
      VerificationTokenType.EMAIL_VERIFICATION,
    );

    if (latestToken) {
      const elapsedSeconds = Math.floor(
        (Date.now() - latestToken.createdAt.getTime()) / 1000,
      );

      if (elapsedSeconds < COOLDOWN_SECONDS) {
        // Return generic success to avoid enumeration and block spam
        return { message: 'If your email exists and is not verified, a new link has been sent.' };
      }
    }

    await this.sendVerificationEmailUC.execute({
      userId: user.id,
      appUrl: input.appUrl,
      expiryHours: input.expiryHours,
    });
    return { message: 'If your email exists and is not verified, a new link has been sent.' };
  }
}
