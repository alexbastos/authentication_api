// ─── Use Case: Refresh Token ──────────────────────────────────────────────
// Implements Refresh Token Rotation with reuse detection

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import { RefreshToken } from '../../../domain/entities/refresh-token.entity.js';
import {
  InvalidTokenError,
  TokenExpiredError,
  TokenRevokedError,
  RefreshTokenReusedError,
  UserNotFoundError,
  UserInactiveError,
} from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface RefreshTokenOutput {
  accessToken: string;
  refreshToken: string;
}

export class RefreshTokenUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenManager: ITokenManager,
    private readonly refreshTokenExpiryDays: number = 7,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    // 1. Find the refresh token
    const existingToken = await this.refreshTokenRepository.findByToken(input.refreshToken);
    if (!existingToken) {
      throw new InvalidTokenError('Refresh token not found');
    }

    // 2. Detect token reuse — if already revoked, revoke the entire family
    if (existingToken.isRevoked) {
      await this.refreshTokenRepository.revokeAllByFamily(existingToken.family);
      throw new RefreshTokenReusedError();
    }

    // 3. Check expiration
    if (existingToken.isExpired) {
      throw new TokenExpiredError();
    }

    // 4. Verify user still exists and is active
    const user = await this.userRepository.findById(existingToken.userId);
    if (!user) {
      throw new UserNotFoundError(existingToken.userId);
    }
    if (!user.isActive) {
      throw new UserInactiveError();
    }

    // 5. Revoke the old refresh token (rotation)
    await this.refreshTokenRepository.revokeByToken(existingToken.token);

    // 6. Generate new tokens
    const accessToken = await this.tokenManager.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const newRefreshTokenValue = this.tokenManager.generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiryDays);

    const newRefreshToken = new RefreshToken({
      id: uuidv4(),
      token: newRefreshTokenValue,
      userId: user.id,
      family: existingToken.family, // Same family for reuse detection
      userAgent: existingToken.userAgent,
      ipAddress: existingToken.ipAddress,
      deviceName: existingToken.deviceName,
      expiresAt,
      createdAt: new Date(),
      revokedAt: null,
    });

    await this.refreshTokenRepository.create(newRefreshToken);

    return {
      accessToken,
      refreshToken: newRefreshTokenValue,
    };
  }
}
