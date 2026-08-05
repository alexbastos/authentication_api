// ─── Use Case: Delete User (Soft Delete) ──────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { Role } from '../../../domain/entities/role.entity.js';
import {
  UserNotFoundError,
  ForbiddenError,
} from '../../../domain/errors/domain-errors.js';

export interface DeleteUserInput {
  userId: string;
  requesterId: string;
  requesterRole: Role;
}

export class DeleteUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(input: DeleteUserInput): Promise<void> {
    // 1. Only admins or the user themselves can deactivate
    const isSelf = input.requesterId === input.userId;
    const isAdmin = input.requesterRole === Role.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenError('You can only deactivate your own account');
    }

    // 2. Find user
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    // 3. Soft delete: deactivate user
    user.deactivate();
    await this.userRepository.update(user);

    // 4. Revoke all refresh tokens
    await this.refreshTokenRepository.revokeAllByUserId(input.userId);
  }
}
