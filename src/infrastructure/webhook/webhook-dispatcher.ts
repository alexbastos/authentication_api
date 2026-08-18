// ─── Webhook HTTP Dispatcher ──────────────────────────────────────────────

import crypto from 'node:crypto';
import type { IWebhookDispatcher, WebhookDeliveryResult } from '../../application/ports/webhook-dispatcher.port.js';

export class HttpWebhookDispatcher implements IWebhookDispatcher {
  constructor(private readonly timeoutMs: number = 5000) {}

  async dispatch(url: string, secret: string, payload: Record<string, unknown>): Promise<WebhookDeliveryResult> {
    const body = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
          'X-Webhook-Timestamp': new Date().toISOString(),
        },
        body,
        signal: controller.signal,
      });

      const responseBody = await response.text().catch(() => null);

      return {
        success: response.ok,
        responseCode: response.status,
        responseBody: responseBody?.slice(0, 1000) ?? null,
      };
    } catch (error) {
      return {
        success: false,
        responseCode: null,
        responseBody: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
