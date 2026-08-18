// ─── Permission Middleware ─────────────────────────────────────────────────
// Checks if the authenticated user has ALL required permissions

import type { FastifyRequest, FastifyReply } from 'fastify';

export function createPermissionMiddleware(...requiredPermissions: string[]) {
  return async function checkPermissions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = request.user;

    if (!user) {
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
        message: 'Authentication required',
      });
      return;
    }

    const userPermissions = new Set(user.permissions ?? []);

    // ADMIN role bypasses permission checks (backward compatibility)
    if (user.role === 'ADMIN') {
      return;
    }

    const missing = requiredPermissions.filter((p) => !userPermissions.has(p));

    if (missing.length > 0) {
      reply.status(403).send({
        statusCode: 403,
        error: 'InsufficientPermissionsError',
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Missing required permissions: ${missing.join(', ')}`,
      });
    }
  };
}
