// ─── Use Case: Request Password Reset ─────────────────────────────────────
// Security: Response is always the same whether the email exists or not.
// This prevents user enumeration attacks.

import crypto from 'node:crypto';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import type { IEmailService } from '../../ports/email.port.js';
import { VerificationToken } from '../../../domain/entities/verification-token.entity.js';
import { VerificationTokenType } from '../../../domain/entities/role.entity.js';
import { v4 as uuidv4 } from 'uuid';

export interface RequestPasswordResetInput {
  email: string;
  appUrl: string;
  expiryHours: number;
}

export interface RequestPasswordResetOutput {
  message: string;
}

export class RequestPasswordResetUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly verificationTokenRepository: IVerificationTokenRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<RequestPasswordResetOutput> {
    // Always return the same message regardless of whether the email exists
    const genericMessage = 'If an account with that email exists, a password reset link has been sent.';

    const user = await this.userRepository.findByEmail(input.email);
    if (!user || !user.isActive) {
      return { message: genericMessage };
    }

    // Delete any existing pending password reset token for this user
    await this.verificationTokenRepository.deleteByUserId(
      user.id,
      VerificationTokenType.PASSWORD_RESET,
    );

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + input.expiryHours);

    const resetToken = new VerificationToken({
      id: uuidv4(),
      tokenHash,
      type: VerificationTokenType.PASSWORD_RESET,
      userId: user.id,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    });

    await this.verificationTokenRepository.create(resetToken);
    await this.emailService.sendPasswordResetEmail(user.email, user.name, rawToken);

    return { message: genericMessage };
  }
}
