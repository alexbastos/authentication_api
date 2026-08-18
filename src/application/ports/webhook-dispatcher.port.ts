// ─── Application Port: Webhook Dispatcher ─────────────────────────────────

export interface WebhookDeliveryResult {
  success: boolean;
  responseCode: number | null;
  responseBody: string | null;
}

export interface IWebhookDispatcher {
  dispatch(url: string, secret: string, payload: Record<string, unknown>): Promise<WebhookDeliveryResult>;
}
