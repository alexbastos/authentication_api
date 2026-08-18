// ─── Use Case: Verify Email ───────────────────────────────────────────────

import crypto from 'node:crypto';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import { VerificationTokenType } from '../../../domain/entities/role.entity.js';
import {
  InvalidVerificationTokenError,
  ExpiredVerificationTokenError,
  UserNotFoundError,
} from '../../../domain/errors/domain-errors.js';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { DispatchEventUseCase } from '../webhook/dispatch-event.use-case.js';

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
    private readonly dispatchEventUC?: DispatchEventUseCase,
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

    if (this.dispatchEventUC) {
      this.dispatchEventUC.execute({
        event: WebhookEvent.USER_EMAIL_VERIFIED,
        payload: {
          userId: user.id,
          email: user.email,
          timestamp: new Date().toISOString(),
        },
      }).catch(console.error);
    }

    return { message: 'Email verified successfully.' };
  }
}
