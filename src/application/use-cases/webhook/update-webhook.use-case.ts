// ─── Use Case: Update Webhook ─────────────────────────────────────────────

import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import type { WebhookEndpoint, WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import { WebhookNotFoundError } from '../../../domain/errors/domain-errors.js';

export interface UpdateWebhookInput {
  id: string;
  url?: string;
  events?: WebhookEvent[];
  description?: string | null;
  isActive?: boolean;
}

export class UpdateWebhookUseCase {
  constructor(private readonly webhookRepository: IWebhookRepository) {}

  async execute(input: UpdateWebhookInput): Promise<WebhookEndpoint> {
    const endpoint = await this.webhookRepository.findEndpointById(input.id);
    if (!endpoint) throw new WebhookNotFoundError(input.id);

    endpoint.update({
      url: input.url,
      events: input.events,
      description: input.description,
      isActive: input.isActive,
    });

    return this.webhookRepository.updateEndpoint(endpoint);
  }
}
