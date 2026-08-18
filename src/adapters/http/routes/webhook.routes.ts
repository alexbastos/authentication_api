// ─── Webhook Routes ───────────────────────────────────────────────────────

import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { WebhookController } from '../controllers/webhook.controller.js';
import {
  RegisterWebhookBodySchema, WebhookEndpointResponseSchema, WebhookListResponseSchema,
  UpdateWebhookBodySchema, WebhookIdParamsSchema,
  DeliveryListResponseSchema, MessageResponseSchema, ErrorResponseSchema,
} from '../schemas/webhook.schema.js';

export function registerWebhookRoutes(
  app: FastifyInstance,
  controller: WebhookController,
  authMiddleware: preHandlerHookHandler,
) {
  // ─── POST /api/v1/webhooks ──────────────────────────────────────────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/webhooks',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Webhooks'],
      summary: 'Register webhook endpoint',
      description: 'Registers a new webhook endpoint. The HMAC secret is auto-generated and returned only once.',
      body: RegisterWebhookBodySchema,
      response: { 201: WebhookEndpointResponseSchema },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.register(request as any, reply),
  });

  // ─── GET /api/v1/webhooks ───────────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/webhooks',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Webhooks'],
      summary: 'List webhooks',
      response: { 200: WebhookListResponseSchema },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.list(request as any, reply),
  });

  // ─── GET /api/v1/webhooks/:id ───────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/webhooks/:id',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Webhooks'],
      summary: 'Get webhook details',
      params: WebhookIdParamsSchema,
      response: { 200: WebhookEndpointResponseSchema, 404: ErrorResponseSchema },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.getById(request as any, reply),
  });

  // ─── PUT /api/v1/webhooks/:id ───────────────────────────────────────
  app.route({
    method: 'PUT',
    url: '/authentication_api/api/v1/webhooks/:id',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Webhooks'],
      summary: 'Update webhook',
      params: WebhookIdParamsSchema,
      body: UpdateWebhookBodySchema,
      response: { 200: WebhookEndpointResponseSchema, 404: ErrorResponseSchema },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.update(request as any, reply),
  });

  // ─── DELETE /api/v1/webhooks/:id ────────────────────────────────────
  app.route({
    method: 'DELETE',
    url: '/authentication_api/api/v1/webhooks/:id',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Webhooks'],
      summary: 'Delete webhook',
      params: WebhookIdParamsSchema,
      response: { 204: { type: 'null', description: 'Webhook deleted' }, 404: ErrorResponseSchema },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.delete(request as any, reply),
  });

  // ─── GET /api/v1/webhooks/:id/deliveries ────────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/webhooks/:id/deliveries',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Webhooks'],
      summary: 'List webhook deliveries',
      description: 'Returns the delivery history for a webhook endpoint.',
      params: WebhookIdParamsSchema,
      response: { 200: DeliveryListResponseSchema },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.listDeliveries(request as any, reply),
  });

  // ─── POST /api/v1/webhooks/:id/test ─────────────────────────────────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/webhooks/:id/test',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Webhooks'],
      summary: 'Send test event',
      description: 'Dispatches a test webhook event to verify delivery.',
      params: WebhookIdParamsSchema,
      response: { 200: MessageResponseSchema, 404: ErrorResponseSchema },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.test(request as any, reply),
  });
}
