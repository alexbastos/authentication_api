// ─── Prisma User Repository ───────────────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IUserRepository, ListUsersFilters, PaginationParams, PaginatedResult } from '../../../domain/repositories/user.repository.js';
import { User, type ProviderInfo } from '../../../domain/entities/user.entity.js';
import { SocialProvider, Role, UserStatus } from '../../../domain/entities/role.entity.js';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { id },
      include: { socialAccounts: true },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { socialAccounts: true },
    });

    if (!record) return null;
    return this.toDomain(record);
  }

  async findByProvider(provider: SocialProvider, providerAccountId: string): Promise<User | null> {
    const socialAccount = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: {
        user: {
          include: { socialAccounts: true },
        },
      },
    });

    if (!socialAccount) return null;
    return this.toDomain(socialAccount.user);
  }

  async create(user: User): Promise<User> {
    const data = user.toJSON();
    const record = await this.prisma.user.create({
      data: {
        id: data.id,
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role as any,
        status: data.status as any,
        socialAccounts: {
          create: data.socialAccounts.map((sa) => ({
            provider: sa.provider,
            providerAccountId: sa.providerAccountId,
          })),
        },
      },
      include: { socialAccounts: true },
    });

    return this.toDomain(record);
  }

  async update(user: User): Promise<User> {
    const data = user.toJSON();
    const record = await this.prisma.user.update({
      where: { id: data.id },
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role as any,
        status: data.status as any,
      },
      include: { socialAccounts: true },
    });

    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async list(filters: ListUsersFilters, pagination: PaginationParams): Promise<PaginatedResult<User>> {
    const where: any = {};

    if (filters.role) where.role = filters.role;
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [records, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { socialAccounts: true },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: records.map((r) => this.toDomain(r)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async addSocialAccount(userId: string, providerInfo: ProviderInfo): Promise<void> {
    await this.prisma.socialAccount.create({
      data: {
        userId,
        provider: providerInfo.provider,
        providerAccountId: providerInfo.providerAccountId,
      },
    });
  }

  private toDomain(record: any): User {
    return new User({
      id: record.id,
      name: record.name,
      email: record.email,
      passwordHash: record.passwordHash,
      role: record.role as Role,
      status: record.status as UserStatus,
      socialAccounts: (record.socialAccounts || []).map((sa: any) => ({
        provider: sa.provider as SocialProvider,
        providerAccountId: sa.providerAccountId,
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
