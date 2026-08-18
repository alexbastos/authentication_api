// ─── Use Case: List Permissions ───────────────────────────────────────────

import type { IPermissionRepository } from '../../../domain/repositories/permission.repository.js';
import type { Permission } from '../../../domain/entities/permission.entity.js';

export class ListPermissionsUseCase {
  constructor(private readonly permissionRepository: IPermissionRepository) {}

  async execute(category?: string): Promise<Permission[]> {
    if (category) {
      return this.permissionRepository.findByCategory(category);
    }
    return this.permissionRepository.findAll();
  }
}
