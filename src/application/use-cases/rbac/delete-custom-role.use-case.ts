// ─── Use Case: Delete Custom Role ─────────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import { RoleNotFoundError, SystemRoleModificationError } from '../../../domain/errors/domain-errors.js';

export class DeleteCustomRoleUseCase {
  constructor(private readonly roleRepository: ICustomRoleRepository) {}

  async execute(id: string): Promise<void> {
    const role = await this.roleRepository.findById(id);
    if (!role) throw new RoleNotFoundError(id);
    if (role.isSystem) throw new SystemRoleModificationError();

    await this.roleRepository.delete(id);
  }
}
