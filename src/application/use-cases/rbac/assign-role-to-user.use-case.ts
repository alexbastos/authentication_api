// ─── Use Case: Assign Role to User ────────────────────────────────────────

import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import {
  OrganizationNotFoundError,
  RoleNotFoundError,
  UserNotFoundError,
} from '../../../domain/errors/domain-errors.js';
import { ForbiddenError } from '../../../domain/errors/domain-errors.js';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';

export interface AssignRoleInput {
  userId: string;
  roleId: string;
  organizationId?: string | null;
  requesterRole: Role;
}

export class AssignRoleToUserUseCase {
  constructor(
    private readonly roleRepository: ICustomRoleRepository,
    private readonly userRepository: IUserRepository,
    private readonly organizationRepository: IOrganizationRepository,
  ) {}

  async execute(input: AssignRoleInput): Promise<void> {
    assertGlobalAdmin(input.requesterRole);
    const user = await this.userRepository.findById(input.userId);
    if (!user) throw new UserNotFoundError(input.userId);

    const role = await this.roleRepository.findById(input.roleId);
    if (!role) throw new RoleNotFoundError(input.roleId);

    const organizationId = input.organizationId ?? null;
    if (role.organizationId !== null && role.organizationId !== organizationId) {
      throw new ForbiddenError('Role cannot be assigned outside its organization');
    }
    if (organizationId) {
      if (!(await this.organizationRepository.findById(organizationId))) {
        throw new OrganizationNotFoundError(organizationId);
      }
      const member = await this.organizationRepository.findMember(organizationId, input.userId);
      if (!member) throw new ForbiddenError('User is not a member of the role organization');
    }

    await this.roleRepository.assignToUser(
      input.userId,
      input.roleId,
      organizationId,
    );
  }
}
