// ─── Session, Login History & Social Account Routes ───────────────────────

import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import type { SessionController } from '../controllers/session.controller.js';
import {
  SessionListResponseSchema,
  SessionIdParamsSchema,
  PaginatedLoginHistoryResponseSchema,
  LoginHistoryQuerySchema,
  LinkSocialBodySchema,
  UnlinkSocialParamsSchema,
  SocialAccountMessageSchema,
} from '../schemas/session.schema.js';
import { ErrorResponseSchema, MessageResponseSchema } from '../schemas/auth.schema.js';

export function registerSessionRoutes(
  app: FastifyInstance,
  controller: SessionController,
  authMiddleware: preHandlerHookHandler,
) {
  // ─── GET /authentication_api/api/v1/users/me/sessions ──────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/users/me/sessions',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Sessions'],
      summary: 'List active sessions',
      description: 'Returns all active sessions (non-revoked, non-expired refresh tokens) for the authenticated user, including device, IP, and User-Agent metadata.',
      response: {
        200: SessionListResponseSchema,
        401: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.listSessions(request, reply),
  });

  // ─── DELETE /authentication_api/api/v1/users/me/sessions/:id ───────────────
  app.route({
    method: 'DELETE',
    url: '/authentication_api/api/v1/users/me/sessions/:id',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Sessions'],
      summary: 'Revoke a specific session',
      description: 'Revokes a specific session by ID. The user can only revoke their own sessions. Useful for logging out a lost device without affecting other sessions.',
      params: SessionIdParamsSchema,
      response: {
        204: { type: 'null' as const, description: 'Session revoked successfully' },
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.revokeSession(request as any, reply),
  });

  // ─── GET /authentication_api/api/v1/users/me/login-history ─────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/users/me/login-history',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Login History'],
      summary: 'Get login history',
      description: 'Returns a paginated list of login attempts (success and failure) for the authenticated user. Includes IP, device, method, and failure reason.',
      querystring: LoginHistoryQuerySchema,
      response: {
        200: PaginatedLoginHistoryResponseSchema,
        401: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.getLoginHistory(request as any, reply),
  });

  // ─── POST /authentication_api/api/v1/users/me/social ───────────────────────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/users/me/social',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Social Accounts'],
      summary: 'Link a social account',
      description: 'Links a social provider (Google, Apple, etc.) to the authenticated user account. Validates the social token before linking. If already linked, returns a success message.',
      body: LinkSocialBodySchema,
      response: {
        200: SocialAccountMessageSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.linkSocial(request as any, reply),
  });

  // ─── DELETE /authentication_api/api/v1/users/me/social/:provider ───────────
  app.route({
    method: 'DELETE',
    url: '/authentication_api/api/v1/users/me/social/:provider',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Social Accounts'],
      summary: 'Unlink a social account',
      description: 'Removes a social provider link from the authenticated user account. Will fail if this is the last authentication method (no password and no other social provider).',
      params: UnlinkSocialParamsSchema,
      response: {
        200: SocialAccountMessageSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.unlinkSocial(request as any, reply),
  });
}
