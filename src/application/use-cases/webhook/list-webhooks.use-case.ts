// ─── Use Case: List Webhooks ──────────────────────────────────────────────

import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import type { WebhookEndpoint } from '../../../domain/entities/webhook.entity.js';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';

export class ListWebhooksUseCase {
  constructor(private readonly webhookRepository: IWebhookRepository) {}

  async execute(requesterRole: Role, organizationId?: string | null): Promise<WebhookEndpoint[]> {
    assertGlobalAdmin(requesterRole);
    return this.webhookRepository.listEndpoints(organizationId);
  }
}
