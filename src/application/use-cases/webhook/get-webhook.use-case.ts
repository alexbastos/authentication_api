import type { Role } from "../../../domain/entities/role.entity.js";
import type { WebhookEndpoint } from "../../../domain/entities/webhook.entity.js";
import { WebhookNotFoundError } from "../../../domain/errors/domain-errors.js";
import type { IWebhookRepository } from "../../../domain/repositories/webhook.repository.js";
import { assertGlobalAdmin } from "../../services/global-authorization.service.js";

export class GetWebhookUseCase {
	constructor(private readonly webhookRepository: IWebhookRepository) {}

	async execute(id: string, requesterRole: Role): Promise<WebhookEndpoint> {
		assertGlobalAdmin(requesterRole);
		const endpoint = await this.webhookRepository.findEndpointById(id);
		if (!endpoint) throw new WebhookNotFoundError(id);
		return endpoint;
	}
}
