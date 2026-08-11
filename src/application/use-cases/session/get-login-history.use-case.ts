// ─── Use Case: Get Login History ──────────────────────────────────────────

import type { ILoginHistoryRepository } from '../../../domain/repositories/login-history.repository.js';
import type { PaginatedResult } from '../../../domain/repositories/user.repository.js';
import type { LoginHistory } from '../../../domain/entities/login-history.entity.js';

export interface GetLoginHistoryInput {
  userId: string;
  page: number;
  limit: number;
}

export class GetLoginHistoryUseCase {
  constructor(
    private readonly loginHistoryRepository: ILoginHistoryRepository,
  ) {}

  async execute(input: GetLoginHistoryInput): Promise<PaginatedResult<LoginHistory>> {
    return this.loginHistoryRepository.findByUserId(input.userId, {
      page: input.page,
      limit: input.limit,
    });
  }
}
