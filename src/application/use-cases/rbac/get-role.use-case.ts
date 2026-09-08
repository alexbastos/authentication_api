import type { CustomRole } from "../../../domain/entities/permission.entity.js";
import type { Role } from "../../../domain/entities/role.entity.js";
import { RoleNotFoundError } from "../../../domain/errors/domain-errors.js";
import type { ICustomRoleRepository } from "../../../domain/repositories/custom-role.repository.js";
import { assertGlobalAdmin } from "../../services/global-authorization.service.js";

export class GetRoleUseCase {
	constructor(private readonly roleRepository: ICustomRoleRepository) {}

	async execute(id: string, requesterRole: Role): Promise<CustomRole> {
		assertGlobalAdmin(requesterRole);
		const role = await this.roleRepository.findById(id);
		if (!role) throw new RoleNotFoundError(id);
		return role;
	}
}
