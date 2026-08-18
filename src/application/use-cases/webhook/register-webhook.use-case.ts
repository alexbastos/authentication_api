// ─── Use Case: Register Webhook ───────────────────────────────────────────

import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import { WebhookEndpoint } from '../../../domain/entities/webhook.entity.js';
import type { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterWebhookInput {
  url: string;
  events: WebhookEvent[];
  organizationId?: string | null;
  description?: string;
}

export class RegisterWebhookUseCase {
  constructor(private readonly webhookRepository: IWebhookRepository) {}

  async execute(input: RegisterWebhookInput): Promise<WebhookEndpoint> {
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
