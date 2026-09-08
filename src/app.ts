// ─── Fastify Application Setup ────────────────────────────────────────────

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart, { ajvFilePlugin } from '@fastify/multipart';

import type { Env } from './infrastructure/config/env.js';
import type { Container } from './container.js';
import { registerAuthRoutes } from './adapters/http/routes/auth.routes.js';
import { registerUserRoutes } from './adapters/http/routes/user.routes.js';
import { registerClientAppRoutes } from './adapters/http/routes/client-app.routes.js';
import { registerSessionRoutes } from './adapters/http/routes/session.routes.js';
import { registerOrganizationRoutes } from './adapters/http/routes/organization.routes.js';
import { registerRbacRoutes } from './adapters/http/routes/rbac.routes.js';
import { registerWebhookRoutes } from './adapters/http/routes/webhook.routes.js';
import { registerOAuthRoutes } from './adapters/http/routes/oauth.routes.js';
import { registerMfaRoutes } from './adapters/http/routes/mfa.routes.js';
import { DomainError } from './domain/errors/domain-errors.js';
import fs from 'node:fs';
import path from 'node:path';

let versionData = { branch: 'local-dev', commit: 'untracked', date: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) };
try {
  const versionPath = path.resolve(process.cwd(), 'version.json');
  if (fs.existsSync(versionPath)) {
    versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
  }
} catch (e) {
  // Silent fallback
}


export async function buildApp(env: Env, container: Container): Promise<FastifyInstance> {
  const docsEnabled = env.NODE_ENV !== 'production' || env.ENABLE_SWAGGER;
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          'password',
          'token',
          'refreshToken',
          'clientSecret',
          'code',
          '*.password',
          '*.token',
          '*.refreshToken',
          '*.clientSecret',
          '*.code',
        ],
        censor: '[Redacted]',
      },
      ...(env.NODE_ENV === 'development' && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }),
    },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: Math.max(1024 * 1024, env.AVATAR_MAX_SIZE_MB * 1024 * 1024 + 64 * 1024),
    ajv: {
      plugins: [(ajv) => {
        ajvFilePlugin(ajv);
        return ajv;
      }],
    },
  });

  // ─── Security Plugins ───────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: docsEnabled ? false : undefined,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }

      const allowedOrigins = env.CORS_ORIGIN.split(',').map((value) => value.trim());
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        cb(null, true);
        return;
      }

      // Automatically allow any localhost port for local development
      if (env.NODE_ENV === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
        cb(null, true);
        return;
      }

      cb(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  });

  // Test Redis connectivity before using it for rate-limit.
  // If Redis is unavailable, fall back to in-memory store to prevent
  // 503 "Service Unavailable" on ALL requests.
  let rateLimitRedis: Record<string, unknown> | undefined;
  try {
    const pong = await container.redis.getClient().ping();
    if (pong === 'PONG') {
      rateLimitRedis = { redis: container.redis.getClient() };
      app.log.info('✅ Rate-limit using Redis store');
    }
  } catch {
    if (env.NODE_ENV === 'production') {
      throw new Error('Redis is required for distributed rate limiting in production');
    }
    app.log.warn('⚠️  Redis unavailable for rate-limit, falling back to in-memory store');
  }

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    ...rateLimitRedis,
  });

  // ─── Multipart (File Upload) ────────────────────────────────────────
  await app.register(multipart, {
    attachFieldsToBody: true,
    limits: {
      fileSize: (env.AVATAR_MAX_SIZE_MB || 5) * 1024 * 1024,
      files: 1,
    },
  });

  // ─── Swagger / OpenAPI ──────────────────────────────────────────────
  if (docsEnabled) await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Authentication API — Identity Provider',
        description: `
**🚀 Versão Atual da API:**
- **Branch:** \`${versionData.branch}\`
- **Commit:** \`${versionData.commit}\`
- **Data do Build:** \`${versionData.date}\`

---

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
        { name: 'Sessions', description: 'Active session management (list, revoke)' },
        { name: 'Login History', description: 'Login attempt audit trail' },
        { name: 'Social Accounts', description: 'Link/unlink social provider accounts' },
        { name: 'Client Apps', description: 'Third-party application management' },
        { name: 'Organizations', description: 'Organization management (multi-tenancy)' },
        { name: 'API Gateway', description: 'Endpoints for API Gateway integration' },
        { name: 'OIDC', description: 'OpenID Connect discovery endpoints' },
        { name: 'MFA/2FA', description: 'Multi-Factor Authentication setup, verification, and management' },
      ],
    },
  });

  if (docsEnabled) await app.register(swaggerUi, {
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
        503: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
    handler: async (_request, reply) => {
      const response = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };

      try {
        await Promise.all([
          container.prisma.$queryRaw`SELECT 1`,
          container.redis.getClient().ping(),
        ]);
        return response;
      } catch {
        return reply.status(503).send({ ...response, status: 'unavailable' });
      }
    },
  });

  // ─── Routes ─────────────────────────────────────────────────────────
  registerAuthRoutes(app, container.authController, container.authMiddleware);
  registerUserRoutes(app, container.userController, container.authMiddleware);
  registerClientAppRoutes(app, container.clientAppController, container.authMiddleware);
  registerSessionRoutes(app, container.sessionController, container.authMiddleware);
  registerOrganizationRoutes(app, container.organizationController, container.authMiddleware);
  registerRbacRoutes(app, container.rbacController, container.authMiddleware);
  registerWebhookRoutes(app, container.webhookController, container.authMiddleware);
  registerOAuthRoutes(
    app,
    container.oauthController,
    container.authMiddleware,
    container.oauthAuthMiddleware ?? container.authMiddleware,
  );
  registerMfaRoutes(app, container.mfaController, container.authMiddleware);

  // ─── Global Error Handler ───────────────────────────────────────────
  app.setErrorHandler((error: Error & { validation?: unknown; code?: string; statusCode?: number }, request, reply) => {
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
        EMAIL_COOLDOWN: 429,
        USER_ALREADY_EXISTS: 409,
        CLIENT_APP_ALREADY_EXISTS: 409,
        USER_NOT_FOUND: 404,
        CLIENT_APP_NOT_FOUND: 404,
        WEAK_PASSWORD: 400,
        SOCIAL_AUTH_FAILED: 400,
        INVALID_VERIFICATION_TOKEN: 400,
        EXPIRED_VERIFICATION_TOKEN: 400,
        SESSION_NOT_FOUND: 404,
        CANNOT_REMOVE_LAST_AUTH_METHOD: 400,
        SOCIAL_ACCOUNT_NOT_LINKED: 404,
        ORGANIZATION_NOT_FOUND: 404,
        ORGANIZATION_SLUG_TAKEN: 409,
        NOT_ORGANIZATION_MEMBER: 403,
        CANNOT_REMOVE_OWNER: 400,
        CANNOT_ASSIGN_OWNER: 400,
        INVITATION_NOT_FOUND: 404,
        INVITATION_EXPIRED: 400,
        INVITATION_ALREADY_ACCEPTED: 400,
        INVITATION_EMAIL_MISMATCH: 403,
        INSUFFICIENT_ORG_ROLE: 403,
        INSUFFICIENT_PERMISSIONS: 403,
        ROLE_NOT_FOUND: 404,
        PERMISSION_NOT_FOUND: 404,
        ROLE_ALREADY_EXISTS: 409,
        SYSTEM_ROLE_MODIFICATION: 400,
        WEBHOOK_NOT_FOUND: 404,
        INVALID_WEBHOOK_URL: 400,
        INVALID_REDIRECT_URI: 400,
        INVALID_CODE_CHALLENGE: 400,
        INVALID_SCOPE: 400,
        CONSENT_REQUIRED: 403,
        INVALID_GRANT: 400,
        INVALID_CLIENT: 401,
        INVALID_OAUTH_STATE: 400,
        UNSUPPORTED_GRANT_TYPE: 400,
        AUTHORIZATION_CODE_EXPIRED: 400,
        // MFA errors
        MFA_TOKEN_INVALID: 401,
        MFA_TOKEN_EXPIRED: 401,
        MFA_CODE_INVALID: 401,
        MFA_METHOD_NOT_ALLOWED: 400,
        MFA_ATTEMPTS_EXCEEDED: 429,
        MFA_ALREADY_ENABLED: 409,
        MFA_NOT_ENABLED: 400,
        MFA_SETUP_NOT_STARTED: 400,
        MFA_RATE_LIMITED: 429,
        // Avatar errors
        INVALID_FILE_TYPE: 400,
        FILE_TOO_LARGE: 400,
        INVALID_FILE_CONTENT: 400,
      };

      const statusCode = statusMap[error.code] ?? 500;
      const oauthErrorNames: Record<string, string> = {
        INVALID_CLIENT: 'invalid_client',
        INVALID_GRANT: 'invalid_grant',
        INVALID_SCOPE: 'invalid_scope',
        UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
        INVALID_CODE_CHALLENGE: 'invalid_grant',
        AUTHORIZATION_CODE_EXPIRED: 'invalid_grant',
      };
      const isOAuthTokenEndpoint = request.url === '/oauth/token';
      if (isOAuthTokenEndpoint && error.code === 'INVALID_CLIENT') {
        reply.header('WWW-Authenticate', 'Basic realm="oauth/token"');
      }

      logger.warn({ code: error.code }, 'Domain error');

      return reply.status(statusCode).send({
        statusCode,
        error: statusCode >= 500
          ? 'Internal Server Error'
          : (isOAuthTokenEndpoint ? oauthErrorNames[error.code] : undefined) ?? error.name,
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

    // Multipart size errors happen while the plugin is parsing the request,
    // before the avatar use case can apply its own size validation.
    if (error instanceof app.multipartErrors.RequestFileTooLargeError) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'FileTooLargeError',
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds the maximum allowed (${env.AVATAR_MAX_SIZE_MB} MB)`,
      });
    }

    // Unexpected errors
    logger.error(
      { errorName: error.name, errorCode: error.code },
      'Unexpected error',
    );

    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });

  return app;
}
