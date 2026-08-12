// ─── Prisma Organization Repository ───────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import { Organization, OrganizationMember } from '../../../domain/entities/organization.entity.js';
import { OrgRole } from '../../../domain/entities/role.entity.js';

export class PrismaOrganizationRepository implements IOrganizationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(org: Organization): Promise<Organization> {
    const data = org.toJSON();
    const record = await this.prisma.organization.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        description: data.description,
        logoUrl: data.logoUrl,
        isActive: data.isActive,
      },
    });
    return this.toDomain(record);
  }

  async findById(id: string): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    const record = await this.prisma.organization.findUnique({ where: { slug } });
    return record ? this.toDomain(record) : null;
  }

  async update(org: Organization): Promise<Organization> {
    const data = org.toJSON();
    const record = await this.prisma.organization.update({
      where: { id: data.id },
      data: {
        name: data.name,
        description: data.description,
        logoUrl: data.logoUrl,
        isActive: data.isActive,
      },
    });
    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.organization.delete({ where: { id } });
  }

  async listByUserId(userId: string): Promise<Array<Organization & { memberRole: OrgRole }>> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => {
      const org = this.toDomain(m.organization);
      return Object.assign(org, { memberRole: m.role as OrgRole });
    });
  }

  // ─── Members ────────────────────────────────────────────────────────────

  async addMember(organizationId: string, userId: string, role: OrgRole): Promise<OrganizationMember> {
    const record = await this.prisma.organizationMember.create({
      data: { organizationId, userId, role: role as any },
      include: { user: { select: { name: true, email: true } } },
    });
    return this.toMemberDomain(record);
  }

  async removeMember(organizationId: string, userId: string): Promise<void> {
    await this.prisma.organizationMember.deleteMany({
      where: { organizationId, userId },
    });
  }

  async findMember(organizationId: string, userId: string): Promise<OrganizationMember | null> {
    const record = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { user: { select: { name: true, email: true } } },
    });
    return record ? this.toMemberDomain(record) : null;
  }

  async listMembers(organizationId: string): Promise<OrganizationMember[]> {
    const records = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return records.map((r) => this.toMemberDomain(r));
  }

  async updateMemberRole(organizationId: string, userId: string, role: OrgRole): Promise<OrganizationMember> {
    const record = await this.prisma.organizationMember.update({
      where: { userId_organizationId: { userId, organizationId } },
      data: { role: role as any },
      include: { user: { select: { name: true, email: true } } },
    });
    return this.toMemberDomain(record);
  }

  private toDomain(record: any): Organization {
    return new Organization({
      id: record.id,
      name: record.name,
      slug: record.slug,
      description: record.description,
      logoUrl: record.logoUrl,
      isActive: record.isActive,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toMemberDomain(record: any): OrganizationMember {
    return new OrganizationMember({
      id: record.id,
      userId: record.userId,
      organizationId: record.organizationId,
      role: record.role as OrgRole,
      joinedAt: record.joinedAt,
      userName: record.user?.name,
      userEmail: record.user?.email,
    });
  }
}
