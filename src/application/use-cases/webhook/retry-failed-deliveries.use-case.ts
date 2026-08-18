// ─── Use Case: Retry Failed Deliveries ────────────────────────────────────

import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import type { IWebhookDispatcher } from '../../ports/webhook-dispatcher.port.js';

export class RetryFailedDeliveriesUseCase {
  constructor(
    private readonly webhookRepository: IWebhookRepository,
    private readonly dispatcher: IWebhookDispatcher,
    private readonly maxRetries: number = 5,
  ) {}

  async execute(): Promise<{ retried: number; succeeded: number; failed: number }> {
    const deliveries = await this.webhookRepository.findPendingRetries();
    let succeeded = 0;
    let failed = 0;

    for (const delivery of deliveries) {
      const endpoint = await this.webhookRepository.findEndpointById(delivery.endpointId);
      if (!endpoint || !endpoint.isActive) {
        continue;
      }

      try {
        const result = await this.dispatcher.dispatch(endpoint.url, endpoint.secret, delivery.payload);

        if (result.success) {
          delivery.recordSuccess(result.responseCode!);
          succeeded++;
        } else {
          delivery.recordFailure(result.responseCode, result.responseBody, this.maxRetries);
          failed++;
        }
      } catch {
        delivery.recordFailure(null, 'Retry dispatch error', this.maxRetries);
        failed++;
      }

      await this.webhookRepository.updateDelivery(delivery);
    }

    return { retried: deliveries.length, succeeded, failed };
  }
}
