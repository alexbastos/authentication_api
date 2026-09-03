// ─── Use Case: List Active Sessions ──────────────────────────────────────

import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';
import type { GeoLocation } from '../../../domain/entities/session.entity.js';

export interface SessionInfo {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  location: GeoLocation | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

export interface ListSessionsInput {
  userId: string;
  currentSessionId?: string;
}

export interface ListSessionsOutput {
  sessions: SessionInfo[];
}

export class ListSessionsUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: ListSessionsInput): Promise<ListSessionsOutput> {
    const activeSessions = await this.sessionRepository.findActiveByUserId(input.userId);

    const sessions: SessionInfo[] = activeSessions.map((session) => ({
      id: session.id,
      deviceName: session.deviceName,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      location: session.location,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      isCurrent: input.currentSessionId ? session.id === input.currentSessionId : false,
    }));

    return { sessions };
  }
}
