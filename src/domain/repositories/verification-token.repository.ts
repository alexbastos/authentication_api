import type { VerificationToken } from '../entities/verification-token.entity.js';
import type { VerificationTokenType } from '../entities/role.entity.js';

export interface IVerificationTokenRepository {
  create(token: VerificationToken): Promise<VerificationToken>;
  findByTokenHash(tokenHash: string, type: VerificationTokenType): Promise<VerificationToken | null>;
  findActiveByUserId(userId: string, type: VerificationTokenType): Promise<VerificationToken | null>;
  consume(id: string): Promise<boolean>;
  deleteByUserId(userId: string, type: VerificationTokenType): Promise<void>;
  findLatestByUserIdAndType(userId: string, type: VerificationTokenType): Promise<VerificationToken | null>;
}
