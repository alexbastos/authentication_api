import { Role } from "../../domain/entities/role.entity.js";
import { ForbiddenError } from "../../domain/errors/domain-errors.js";

export function assertGlobalAdmin(role: Role): void {
	if (role !== Role.ADMIN)
		throw new ForbiddenError("Administrator role is required");
}
