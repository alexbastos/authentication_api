// ─── Use Case: Remove Role from User ──────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';

export class RemoveRoleFromUserUseCase {
  constructor(private readonly roleRepository: ICustomRoleRepository) {}

  async execute(userId: string, roleId: string, requesterRole: Role): Promise<void> {
    assertGlobalAdmin(requesterRole);
    await this.roleRepository.removeFromUser(userId, roleId);
  }
}
