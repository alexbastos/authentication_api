import type { Role } from "../../../domain/entities/role.entity.js";
import { WebhookEvent } from "../../../domain/entities/webhook.entity.js";
import { WebhookNotFoundError } from "../../../domain/errors/domain-errors.js";
import type { IWebhookRepository } from "../../../domain/repositories/webhook.repository.js";
import { assertGlobalAdmin } from "../../services/global-authorization.service.js";
import type { DispatchEventUseCase } from "./dispatch-event.use-case.js";

export class TestWebhookUseCase {
	constructor(
		private readonly webhookRepository: IWebhookRepository,
		private readonly dispatchEventUseCase: DispatchEventUseCase,
	) {}

	async execute(endpointId: string, requesterRole: Role): Promise<void> {
		assertGlobalAdmin(requesterRole);
		const endpoint = await this.webhookRepository.findEndpointById(endpointId);
		if (!endpoint) throw new WebhookNotFoundError(endpointId);

		await this.dispatchEventUseCase.execute({
			endpointId: endpoint.id,
			event: WebhookEvent.USER_CREATED,
			payload: {
				test: true,
				message: "This is a test webhook delivery",
				timestamp: new Date().toISOString(),
			},
		});
	}
}
