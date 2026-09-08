// ─── Use Case: Get User Permissions ───────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';

export interface GetUserPermissionsOutput {
  userId: string;
  permissions: string[];
}

export class GetUserPermissionsUseCase {
  constructor(private readonly roleRepository: ICustomRoleRepository) {}

  async execute(userId: string, requesterRole: Role, organizationId?: string | null): Promise<GetUserPermissionsOutput> {
    assertGlobalAdmin(requesterRole);
    const permissions = await this.roleRepository.getUserPermissionCodes(userId, organizationId);
    return { userId, permissions };
  }
}
