// ─── User Controller ──────────────────────────────────────────────────────

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { GetUserUseCase } from '../../../application/use-cases/user/get-user.use-case.js';
import type { UpdateUserUseCase } from '../../../application/use-cases/user/update-user.use-case.js';
import type { DeleteUserUseCase } from '../../../application/use-cases/user/delete-user.use-case.js';
import type { ListUsersUseCase } from '../../../application/use-cases/user/list-users.use-case.js';
import type { UploadAvatarUseCase } from '../../../application/use-cases/user/upload-avatar.use-case.js';
import type { DeleteAvatarUseCase } from '../../../application/use-cases/user/delete-avatar.use-case.js';
import type { UpdateUserBody, UserIdParams, ListUsersQuery } from '../schemas/user.schema.js';
import type { UploadAvatarBody } from '../schemas/avatar.schema.js';
import { Role, UserStatus } from '../../../domain/entities/role.entity.js';

export class UserController {
  constructor(
    private readonly getUserUC: GetUserUseCase,
    private readonly updateUserUC: UpdateUserUseCase,
    private readonly deleteUserUC: DeleteUserUseCase,
    private readonly listUsersUC: ListUsersUseCase,
    private readonly uploadAvatarUC: UploadAvatarUseCase,
    private readonly deleteAvatarUC: DeleteAvatarUseCase,
    private readonly avatarMaxSizeMB: number,
  ) {}

  async getMe(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.getUserUC.execute({
      userId: request.user!.sub,
      requesterId: request.user!.sub,
      requesterRole: request.user!.role,
    });
    return reply.status(200).send(result);
  }

  async getById(request: FastifyRequest<{ Params: UserIdParams }>, reply: FastifyReply) {
    const result = await this.getUserUC.execute({
      userId: request.params.id,
      requesterId: request.user!.sub,
      requesterRole: request.user!.role,
    });
    return reply.status(200).send(result);
  }

  async update(request: FastifyRequest<{ Params: UserIdParams; Body: UpdateUserBody }>, reply: FastifyReply) {
    const result = await this.updateUserUC.execute({
      userId: request.params.id,
      name: request.body.name,
      role: request.body.role as Role | undefined,
      phone: request.body.phone,
      birthDate: request.body.birthDate === undefined
        ? undefined
        : request.body.birthDate === null
          ? null
          : new Date(`${request.body.birthDate}T00:00:00.000Z`),
      bio: request.body.bio,
      locale: request.body.locale,
      timezone: request.body.timezone,
      address: request.body.address,
      requesterId: request.user!.sub,
      requesterRole: request.user!.role,
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
      requesterRole: request.user!.role,
    });

    return reply.status(200).send(result);
  }

  async uploadAvatar(request: FastifyRequest<{ Body: UploadAvatarBody }>, reply: FastifyReply) {
    const file = request.body?.avatar;

    if (!file) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        message: 'No file provided. Send a file with field name "avatar".',
      });
    }

    const buffer = await file.toBuffer();

    const result = await this.uploadAvatarUC.execute({
      userId: request.user!.sub,
      buffer,
      mimeType: file.mimetype,
      maxSizeMB: this.avatarMaxSizeMB,
    });

    return reply.status(200).send(result);
  }

  async deleteAvatar(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.deleteAvatarUC.execute({
      userId: request.user!.sub,
    });

    return reply.status(200).send(result);
  }
}
