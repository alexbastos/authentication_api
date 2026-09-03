// ─── Use Case: Disable MFA ────────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IMfaRepository } from '../../../domain/repositories/mfa.repository.js';
import type { ValidateMfaCodeUseCase } from './validate-mfa-code.use-case.js';
import {
  UserNotFoundError,
  MfaNotEnabledError,
} from '../../../domain/errors/domain-errors.js';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { DispatchEventUseCase } from '../webhook/dispatch-event.use-case.js';

export interface DisableMfaInput {
  userId: string;
  code: string;
}

export interface DisableMfaOutput {
  message: string;
}

export class DisableMfaUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly mfaRepository: IMfaRepository,
    private readonly validateMfaCodeUC: ValidateMfaCodeUseCase,
    private readonly dispatchEventUC?: DispatchEventUseCase,
  ) {}

  async execute(input: DisableMfaInput): Promise<DisableMfaOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    if (!user.mfaEnabled) {
      throw new MfaNotEnabledError();
    }

    // Require valid TOTP or recovery code to disable
    await this.validateMfaCodeUC.execute({
      userId: user.id,
      code: input.code,
      method: 'TOTP',
    }).catch(async () => {
      // If TOTP fails, try as recovery code
      await this.validateMfaCodeUC.execute({
        userId: user.id,
        code: input.code,
        method: 'RECOVERY',
      });
    });

    // Disable MFA
    user.disableMfa();
    await this.userRepository.update(user);

    // Clean up MFA data
    await this.mfaRepository.deleteSecretByUserId(user.id);
    await this.mfaRepository.deleteRecoveryCodesByUserId(user.id);

    // Dispatch webhook event
    if (this.dispatchEventUC) {
      this.dispatchEventUC.execute({
        event: WebhookEvent.MFA_DISABLED,
        payload: {
          userId: user.id,
          email: user.email,
          timestamp: new Date().toISOString(),
        },
      }).catch(console.error);
    }

    return {
      message: 'Two-factor authentication has been disabled.',
    };
  }
}
