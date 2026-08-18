// ─── Use Case: Get User Permissions ───────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';

export interface GetUserPermissionsOutput {
  userId: string;
  permissions: string[];
}

export class GetUserPermissionsUseCase {
  constructor(private readonly roleRepository: ICustomRoleRepository) {}

  async execute(userId: string, organizationId?: string | null): Promise<GetUserPermissionsOutput> {
    const permissions = await this.roleRepository.getUserPermissionCodes(userId, organizationId);
    return { userId, permissions };
  }
}
