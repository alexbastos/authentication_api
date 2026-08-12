// ─── Use Case: Invite Member ──────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import { randomBytes, createHash } from 'node:crypto';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import type { IOrgInvitationRepository } from '../../../domain/repositories/org-invitation.repository.js';
import { OrgInvitation } from '../../../domain/entities/org-invitation.entity.js';
import { OrgRole } from '../../../domain/entities/role.entity.js';
import {
  OrganizationNotFoundError,
  NotOrganizationMemberError,
  InsufficientOrgRoleError,
} from '../../../domain/errors/domain-errors.js';

export interface InviteMemberInput {
  orgId: string;
  requesterId: string;
  email: string;
  role?: OrgRole;
}

export class InviteMemberUseCase {
  constructor(
    private readonly orgRepository: IOrganizationRepository,
    private readonly invitationRepository: IOrgInvitationRepository,
  ) {}

  async execute(input: InviteMemberInput) {
    const org = await this.orgRepository.findById(input.orgId);
    if (!org) {
      throw new OrganizationNotFoundError(input.orgId);
    }

    // Verify requester is OWNER or ADMIN
    const member = await this.orgRepository.findMember(input.orgId, input.requesterId);
    if (!member) {
      throw new NotOrganizationMemberError();
    }
    if (member.role !== OrgRole.OWNER && member.role !== OrgRole.ADMIN) {
      throw new InsufficientOrgRoleError('ADMIN');
    }

    // Generate token
    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    const invitation = new OrgInvitation({
      id: uuidv4(),
      email: input.email.toLowerCase().trim(),
      organizationId: input.orgId,
      role: input.role ?? OrgRole.MEMBER,
      invitedBy: input.requesterId,
      tokenHash,
      expiresAt,
      acceptedAt: null,
      createdAt: new Date(),
    });

    const created = await this.invitationRepository.create(invitation);

    return {
      ...created.toJSON(),
      token: plainToken, // Return plain token for email delivery
    };
  }
}
