// ─── Use Case: List Webhooks ──────────────────────────────────────────────

import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import type { WebhookEndpoint } from '../../../domain/entities/webhook.entity.js';

export class ListWebhooksUseCase {
  constructor(private readonly webhookRepository: IWebhookRepository) {}

  async execute(organizationId?: string | null): Promise<WebhookEndpoint[]> {
    return this.webhookRepository.listEndpoints(organizationId);
  }
}
