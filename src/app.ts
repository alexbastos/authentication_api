// ─── Fastify Application Setup ────────────────────────────────────────────

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import type { Env } from './infrastructure/config/env.js';
import type { Container } from './container.js';
import { registerAuthRoutes } from './adapters/http/routes/auth.routes.js';
import { registerUserRoutes } from './adapters/http/routes/user.routes.js';
import { registerClientAppRoutes } from './adapters/http/routes/client-app.routes.js';
import { DomainError } from './domain/errors/domain-errors.js';

export async function buildApp(env: Env, container: Container): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }),
    },
  });

  // ─── Security Plugins ───────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false, // Disabled for Swagger UI
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      const allowedOrigins = env.CORS_ORIGIN.split(',');
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        cb(null, true);
        return;
      }

      // Automatically allow any localhost port for local development
      if (/^http:\/\/localhost:\d+$/.test(origin)) {
        cb(null, true);
        return;
      }

      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  });

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    redis: container.redis.getClient(),
  });

  // ─── Swagger / OpenAPI ──────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Authentication API — Identity Provider',
        description: `
## Overview
Centralized Identity Provider (IdP) microservice built with **Clean Architecture**.

Supports:
- **Email/Password** authentication
- **Social Login** (Google, Apple, Facebook, GitHub)
- **JWT RS256** tokens with JWKS endpoint
- **Refresh Token Rotation** with reuse detection
- **Token Blocklist** via Redis
- **RBAC** (Role-Based Access Control)

## Authentication
All protected endpoints require a Bearer token in the Authorization header:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

## Token Strategy
- **Access Token**: JWT RS256, 15-minute TTL
- **Refresh Token**: Opaque token, 7-day TTL with rotation
- **JWKS**: Public key available at \`/authentication_api/api/v1/auth/.well-known/jwks.json\`
        `.trim(),
        version: '1.0.0',
        contact: {
          name: 'API Support',
        },
      },

      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT access token obtained from /authentication_api/api/v1/auth/login',
          },
        },
      },
      tags: [
        { name: 'Auth', description: 'Authentication endpoints (login, register, refresh, logout)' },
        { name: 'Social Login', description: 'Social provider authentication (Google, Apple, etc.)' },
        { name: 'Users', description: 'User CRUD operations' },
        { name: 'Client Apps', description: 'Third-party application management' },
        { name: 'API Gateway', description: 'Endpoints for API Gateway integration' },
        { name: 'OIDC', description: 'OpenID Connect discovery endpoints' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs/authentication_api',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
  });

  // ─── Health Check ───────────────────────────────────────────────────
  app.get('/health/authentication_api', {
    schema: {
      tags: ['Health'],
      summary: 'Health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
    handler: async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }),
  });

  // ─── Routes ─────────────────────────────────────────────────────────
  registerAuthRoutes(app, container.authController, container.authMiddleware);
  registerUserRoutes(app, container.userController, container.authMiddleware);
  registerClientAppRoutes(app, container.clientAppController, container.authMiddleware);

  // ─── Global Error Handler ───────────────────────────────────────────
  app.setErrorHandler((error: Error & { validation?: unknown; code?: string; statusCode?: number }, _request, reply) => {
    const logger = app.log;

    // Domain errors → mapped HTTP status codes
    if (error instanceof DomainError) {
      const statusMap: Record<string, number> = {
        INVALID_CREDENTIALS: 401,
        TOKEN_EXPIRED: 401,
        TOKEN_REVOKED: 401,
        INVALID_TOKEN: 401,
        REFRESH_TOKEN_REUSED: 401,
        USER_INACTIVE: 403,
        FORBIDDEN: 403,
        EMAIL_NOT_VERIFIED: 403,
        ACCOUNT_LOCKED: 429,
        USER_ALREADY_EXISTS: 409,
        CLIENT_APP_ALREADY_EXISTS: 409,
        USER_NOT_FOUND: 404,
        CLIENT_APP_NOT_FOUND: 404,
        WEAK_PASSWORD: 400,
        SOCIAL_AUTH_FAILED: 400,
        INVALID_VERIFICATION_TOKEN: 400,
        EXPIRED_VERIFICATION_TOKEN: 400,
      };

      const statusCode = statusMap[error.code] ?? 500;

      logger.warn({ code: error.code, message: error.message }, 'Domain error');

      return reply.status(statusCode).send({
        statusCode,
        error: statusCode >= 500 ? 'Internal Server Error' : error.name,
        code: error.code,
        message: error.message,
      });
    }

    // Fastify validation errors
    if (error.validation) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    // Unexpected errors
    logger.error(error, 'Unexpected error');

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });

  return app;
}

