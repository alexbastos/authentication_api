import type { CustomRole } from "../../../domain/entities/permission.entity.js";
import type { Role } from "../../../domain/entities/role.entity.js";
import type { ICustomRoleRepository } from "../../../domain/repositories/custom-role.repository.js";
import { assertGlobalAdmin } from "../../services/global-authorization.service.js";

export class ListRolesUseCase {
	constructor(private readonly roleRepository: ICustomRoleRepository) {}

	async execute(requesterRole: Role): Promise<CustomRole[]> {
		assertGlobalAdmin(requesterRole);
		return this.roleRepository.list();
	}
}
