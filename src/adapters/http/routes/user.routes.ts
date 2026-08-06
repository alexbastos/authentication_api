// ─── User Routes ──────────────────────────────────────────────────────────

import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import type { UserController } from '../controllers/user.controller.js';
import {
  UserResponseSchema,
  UpdateUserBodySchema,
  UserIdParamsSchema,
  ListUsersQuerySchema,
  PaginatedUsersResponseSchema,
} from '../schemas/user.schema.js';
import { ErrorResponseSchema } from '../schemas/auth.schema.js';
import { Role } from '../../../domain/entities/role.entity.js';
import { createRoleMiddleware } from '../middlewares/role.middleware.js';

export function registerUserRoutes(
  app: FastifyInstance,
  controller: UserController,
  authMiddleware: preHandlerHookHandler,
) {
  // ─── GET /authentication_api/api/v1/users/me ───────────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/users/me',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Users'],
      summary: 'Get current user profile',
      description: 'Returns the profile of the authenticated user.',
      response: {
        200: UserResponseSchema,
        401: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.getMe(request, reply),
  });

  // ─── GET /authentication_api/api/v1/users ──────────────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/users',
    preHandler: [authMiddleware, createRoleMiddleware(Role.ADMIN)],
    schema: {
      tags: ['Users'],
      summary: 'List all users (Admin only)',
      description: 'Returns a paginated list of users. Supports filtering by role, status, and search by name/email.',
      querystring: ListUsersQuerySchema,
      response: {
        200: PaginatedUsersResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.list(request as any, reply),
  });

  // ─── GET /authentication_api/api/v1/users/:id ──────────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/users/:id',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Users'],
      summary: 'Get user by ID',
      description: 'Returns user details by ID. Admins can view any user; regular users can only view themselves.',
      params: UserIdParamsSchema,
      response: {
        200: UserResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.getById(request as any, reply),
  });

  // ─── PUT /authentication_api/api/v1/users/:id ──────────────────────────────────────────
  app.route({
    method: 'PUT',
    url: '/authentication_api/api/v1/users/:id',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Users'],
      summary: 'Update user',
      description: 'Updates user profile. Users can update their own profile; admins can update any user and change roles.',
      params: UserIdParamsSchema,
      body: UpdateUserBodySchema,
      response: {
        200: UserResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.update(request as any, reply),
  });

  // ─── DELETE /authentication_api/api/v1/users/:id ───────────────────────────────────────
  app.route({
    method: 'DELETE',
    url: '/authentication_api/api/v1/users/:id',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Users'],
      summary: 'Deactivate user (soft delete)',
      description: 'Sets user status to INACTIVE and revokes all refresh tokens. Users can deactivate themselves; admins can deactivate any user.',
      params: UserIdParamsSchema,
      response: {
        204: { type: 'null' as const, description: 'User deactivated' },
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.delete(request as any, reply),
  });
}
