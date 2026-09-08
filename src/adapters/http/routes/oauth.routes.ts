// ─── OAuth Routes ─────────────────────────────────────────────────────────

import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { OAuthController } from '../controllers/oauth.controller.js';
import { Type } from '@sinclair/typebox';

export function registerOAuthRoutes(
  app: FastifyInstance,
  controller: OAuthController,
  authMiddleware: preHandlerHookHandler,
  userInfoAuthMiddleware: preHandlerHookHandler,
) {
  // ─── GET /oauth/authorize ───────────────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/oauth/authorize',
    preHandler: [authMiddleware], // Requires user to be logged in
    schema: {
      tags: ['OAuth'],
      summary: 'OAuth 2.0 Authorization Endpoint',
      querystring: Type.Object({
        response_type: Type.Literal('code'),
        client_id: Type.String(),
        redirect_uri: Type.String({ format: 'uri' }),
        scope: Type.Optional(Type.String()),
        state: Type.String({ minLength: 16, maxLength: 512, description: 'Opaque CSRF binding value returned unchanged' }),
        code_challenge: Type.String({ pattern: '^[A-Za-z0-9_-]{43}$' }),
        code_challenge_method: Type.Literal('S256'),
        nonce: Type.Optional(Type.String()),
        prompt: Type.Optional(Type.String()),
      }),
      response: {
        302: Type.Null({ description: 'Redirects to redirect_uri with code or error' }),
        401: Type.Object({ error: Type.String() }),
        403: Type.Object({ error: Type.String(), client_id: Type.String(), scope: Type.Optional(Type.String()) }),
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.authorize(request as any, reply),
  });

  // ─── POST /oauth/consent ────────────────────────────────────────────────
  app.route({
    method: 'POST',
    url: '/oauth/consent',
    preHandler: [authMiddleware],
    schema: {
      tags: ['OAuth'],
      summary: 'Grant OAuth Consent',
      body: Type.Object({
        client_id: Type.String(),
        scopes: Type.Array(Type.String(), { minItems: 1 }),
      }, { additionalProperties: false }),
      response: {
        200: Type.Object({ message: Type.String() }),
        400: Type.Object({ statusCode: Type.Number(), error: Type.String(), code: Type.String(), message: Type.String() }),
        401: Type.Object({ statusCode: Type.Number(), error: Type.String(), code: Type.String(), message: Type.String() }),
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.grantConsent(request as any, reply),
  });

  // ─── POST /oauth/token ──────────────────────────────────────────────────
  app.route({
    method: 'POST',
    url: '/oauth/token',
    // Not protected by user auth middleware. Client auth happens inside the controller.
    schema: {
      tags: ['OAuth'],
      summary: 'OAuth 2.0 Token Endpoint',
      body: Type.Object({
        grant_type: Type.Literal('authorization_code'),
        code: Type.String({ minLength: 1 }),
        redirect_uri: Type.String({ format: 'uri' }),
        client_id: Type.Optional(Type.String()),
        client_secret: Type.Optional(Type.String()),
        code_verifier: Type.String({ minLength: 43, maxLength: 128, pattern: '^[A-Za-z0-9._~-]+$' }),
      }, { additionalProperties: false }),
      response: {
        200: Type.Object({
          access_token: Type.String(),
          token_type: Type.Literal('Bearer'),
          expires_in: Type.Number(),
          id_token: Type.Optional(Type.String()),
        }),
        400: Type.Object({ error: Type.String(), code: Type.String(), message: Type.String() }),
        401: Type.Object({ error: Type.String(), code: Type.String(), message: Type.String() }),
      },
    },
    handler: (request, reply) => controller.token(request as any, reply),
  });

  // ─── GET|POST /oauth/userinfo ───────────────────────────────────────────
  app.route({
    method: ['GET', 'POST'],
    url: '/oauth/userinfo',
    preHandler: [userInfoAuthMiddleware],
    schema: {
      tags: ['OAuth'],
      summary: 'OIDC UserInfo Endpoint',
      response: {
        200: Type.Object({
          sub: Type.String(),
          name: Type.Optional(Type.String()),
          email: Type.Optional(Type.String()),
          email_verified: Type.Optional(Type.Boolean()),
          updated_at: Type.Optional(Type.Number()),
        }, { additionalProperties: true }),
        401: Type.Object({ statusCode: Type.Number(), error: Type.String(), code: Type.String(), message: Type.String() }),
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.userinfo(request as any, reply),
  });
}
