// ─── Organization Controller ──────────────────────────────────────────────

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { CreateOrganizationUseCase } from '../../../application/use-cases/organization/create-organization.use-case.js';
import type { ListUserOrganizationsUseCase } from '../../../application/use-cases/organization/list-user-organizations.use-case.js';
import type { GetOrganizationUseCase } from '../../../application/use-cases/organization/get-organization.use-case.js';
import type { UpdateOrganizationUseCase } from '../../../application/use-cases/organization/update-organization.use-case.js';
import type { InviteMemberUseCase } from '../../../application/use-cases/organization/invite-member.use-case.js';
import type { AcceptInvitationUseCase } from '../../../application/use-cases/organization/accept-invitation.use-case.js';
import type { RemoveMemberUseCase } from '../../../application/use-cases/organization/remove-member.use-case.js';
import type { ChangeMemberRoleUseCase } from '../../../application/use-cases/organization/change-member-role.use-case.js';
import type { IOrganizationRepository } from '../../../domain/repositories/organization.repository.js';
import { OrgRole } from '../../../domain/entities/role.entity.js';
import type {
  CreateOrganizationBody,
  UpdateOrganizationBody,
  OrgIdParams,
  MemberParams,
  InviteMemberBody,
  AcceptInvitationBody,
  ChangeMemberRoleBody,
} from '../schemas/organization.schema.js';

export class OrganizationController {
  constructor(
    private readonly createOrgUC: CreateOrganizationUseCase,
    private readonly listUserOrgsUC: ListUserOrganizationsUseCase,
    private readonly getOrgUC: GetOrganizationUseCase,
    private readonly updateOrgUC: UpdateOrganizationUseCase,
    private readonly inviteMemberUC: InviteMemberUseCase,
    private readonly acceptInvitationUC: AcceptInvitationUseCase,
    private readonly removeMemberUC: RemoveMemberUseCase,
    private readonly changeMemberRoleUC: ChangeMemberRoleUseCase,
    private readonly orgRepository: IOrganizationRepository,
  ) {}

  async create(request: FastifyRequest<{ Body: CreateOrganizationBody }>, reply: FastifyReply) {
    const result = await this.createOrgUC.execute({
      name: request.body.name,
      slug: request.body.slug,
      description: request.body.description,
      logoUrl: request.body.logoUrl,
      creatorUserId: request.user!.sub,
    });

    return reply.status(201).send(result);
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.listUserOrgsUC.execute(request.user!.sub);
    return reply.status(200).send(result);
  }

  async getById(request: FastifyRequest<{ Params: OrgIdParams }>, reply: FastifyReply) {
    const result = await this.getOrgUC.execute(request.params.orgId, request.user!.sub);
    return reply.status(200).send(result);
  }

  async update(request: FastifyRequest<{ Params: OrgIdParams; Body: UpdateOrganizationBody }>, reply: FastifyReply) {
    const result = await this.updateOrgUC.execute({
      orgId: request.params.orgId,
      requesterId: request.user!.sub,
      name: request.body.name,
      description: request.body.description,
      logoUrl: request.body.logoUrl,
    });

    return reply.status(200).send(result);
  }

  async listMembers(request: FastifyRequest<{ Params: OrgIdParams }>, reply: FastifyReply) {
    const members = await this.orgRepository.listMembers(request.params.orgId);
    return reply.status(200).send(members.map((m) => m.toJSON()));
  }

  async inviteMember(request: FastifyRequest<{ Params: OrgIdParams; Body: InviteMemberBody }>, reply: FastifyReply) {
    const result = await this.inviteMemberUC.execute({
      orgId: request.params.orgId,
      requesterId: request.user!.sub,
      email: request.body.email,
      role: request.body.role as OrgRole | undefined,
    });

    return reply.status(201).send(result);
  }

  async acceptInvitation(request: FastifyRequest<{ Body: AcceptInvitationBody }>, reply: FastifyReply) {
    const result = await this.acceptInvitationUC.execute({
      token: request.body.token,
      userId: request.user!.sub,
    });

    return reply.status(200).send(result);
  }

  async removeMember(request: FastifyRequest<{ Params: MemberParams }>, reply: FastifyReply) {
    await this.removeMemberUC.execute({
      orgId: request.params.orgId,
      targetUserId: request.params.userId,
      requesterId: request.user!.sub,
    });

    return reply.status(204).send();
  }

  async changeMemberRole(request: FastifyRequest<{ Params: MemberParams; Body: ChangeMemberRoleBody }>, reply: FastifyReply) {
    const result = await this.changeMemberRoleUC.execute({
      orgId: request.params.orgId,
      targetUserId: request.params.userId,
      newRole: request.body.role as OrgRole,
      requesterId: request.user!.sub,
    });

    return reply.status(200).send(result);
  }
}
