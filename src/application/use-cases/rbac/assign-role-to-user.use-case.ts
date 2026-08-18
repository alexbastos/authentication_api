// ─── Use Case: Assign Role to User ────────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import { RoleNotFoundError, UserNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface AssignRoleInput {
  userId: string;
  roleId: string;
  organizationId?: string | null;
}

export class AssignRoleToUserUseCase {
  constructor(
    private readonly roleRepository: ICustomRoleRepository,
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: AssignRoleInput): Promise<void> {
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    const role = await this.roleRepository.findById(input.roleId);
    if (!role) throw new RoleNotFoundError(input.roleId);

    await this.roleRepository.assignToUser(
      input.userId,
      input.roleId,
      input.organizationId ?? null,
    );
  }
}
