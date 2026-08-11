// ─── Use Case: List Active Sessions ──────────────────────────────────────

import type { IRefreshTokenRepository } from '../../../domain/repositories/refresh-token.repository.js';

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

export interface ListSessionsInput {
  userId: string;
  currentTokenId?: string;
}

export interface ListSessionsOutput {
  sessions: SessionInfo[];
}

export class ListSessionsUseCase {
  constructor(
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  async execute(input: ListSessionsInput): Promise<ListSessionsOutput> {
    const activeTokens = await this.refreshTokenRepository.findActiveByUserId(input.userId);

    const sessions: SessionInfo[] = activeTokens.map((token) => ({
      id: token.id,
      deviceName: token.deviceName,
      ipAddress: token.ipAddress,
      userAgent: token.userAgent,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      isCurrent: input.currentTokenId ? token.id === input.currentTokenId : false,
    }));

    return { sessions };
  }
}
