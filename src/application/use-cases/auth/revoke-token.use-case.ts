// ─── Use Case: Revoke Token (Logout) ──────────────────────────────────────

import { InvalidTokenError } from '../../../domain/errors/domain-errors.js';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { DispatchEventUseCase } from '../webhook/dispatch-event.use-case.js';
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
    private readonly dispatchEventUC?: DispatchEventUseCase,
  ) {}

  async execute(input: RevokeTokenInput): Promise<void> {
    // 1. Add access token JTI to Redis blocklist
    let userId: string | null = null;
    try {
      const payload: TokenPayload = await this.tokenManager.verifyAccessToken(input.accessToken);
      userId = payload.sub;
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

    if (this.dispatchEventUC && userId) {
      this.dispatchEventUC.execute({
        event: WebhookEvent.USER_LOGOUT,
        payload: {
          userId,
          timestamp: new Date().toISOString(),
        },
      }).catch(console.error);
    }
  }
}
