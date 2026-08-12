// ─── Use Case: List User Organizations ────────────────────────────────────

import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';

export class ListUserOrganizationsUseCase {
  constructor(private readonly orgRepository: IOrganizationRepository) {}

  async execute(userId: string) {
    const orgs = await this.orgRepository.listByUserId(userId);
    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      description: org.description,
      logoUrl: org.logoUrl,
      isActive: org.isActive,
      memberRole: org.memberRole,
      createdAt: org.createdAt,
    }));
  }
}
