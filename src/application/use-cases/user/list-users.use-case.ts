// ─── Use Case: List Users ─────────────────────────────────────────────────

import type {
  IUserRepository,
  ListUsersFilters,
  PaginationParams,
  PaginatedResult,
} from '../../../domain/repositories/user.repository.js';

export interface ListUsersInput {
  filters: ListUsersFilters;
  pagination: PaginationParams;
}

export interface ListUsersUserOutput {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: Date;
}

export type ListUsersOutput = PaginatedResult<ListUsersUserOutput>;

export class ListUsersUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: ListUsersInput): Promise<ListUsersOutput> {
    const result = await this.userRepository.list(input.filters, input.pagination);

    return {
      data: result.data.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
