// ─── User Controller ──────────────────────────────────────────────────────

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { GetUserUseCase } from '../../../application/use-cases/user/get-user.use-case.js';
import type { UpdateUserUseCase } from '../../../application/use-cases/user/update-user.use-case.js';
import type { DeleteUserUseCase } from '../../../application/use-cases/user/delete-user.use-case.js';
import type { ListUsersUseCase } from '../../../application/use-cases/user/list-users.use-case.js';
import type { UpdateUserBody, UserIdParams, ListUsersQuery } from '../schemas/user.schema.js';
import { Role, UserStatus } from '../../../domain/entities/role.entity.js';

export class UserController {
  constructor(
    private readonly getUserUC: GetUserUseCase,
    private readonly updateUserUC: UpdateUserUseCase,
    private readonly deleteUserUC: DeleteUserUseCase,
    private readonly listUsersUC: ListUsersUseCase,
  ) {}

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.getUserUC.execute(request.user!.sub);
    return reply.status(200).send(result);
  }

  async getById(request: FastifyRequest<{ Params: UserIdParams }>, reply: FastifyReply) {
    const result = await this.getUserUC.execute(request.params.id);
    return reply.status(200).send(result);
  }

  async update(request: FastifyRequest<{ Params: UserIdParams; Body: UpdateUserBody }>, reply: FastifyReply) {
    const result = await this.updateUserUC.execute({
      userId: request.params.id,
      name: request.body.name,
      email: request.body.email,
      password: request.body.password,
      role: request.body.role as Role | undefined,
      requesterId: request.user!.sub,
      requesterRole: request.user!.role,
      // Profile fields
      avatarUrl: request.body.avatarUrl,
      phone: request.body.phone,
      birthDate: request.body.birthDate ? new Date(request.body.birthDate) : request.body.birthDate as undefined | null,
      bio: request.body.bio,
      locale: request.body.locale,
      timezone: request.body.timezone,
      address: request.body.address,
    });

    return reply.status(200).send(result);
  }

  async delete(request: FastifyRequest<{ Params: UserIdParams }>, reply: FastifyReply) {
    await this.deleteUserUC.execute({
      userId: request.params.id,
      requesterId: request.user!.sub,
      requesterRole: request.user!.role,
    });

    return reply.status(204).send();
  }

  async list(request: FastifyRequest<{ Querystring: ListUsersQuery }>, reply: FastifyReply) {
    const result = await this.listUsersUC.execute({
      filters: {
        role: request.query.role as Role | undefined,
        status: request.query.status as UserStatus | undefined,
        search: request.query.search,
      },
      pagination: {
        page: request.query.page ?? 1,
        limit: request.query.limit ?? 20,
      },
    });

    return reply.status(200).send(result);
  }
}
