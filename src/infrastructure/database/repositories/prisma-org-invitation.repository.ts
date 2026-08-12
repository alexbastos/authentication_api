// ─── Prisma OrgInvitation Repository ──────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IOrgInvitationRepository } from '../../../domain/repositories/org-invitation.repository.js';
import { OrgInvitation } from '../../../domain/entities/org-invitation.entity.js';
import type { OrgRole } from '../../../domain/entities/role.entity.js';

export class PrismaOrgInvitationRepository implements IOrgInvitationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(invitation: OrgInvitation): Promise<OrgInvitation> {
    const data = invitation.toJSON();
    const record = await this.prisma.orgInvitation.create({
      data: {
        id: data.id,
        email: data.email,
        organizationId: data.organizationId,
        role: data.role as any,
        invitedBy: data.invitedBy,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
      include: { organization: { select: { name: true } } },
    });
    return this.toDomain(record);
  }

  async findByTokenHash(tokenHash: string): Promise<OrgInvitation | null> {
    const record = await this.prisma.orgInvitation.findUnique({
      where: { tokenHash },
      include: { organization: { select: { name: true } } },
    });
    return record ? this.toDomain(record) : null;
  }

  async findPendingByEmail(email: string): Promise<OrgInvitation[]> {
    const records = await this.prisma.orgInvitation.findMany({
      where: {
        email: email.toLowerCase(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async findByOrganizationId(organizationId: string): Promise<OrgInvitation[]> {
    const records = await this.prisma.orgInvitation.findMany({
      where: { organizationId },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async markAccepted(id: string): Promise<void> {
    await this.prisma.orgInvitation.update({
      where: { id },
      data: { acceptedAt: new Date() },
    });
  }

  private toDomain(record: any): OrgInvitation {
    return new OrgInvitation({
      id: record.id,
      email: record.email,
      organizationId: record.organizationId,
      role: record.role as OrgRole,
      invitedBy: record.invitedBy,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      acceptedAt: record.acceptedAt,
      createdAt: record.createdAt,
      organizationName: record.organization?.name,
    });
  }
}
