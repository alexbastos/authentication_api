// ─── Organization Routes ──────────────────────────────────────────────────

import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import type { OrganizationController } from '../controllers/organization.controller.js';
import {
  CreateOrganizationBodySchema,
  UpdateOrganizationBodySchema,
  OrganizationResponseSchema,
  OrganizationWithRoleResponseSchema,
  OrgIdParamsSchema,
  MemberParamsSchema,
  MemberResponseSchema,
  InviteMemberBodySchema,
  InvitationResponseSchema,
  AcceptInvitationBodySchema,
  AcceptInvitationResponseSchema,
  ChangeMemberRoleBodySchema,
} from '../schemas/organization.schema.js';
import { ErrorResponseSchema } from '../schemas/auth.schema.js';
import { Type } from '@sinclair/typebox';

export function registerOrganizationRoutes(
  app: FastifyInstance,
  controller: OrganizationController,
  authMiddleware: preHandlerHookHandler,
) {
  // ─── POST /authentication_api/api/v1/organizations ──────────────────────────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/organizations',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Organizations'],
      summary: 'Create organization',
      description: 'Creates a new organization. The authenticated user becomes the OWNER.',
      body: CreateOrganizationBodySchema,
      response: {
        201: OrganizationResponseSchema,
        401: ErrorResponseSchema,
        409: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.create(request as any, reply),
  });

  // ─── GET /authentication_api/api/v1/organizations ───────────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/organizations',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Organizations'],
      summary: 'List my organizations',
      description: 'Returns all organizations the authenticated user is a member of, with their role.',
      response: {
        200: Type.Array(OrganizationWithRoleResponseSchema),
        401: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.list(request, reply),
  });

  // ─── GET /authentication_api/api/v1/organizations/:orgId ────────────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/organizations/:orgId',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Organizations'],
      summary: 'Get organization details',
      description: 'Returns organization details. Requires membership.',
      params: OrgIdParamsSchema,
      response: {
        200: OrganizationWithRoleResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.getById(request as any, reply),
  });

  // ─── PUT /authentication_api/api/v1/organizations/:orgId ────────────────────
  app.route({
    method: 'PUT',
    url: '/authentication_api/api/v1/organizations/:orgId',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Organizations'],
      summary: 'Update organization',
      description: 'Updates organization details. Requires OWNER or ADMIN role.',
      params: OrgIdParamsSchema,
      body: UpdateOrganizationBodySchema,
      response: {
        200: OrganizationResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.update(request as any, reply),
  });

  // ─── GET /authentication_api/api/v1/organizations/:orgId/members ────────────
  app.route({
    method: 'GET',
    url: '/authentication_api/api/v1/organizations/:orgId/members',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Organizations'],
      summary: 'List organization members',
      description: 'Returns all members of the organization. Requires membership.',
      params: OrgIdParamsSchema,
      response: {
        200: Type.Array(MemberResponseSchema),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.listMembers(request as any, reply),
  });

  // ─── POST /authentication_api/api/v1/organizations/:orgId/invitations ───────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/organizations/:orgId/invitations',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Organizations'],
      summary: 'Invite member',
      description: 'Sends an invitation to join the organization. Requires OWNER or ADMIN role. Returns the invitation with a plain token for email delivery.',
      params: OrgIdParamsSchema,
      body: InviteMemberBodySchema,
      response: {
        201: InvitationResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.inviteMember(request as any, reply),
  });

  // ─── POST /authentication_api/api/v1/organizations/invitations/accept ───────
  app.route({
    method: 'POST',
    url: '/authentication_api/api/v1/organizations/invitations/accept',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Organizations'],
      summary: 'Accept invitation',
      description: 'Accepts an organization invitation using the token received via email. The authenticated user is added as a member with the invited role.',
      body: AcceptInvitationBodySchema,
      response: {
        200: AcceptInvitationResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.acceptInvitation(request as any, reply),
  });

  // ─── DELETE /authentication_api/api/v1/organizations/:orgId/members/:userId ─
  app.route({
    method: 'DELETE',
    url: '/authentication_api/api/v1/organizations/:orgId/members/:userId',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Organizations'],
      summary: 'Remove member',
      description: 'Removes a member from the organization. Requires OWNER or ADMIN role. The OWNER cannot be removed.',
      params: MemberParamsSchema,
      response: {
        204: { type: 'null' as const, description: 'Member removed' },
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.removeMember(request as any, reply),
  });

  // ─── PUT /authentication_api/api/v1/organizations/:orgId/members/:userId/role
  app.route({
    method: 'PUT',
    url: '/authentication_api/api/v1/organizations/:orgId/members/:userId/role',
    preHandler: [authMiddleware],
    schema: {
      tags: ['Organizations'],
      summary: 'Change member role',
      description: 'Changes a member\'s role. Only the OWNER can change roles. The OWNER\'s own role cannot be changed.',
      params: MemberParamsSchema,
      body: ChangeMemberRoleBodySchema,
      response: {
        200: MemberResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      security: [{ bearerAuth: [] }],
    },
    handler: (request: FastifyRequest, reply: FastifyReply) => controller.changeMemberRole(request as any, reply),
  });
}
