import type { WebhookEndpoint, WebhookDelivery, WebhookEvent, WebhookDeliveryStatus } from '../entities/webhook.entity.js';

export interface IWebhookRepository {
  // Endpoint CRUD
  createEndpoint(endpoint: WebhookEndpoint): Promise<WebhookEndpoint>;
  findEndpointById(id: string): Promise<WebhookEndpoint | null>;
  listEndpoints(organizationId?: string | null): Promise<WebhookEndpoint[]>;
  updateEndpoint(endpoint: WebhookEndpoint): Promise<WebhookEndpoint>;
  deleteEndpoint(id: string): Promise<void>;
  findActiveEndpointsByEvent(event: WebhookEvent): Promise<WebhookEndpoint[]>;

  // Delivery management
  createDelivery(delivery: WebhookDelivery): Promise<WebhookDelivery>;
  updateDelivery(delivery: WebhookDelivery): Promise<void>;
  findDeliveriesByEndpointId(endpointId: string, limit?: number): Promise<WebhookDelivery[]>;
  findPendingRetries(limit?: number): Promise<WebhookDelivery[]>;
}
