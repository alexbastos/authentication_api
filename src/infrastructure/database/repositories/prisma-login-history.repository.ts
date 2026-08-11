// ─── Prisma Login History Repository ──────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { ILoginHistoryRepository } from '../../../domain/repositories/login-history.repository.js';
import type { PaginationParams, PaginatedResult } from '../../../domain/repositories/user.repository.js';
import { LoginHistory } from '../../../domain/entities/login-history.entity.js';
import { LoginStatus, LoginMethod } from '../../../domain/entities/role.entity.js';

export class PrismaLoginHistoryRepository implements ILoginHistoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(entry: LoginHistory): Promise<LoginHistory> {
    const record = await this.prisma.loginHistory.create({
      data: {
        id: entry.id,
        userId: entry.userId,
        email: entry.email,
        status: entry.status as any,
        method: entry.method as any,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        deviceName: entry.deviceName,
        failReason: entry.failReason,
      },
    });

    return this.toDomain(record);
  }

  async findByUserId(userId: string, pagination: PaginationParams): Promise<PaginatedResult<LoginHistory>> {
    const where = { userId };

    const [records, total] = await Promise.all([
      this.prisma.loginHistory.findMany({
        where,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.loginHistory.count({ where }),
    ]);

    return {
      data: records.map((r) => this.toDomain(r)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  private toDomain(record: any): LoginHistory {
    return new LoginHistory({
      id: record.id,
      userId: record.userId,
      email: record.email,
      status: record.status as LoginStatus,
      method: record.method as LoginMethod,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      deviceName: record.deviceName,
      failReason: record.failReason,
      createdAt: record.createdAt,
    });
  }
}
