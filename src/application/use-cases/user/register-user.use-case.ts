// ─── Use Case: Register User ──────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import type { IVerificationTokenRepository } from '../../../domain/repositories/verification-token.repository.js';
import type { IEmailService } from '../../ports/email.port.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Role, UserStatus } from '../../../domain/entities/role.entity.js';
import {
  UserAlreadyExistsError,
  WeakPasswordError,
} from '../../../domain/errors/domain-errors.js';
import { SendVerificationEmailUseCase } from '../auth/send-verification-email.use-case.js';
import { v4 as uuidv4 } from 'uuid';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { DispatchEventUseCase } from '../webhook/dispatch-event.use-case.js';

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  role?: Role;
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
    this.validatePasswordComplexity(input.password);

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
      role: input.role ?? Role.USER,
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
      } catch (err) {
        console.error('[RegisterUser] Failed to send verification email:', err);
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
      }).catch(console.error);
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

  private validatePasswordComplexity(password: string): void {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('at least one digit');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('at least one special character');
    }

    if (errors.length > 0) {
      throw new WeakPasswordError(errors.join(', '));
    }
  }
}
