import {
	NotOrganizationMemberError,
	OrganizationNotFoundError,
} from "../../../domain/errors/domain-errors.js";
import type { IOrganizationRepository } from "../../../domain/repositories/organization.repository.js";

export class ListOrganizationMembersUseCase {
	constructor(private readonly orgRepository: IOrganizationRepository) {}

	async execute(orgId: string, requesterId: string) {
		const organization = await this.orgRepository.findById(orgId);
		if (!organization) throw new OrganizationNotFoundError(orgId);

		const requester = await this.orgRepository.findMember(orgId, requesterId);
		if (!requester) throw new NotOrganizationMemberError();

		const members = await this.orgRepository.listMembers(orgId);
		return members.map((member) => member.toJSON());
	}
}
