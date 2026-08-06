import type { VerificationToken } from '../entities/verification-token.entity.js';
import type { VerificationTokenType } from '../entities/role.entity.js';

export interface IVerificationTokenRepository {
  create(token: VerificationToken): Promise<VerificationToken>;
  findByTokenHash(tokenHash: string, type: VerificationTokenType): Promise<VerificationToken | null>;
  markAsUsed(id: string): Promise<void>;
  deleteByUserId(userId: string, type: VerificationTokenType): Promise<void>;
}
