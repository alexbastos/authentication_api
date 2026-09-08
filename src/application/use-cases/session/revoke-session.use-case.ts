// ─── Use Case: Revoke Session ─────────────────────────────────────────────
// Revokes a logical session and all its associated refresh tokens.
// Idempotent: already-revoked or non-existent sessions return success silently.

import type { IAccountSecurityRepository } from '../../ports/account-security.port.js';

export interface RevokeSessionInput {
  userId: string;
  sessionId: string;
}

export class RevokeSessionUseCase {
  constructor(private readonly accountSecurityRepository: IAccountSecurityRepository) {}

  async execute(input: RevokeSessionInput): Promise<void> {
    await this.accountSecurityRepository.revokeSessionAndTokens(
      input.userId,
      input.sessionId,
    );
  }
}
