// ─── Use Case: Revoke Session ─────────────────────────────────────────────

import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';
import { SessionNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface RevokeSessionInput {
  userId: string;
  sessionId: string;
}

export class RevokeSessionUseCase {
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(input: RevokeSessionInput): Promise<void> {
    const token = await this.refreshTokenRepository.findById(input.sessionId);

    if (!token || token.userId !== input.userId) {
      throw new SessionNotFoundError(input.sessionId);
    }

    if (token.isRevoked || token.isExpired) {
      throw new SessionNotFoundError(input.sessionId);
    }

    await this.refreshTokenRepository.revokeById(input.sessionId);
  }
}
