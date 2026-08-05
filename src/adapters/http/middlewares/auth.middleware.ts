// ─── JWT Authentication Middleware ────────────────────────────────────────
// Fastify preHandler hook that validates Bearer token

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ITokenManager, TokenPayload } from '../../../application/ports/token-manager.port.js';
import type { ICacheProvider } from '../../../application/ports/cache.port.js';

const BLOCKLIST_PREFIX = 'blocklist:';

// Augment Fastify request to include user info
declare module 'fastify' {
  interface FastifyRequest {
    user?: TokenPayload;
  }
}

export function createAuthMiddleware(
  tokenManager: ITokenManager,
  cacheProvider: ICacheProvider,
) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
        message: 'Authorization header with Bearer token is required',
      });
      return;
    }

    const token = authHeader.slice(7); // Remove "Bearer "

    try {
      const payload = await tokenManager.verifyAccessToken(token);

      // Check blocklist
      const isBlocked = await cacheProvider.exists(`${BLOCKLIST_PREFIX}${payload.jti}`);
      if (isBlocked) {
        reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          code: 'TOKEN_REVOKED',
          message: 'Token has been revoked',
        });
        return;
      }

      request.user = payload;
    } catch {
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    }
  };
}
