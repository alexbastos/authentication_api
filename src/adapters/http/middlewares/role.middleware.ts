// ─── Role-Based Access Control Middleware ─────────────────────────────────

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Role } from '../../../domain/entities/role.entity.js';

export function createRoleMiddleware(...allowedRoles: Role[]) {
  return async function checkRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
        message: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        code: 'INSUFFICIENT_ROLE',
        message: `Required role: ${allowedRoles.join(' or ')}`,
      });
      return;
    }
  };
}
