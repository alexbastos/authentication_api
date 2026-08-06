// ─── Use Case: Send Verification Email ────────────────────────────────────

import crypto from 'node:crypto';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import type { IEmailService } from '../../ports/email.port.js';
import { VerificationToken } from '../../../domain/entities/verification-token.entity.js';
import { VerificationTokenType } from '../../../domain/entities/role.entity.js';
import { UserNotFoundError } from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';

export interface SendVerificationEmailInput {
  userId: string;
  appUrl: string;
  expiryHours: number;
}

export class SendVerificationEmailUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly verificationTokenRepository: IVerificationTokenRepository,
    private readonly emailService: IEmailService,
  ) {}

  async execute(input: SendVerificationEmailInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    // Delete any existing pending verification token for this user
    await this.verificationTokenRepository.deleteByUserId(
      input.userId,
      VerificationTokenType.EMAIL_VERIFICATION,
    );

    // Generate a secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + input.expiryHours);

    const verificationToken = new VerificationToken({
      id: uuidv4(),
      tokenHash,
      type: VerificationTokenType.EMAIL_VERIFICATION,
      userId: input.userId,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    });

    await this.verificationTokenRepository.create(verificationToken);
    await this.emailService.sendVerificationEmail(user.email, user.name, rawToken);
  }
}
