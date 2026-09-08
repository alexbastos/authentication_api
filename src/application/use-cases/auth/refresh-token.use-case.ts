// ─── Use Case: Refresh Token ──────────────────────────────────────────────
// Implements Refresh Token Rotation with reuse detection

import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';
import type { ITokenManager } from '../../ports/token-manager.port.js';
import type { ISecureTokenService } from '../../ports/secure-token.port.js';
import type { IGeoIpService } from '../../ports/geo-ip.port.js';
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
    private readonly secureTokenService?: ISecureTokenService,
  ) {}

  async execute(input: RefreshTokenInput): Promise<RefreshTokenOutput> {
    // 1. Find the refresh token
    const tokenDigest = this.secureTokenService?.digest(input.refreshToken) ?? input.refreshToken;
    let existingToken = await this.refreshTokenRepository.findByToken(tokenDigest);
    if (!existingToken && tokenDigest !== input.refreshToken) {
      existingToken = await this.refreshTokenRepository.findByToken(input.refreshToken);
    }
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

    // 5. Update session activity (lastSeenAt, IP, location)
    let sessionId: string | undefined;
    if (this.sessionRepository) {
      const session = await this.sessionRepository.findByFamily(existingToken.family);
      if (!session || !session.isActive || session.userId !== user.id) {
        await this.refreshTokenRepository.revokeAllByFamily(existingToken.family);
        throw new TokenRevokedError();
      }
      const location = this.geoIpService?.lookup(input.ipAddress ?? '') ?? null;
      await this.sessionRepository.updateActivity(session.id, {
        ipAddress: input.ipAddress ?? null,
        location,
        lastSeenAt: new Date(),
      });
      sessionId = session.id;
    }

    // 6. Rotate in one database transaction. Only one concurrent request can
    // consume the old token; a loser triggers family-wide reuse handling.
    const newRefreshTokenValue = this.tokenManager.generateRefreshToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiryDays);

    const newRefreshToken = new RefreshToken({
      id: uuidv4(),
      token: this.secureTokenService?.digest(newRefreshTokenValue) ?? newRefreshTokenValue,
      userId: user.id,
      family: existingToken.family, // Same family for reuse detection
      userAgent: existingToken.userAgent,
      ipAddress: input.ipAddress ?? existingToken.ipAddress,
      deviceName: existingToken.deviceName,
      expiresAt,
      createdAt: new Date(),
      revokedAt: null,
    });

    const rotated = await this.refreshTokenRepository.rotate(existingToken.id, newRefreshToken);
    if (!rotated) {
      await this.refreshTokenRepository.revokeAllByFamily(existingToken.family);
      if (this.sessionRepository) await this.sessionRepository.revokeByFamily(existingToken.family);
      throw new RefreshTokenReusedError();
    }

    const accessToken = await this.tokenManager.generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    });

    return {
      accessToken,
      refreshToken: newRefreshTokenValue,
    };
  }
}
