// ─── Use Case: Authenticate User (email/password) ────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import {
  InvalidCredentialsError,
  UserInactiveError,
  EmailNotVerifiedError,
  AccountLockedError,
} from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';

const BRUTE_FORCE_PREFIX = 'login_attempts:';

export interface AuthenticateUserInput {
  email: string;
  password: string;
  /** IP or identifier for brute force tracking */
  identifier?: string;
}

export interface AuthenticateUserOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    emailVerified: boolean;
  };
}

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly hasher: IHasher,
    private readonly tokenManager: ITokenManager,
    private readonly refreshTokenExpiryDays: number = 7,
    private readonly cacheProvider?: ICacheProvider,
    private readonly maxLoginAttempts: number = 5,
    private readonly lockoutMinutes: number = 15,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserOutput> {
    const lockKey = `${BRUTE_FORCE_PREFIX}${input.identifier ?? input.email}`;
    const lockoutTtl = this.lockoutMinutes * 60;

    // Check if account/IP is locked
    if (this.cacheProvider) {
      const attempts = await this.cacheProvider.get(lockKey);
      if (attempts && parseInt(attempts, 10) >= this.maxLoginAttempts) {
        throw new AccountLockedError(this.lockoutMinutes);
      }
    }

    const user = await this.userRepository.findByEmail(input.email);

    if (!user || !user.hasPassword) {
      await this.recordFailedAttempt(lockKey, lockoutTtl);
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new UserInactiveError();
    }

    const isPasswordValid = await this.hasher.compare(input.password, user.passwordHash!);
    if (!isPasswordValid) {
      await this.recordFailedAttempt(lockKey, lockoutTtl);
      throw new InvalidCredentialsError();
    }

    // Require email verification before granting access
    if (!user.emailVerified) {
      throw new EmailNotVerifiedError();
    }

    // Success: clear failed attempts counter
    if (this.cacheProvider) {
      await this.cacheProvider.del(lockKey);
    }

    // Generate tokens
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
        emailVerified: user.emailVerified,
      },
    };
  }

  private async recordFailedAttempt(lockKey: string, ttlSeconds: number): Promise<void> {
    if (this.cacheProvider) {
      await this.cacheProvider.increment(lockKey, ttlSeconds);
    }
  }
}
