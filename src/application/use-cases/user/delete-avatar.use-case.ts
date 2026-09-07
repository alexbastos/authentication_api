// ─── Use Case: Delete Avatar ──────────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IStorageService } from '../../ports/storage.port.js';
import { UserNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface DeleteAvatarInput {
  userId: string;
}

export interface DeleteAvatarOutput {
  message: string;
}

export class DeleteAvatarUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly storageService: IStorageService,
  ) {}

  async execute(input: DeleteAvatarInput): Promise<DeleteAvatarOutput> {
    const { userId } = input;

    // 1. Find user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    // 2. Delete avatar from S3 if exists
    const currentAvatarKey = user.profile.avatarUrl;
    if (currentAvatarKey && !currentAvatarKey.startsWith('http')) {
      try {
        await this.storageService.delete(currentAvatarKey);
      } catch {
        // If deletion fails, still clear the reference
      }
    }

    // 3. Clear avatar URL from profile
    user.updateProfile({ avatarUrl: null });
    await this.userRepository.update(user);

    return {
      message: 'Avatar removed successfully',
    };
  }
}
