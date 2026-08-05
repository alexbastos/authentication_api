// ─── Use Case: Authenticate User (email/password) ────────────────────────

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import {
  InvalidCredentialsError,
  UserInactiveError,
  UserNotFoundError,
} from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';

export interface AuthenticateUserInput {
  email: string;
  password: string;
}

export interface AuthenticateUserOutput {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export class AuthenticateUserUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly hasher: IHasher,
    private readonly tokenManager: ITokenManager,
    private readonly refreshTokenExpiryDays: number = 7,
  ) {}

  async execute(input: AuthenticateUserInput): Promise<AuthenticateUserOutput> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    if (!user.isActive) {
      throw new UserInactiveError();
    }

    if (!user.hasPassword) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await this.hasher.compare(input.password, user.passwordHash!);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
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
      },
    };
  }
}
