// ─── Prisma Custom Role Repository ────────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import { CustomRole } from '../../../domain/entities/permission.entity.js';
import { Permission } from '../../../domain/entities/permission.entity.js';

const ROLE_INCLUDE = {
  permissions: {
    include: { permission: true },
  },
} as const;

export class PrismaCustomRoleRepository implements ICustomRoleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(role: CustomRole): Promise<CustomRole> {
    const data = role.toJSON();
    const record = await this.prisma.customRole.create({
      data: {
        id: data.id,
        name: data.name,
        description: data.description,
        organizationId: data.organizationId,
        isSystem: data.isSystem,
        permissions: {
          create: data.permissions.map((p) => ({
            permissionId: p.id,
          })),
        },
      },
      include: ROLE_INCLUDE,
    });
    return this.toDomain(record);
  }

  async findById(id: string): Promise<CustomRole | null> {
    const record = await this.prisma.customRole.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByNameAndOrg(name: string, organizationId: string | null): Promise<CustomRole | null> {
    const record = await this.prisma.customRole.findUnique({
      where: { name_organizationId: { name, organizationId: organizationId ?? '' } },
      include: ROLE_INCLUDE,
    });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(organizationId?: string | null): Promise<CustomRole[]> {
    const where = organizationId !== undefined
      ? { OR: [{ organizationId: null }, { organizationId }] }
      : {};

    const records = await this.prisma.customRole.findMany({
      where,
      include: ROLE_INCLUDE,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async update(role: CustomRole): Promise<CustomRole> {
    const data = role.toJSON();

    // Replace all permissions (delete + create)
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId: data.id } }),
      this.prisma.customRole.update({
        where: { id: data.id },
        data: {
          name: data.name,
          description: data.description,
          permissions: {
            create: data.permissions.map((p) => ({
              permissionId: p.id,
            })),
          },
        },
      }),
    ]);

    return (await this.findById(data.id))!;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.customRole.delete({ where: { id } });
  }

  async findByUserId(userId: string, organizationId?: string | null): Promise<CustomRole[]> {
    const where: any = { userId };
    if (organizationId !== undefined) {
      where.organizationId = organizationId;
    }

    const userRoles = await this.prisma.userRole.findMany({
      where,
      include: {
        role: { include: ROLE_INCLUDE },
      },
    });
    return userRoles.map((ur) => this.toDomain(ur.role));
  }

  async assignToUser(userId: string, roleId: string, organizationId?: string | null): Promise<void> {
    await this.prisma.userRole.create({
      data: {
        userId,
        roleId,
        organizationId: organizationId ?? null,
      },
    });
  }

  async removeFromUser(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.delete({
      where: { userId_roleId: { userId, roleId } },
    });
  }

  async getUserPermissionCodes(userId: string, organizationId?: string | null): Promise<string[]> {
    const where: any = { userId };
    if (organizationId !== undefined) {
      where.organizationId = organizationId;
    }

    const userRoles = await this.prisma.userRole.findMany({
      where,
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissionSet = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of (ur.role as any).permissions) {
        permissionSet.add(rp.permission.code);
      }
    }

    return Array.from(permissionSet);
  }

  private toDomain(record: any): CustomRole {
    const permissions = (record.permissions ?? []).map((rp: any) =>
      new Permission({
        id: rp.permission.id,
        code: rp.permission.code,
        description: rp.permission.description,
        category: rp.permission.category,
      }),
    );

    return new CustomRole({
      id: record.id,
      name: record.name,
      description: record.description,
      organizationId: record.organizationId,
      isSystem: record.isSystem,
      createdAt: record.createdAt,
      permissions,
    });
  }
}
