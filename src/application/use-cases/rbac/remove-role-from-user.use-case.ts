// ─── Use Case: Remove Role from User ──────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';

export class RemoveRoleFromUserUseCase {
  constructor(private readonly roleRepository: ICustomRoleRepository) {}

  async execute(userId: string, roleId: string): Promise<void> {
    await this.roleRepository.removeFromUser(userId, roleId);
  }
}
