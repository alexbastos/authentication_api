// ─── Organization Membership Middleware ────────────────────────────────────
// Fastify preHandler that checks org membership and minimum role

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import { OrgRole } from '../../../domain/entities/role.entity.js';

const ORG_ROLE_HIERARCHY: Record<OrgRole, number> = {
  [OrgRole.VIEWER]: 0,
  [OrgRole.MEMBER]: 1,
  [OrgRole.ADMIN]: 2,
  [OrgRole.OWNER]: 3,
};

/**
 * Creates a middleware that verifies the authenticated user is a member
 * of the organization specified by `:orgId` param and has at least the
 * specified minimum role.
 *
 * Must be used AFTER authMiddleware (requires `request.user`).
 */
export function createOrgMemberMiddleware(
  orgRepository: IOrganizationRepository,
  minRole: OrgRole = OrgRole.VIEWER,
) {
  return async function checkOrgMembership(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    if (!request.user) {
      reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        code: 'MISSING_TOKEN',
        message: 'Authentication required',
      });
      return;
    }

    const params = request.params as { orgId?: string };
    const orgId = params.orgId;

    if (!orgId) {
      reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        code: 'MISSING_ORG_ID',
        message: 'Organization ID is required',
      });
      return;
    }

    const member = await orgRepository.findMember(orgId, request.user.sub);
    if (!member) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        code: 'NOT_ORGANIZATION_MEMBER',
        message: 'You are not a member of this organization',
      });
      return;
    }

    const memberLevel = ORG_ROLE_HIERARCHY[member.role];
    const requiredLevel = ORG_ROLE_HIERARCHY[minRole];

    if (memberLevel < requiredLevel) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        code: 'INSUFFICIENT_ORG_ROLE',
        message: `This action requires at least ${minRole} role in the organization`,
      });
      return;
    }
  };
}
