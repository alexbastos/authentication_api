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

    // 2. Clear the database reference first so a storage failure cannot keep a
    // broken avatar in the public profile.
    const currentAvatarKey = user.profile.avatarUrl;
    if (!currentAvatarKey) {
      return {
        message: 'Avatar removed successfully',
      };
    }

    user.updateProfile({ avatarUrl: null });
    await this.userRepository.update(user);

    // 3. Remove the now-unreferenced object best-effort. Orphans can be cleaned
    // by bucket lifecycle policy without making the API operation fail.
    if (!currentAvatarKey.startsWith('http')) {
      await this.storageService.delete(currentAvatarKey).catch(() => undefined);
    }

    return {
      message: 'Avatar removed successfully',
    };
  }
}
