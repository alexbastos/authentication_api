// ─── Use Case: Update Webhook ─────────────────────────────────────────────

import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import type { WebhookEndpoint, WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import { WebhookNotFoundError } from '../../../domain/errors/domain-errors.js';
import type { IWebhookUrlValidator } from '../../ports/webhook-url-validator.port.js';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';

export interface UpdateWebhookInput {
  id: string;
  url?: string;
  events?: WebhookEvent[];
  description?: string | null;
  isActive?: boolean;
  requesterRole: Role;
}

export class UpdateWebhookUseCase {
  constructor(
    private readonly webhookRepository: IWebhookRepository,
    private readonly urlValidator: IWebhookUrlValidator,
  ) {}

  async execute(input: UpdateWebhookInput): Promise<WebhookEndpoint> {
    assertGlobalAdmin(input.requesterRole);
    const endpoint = await this.webhookRepository.findEndpointById(input.id);
    if (!endpoint) throw new WebhookNotFoundError(input.id);
    if (input.url !== undefined) await this.urlValidator.assertAllowed(input.url);

    endpoint.update({
      url: input.url,
      events: input.events,
      description: input.description,
      isActive: input.isActive,
    });

    return this.webhookRepository.updateEndpoint(endpoint);
  }
}
