// ─── Use Case: Setup MFA ──────────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import type { ITotpService } from '../../ports/totp.port.js';
import type { IEmailService } from '../../ports/email.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import { MfaSecret } from '../../../domain/entities/mfa-secret.entity.js';
import { MfaMethod } from '../../../domain/entities/role.entity.js';
import { UserNotFoundError, MfaAlreadyEnabledError } from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';

const MFA_EMAIL_CODE_PREFIX = 'mfa_email_code:';

export interface SetupMfaInput {
  userId: string;
  method: MfaMethod;
}

export interface SetupMfaOutput {
  method: MfaMethod;
  qrCodeUrl?: string;
  secret?: string;
  message: string;
}

export class SetupMfaUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly mfaRepository: IMfaRepository,
    private readonly totpService: ITotpService,
    private readonly emailService: IEmailService,
    private readonly cacheProvider: ICacheProvider,
    private readonly mfaIssuerName: string = 'AuthenticationAPI',
    private readonly mfaCodeTtlMinutes: number = 10,
  ) {}

  async execute(input: SetupMfaInput): Promise<SetupMfaOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    if (user.mfaEnabled) {
      throw new MfaAlreadyEnabledError();
    }

    // Delete any existing pending secret
    await this.mfaRepository.deleteSecretByUserId(user.id);

    if (input.method === MfaMethod.TOTP) {
      const { secret, otpAuthUrl } = this.totpService.generateSecret(
        this.mfaIssuerName,
        user.email,
      );
      const qrCodeUrl = await this.totpService.generateQrCodeDataUrl(otpAuthUrl);

      const mfaSecret = new MfaSecret({
        id: uuidv4(),
        userId: user.id,
        secret,
        method: MfaMethod.TOTP,
        verified: false,
        createdAt: new Date(),
      });

      await this.mfaRepository.createSecret(mfaSecret);

      return {
        method: MfaMethod.TOTP,
        qrCodeUrl,
        secret,
        message: 'Scan the QR code with your authenticator app, then verify with a code.',
      };
    }

    // EMAIL method
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const cacheKey = `${MFA_EMAIL_CODE_PREFIX}${user.id}`;
    await this.cacheProvider.set(cacheKey, code, this.mfaCodeTtlMinutes * 60);

    const mfaSecret = new MfaSecret({
      id: uuidv4(),
      userId: user.id,
      secret: 'email',
      method: MfaMethod.EMAIL,
      verified: false,
      createdAt: new Date(),
    });

    await this.mfaRepository.createSecret(mfaSecret);
    await this.emailService.sendMfaCode(user.email, user.name, code);

    return {
      method: MfaMethod.EMAIL,
      message: 'A verification code has been sent to your email.',
    };
  }
}
