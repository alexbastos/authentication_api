// ─── MFA Routes ───────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
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
} from '../schemas/mfa.schema.js';
import { ErrorResponseSchema } from '../schemas/auth.schema.js';
import { Type } from '@sinclair/typebox';

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
      description: 'Initiates 2FA setup. For TOTP: generates secret and QR code. For EMAIL: sends verification code. Requires authentication.',
      body: SetupMfaBodySchema,
      response: {
        200: SetupMfaResponseSchema,
        400: ErrorResponseSchema,
        409: ErrorResponseSchema,
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
      description: 'Confirms MFA setup with a verification code. On success, enables 2FA and returns 10 recovery codes (shown only once).',
      body: VerifyMfaSetupBodySchema,
      response: {
        200: VerifyMfaSetupResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
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
      description: 'Second step of login for users with 2FA enabled. Accepts the temporary mfaToken from login + a TOTP code, email code, or recovery code. Returns final access + refresh tokens on success.',
      body: ValidateMfaCodeBodySchema,
      response: {
        200: ValidateMfaCodeResponseSchema,
        401: ErrorResponseSchema,
        429: ErrorResponseSchema,
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
      description: 'Disables 2FA for the authenticated user. Requires a valid TOTP or recovery code for confirmation.',
      body: DisableMfaBodySchema,
      response: {
        200: MfaMessageResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
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
      description: 'Invalidates all existing recovery codes and generates 10 new ones. Requires a valid TOTP code for confirmation.',
      body: RegenerateRecoveryCodesBodySchema,
      response: {
        200: RegenerateRecoveryCodesResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.regenerateRecoveryCodes(request as any, reply),
  });

  // ─── POST /authentication_api/api/v1/auth/mfa/email-code ──────────────
  app.post('/authentication_api/api/v1/auth/mfa/email-code', {
    schema: {
      tags: ['Auth', 'MFA/2FA'],
      summary: 'Send MFA code via email',
      description: 'Sends a 6-digit verification code to the user\'s email. Used during login step 2 when user prefers email verification over TOTP. Requires the temporary mfaToken.',
      body: Type.Object({
        mfaToken: Type.String({ description: 'Temporary MFA token from login' }),
      }),
      response: {
        200: MfaMessageResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    handler: controller.sendEmailCode.bind(controller),
  });
}
