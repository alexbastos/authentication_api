// ─── Use Case: Change Member Role ─────────────────────────────────────────

import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import { OrgRole } from '../../../domain/entities/role.entity.js';
import {
  OrganizationNotFoundError,
  NotOrganizationMemberError,
  InsufficientOrgRoleError,
  CannotRemoveOwnerError,
} from '../../../domain/errors/domain-errors.js';

export interface ChangeMemberRoleInput {
  orgId: string;
  targetUserId: string;
  newRole: OrgRole;
  requesterId: string;
}

export class ChangeMemberRoleUseCase {
  constructor(private readonly orgRepository: IOrganizationRepository) {}

  async execute(input: ChangeMemberRoleInput) {
    const org = await this.orgRepository.findById(input.orgId);
    if (!org) {
      throw new OrganizationNotFoundError(input.orgId);
    }

    // Only OWNER can change roles
    const requester = await this.orgRepository.findMember(input.orgId, input.requesterId);
    if (!requester) {
      throw new NotOrganizationMemberError();
    }
    if (requester.role !== OrgRole.OWNER) {
      throw new InsufficientOrgRoleError('OWNER');
    }

    // Verify target exists
    const target = await this.orgRepository.findMember(input.orgId, input.targetUserId);
    if (!target) {
      throw new NotOrganizationMemberError();
    }

    // Cannot change OWNER's role (would leave org without owner)
    if (target.isOwner) {
      throw new CannotRemoveOwnerError();
    }

    const updated = await this.orgRepository.updateMemberRole(
      input.orgId,
      input.targetUserId,
      input.newRole,
    );

    return updated.toJSON();
  }
}
