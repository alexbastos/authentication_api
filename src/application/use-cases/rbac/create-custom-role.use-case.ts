// ─── Use Case: Create Custom Role ─────────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import type { IPermissionRepository } from '../../../domain/repositories/permission.repository.js';
import { CustomRole } from '../../../domain/entities/permission.entity.js';
import { RoleAlreadyExistsError, PermissionNotFoundError } from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';

export interface CreateCustomRoleInput {
  name: string;
  description?: string;
  organizationId?: string | null;
  permissionCodes: string[];
}

export class CreateCustomRoleUseCase {
  constructor(
    private readonly roleRepository: ICustomRoleRepository,
    private readonly permissionRepository: IPermissionRepository,
  ) {}

  async execute(input: CreateCustomRoleInput): Promise<CustomRole> {
    const orgId = input.organizationId ?? null;

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
