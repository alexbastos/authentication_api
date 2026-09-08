// ─── Use Case: Register Webhook ───────────────────────────────────────────

import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import { WebhookEndpoint } from '../../../domain/entities/webhook.entity.js';
import type { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { IWebhookUrlValidator } from '../../ports/webhook-url-validator.port.js';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';
import { OrganizationNotFoundError } from '../../../domain/errors/domain-errors.js';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterWebhookInput {
  url: string;
  events: WebhookEvent[];
  organizationId?: string | null;
  description?: string;
  requesterRole: Role;
}

export class RegisterWebhookUseCase {
  constructor(
    private readonly webhookRepository: IWebhookRepository,
    private readonly urlValidator: IWebhookUrlValidator,
    private readonly organizationRepository: IOrganizationRepository,
  ) {}

  async execute(input: RegisterWebhookInput): Promise<WebhookEndpoint> {
    assertGlobalAdmin(input.requesterRole);
    if (input.organizationId && !(await this.organizationRepository.findById(input.organizationId))) {
      throw new OrganizationNotFoundError(input.organizationId);
    }
    await this.urlValidator.assertAllowed(input.url);
    const secret = crypto.randomBytes(32).toString('hex');
    const now = new Date();

    const endpoint = new WebhookEndpoint({
      id: uuidv4(),
      url: input.url,
      secret,
      events: input.events,
      organizationId: input.organizationId ?? null,
      isActive: true,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return this.webhookRepository.createEndpoint(endpoint);
  }
}
