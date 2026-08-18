// ─── TypeBox Schemas — Webhooks ───────────────────────────────────────────

import { Type, Static } from '@sinclair/typebox';

const WebhookEventEnum = Type.String({
  enum: [
    'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
    'USER_LOGIN', 'USER_LOGOUT', 'USER_PASSWORD_CHANGED',
    'USER_EMAIL_VERIFIED', 'ORG_CREATED', 'ORG_MEMBER_ADDED', 'ORG_MEMBER_REMOVED',
  ],
});

// ─── Params ─────────────────────────────────────────────────────────────

export const WebhookIdParamsSchema = Type.Object({
  id: Type.String({ description: 'Webhook Endpoint ID' }),
});
export type WebhookIdParams = Static<typeof WebhookIdParamsSchema>;

// ─── Register Webhook ───────────────────────────────────────────────────

export const RegisterWebhookBodySchema = Type.Object({
  url: Type.String({ format: 'uri', maxLength: 500, description: 'Webhook delivery URL (HTTPS recommended)' }),
  events: Type.Array(WebhookEventEnum, { minItems: 1, description: 'Events to subscribe to' }),
  organizationId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  description: Type.Optional(Type.String({ maxLength: 255 })),
});
export type RegisterWebhookBody = Static<typeof RegisterWebhookBodySchema>;

// ─── Update Webhook ─────────────────────────────────────────────────────

export const UpdateWebhookBodySchema = Type.Object({
  url: Type.Optional(Type.String({ format: 'uri', maxLength: 500 })),
  events: Type.Optional(Type.Array(WebhookEventEnum, { minItems: 1 })),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 255 }), Type.Null()])),
  isActive: Type.Optional(Type.Boolean()),
});
export type UpdateWebhookBody = Static<typeof UpdateWebhookBodySchema>;

// ─── Response Schemas ───────────────────────────────────────────────────

export const WebhookEndpointResponseSchema = Type.Object({
  id: Type.String(),
  url: Type.String(),
  secret: Type.String({ description: 'HMAC signing secret (only shown once on creation)' }),
  events: Type.Array(Type.String()),
  organizationId: Type.Union([Type.String(), Type.Null()]),
  isActive: Type.Boolean(),
  description: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export const WebhookListResponseSchema = Type.Array(WebhookEndpointResponseSchema);

export const WebhookDeliveryResponseSchema = Type.Object({
  id: Type.String(),
  endpointId: Type.String(),
  event: Type.String(),
  payload: Type.Any(),
  status: Type.String(),
  attempts: Type.Number(),
  lastAttempt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  nextRetry: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  responseCode: Type.Union([Type.Number(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
});

export const DeliveryListResponseSchema = Type.Array(WebhookDeliveryResponseSchema);

export const ErrorResponseSchema = Type.Object({
  statusCode: Type.Number(),
  error: Type.String(),
  code: Type.String(),
  message: Type.String(),
});

export const MessageResponseSchema = Type.Object({
  message: Type.String(),
});
