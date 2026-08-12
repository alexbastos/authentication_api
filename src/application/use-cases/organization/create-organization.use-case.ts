// ─── Use Case: Create Organization ────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import { Organization } from '../../../domain/entities/organization.entity.js';
import { OrgRole } from '../../../domain/entities/role.entity.js';
import { OrganizationSlugTakenError } from '../../../domain/errors/domain-errors.js';

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  creatorUserId: string;
}

export class CreateOrganizationUseCase {
  constructor(private readonly orgRepository: IOrganizationRepository) {}

  async execute(input: CreateOrganizationInput) {
    // Check slug uniqueness
    const existing = await this.orgRepository.findBySlug(input.slug);
    if (existing) {
      throw new OrganizationSlugTakenError(input.slug);
    }

    const org = new Organization({
      id: uuidv4(),
      name: input.name,
      slug: input.slug.toLowerCase().trim(),
      description: input.description ?? null,
      logoUrl: input.logoUrl ?? null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const created = await this.orgRepository.create(org);

    // Add creator as OWNER
    await this.orgRepository.addMember(created.id, input.creatorUserId, OrgRole.OWNER);

    return created.toJSON();
  }
}
