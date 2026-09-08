// ─── Use Case: Revoke Token (Logout) ──────────────────────────────────────

import { InvalidTokenError } from '../../../domain/errors/domain-errors.js';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { DispatchEventUseCase } from '../webhook/dispatch-event.use-case.js';
import type { ITokenManager, TokenPayload } from '../../ports/token-manager.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import type { IAccountSecurityRepository } from '../../ports/account-security.port.js';

const BLOCKLIST_PREFIX = 'blocklist:';

export interface RevokeTokenInput {
  accessToken: string;
  refreshToken?: string;
}

export class RevokeTokenUseCase {
  constructor(
    private readonly tokenManager: ITokenManager,
    private readonly cacheProvider: ICacheProvider,
    private readonly accountSecurityRepository: IAccountSecurityRepository,
    private readonly dispatchEventUC?: DispatchEventUseCase,
  ) {}

  async execute(input: RevokeTokenInput): Promise<void> {
    let payload: TokenPayload;
    try {
      payload = await this.tokenManager.verifyAccessToken(input.accessToken);
    } catch {
      throw new InvalidTokenError('A valid access token is required for logout');
    }
    if (!payload.sid) throw new InvalidTokenError('Session identifier is missing');

    await this.accountSecurityRepository.revokeSessionAndTokens(
      payload.sub,
      payload.sid,
    );

    const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);
    if (remainingTtl > 0) {
      await this.cacheProvider.set(
        `${BLOCKLIST_PREFIX}${payload.jti}`,
        '1',
        remainingTtl,
      );
    }

    if (this.dispatchEventUC) {
      this.dispatchEventUC.execute({
        event: WebhookEvent.USER_LOGOUT,
        payload: {
          userId: payload.sub,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => undefined);
    }
  }
}
