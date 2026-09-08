// ─── Client App Controller ────────────────────────────────────────────────

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegisterClientAppUseCase } from '../../../application/use-cases/client-app/register-client-app.use-case.js';
import type { ListClientAppsUseCase } from '../../../application/use-cases/client-app/list-client-apps.use-case.js';
import type { RegisterClientAppBody } from '../schemas/client-app.schema.js';

export class ClientAppController {
  constructor(
    private readonly registerClientAppUC: RegisterClientAppUseCase,
    private readonly listClientAppsUC: ListClientAppsUseCase,
  ) {}

  async register(request: FastifyRequest<{ Body: RegisterClientAppBody }>, reply: FastifyReply) {
    const result = await this.registerClientAppUC.execute({
      name: request.body.name,
      redirectUrls: request.body.redirectUrls,
      grantTypes: request.body.grantTypes,
      scopes: request.body.scopes,
      tokenEndpointAuth: request.body.tokenEndpointAuth,
      requesterRole: request.user!.role,
    });

    return reply.status(201).send(result);
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.listClientAppsUC.execute(request.user!.role);
    return reply.status(200).send(result);
  }
}
