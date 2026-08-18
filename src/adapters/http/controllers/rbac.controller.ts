// ─── RBAC Controller ──────────────────────────────────────────────────────

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ListPermissionsUseCase } from '../../../application/use-cases/rbac/list-permissions.use-case.js';
import type { CreateCustomRoleUseCase } from '../../../application/use-cases/rbac/create-custom-role.use-case.js';
import type { UpdateCustomRoleUseCase } from '../../../application/use-cases/rbac/update-custom-role.use-case.js';
import type { DeleteCustomRoleUseCase } from '../../../application/use-cases/rbac/delete-custom-role.use-case.js';
import type { AssignRoleToUserUseCase } from '../../../application/use-cases/rbac/assign-role-to-user.use-case.js';
import type { RemoveRoleFromUserUseCase } from '../../../application/use-cases/rbac/remove-role-from-user.use-case.js';
import type { GetUserPermissionsUseCase } from '../../../application/use-cases/rbac/get-user-permissions.use-case.js';
import type { ICustomRoleRepository } from '../../../domain/repositories/custom-role.repository.js';
import type {
  RoleIdParams, UserIdParams, UserRoleParams,
  CreateRoleBody, UpdateRoleBody, AssignRoleBody,
} from '../schemas/rbac.schema.js';

export class RbacController {
  constructor(
    private readonly listPermissionsUC: ListPermissionsUseCase,
    private readonly createRoleUC: CreateCustomRoleUseCase,
    private readonly updateRoleUC: UpdateCustomRoleUseCase,
    private readonly deleteRoleUC: DeleteCustomRoleUseCase,
    private readonly assignRoleUC: AssignRoleToUserUseCase,
    private readonly removeRoleUC: RemoveRoleFromUserUseCase,
    private readonly getUserPermissionsUC: GetUserPermissionsUseCase,
    private readonly roleRepository: ICustomRoleRepository,
  ) {}

  async listPermissions(request: FastifyRequest<{ Querystring: { category?: string } }>, reply: FastifyReply) {
    const result = await this.listPermissionsUC.execute(request.query.category);
    return reply.status(200).send(result.map((p) => p.toJSON()));
  }

  async createRole(request: FastifyRequest<{ Body: CreateRoleBody }>, reply: FastifyReply) {
    const result = await this.createRoleUC.execute({
      name: request.body.name,
      description: request.body.description,
      organizationId: request.body.organizationId,
      permissionCodes: request.body.permissionCodes,
    });
    return reply.status(201).send(result.toJSON());
  }

  async listRoles(_request: FastifyRequest, reply: FastifyReply) {
    const result = await this.roleRepository.list();
    return reply.status(200).send(result.map((r) => r.toJSON()));
  }

  async getRole(request: FastifyRequest<{ Params: RoleIdParams }>, reply: FastifyReply) {
    const result = await this.roleRepository.findById(request.params.id);
    if (!result) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'RoleNotFoundError',
        code: 'ROLE_NOT_FOUND',
        message: `Role not found: ${request.params.id}`,
      });
    }
    return reply.status(200).send(result.toJSON());
  }

  async updateRole(request: FastifyRequest<{ Params: RoleIdParams; Body: UpdateRoleBody }>, reply: FastifyReply) {
    const result = await this.updateRoleUC.execute({
      id: request.params.id,
      name: request.body.name,
      description: request.body.description,
      permissionCodes: request.body.permissionCodes,
    });
    return reply.status(200).send(result.toJSON());
  }

  async deleteRole(request: FastifyRequest<{ Params: RoleIdParams }>, reply: FastifyReply) {
    await this.deleteRoleUC.execute(request.params.id);
    return reply.status(204).send();
  }

  async assignRoleToUser(request: FastifyRequest<{ Params: UserIdParams; Body: AssignRoleBody }>, reply: FastifyReply) {
    await this.assignRoleUC.execute({
      userId: request.params.id,
      roleId: request.body.roleId,
      organizationId: request.body.organizationId,
    });
    return reply.status(201).send({ message: 'Role assigned successfully' });
  }

  async removeRoleFromUser(request: FastifyRequest<{ Params: UserRoleParams }>, reply: FastifyReply) {
    await this.removeRoleUC.execute(request.params.id, request.params.roleId);
    return reply.status(204).send();
  }

  async getUserPermissions(request: FastifyRequest<{ Params: UserIdParams }>, reply: FastifyReply) {
    const result = await this.getUserPermissionsUC.execute(request.params.id);
    return reply.status(200).send(result);
  }
}
