// ─── Use Case: Update Custom Role ─────────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import type { IPermissionRepository } from '../../../domain/repositories/permission.repository.js';
import type { CustomRole } from '../../../domain/entities/permission.entity.js';
import { RoleNotFoundError, SystemRoleModificationError, PermissionNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface UpdateCustomRoleInput {
  id: string;
  name?: string;
  description?: string | null;
  permissionCodes?: string[];
}

export class UpdateCustomRoleUseCase {
  constructor(
    private readonly roleRepository: ICustomRoleRepository,
    private readonly permissionRepository: IPermissionRepository,
  ) {}

  async execute(input: UpdateCustomRoleInput): Promise<CustomRole> {
    const role = await this.roleRepository.findById(input.id);
    if (!role) throw new RoleNotFoundError(input.id);
    if (role.isSystem) throw new SystemRoleModificationError();

    role.update({
      name: input.name,
      description: input.description,
    });

    if (input.permissionCodes) {
      const permissions = await this.permissionRepository.findByCodes(input.permissionCodes);
      const foundCodes = new Set(permissions.map((p) => p.code));
      const missing = input.permissionCodes.filter((c) => !foundCodes.has(c));
      if (missing.length > 0) {
        throw new PermissionNotFoundError(missing.join(', '));
      }
      role.setPermissions(permissions);
    }

    return this.roleRepository.update(role);
  }
}
