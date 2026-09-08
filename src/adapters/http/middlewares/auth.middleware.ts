// ─── JWT Authentication Middleware ────────────────────────────────────────
// Fastify preHandler hook that validates Bearer token

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ITokenManager, TokenPayload } from '../../../application/ports/token-manager.port.js';
import type { ICacheProvider } from '../../../application/ports/cache.port.js';
import type { IUserRepository } from '../../../domain/repositories/user.repository.js';
import type { ISessionRepository } from '../../../domain/repositories/session.repository.js';

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
  userRepository: IUserRepository,
  sessionRepository: ISessionRepository,
  options?: { allowAnyAudience?: boolean },
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
      const payload = await tokenManager.verifyAccessToken(token, options);

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

      const user = await userRepository.findById(payload.sub);
      if (!user || !user.isActive) {
        reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          code: 'USER_INACTIVE',
          message: 'User account is unavailable',
        });
        return;
      }

      if (!options?.allowAnyAudience) {
        if (!payload.sid) {
          reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            code: 'SESSION_REVOKED',
            message: 'Session is missing or revoked',
          });
          return;
        }
        const session = await sessionRepository.findById(payload.sid);
        if (!session || !session.isActive || session.userId !== payload.sub) {
          reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            code: 'SESSION_REVOKED',
            message: 'Session is missing or revoked',
          });
          return;
        }
      }

      request.user = { ...payload, email: user.email, role: user.role };
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
