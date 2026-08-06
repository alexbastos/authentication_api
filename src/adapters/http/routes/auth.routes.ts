// ─── Auth Routes ──────────────────────────────────────────────────────────

import type { FastifyInstance } from 'fastify';
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
} from '../schemas/auth.schema.js';

export function registerAuthRoutes(
  app: FastifyInstance,
  controller: AuthController,
) {
  // ─── POST /authentication_api/api/v1/auth/register ─────────────────────────────────────
  app.post('/authentication_api/api/v1/auth/register', {
    schema: {
      tags: ['Auth'],
      summary: 'Register a new user',
      description: 'Creates a new user account with email and password. Validates password complexity.',
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
      description: 'Authenticates user credentials and returns JWT access token + refresh token.',
      body: LoginBodySchema,
      response: {
        200: TokenResponseSchema,
        401: ErrorResponseSchema,
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
