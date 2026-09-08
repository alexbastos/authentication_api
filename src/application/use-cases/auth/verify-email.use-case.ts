// ─── Use Case: Verify Email ───────────────────────────────────────────────

import crypto from 'node:crypto';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import type { IAccountSecurityRepository } from '../../ports/account-security.port.js';
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
    private readonly accountSecurityRepository: IAccountSecurityRepository,
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

    const user = await this.userRepository.findById(verificationToken.userId);
    if (!user) throw new InvalidVerificationTokenError();

    if (!(await this.accountSecurityRepository.verifyEmailWithToken(
      verificationToken.id,
      user.id,
    ))) {
      throw new InvalidVerificationTokenError();
    }

    if (this.dispatchEventUC) {
      this.dispatchEventUC.execute({
        event: WebhookEvent.USER_EMAIL_VERIFIED,
        payload: {
          userId: user.id,
          email: user.email,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => undefined);
    }

    return { message: 'Email verified successfully.' };
  }
}
