import type { RefreshToken } from '../entities/refresh-token.entity.js';

export interface IRefreshTokenRepository {
  create(refreshToken: RefreshToken): Promise<RefreshToken>;
  findByToken(token: string): Promise<RefreshToken | null>;
  findById(id: string): Promise<RefreshToken | null>;
  findActiveByUserId(userId: string): Promise<RefreshToken[]>;
  revokeByToken(token: string): Promise<void>;
  revokeById(id: string): Promise<void>;
  revokeAllByUserId(userId: string): Promise<void>;
  revokeAllByFamily(family: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
