// ─── Use Case: Get Organization ───────────────────────────────────────────

import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import {
  OrganizationNotFoundError,
  NotOrganizationMemberError,
} from '../../../domain/errors/domain-errors.js';

export class GetOrganizationUseCase {
  constructor(private readonly orgRepository: IOrganizationRepository) {}

  async execute(orgId: string, requesterId: string) {
    const org = await this.orgRepository.findById(orgId);
    if (!org) {
      throw new OrganizationNotFoundError(orgId);
    }

    // Verify requester is a member
    const member = await this.orgRepository.findMember(orgId, requesterId);
    if (!member) {
      throw new NotOrganizationMemberError();
    }

    return { ...org.toJSON(), memberRole: member.role };
  }
}
