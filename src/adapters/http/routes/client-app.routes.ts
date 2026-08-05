// ─── Client App Routes ────────────────────────────────────────────────────

import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import type { ClientAppController } from '../controllers/client-app.controller.js';
import {
  RegisterClientAppBodySchema,
  ClientAppResponseSchema,
  ClientAppListResponseSchema,
} from '../schemas/client-app.schema.js';
import { ErrorResponseSchema } from '../schemas/auth.schema.js';
import { Role } from '../../../domain/entities/role.entity.js';
import { createRoleMiddleware } from '../middlewares/role.middleware.js';

export function registerClientAppRoutes(
  app: FastifyInstance,
  controller: ClientAppController,
  authMiddleware: preHandlerHookHandler,
) {
  // ─── POST /api/v1/client-apps ───────────────────────────────────────
  app.route({
    method: 'POST',
    url: '/api/v1/client-apps',
    preHandler: [authMiddleware, createRoleMiddleware(Role.ADMIN)],
    schema: {
      tags: ['Client Apps'],
      summary: 'Register a new client application (Admin only)',
      description: 'Registers a third-party application that can use this IdP. Returns clientId and clientSecret (secret shown only once).',
      body: RegisterClientAppBodySchema,
      response: {
        201: ClientAppResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.register(request as any, reply),
  });

  // ─── GET /api/v1/client-apps ────────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/api/v1/client-apps',
    preHandler: [authMiddleware, createRoleMiddleware(Role.ADMIN)],
    schema: {
      tags: ['Client Apps'],
      summary: 'List all client applications (Admin only)',
      description: 'Returns all registered client applications. Client secrets are not included.',
      response: {
        200: ClientAppListResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.list(request, reply),
  });
}
