// ─── Session Controller ───────────────────────────────────────────────────
// Thin adapter layer: receives HTTP, calls use case, formats response

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ListSessionsUseCase } from '../../../application/use-cases/session/list-sessions.use-case.js';
import type { RevokeSessionUseCase } from '../../../application/use-cases/session/revoke-session.use-case.js';
import type { GetLoginHistoryUseCase } from '../../../application/use-cases/session/get-login-history.use-case.js';
import type { LinkSocialAccountUseCase } from '../../../application/use-cases/social/link-social-account.use-case.js';
import type { UnlinkSocialAccountUseCase } from '../../../application/use-cases/social/unlink-social-account.use-case.js';
import type { SessionIdParams, LoginHistoryQuery, LinkSocialBody, UnlinkSocialParams } from '../schemas/session.schema.js';
import { SocialProvider } from '../../../domain/entities/role.entity.js';

export class SessionController {
  constructor(
    private readonly listSessionsUC: ListSessionsUseCase,
    private readonly revokeSessionUC: RevokeSessionUseCase,
    private readonly getLoginHistoryUC: GetLoginHistoryUseCase,
    private readonly linkSocialAccountUC: LinkSocialAccountUseCase,
    private readonly unlinkSocialAccountUC: UnlinkSocialAccountUseCase,
  ) {}

  async listSessions(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.listSessionsUC.execute({
      userId: request.user!.sub,
    });

    return reply.status(200).send(result);
  }

  async revokeSession(request: FastifyRequest<{ Params: SessionIdParams }>, reply: FastifyReply) {
    await this.revokeSessionUC.execute({
      userId: request.user!.sub,
      sessionId: request.params.id,
    });

    return reply.status(204).send();
  }

  async getLoginHistory(request: FastifyRequest<{ Querystring: LoginHistoryQuery }>, reply: FastifyReply) {
    const result = await this.getLoginHistoryUC.execute({
      userId: request.user!.sub,
      page: request.query.page ?? 1,
      limit: request.query.limit ?? 20,
    });

    return reply.status(200).send(result);
  }

  async linkSocial(request: FastifyRequest<{ Body: LinkSocialBody }>, reply: FastifyReply) {
    const result = await this.linkSocialAccountUC.execute({
      userId: request.user!.sub,
      provider: request.body.provider as SocialProvider,
      token: request.body.token,
    });

    return reply.status(200).send(result);
  }

  async unlinkSocial(request: FastifyRequest<{ Params: UnlinkSocialParams }>, reply: FastifyReply) {
    const result = await this.unlinkSocialAccountUC.execute({
      userId: request.user!.sub,
      provider: request.params.provider as SocialProvider,
    });

    return reply.status(200).send(result);
  }
}
