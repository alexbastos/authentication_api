// ─── Use Case: Delete Custom Role ─────────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import { RoleNotFoundError, SystemRoleModificationError } from '../../../domain/errors/domain-errors.js';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';

export class DeleteCustomRoleUseCase {
  constructor(private readonly roleRepository: ICustomRoleRepository) {}

  async execute(id: string, requesterRole: Role): Promise<void> {
    assertGlobalAdmin(requesterRole);
    const role = await this.roleRepository.findById(id);
    if (!role) throw new RoleNotFoundError(id);
    if (role.isSystem) throw new SystemRoleModificationError();

    await this.roleRepository.delete(id);
  }
}
