// ─── MFA Routes ───────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { Type } from '@sinclair/typebox';
import type { MfaController } from '../controllers/mfa.controller.js';
import {
  SetupMfaBodySchema,
  SetupMfaResponseSchema,
  VerifyMfaSetupBodySchema,
  VerifyMfaSetupResponseSchema,
  ValidateMfaCodeBodySchema,
  ValidateMfaCodeResponseSchema,
  DisableMfaBodySchema,
  MfaStatusResponseSchema,
  RegenerateRecoveryCodesBodySchema,
  RegenerateRecoveryCodesResponseSchema,
  MfaMessageResponseSchema,
  SendMfaEmailCodeBodySchema,
  MfaBadRequestErrorResponseSchema,
  MfaUnauthorizedErrorResponseSchema,
  MfaConflictErrorResponseSchema,
  MfaRateLimitErrorResponseSchema,
} from '../schemas/mfa.schema.js';

export function registerMfaRoutes(
  app: FastifyInstance,
  controller: MfaController,
  authMiddleware: preHandlerHookHandler,
) {
  // ─── POST /authentication_api/api/v1/auth/mfa/setup ───────────────────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/auth/mfa/setup',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Auth', 'MFA/2FA'],
      summary: 'Setup two-factor authentication',
      description: 'Initiates 2FA setup and invalidates any previous pending setup. For TOTP, always returns the secret and a PNG QR code as a data URL. For EMAIL, automatically sends a 6-digit verification code. Requires authentication.',
      body: SetupMfaBodySchema,
      response: {
        200: SetupMfaResponseSchema,
        400: MfaBadRequestErrorResponseSchema,
        401: MfaUnauthorizedErrorResponseSchema,
        409: MfaConflictErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.setupMfa(request as any, reply),
  });

  // ─── POST /authentication_api/api/v1/auth/mfa/verify-setup ────────────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/auth/mfa/verify-setup',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Auth', 'MFA/2FA'],
      summary: 'Verify MFA setup and activate 2FA',
      description: 'Confirms the pending MFA setup with a 6-digit TOTP or email code. On success, atomically enables MFA, revokes existing sessions, and returns exactly 10 recovery codes in XXXXXXXX-XXXXXXXX format. They are shown only in this response and cannot be queried later; use the regeneration endpoint to obtain a new list.',
      body: VerifyMfaSetupBodySchema,
      response: {
        200: VerifyMfaSetupResponseSchema,
        400: MfaBadRequestErrorResponseSchema,
        401: MfaUnauthorizedErrorResponseSchema,
        409: MfaConflictErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.verifySetup(request as any, reply),
  });

  // ─── POST /authentication_api/api/v1/auth/mfa/verify ──────────────────
  app.post('/authentication_api/api/v1/auth/mfa/verify', {
    schema: {
      tags: ['Auth', 'MFA/2FA'],
      summary: 'Verify MFA code (login step 2)',
      description: 'Second login step. Accepts the single-use 5-minute mfaToken, a code, and one of the availableMethods returned by login. On success the challenge is atomically invalidated and final session tokens are returned. Invalid codes invalidate the challenge after the configured attempt limit (5 by default).',
      body: ValidateMfaCodeBodySchema,
      response: {
        200: ValidateMfaCodeResponseSchema,
        400: MfaBadRequestErrorResponseSchema,
        401: MfaUnauthorizedErrorResponseSchema,
        403: Type.Object({
          statusCode: Type.Literal(403),
          error: Type.String(),
          code: Type.Literal('USER_INACTIVE'),
          message: Type.String(),
        }),
        429: MfaRateLimitErrorResponseSchema,
      },
    },
    handler: controller.verifyCode.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/mfa/disable ─────────────────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/auth/mfa/disable',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Auth', 'MFA/2FA'],
      summary: 'Disable two-factor authentication',
      description: 'Disables MFA atomically and revokes existing sessions after confirmation with the configured method (TOTP or EMAIL), or a recovery code. For EMAIL accounts, first request a code from /auth/mfa/email-code using Bearer authentication.',
      body: DisableMfaBodySchema,
      response: {
        200: MfaMessageResponseSchema,
        400: MfaBadRequestErrorResponseSchema,
        401: MfaUnauthorizedErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.disable(request as any, reply),
  });

  // ─── GET /authentication_api/api/v1/auth/mfa/status ───────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/auth/mfa/status',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Auth', 'MFA/2FA'],
      summary: 'Get MFA status',
      description: 'Returns whether 2FA is enabled, the active method, and the number of remaining recovery codes.',
      response: {
        200: MfaStatusResponseSchema,
        401: MfaUnauthorizedErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: controller.getStatus.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/mfa/recovery-codes/regenerate
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/auth/mfa/recovery-codes/regenerate',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Auth', 'MFA/2FA'],
      summary: 'Regenerate recovery codes',
      description: 'Invalidates all existing recovery codes and returns exactly 10 new single-use codes. Confirm with the configured method (TOTP or EMAIL), or a recovery code. For EMAIL accounts, first request a code from /auth/mfa/email-code using Bearer authentication.',
      body: RegenerateRecoveryCodesBodySchema,
      response: {
        200: RegenerateRecoveryCodesResponseSchema,
        400: MfaBadRequestErrorResponseSchema,
        401: MfaUnauthorizedErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.regenerateRecoveryCodes(request as any, reply),
  });

  // ─── POST /authentication_api/api/v1/auth/mfa/email-code ──────────────
  app.post('/authentication_api/api/v1/auth/mfa/email-code', {
    preHandler: [async (request, reply) => {
      if (request.headers.authorization) {
        await (authMiddleware as (
          request: FastifyRequest,
          reply: FastifyReply,
        ) => Promise<void>)(request, reply);
      }
    }],
    schema: {
      tags: ['Auth', 'MFA/2FA'],
      summary: 'Send MFA code via email',
      description: 'Sends a 6-digit verification code valid for the configured TTL (10 minutes by default). During login, provide an mfaToken whose availableMethods includes EMAIL. For account actions on an EMAIL-configured account, authenticate with Bearer and send an empty object. Requests are limited to one email per minute.',
      body: SendMfaEmailCodeBodySchema,
      response: {
        200: MfaMessageResponseSchema,
        400: MfaBadRequestErrorResponseSchema,
        401: MfaUnauthorizedErrorResponseSchema,
        429: MfaRateLimitErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }, {}],
    },
    handler: controller.sendEmailCode.bind(controller),
  });
}
