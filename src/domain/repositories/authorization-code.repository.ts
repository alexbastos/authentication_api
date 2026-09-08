import type { AuthorizationCode } from '../entities/authorization-code.entity.js';

export interface IAuthorizationCodeRepository {
  create(code: AuthorizationCode): Promise<AuthorizationCode>;
  findByCode(code: string): Promise<AuthorizationCode | null>;
  consume(id: string): Promise<boolean>;
  deleteExpired(): Promise<number>;
}
