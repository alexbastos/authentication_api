// ─── Use Case: Link Social Account ────────────────────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { ISocialAuthProviderRegistry } from '../../ports/social-auth.port.js';
import type { SocialProvider } from '../../../domain/entities/role.entity.js';
import {
  UserNotFoundError,
  SocialAuthError,
} from '../../../domain/errors/domain-errors.js';

export interface LinkSocialAccountInput {
  userId: string;
  provider: SocialProvider;
  token: string;
}

export interface LinkSocialAccountOutput {
  message: string;
  provider: string;
}

export class LinkSocialAccountUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly socialProviderRegistry: ISocialAuthProviderRegistry,
  ) {}

  async execute(input: LinkSocialAccountInput): Promise<LinkSocialAccountOutput> {
    // 1. Verify user exists
    const user = await this.userRepository.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError(input.userId);
    }

    // 2. Check if already linked
    if (user.hasSocialProvider(input.provider)) {
      return {
        message: `Social account ${input.provider} is already linked`,
        provider: input.provider,
      };
    }

    // 3. Validate the social token
    const socialAuthProvider = this.socialProviderRegistry.getProvider(input.provider);
    if (!socialAuthProvider) {
      throw new SocialAuthError(input.provider, 'Provider not supported');
    }

    let socialUserInfo;
    try {
      socialUserInfo = await socialAuthProvider.getUserInfo(input.token);
    } catch (error) {
      throw new SocialAuthError(
        input.provider,
        error instanceof Error ? error.message : 'Failed to validate social token',
      );
    }

    // 4. Check if this social account is already linked to another user
    const existingUser = await this.userRepository.findByProvider(
      input.provider,
      socialUserInfo.providerAccountId,
    );
    if (existingUser && existingUser.id !== user.id) {
      throw new SocialAuthError(
        input.provider,
        'This social account is already linked to another user',
      );
    }

    // 5. Link the social account
    await this.userRepository.addSocialAccount(user.id, {
      provider: input.provider,
      providerAccountId: socialUserInfo.providerAccountId,
    });

    return {
      message: `Social account ${input.provider} linked successfully`,
      provider: input.provider,
    };
  }
}
