// ─── Use Case: Unlink Social Account ──────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { SocialProvider } from '../../../domain/entities/role.entity.js';
import {
  UserNotFoundError,
  CannotRemoveLastAuthMethodError,
  SocialAccountNotLinkedError,
} from '../../../domain/errors/domain-errors.js';

export interface UnlinkSocialAccountInput {
  userId: string;
  provider: SocialProvider;
}

export interface UnlinkSocialAccountOutput {
  message: string;
  provider: string;
}

export class UnlinkSocialAccountUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: UnlinkSocialAccountInput): Promise<UnlinkSocialAccountOutput> {
    // 1. Verify user exists
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    // 2. Check if the provider is linked
    if (!user.hasSocialProvider(input.provider)) {
      throw new SocialAccountNotLinkedError(input.provider);
    }

    // 3. Check if removing would leave user with no auth method
    try {
      user.removeSocialProvider(input.provider);
    } catch {
      throw new CannotRemoveLastAuthMethodError();
    }

    // 4. Remove from database
    await this.userRepository.removeSocialAccount(user.id, input.provider);

    return {
      message: `Social account ${input.provider} unlinked successfully`,
      provider: input.provider,
    };
  }
}
