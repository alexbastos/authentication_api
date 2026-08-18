// ─── RBAC Routes ──────────────────────────────────────────────────────────

import type { FastifyInstance, preHandlerHookHandler } from 'fastify';
import type { RbacController } from '../controllers/rbac.controller.js';
import {
  PermissionListResponseSchema,
  CreateRoleBodySchema, RoleResponseSchema, RoleListResponseSchema,
  UpdateRoleBodySchema, RoleIdParamsSchema,
  AssignRoleBodySchema, UserIdParamsSchema, UserRoleParamsSchema,
  UserPermissionsResponseSchema, MessageResponseSchema, ErrorResponseSchema,
} from '../schemas/rbac.schema.js';

export function registerRbacRoutes(
  app: FastifyInstance,
  controller: RbacController,
  authMiddleware: preHandlerHookHandler,
) {
  // ─── GET /api/v1/rbac/permissions ──────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/rbac/permissions',
    preHandler: [authMiddleware],
    schema: {
      tags: ['RBAC'],
      summary: 'List all permissions',
      description: 'Returns all available permissions, optionally filtered by category.',
      querystring: { type: 'object', properties: { category: { type: 'string' } } },
      response: {
        200: PermissionListResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.listPermissions(request as any, reply),
  });

  // ─── POST /api/v1/rbac/roles ───────────────────────────────────────────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/rbac/roles',
    preHandler: [authMiddleware],
    schema: {
      tags: ['RBAC'],
      summary: 'Create custom role',
      description: 'Creates a new custom role with specified permissions. System roles cannot be created via this endpoint.',
      body: CreateRoleBodySchema,
      response: {
        201: RoleResponseSchema,
        400: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.createRole(request as any, reply),
  });

  // ─── GET /api/v1/rbac/roles ────────────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/rbac/roles',
    preHandler: [authMiddleware],
    schema: {
      tags: ['RBAC'],
      summary: 'List all roles',
      description: 'Returns all roles (system + custom) with their permissions.',
      response: {
        200: RoleListResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.listRoles(request as any, reply),
  });

  // ─── GET /api/v1/rbac/roles/:id ────────────────────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/rbac/roles/:id',
    preHandler: [authMiddleware],
    schema: {
      tags: ['RBAC'],
      summary: 'Get role details',
      description: 'Returns a role with all its permissions.',
      params: RoleIdParamsSchema,
      response: {
        200: RoleResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.getRole(request as any, reply),
  });

  // ─── PUT /api/v1/rbac/roles/:id ────────────────────────────────────────
  app.route({
    method: 'PUT',
    url: '/authentication_api/api/v1/rbac/roles/:id',
    preHandler: [authMiddleware],
    schema: {
      tags: ['RBAC'],
      summary: 'Update custom role',
      description: 'Updates name, description, or permissions of a custom role. System roles cannot be modified.',
      params: RoleIdParamsSchema,
      body: UpdateRoleBodySchema,
      response: {
        200: RoleResponseSchema,
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.updateRole(request as any, reply),
  });

  // ─── DELETE /api/v1/rbac/roles/:id ─────────────────────────────────────
  app.route({
    method: 'DELETE',
    url: '/authentication_api/api/v1/rbac/roles/:id',
    preHandler: [authMiddleware],
    schema: {
      tags: ['RBAC'],
      summary: 'Delete custom role',
      description: 'Deletes a custom role. System roles cannot be deleted.',
      params: RoleIdParamsSchema,
      response: {
        204: { type: 'null', description: 'Role deleted' },
        400: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.deleteRole(request as any, reply),
  });

  // ─── POST /api/v1/rbac/users/:id/roles ─────────────────────────────────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/rbac/users/:id/roles',
    preHandler: [authMiddleware],
    schema: {
      tags: ['RBAC'],
      summary: 'Assign role to user',
      description: 'Assigns a role to a user, optionally scoped to an organization.',
      params: UserIdParamsSchema,
      body: AssignRoleBodySchema,
      response: {
        201: MessageResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.assignRoleToUser(request as any, reply),
  });

  // ─── DELETE /api/v1/rbac/users/:id/roles/:roleId ───────────────────────
  app.route({
    method: 'DELETE',
    url: '/authentication_api/api/v1/rbac/users/:id/roles/:roleId',
    preHandler: [authMiddleware],
    schema: {
      tags: ['RBAC'],
      summary: 'Remove role from user',
      description: 'Removes a role assignment from a user.',
      params: UserRoleParamsSchema,
      response: {
        204: { type: 'null', description: 'Role removed' },
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.removeRoleFromUser(request as any, reply),
  });

  // ─── GET /api/v1/rbac/users/:id/permissions ────────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/rbac/users/:id/permissions',
    preHandler: [authMiddleware],
    schema: {
      tags: ['RBAC'],
      summary: 'Get user effective permissions',
      description: 'Returns all effective permissions for a user across all assigned roles.',
      params: UserIdParamsSchema,
      response: {
        200: UserPermissionsResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request, reply) => controller.getUserPermissions(request as any, reply),
  });
}
