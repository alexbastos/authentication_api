// ─── Use Case: Validate Token ─────────────────────────────────────────────
// Used by API Gateway to validate incoming JWTs

import type { ITokenManager, TokenPayload } from '../../ports/token-manager.port.js';
import type { ICacheProvider } from '../../ports/cache.port.js';
import { InvalidTokenError, TokenRevokedError } from '../../../domain/errors/domain-errors.js';

const BLOCKLIST_PREFIX = 'blocklist:';

export interface ValidateTokenInput {
  token: string;
}

export interface ValidateTokenOutput {
  valid: boolean;
  payload: TokenPayload;
}

export class ValidateTokenUseCase {
  constructor(
    private readonly tokenManager: ITokenManager,
    private readonly cacheProvider: ICacheProvider,
  ) {}

  async execute(input: ValidateTokenInput): Promise<ValidateTokenOutput> {
    // 1. Verify JWT signature and expiration
    let payload: TokenPayload;
    try {
      payload = await this.tokenManager.verifyAccessToken(input.token);
    } catch {
      throw new InvalidTokenError('Token verification failed');
    }

    // 2. Check blocklist in Redis
    const isBlocked = await this.cacheProvider.exists(`${BLOCKLIST_PREFIX}${payload.jti}`);
    if (isBlocked) {
      throw new TokenRevokedError();
    }

    return {
      valid: true,
      payload,
    };
  }
}
