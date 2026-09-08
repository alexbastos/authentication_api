// ─── Use Case: Create Custom Role ─────────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import type { IPermissionRepository } from '../../../domain/repositories/permission.repository.js';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import { CustomRole } from '../../../domain/entities/permission.entity.js';
import {
  OrganizationNotFoundError,
  PermissionNotFoundError,
  RoleAlreadyExistsError,
} from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';

export interface CreateCustomRoleInput {
  name: string;
  description?: string;
  organizationId?: string | null;
  permissionCodes: string[];
  requesterRole: Role;
}

export class CreateCustomRoleUseCase {
  constructor(
    private readonly roleRepository: ICustomRoleRepository,
    private readonly permissionRepository: IPermissionRepository,
    private readonly organizationRepository: IOrganizationRepository,
  ) {}

  async execute(input: CreateCustomRoleInput): Promise<CustomRole> {
    assertGlobalAdmin(input.requesterRole);
    const orgId = input.organizationId ?? null;
    if (orgId && !(await this.organizationRepository.findById(orgId))) {
      throw new OrganizationNotFoundError(orgId);
    }

    // Check uniqueness
    const existing = await this.roleRepository.findByNameAndOrg(input.name, orgId);
    if (existing) {
      throw new RoleAlreadyExistsError(input.name);
    }

    // Resolve permission codes to entities
    const permissions = await this.permissionRepository.findByCodes(input.permissionCodes);
    const foundCodes = new Set(permissions.map((p) => p.code));
    const missing = input.permissionCodes.filter((c) => !foundCodes.has(c));
    if (missing.length > 0) {
      throw new PermissionNotFoundError(missing.join(', '));
    }

    const role = new CustomRole({
      id: uuidv4(),
      name: input.name,
      description: input.description ?? null,
      organizationId: orgId,
      isSystem: false,
      createdAt: new Date(),
      permissions,
    });

    return this.roleRepository.create(role);
  }
}
