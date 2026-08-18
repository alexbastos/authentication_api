// ─── Prisma Permission Repository ─────────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IPermissionRepository } from '../../../domain/repositories/permission.repository.js';
import { Permission } from '../../../domain/entities/permission.entity.js';

export class PrismaPermissionRepository implements IPermissionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<Permission[]> {
    const records = await this.prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByCode(code: string): Promise<Permission | null> {
    const record = await this.prisma.permission.findUnique({ where: { code } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByCodes(codes: string[]): Promise<Permission[]> {
    const records = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByCategory(category: string): Promise<Permission[]> {
    const records = await this.prisma.permission.findMany({
      where: { category },
      orderBy: { code: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  private toDomain(record: any): Permission {
    return new Permission({
      id: record.id,
      code: record.code,
      description: record.description,
      category: record.category,
    });
  }
}
