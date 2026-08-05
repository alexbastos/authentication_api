// ─── Use Case: Register User ──────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import { User } from '../../../domain/entities/user.entity.js';
import { Role, UserStatus } from '../../../domain/entities/role.entity.js';
import {
  UserAlreadyExistsError,
  WeakPasswordError,
} from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  role?: Role;
}

export interface RegisterUserOutput {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
}

export class RegisterUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hasher: IHasher,
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

    // 4. Create user entity
    const now = new Date();
    const user = new User({
      id: uuidv4(),
      name: input.name,
      email: input.email.toLowerCase().trim(),
      passwordHash,
      role: input.role ?? Role.USER,
      status: UserStatus.ACTIVE,
      socialAccounts: [],
      createdAt: now,
      updatedAt: now,
    });

    const createdUser = await this.userRepository.create(user);

    return {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      role: createdUser.role,
      status: createdUser.status,
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
