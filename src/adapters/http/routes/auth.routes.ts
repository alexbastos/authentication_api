// ─── Auth Routes ──────────────────────────────────────────────────────────

import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { AuthController } from '../controllers/auth.controller.js';
import {
  LoginBodySchema,
  TokenResponseSchema,
  RegisterBodySchema,
  RegisterResponseSchema,
  SocialLoginBodySchema,
  SocialLoginResponseSchema,
  RefreshTokenBodySchema,
  RefreshTokenResponseSchema,
  LogoutBodySchema,
  ValidateTokenBodySchema,
  ValidateTokenResponseSchema,
  JWKSResponseSchema,
  ErrorResponseSchema,
  MessageResponseSchema,
  VerifyEmailBodySchema,
  ForgotPasswordBodySchema,
  ResetPasswordBodySchema,
  ChangePasswordBodySchema,
  ResendVerificationBodySchema,
} from '../schemas/auth.schema.js';

export function registerAuthRoutes(
  app: FastifyInstance,
  controller: AuthController,
  authMiddleware: preHandlerHookHandler,
) {
  // ─── POST /authentication_api/api/v1/auth/register ─────────────────────────────────────
  app.post('/authentication_api/api/v1/auth/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new user',
      description: 'Creates a new user account with email and password. Validates password complexity. Sends a verification email automatically.',
      body: RegisterBodySchema,
      response: {
        201: RegisterResponseSchema,
        400: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
    },
    handler: controller.register.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/login ────────────────────────────────────────
  app.post('/authentication_api/api/v1/auth/login', {
    schema: {
      tags: ['Auth'],
      summary: 'Login with email and password',
      description: 'Authenticates user credentials and returns JWT access token + refresh token. Requires email verification. Includes brute force protection (5 attempts / 15 min).',
      body: LoginBodySchema,
      response: {
        200: TokenResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        429: ErrorResponseSchema,
      },
    },
    handler: controller.login.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/login/social ─────────────────────────────────
  app.post('/authentication_api/api/v1/auth/login/social', {
    schema: {
      tags: ['Auth', 'Social Login'],
      summary: 'Login with social provider (Google, Apple, etc.)',
      description: 'Validates the social provider token, finds or creates the user, and returns internal JWT tokens. The social token is discarded after validation.',
      body: SocialLoginBodySchema,
      response: {
        200: SocialLoginResponseSchema,
        400: ErrorResponseSchema,
      },
    },
    handler: controller.socialLogin.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/verify-email ─────────────────────────────────
  app.post('/authentication_api/api/v1/auth/verify-email', {
    schema: {
      tags: ['Auth', 'Email Verification'],
      summary: 'Verify email address',
      description: 'Confirms the user email address using the token received by email. Must be called before user can log in.',
      body: VerifyEmailBodySchema,
      response: {
        200: MessageResponseSchema,
        400: ErrorResponseSchema,
      },
    },
    handler: controller.verifyEmail.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/resend-verification ──────────────────────────
  app.post('/authentication_api/api/v1/auth/resend-verification', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '15 minutes',
      },
    },
    schema: {
      tags: ['Auth', 'Email Verification'],
      summary: 'Resend verification email',
      description: 'Resends the verification email to the given address. Always returns success to prevent user enumeration.\n\n**Security Protections:**\n- Rate Limited to 3 requests per 15 minutes per IP.\n- Cooldown mechanism: will silently ignore requests if the last token was generated less than 2 minutes ago.',
      body: ResendVerificationBodySchema,
      response: {
        200: MessageResponseSchema,
        429: ErrorResponseSchema,
      },
    },
    handler: controller.resendVerification.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/forgot-password ──────────────────────────────
  app.post('/authentication_api/api/v1/auth/forgot-password', {
    schema: {
      tags: ['Auth', 'Password Recovery'],
      summary: 'Request password reset',
      description: 'Sends a password reset email to the given address. Always returns success to prevent user enumeration. Token expires in 1 hour.',
      body: ForgotPasswordBodySchema,
      response: {
        200: MessageResponseSchema,
      },
    },
    handler: controller.forgotPassword.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/reset-password ───────────────────────────────
  app.post('/authentication_api/api/v1/auth/reset-password', {
    schema: {
      tags: ['Auth', 'Password Recovery'],
      summary: 'Reset password with token',
      description: 'Resets the user password using the token received by email. Revokes all active sessions for security.',
      body: ResetPasswordBodySchema,
      response: {
        200: MessageResponseSchema,
        400: ErrorResponseSchema,
      },
    },
    handler: controller.resetPassword.bind(controller),
  });

  // ─── PUT /authentication_api/api/v1/auth/change-password ───────────────────────────────
  app.route({
    method: 'PUT',
    url: '/authentication_api/api/v1/auth/change-password',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Auth'],
      summary: 'Change password (authenticated)',
      description: 'Changes the password for the authenticated user. Requires current password for confirmation. New password must meet complexity requirements and differ from current.',
      body: ChangePasswordBodySchema,
      response: {
        200: MessageResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: controller.changePassword.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/refresh ──────────────────────────────────────
  app.post('/authentication_api/api/v1/auth/refresh', {
    schema: {
      tags: ['Auth'],
      summary: 'Refresh access token',
      description: 'Exchanges a valid refresh token for a new access token + refresh token pair. Implements token rotation: the old refresh token is invalidated.',
      body: RefreshTokenBodySchema,
      response: {
        200: RefreshTokenResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    handler: controller.refresh.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/logout ───────────────────────────────────────
  app.post('/authentication_api/api/v1/auth/logout', {
    schema: {
      tags: ['Auth'],
      summary: 'Logout (revoke tokens)',
      description: 'Adds the access token JTI to the Redis blocklist and revokes the refresh token. Requires Bearer token in Authorization header.',
      body: LogoutBodySchema,
      response: {
        204: { type: 'null', description: 'Successfully logged out' },
        401: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: controller.logout.bind(controller),
  });

  // ─── POST /authentication_api/api/v1/auth/validate ─────────────────────────────────────
  app.post('/authentication_api/api/v1/auth/validate', {
    schema: {
      tags: ['Auth', 'API Gateway'],
      summary: 'Validate a JWT token',
      description: 'Used by the API Gateway or other microservices to validate an access token. Checks signature, expiration, and Redis blocklist.',
      body: ValidateTokenBodySchema,
      response: {
        200: ValidateTokenResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    handler: controller.validate.bind(controller),
  });

  // ─── GET /authentication_api/api/v1/auth/.well-known/jwks.json ─────────────────────────
  app.get('/authentication_api/api/v1/auth/.well-known/jwks.json', {
    schema: {
      tags: ['Auth', 'OIDC'],
      summary: 'JSON Web Key Set (JWKS)',
      description: 'Public endpoint that exposes the RS256 public key for JWT verification. Other microservices can use this to verify tokens without shared secrets.',
      response: {
        200: JWKSResponseSchema,
      },
    },
    handler: controller.jwks.bind(controller),
  });
}
