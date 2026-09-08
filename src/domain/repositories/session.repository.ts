import type { Session } from '../entities/session.entity.js';
import type { GeoLocation } from '../entities/session.entity.js';

export interface ISessionRepository {
  create(session: Session): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  findByFamily(family: string): Promise<Session | null>;
  findActiveByUserId(userId: string): Promise<Session[]>;
  updateActivity(id: string, data: {
    ipAddress: string | null;
    location: GeoLocation | null;
    lastSeenAt: Date;
  }): Promise<void>;
  revokeById(id: string): Promise<void>;
  revokeByFamily(family: string): Promise<void>;
  revokeAllByUserId(userId: string): Promise<void>;
}
