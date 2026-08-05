// ─── Use Case: Authenticate with Social Provider ─────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import type { ISocialAuthProviderRegistry } from '../../ports/social-auth.port.js';
import { User } from '../../../domain/entities/user.entity.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import { Role, UserStatus, SocialProvider } from '../../../domain/entities/role.entity.js';
import { SocialAuthError } from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuthenticateSocialInput {
  provider: SocialProvider;
  token: string; // ID token or access token from the social provider
}

export interface AuthenticateSocialOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  isNewUser: boolean;
}

export class AuthenticateSocialUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenManager: ITokenManager,
    private readonly socialProviderRegistry: ISocialAuthProviderRegistry,
    private readonly refreshTokenExpiryDays: number = 7,
  ) {}

  async execute(input: AuthenticateSocialInput): Promise<AuthenticateSocialOutput> {
    // 1. Get the provider implementation
    const socialProvider = this.socialProviderRegistry.getProvider(input.provider);
    if (!socialProvider) {
      throw new SocialAuthError(input.provider, 'Provider not supported');
    }

    // 2. Validate token and get user info from the social provider
    let socialUserInfo;
    try {
      socialUserInfo = await socialProvider.getUserInfo(input.token);
    } catch (error) {
      throw new SocialAuthError(
        input.provider,
        error instanceof Error ? error.message : 'Failed to validate social token',
      );
    }

    // 3. Check if user exists by provider+providerAccountId first
    let user = await this.userRepository.findByProvider(
      input.provider,
      socialUserInfo.providerAccountId,
    );

    let isNewUser = false;

    if (!user) {
      // 4. Check if user exists by email
      user = await this.userRepository.findByEmail(socialUserInfo.email);

      if (user) {
        // 5a. User exists but without this social link — add the link
        await this.userRepository.addSocialAccount(user.id, {
          provider: input.provider,
          providerAccountId: socialUserInfo.providerAccountId,
        });
      } else {
        // 5b. User doesn't exist — auto-register
        isNewUser = true;
        const now = new Date();
        user = new User({
          id: uuidv4(),
          name: socialUserInfo.name,
          email: socialUserInfo.email,
          passwordHash: null, // Social users don't have passwords
          role: Role.USER,
          status: UserStatus.ACTIVE,
          socialAccounts: [
            {
              provider: input.provider,
              providerAccountId: socialUserInfo.providerAccountId,
            },
          ],
          createdAt: now,
          updatedAt: now,
        });

        user = await this.userRepository.create(user);
      }
    }

    // 6. Generate internal tokens
    const accessToken = await this.tokenManager.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = this.tokenManager.generateRefreshToken();
    const family = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiryDays);

    const refreshToken = new RefreshToken({
      id: uuidv4(),
      token: refreshTokenValue,
      userId: user.id,
      family,
      expiresAt,
      createdAt: new Date(),
      revokedAt: null,
    });

    await this.refreshTokenRepository.create(refreshToken);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      isNewUser,
    };
  }
}
