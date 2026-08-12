// ─── Use Case: Update Organization ────────────────────────────────────────

import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import { OrgRole } from '../../../domain/entities/role.entity.js';
import {
  OrganizationNotFoundError,
  NotOrganizationMemberError,
  InsufficientOrgRoleError,
} from '../../../domain/errors/domain-errors.js';

export interface UpdateOrganizationInput {
  orgId: string;
  requesterId: string;
  name?: string;
  description?: string | null;
  logoUrl?: string | null;
}

export class UpdateOrganizationUseCase {
  constructor(private readonly orgRepository: IOrganizationRepository) {}

  async execute(input: UpdateOrganizationInput) {
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

    if (input.name !== undefined) org.updateName(input.name);
    if (input.description !== undefined) org.updateDescription(input.description);
    if (input.logoUrl !== undefined) org.updateLogoUrl(input.logoUrl);

    const updated = await this.orgRepository.update(org);
    return updated.toJSON();
  }
}
