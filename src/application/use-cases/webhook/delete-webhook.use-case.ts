// ─── Use Case: Delete Webhook ─────────────────────────────────────────────

import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import { WebhookNotFoundError } from '../../../domain/errors/domain-errors.js';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';

export class DeleteWebhookUseCase {
  constructor(private readonly webhookRepository: IWebhookRepository) {}

  async execute(id: string, requesterRole: Role): Promise<void> {
    assertGlobalAdmin(requesterRole);
    const endpoint = await this.webhookRepository.findEndpointById(id);
    if (!endpoint) throw new WebhookNotFoundError(id);

    await this.webhookRepository.deleteEndpoint(id);
  }
}
