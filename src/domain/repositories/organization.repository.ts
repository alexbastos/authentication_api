// ─── Domain Repository Contract — Organization ───────────────────────────

import type { Organization } from '../entities/organization.entity.js';
import type { OrganizationMember } from '../entities/organization.entity.js';
import type { OrgRole } from '../entities/role.entity.js';

export interface IOrganizationRepository {
  create(org: Organization): Promise<Organization>;
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  update(org: Organization): Promise<Organization>;
  delete(id: string): Promise<void>;
  listByUserId(userId: string): Promise<Array<Organization & { memberRole: OrgRole }>>;

  // Members
  addMember(organizationId: string, userId: string, role: OrgRole): Promise<OrganizationMember>;
  removeMember(organizationId: string, userId: string): Promise<void>;
  findMember(organizationId: string, userId: string): Promise<OrganizationMember | null>;
  listMembers(organizationId: string): Promise<OrganizationMember[]>;
  updateMemberRole(organizationId: string, userId: string, role: OrgRole): Promise<OrganizationMember>;
}
