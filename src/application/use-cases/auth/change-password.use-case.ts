// ─── Use Case: Change Password (Authenticated) ────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import {
  UserNotFoundError,
  InvalidCredentialsError,
  WeakPasswordError,
} from '../../../domain/errors/domain-errors.js';

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordOutput {
  message: string;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hasher: IHasher,
  ) {}

  async execute(input: ChangePasswordInput): Promise<ChangePasswordOutput> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    // Social-only users don't have a password to compare
    if (!user.hasPassword) {
      throw new InvalidCredentialsError();
    }

    // Validate current password
    const isCurrentPasswordValid = await this.hasher.compare(
      input.currentPassword,
      user.passwordHash!,
    );
    if (!isCurrentPasswordValid) {
      throw new InvalidCredentialsError();
    }

    // Validate new password complexity
    this.validatePasswordComplexity(input.newPassword);

    // Prevent reusing the same password
    const isSamePassword = await this.hasher.compare(input.newPassword, user.passwordHash!);
    if (isSamePassword) {
      throw new WeakPasswordError('new password must be different from current password');
    }

    const newPasswordHash = await this.hasher.hash(input.newPassword);
    user.updatePassword(newPasswordHash);
    await this.userRepository.update(user);

    return { message: 'Password changed successfully.' };
  }

  private validatePasswordComplexity(password: string): void {
    const errors: string[] = [];
    if (password.length < 8) errors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) errors.push('at least one uppercase letter');
    if (!/[a-z]/.test(password)) errors.push('at least one lowercase letter');
    if (!/[0-9]/.test(password)) errors.push('at least one digit');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('at least one special character');
    if (errors.length > 0) throw new WeakPasswordError(errors.join(', '));
  }
}
