import type { User } from '../entities/user.entity.js';
import type { SocialProvider, Role, UserStatus } from '../entities/role.entity.js';
import type { ProviderInfo } from '../entities/user.entity.js';

export interface ListUsersFilters {
  role?: Role;
  status?: UserStatus;
  search?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByProvider(provider: SocialProvider, providerAccountId: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
  list(filters: ListUsersFilters, pagination: PaginationParams): Promise<PaginatedResult<User>>;
  addSocialAccount(userId: string, providerInfo: ProviderInfo): Promise<void>;
  removeSocialAccount(userId: string, provider: SocialProvider): Promise<void>;
}
