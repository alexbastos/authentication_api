// ─── Use Case: Update User ────────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import { Role } from '../../../domain/entities/role.entity.js';
import {
  UserNotFoundError,
  UserAlreadyExistsError,
  ForbiddenError,
} from '../../../domain/errors/domain-errors.js';

export interface UpdateUserInput {
  userId: string;
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  requesterId: string;
  requesterRole: Role;
}

export interface UpdateUserOutput {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  updatedAt: Date;
}

export class UpdateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly hasher: IHasher,
  ) {}

  async execute(input: UpdateUserInput): Promise<UpdateUserOutput> {
    // 1. Authorization check
    const isSelf = input.requesterId === input.userId;
    const isAdmin = input.requesterRole === Role.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenError('You can only update your own profile');
    }

    // Only admins can change roles
    if (input.role && !isAdmin) {
      throw new ForbiddenError('Only administrators can change user roles');
    }

    // 2. Find user
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    // 3. Update fields
    if (input.name) {
      user.updateName(input.name);
    }

    if (input.email && input.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(input.email);
      if (existingUser) {
        throw new UserAlreadyExistsError(input.email);
      }
      user.updateEmail(input.email.toLowerCase().trim());
    }

    if (input.password) {
      const hashedPassword = await this.hasher.hash(input.password);
      user.updatePassword(hashedPassword);
    }

    if (input.role) {
      user.updateRole(input.role);
    }

    const updatedUser = await this.userRepository.update(user);

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      updatedAt: updatedUser.updatedAt,
    };
  }
}
