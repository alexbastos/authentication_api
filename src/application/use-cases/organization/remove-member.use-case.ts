// ─── Use Case: Remove Member ──────────────────────────────────────────────

import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import { OrgRole } from '../../../domain/entities/role.entity.js';
import {
  OrganizationNotFoundError,
  NotOrganizationMemberError,
  InsufficientOrgRoleError,
  CannotRemoveOwnerError,
} from '../../../domain/errors/domain-errors.js';

export interface RemoveMemberInput {
  orgId: string;
  targetUserId: string;
  requesterId: string;
}

export class RemoveMemberUseCase {
  constructor(private readonly orgRepository: IOrganizationRepository) {}

  async execute(input: RemoveMemberInput) {
    const org = await this.orgRepository.findById(input.orgId);
    if (!org) {
      throw new OrganizationNotFoundError(input.orgId);
    }

    // Verify requester is OWNER or ADMIN
    const requester = await this.orgRepository.findMember(input.orgId, input.requesterId);
    if (!requester) {
      throw new NotOrganizationMemberError();
    }
    if (requester.role !== OrgRole.OWNER && requester.role !== OrgRole.ADMIN) {
      throw new InsufficientOrgRoleError('ADMIN');
    }

    // Verify target exists
    const target = await this.orgRepository.findMember(input.orgId, input.targetUserId);
    if (!target) {
      throw new NotOrganizationMemberError();
    }

    // Cannot remove OWNER
    if (target.isOwner) {
      throw new CannotRemoveOwnerError();
    }

    await this.orgRepository.removeMember(input.orgId, input.targetUserId);
  }
}
