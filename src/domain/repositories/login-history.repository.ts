import type { LoginHistory } from '../entities/login-history.entity.js';
import type { PaginatedResult, PaginationParams } from './user.repository.js';

export interface ILoginHistoryRepository {
  create(entry: LoginHistory): Promise<LoginHistory>;
  findByUserId(userId: string, pagination: PaginationParams): Promise<PaginatedResult<LoginHistory>>;
}
