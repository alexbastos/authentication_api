// ─── Use Case: Register User ──────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import type { IEmailService } from '../../ports/email.port.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Role, UserStatus } from '../../../domain/entities/role.entity.js';
import { UserAlreadyExistsError } from '../../../domain/errors/domain-errors.js';
import { assertStrongPassword } from '../../services/password-policy.service.js';
import { SendVerificationEmailUseCase } from '../auth/send-verification-email.use-case.js';
import { v4 as uuidv4 } from 'uuid';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { DispatchEventUseCase } from '../webhook/dispatch-event.use-case.js';

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  appUrl: string;
  verificationTokenExpiryHours: number;
}

export interface RegisterUserOutput {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hasher: IHasher,
    private readonly verificationTokenRepository?: IVerificationTokenRepository,
    private readonly emailService?: IEmailService,
    private readonly dispatchEventUC?: DispatchEventUseCase,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    // 1. Validate password complexity
    assertStrongPassword(input.password);

    // 2. Check for duplicate email
    const existingUser = await this.userRepository.findByEmail(input.email);
    if (existingUser) {
      throw new UserAlreadyExistsError(input.email);
    }

    // 3. Hash password
    const passwordHash = await this.hasher.hash(input.password);

    // 4. Create user entity (emailVerified starts as false)
    const now = new Date();
    const user = new User({
      id: uuidv4(),
      name: input.name,
      email: input.email.toLowerCase().trim(),
      passwordHash,
      emailVerified: false,
      role: Role.USER,
      status: UserStatus.ACTIVE,
      socialAccounts: [],
      createdAt: now,
      updatedAt: now,
    });

    const createdUser = await this.userRepository.create(user);

    // 5. Send verification email (non-blocking)
    if (this.verificationTokenRepository && this.emailService) {
      const sendVerificationEmailUC = new SendVerificationEmailUseCase(
        this.userRepository,
        this.verificationTokenRepository,
        this.emailService,
      );
      try {
        await sendVerificationEmailUC.execute({
          userId: createdUser.id,
          appUrl: input.appUrl,
          expiryHours: input.verificationTokenExpiryHours,
        });
      } catch {
        console.error('[RegisterUser] Failed to send verification email');
      }
    }

    // 6. Dispatch Webhook event
    if (this.dispatchEventUC) {
      this.dispatchEventUC.execute({
        event: WebhookEvent.USER_CREATED,
        payload: {
          userId: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          role: createdUser.role,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => undefined);
    }

    return {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      status: createdUser.status,
      emailVerified: createdUser.emailVerified,
      createdAt: createdUser.createdAt,
    };
  }

}
