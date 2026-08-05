// ─── Use Case: Revoke Token (Logout) ──────────────────────────────────────

import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import type { ITokenManager, TokenPayload } from '../../ports/token-manager.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';

const BLOCKLIST_PREFIX = 'blocklist:';

export interface RevokeTokenInput {
  accessToken: string;
  refreshToken?: string;
}

export class RevokeTokenUseCase {
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    private readonly tokenManager: ITokenManager,
    private readonly cacheProvider: ICacheProvider,
  ) {}

  async execute(input: RevokeTokenInput): Promise<void> {
    // 1. Add access token JTI to Redis blocklist
    try {
      const payload: TokenPayload = await this.tokenManager.verifyAccessToken(input.accessToken);
      const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);
      if (remainingTtl > 0) {
        await this.cacheProvider.set(
          `${BLOCKLIST_PREFIX}${payload.jti}`,
          '1',
          remainingTtl,
        );
      }
    } catch {
      // Token might already be expired — still revoke refresh token
    }

    // 2. Revoke refresh token in the database
    if (input.refreshToken) {
      await this.refreshTokenRepository.revokeByToken(input.refreshToken);
    }
  }
}
