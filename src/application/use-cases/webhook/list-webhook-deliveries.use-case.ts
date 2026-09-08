import type { Role } from "../../../domain/entities/role.entity.js";
import type { WebhookDelivery } from "../../../domain/entities/webhook.entity.js";
import { WebhookNotFoundError } from "../../../domain/errors/domain-errors.js";
import type { IWebhookRepository } from "../../../domain/repositories/webhook.repository.js";
import { assertGlobalAdmin } from "../../services/global-authorization.service.js";

export class ListWebhookDeliveriesUseCase {
	constructor(private readonly webhookRepository: IWebhookRepository) {}

	async execute(
		endpointId: string,
		requesterRole: Role,
	): Promise<WebhookDelivery[]> {
		assertGlobalAdmin(requesterRole);
		const endpoint = await this.webhookRepository.findEndpointById(endpointId);
		if (!endpoint) throw new WebhookNotFoundError(endpointId);
		return this.webhookRepository.findDeliveriesByEndpointId(endpointId);
	}
}
