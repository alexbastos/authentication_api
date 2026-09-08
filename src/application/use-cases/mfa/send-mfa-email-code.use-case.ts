// ─── Use Case: Send MFA Email Code ────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IEmailService } from '../../ports/email.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import type { ISecureTokenService } from '../../ports/secure-token.port.js';
import { randomInt } from 'node:crypto';
import { MfaMethod } from '../../../domain/entities/role.entity.js';
import {
  MfaMethodNotAllowedError,
  MfaRateLimitedError,
  UserNotFoundError,
} from '../../../domain/errors/domain-errors.js';

const MFA_EMAIL_CODE_PREFIX = 'mfa_email_code:';
const MFA_EMAIL_RATE_LIMIT_PREFIX = 'mfa_email_rate_limit:';
const MFA_EMAIL_RATE_LIMIT_SECONDS = 60;

export interface SendMfaEmailCodeInput {
  userId: string;
  accountAction?: boolean;
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
    private readonly secureTokenService?: ISecureTokenService,
  ) {}

  async execute(input: SendMfaEmailCodeInput): Promise<SendMfaEmailCodeOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    if (input.accountAction && (!user.mfaEnabled || user.mfaMethod !== MfaMethod.EMAIL)) {
      throw new MfaMethodNotAllowedError();
    }

    const rateLimitKey = `${MFA_EMAIL_RATE_LIMIT_PREFIX}${user.id}`;
    const acquired = await this.cacheProvider.setIfNotExists(
      rateLimitKey,
      '1',
      MFA_EMAIL_RATE_LIMIT_SECONDS,
    );
    if (!acquired) {
      throw new MfaRateLimitedError();
    }

    const code = randomInt(100000, 1_000_000).toString();
    const cacheKey = `${MFA_EMAIL_CODE_PREFIX}${user.id}`;
    await this.cacheProvider.set(
      cacheKey,
      this.secureTokenService?.digest(code) ?? code,
      this.mfaCodeTtlMinutes * 60,
    );

    await this.emailService.sendMfaCode(user.email, user.name, code);

    return {
      message: 'Verification code sent to your email.',
    };
  }
}
