// ─── Use Case: Dispatch Webhook Event ─────────────────────────────────────
// Core use case that finds subscribed endpoints and dispatches the event

import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import type { IWebhookDispatcher } from '../../ports/webhook-dispatcher.port.js';
import { WebhookDelivery, WebhookDeliveryStatus } from '../../../domain/entities/webhook.entity.js';
import type { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import { v4 as uuidv4 } from 'uuid';

export interface DispatchEventInput {
  event: WebhookEvent;
  payload: Record<string, unknown>;
}

export class DispatchEventUseCase {
  constructor(
    private readonly webhookRepository: IWebhookRepository,
    private readonly dispatcher: IWebhookDispatcher,
    private readonly maxRetries: number = 5,
  ) {}

  async execute(input: DispatchEventInput): Promise<void> {
    const endpoints = await this.webhookRepository.findActiveEndpointsByEvent(input.event);

    const deliveryPromises = endpoints.map(async (endpoint) => {
      const delivery = new WebhookDelivery({
        id: uuidv4(),
        endpointId: endpoint.id,
        event: input.event,
        payload: input.payload,
        status: WebhookDeliveryStatus.PENDING,
        attempts: 0,
        lastAttempt: null,
        nextRetry: null,
        responseCode: null,
        responseBody: null,
        createdAt: new Date(),
      });

      await this.webhookRepository.createDelivery(delivery);

      // Fire-and-forget: attempt delivery but don't block the caller
      try {
        const result = await this.dispatcher.dispatch(endpoint.url, endpoint.secret, input.payload);

        if (result.success) {
          delivery.recordSuccess(result.responseCode!);
        } else {
          delivery.recordFailure(result.responseCode, result.responseBody, this.maxRetries);
        }
      } catch {
        delivery.recordFailure(null, 'Dispatch error', this.maxRetries);
      }

      await this.webhookRepository.updateDelivery(delivery);
    });

    // Execute all deliveries concurrently but don't let failures propagate
    await Promise.allSettled(deliveryPromises);
  }
}
