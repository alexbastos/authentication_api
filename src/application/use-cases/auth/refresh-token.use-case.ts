// ─── Use Case: Refresh Token ──────────────────────────────────────────────
// Implements Refresh Token Rotation with reuse detection

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import type { IGeoIpService } from '../../../infrastructure/geo/geoip.service.js';
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
  /** Client IP address (for session activity tracking) */
  ipAddress?: string;
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
    private readonly sessionRepository?: ISessionRepository,
    private readonly geoIpService?: IGeoIpService,
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
      // Also revoke the session
      if (this.sessionRepository) {
        await this.sessionRepository.revokeByFamily(existingToken.family);
      }
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

    // 6. Update session activity (lastSeenAt, IP, location)
    let sessionId: string | undefined;
    if (this.sessionRepository) {
      const session = await this.sessionRepository.findByFamily(existingToken.family);
      if (session && session.isActive) {
        const location = this.geoIpService?.lookup(input.ipAddress ?? '') ?? null;
        await this.sessionRepository.updateActivity(session.id, {
          ipAddress: input.ipAddress ?? null,
          location,
          lastSeenAt: new Date(),
        });
        sessionId = session.id;
      }
    }

    // 7. Generate new tokens
    const accessToken = await this.tokenManager.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
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
      ipAddress: input.ipAddress ?? existingToken.ipAddress,
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
