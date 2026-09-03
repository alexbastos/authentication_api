// ─── Use Case: Send MFA Email Code ────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IEmailService } from '../../ports/email.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import { UserNotFoundError } from '../../../domain/errors/domain-errors.js';

const MFA_EMAIL_CODE_PREFIX = 'mfa_email_code:';

export interface SendMfaEmailCodeInput {
  userId: string;
}

export interface SendMfaEmailCodeOutput {
  message: string;
}

export class SendMfaEmailCodeUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly cacheProvider: ICacheProvider,
    private readonly mfaCodeTtlMinutes: number = 10,
  ) {}

  async execute(input: SendMfaEmailCodeInput): Promise<SendMfaEmailCodeOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const cacheKey = `${MFA_EMAIL_CODE_PREFIX}${user.id}`;
    await this.cacheProvider.set(cacheKey, code, this.mfaCodeTtlMinutes * 60);

    await this.emailService.sendMfaCode(user.email, user.name, code);

    return {
      message: 'Verification code sent to your email.',
    };
  }
}
