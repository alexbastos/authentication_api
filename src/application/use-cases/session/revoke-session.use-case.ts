// ─── Use Case: Revoke Session ─────────────────────────────────────────────
// Revokes a logical session and all its associated refresh tokens.
// Idempotent: already-revoked or non-existent sessions return success silently.

import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';
import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';

export interface RevokeSessionInput {
  userId: string;
  sessionId: string;
}

export class RevokeSessionUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(input: RevokeSessionInput): Promise<void> {
    const session = await this.sessionRepository.findById(input.sessionId);

    // Idempotent: if session doesn't exist, belongs to another user,
    // or is already revoked/expired, return silently
    if (!session || session.userId !== input.userId || !session.isActive) {
      return;
    }

    // Revoke the session
    await this.sessionRepository.revokeById(session.id);

    // Revoke all refresh tokens in the same family
    await this.refreshTokenRepository.revokeAllByFamily(session.family);
  }
}
