// ─── Webhook Controller ───────────────────────────────────────────────────

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegisterWebhookUseCase } from '../../../application/use-cases/webhook/register-webhook.use-case.js';
import type { ListWebhooksUseCase } from '../../../application/use-cases/webhook/list-webhooks.use-case.js';
import type { UpdateWebhookUseCase } from '../../../application/use-cases/webhook/update-webhook.use-case.js';
import type { DeleteWebhookUseCase } from '../../../application/use-cases/webhook/delete-webhook.use-case.js';
import type { GetWebhookUseCase } from '../../../application/use-cases/webhook/get-webhook.use-case.js';
import type { ListWebhookDeliveriesUseCase } from '../../../application/use-cases/webhook/list-webhook-deliveries.use-case.js';
import type { TestWebhookUseCase } from '../../../application/use-cases/webhook/test-webhook.use-case.js';
import { WebhookEvent, type WebhookEndpoint } from '../../../domain/entities/webhook.entity.js';
import type { WebhookIdParams, RegisterWebhookBody, UpdateWebhookBody } from '../schemas/webhook.schema.js';

export class WebhookController {
  constructor(
    private readonly registerWebhookUC: RegisterWebhookUseCase,
    private readonly listWebhooksUC: ListWebhooksUseCase,
    private readonly updateWebhookUC: UpdateWebhookUseCase,
    private readonly deleteWebhookUC: DeleteWebhookUseCase,
    private readonly getWebhookUC: GetWebhookUseCase,
    private readonly listDeliveriesUC: ListWebhookDeliveriesUseCase,
    private readonly testWebhookUC: TestWebhookUseCase,
  ) {}

  async register(request: FastifyRequest<{ Body: RegisterWebhookBody }>, reply: FastifyReply) {
    const result = await this.registerWebhookUC.execute({
      url: request.body.url,
      events: request.body.events as WebhookEvent[],
      organizationId: request.body.organizationId,
      description: request.body.description,
      requesterRole: request.user!.role,
    });
    return reply.status(201).send(result.toJSON());
  }

  async list(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.listWebhooksUC.execute(request.user!.role);
    return reply.status(200).send(result.map((endpoint) => this.toPublicResponse(endpoint)));
  }

  async getById(request: FastifyRequest<{ Params: WebhookIdParams }>, reply: FastifyReply) {
    const result = await this.getWebhookUC.execute(request.params.id, request.user!.role);
    return reply.status(200).send(this.toPublicResponse(result));
  }

  async update(request: FastifyRequest<{ Params: WebhookIdParams; Body: UpdateWebhookBody }>, reply: FastifyReply) {
    const result = await this.updateWebhookUC.execute({
      id: request.params.id,
      url: request.body.url,
      events: request.body.events as WebhookEvent[] | undefined,
      description: request.body.description,
      isActive: request.body.isActive,
      requesterRole: request.user!.role,
    });
    return reply.status(200).send(this.toPublicResponse(result));
  }

  async delete(request: FastifyRequest<{ Params: WebhookIdParams }>, reply: FastifyReply) {
    await this.deleteWebhookUC.execute(request.params.id, request.user!.role);
    return reply.status(204).send();
  }

  async listDeliveries(request: FastifyRequest<{ Params: WebhookIdParams }>, reply: FastifyReply) {
    const deliveries = await this.listDeliveriesUC.execute(request.params.id, request.user!.role);
    return reply.status(200).send(deliveries.map((d) => d.toJSON()));
  }

  async test(request: FastifyRequest<{ Params: WebhookIdParams }>, reply: FastifyReply) {
    await this.testWebhookUC.execute(request.params.id, request.user!.role);

    return reply.status(200).send({ message: 'Test event dispatched' });
  }

  private toPublicResponse(endpoint: WebhookEndpoint) {
    const { secret: _secret, ...publicEndpoint } = endpoint.toJSON();
    return publicEndpoint;
  }
}
