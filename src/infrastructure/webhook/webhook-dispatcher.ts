// ─── Webhook HTTP Dispatcher ──────────────────────────────────────────────

import crypto from 'node:crypto';
import type { IWebhookDispatcher, WebhookDeliveryResult } from '../../application/ports/webhook-dispatcher.port.js';
import type { IWebhookUrlValidator } from '../../application/ports/webhook-url-validator.port.js';

export class HttpWebhookDispatcher implements IWebhookDispatcher {
  constructor(
    private readonly urlValidator: IWebhookUrlValidator,
    private readonly timeoutMs: number = 5000,
  ) {}

  async dispatch(url: string, secret: string, payload: Record<string, unknown>): Promise<WebhookDeliveryResult> {
    const body = JSON.stringify(payload);
    const timestamp = new Date().toISOString();
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      await this.urlValidator.assertAllowed(url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Timestamp': timestamp,
        },
        body,
        signal: controller.signal,
        redirect: 'error',
      });

      return {
        success: response.ok,
        responseCode: response.status,
        responseBody: null,
      };
    } catch {
      return {
        success: false,
        responseCode: null,
        responseBody: 'Delivery failed',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
