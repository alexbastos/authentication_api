// ─── Use Case: Delete Webhook ─────────────────────────────────────────────

import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import { WebhookNotFoundError } from '../../../domain/errors/domain-errors.js';

export class DeleteWebhookUseCase {
  constructor(private readonly webhookRepository: IWebhookRepository) {}

  async execute(id: string): Promise<void> {
    const endpoint = await this.webhookRepository.findEndpointById(id);
    if (!endpoint) throw new WebhookNotFoundError(id);

    await this.webhookRepository.deleteEndpoint(id);
  }
}
