// ─── Webhook Controller ───────────────────────────────────────────────────

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RegisterWebhookUseCase } from '../../../application/use-cases/webhook/register-webhook.use-case.js';
import type { ListWebhooksUseCase } from '../../../application/use-cases/webhook/list-webhooks.use-case.js';
import type { UpdateWebhookUseCase } from '../../../application/use-cases/webhook/update-webhook.use-case.js';
import type { DeleteWebhookUseCase } from '../../../application/use-cases/webhook/delete-webhook.use-case.js';
import type { DispatchEventUseCase } from '../../../application/use-cases/webhook/dispatch-event.use-case.js';
import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import { WebhookEvent } from '../../../domain/entities/webhook.entity.js';
import type { WebhookIdParams, RegisterWebhookBody, UpdateWebhookBody } from '../schemas/webhook.schema.js';

export class WebhookController {
  constructor(
    private readonly registerWebhookUC: RegisterWebhookUseCase,
    private readonly listWebhooksUC: ListWebhooksUseCase,
    private readonly updateWebhookUC: UpdateWebhookUseCase,
    private readonly deleteWebhookUC: DeleteWebhookUseCase,
    private readonly dispatchEventUC: DispatchEventUseCase,
    private readonly webhookRepository: IWebhookRepository,
  ) {}

  async register(request: FastifyRequest<{ Body: RegisterWebhookBody }>, reply: FastifyReply) {
    const result = await this.registerWebhookUC.execute({
      url: request.body.url,
      events: request.body.events as WebhookEvent[],
      organizationId: request.body.organizationId,
      description: request.body.description,
    });
    return reply.status(201).send(result.toJSON());
  }

  async list(_request: FastifyRequest, reply: FastifyReply) {
    const result = await this.listWebhooksUC.execute();
    return reply.status(200).send(result.map((e) => e.toJSON()));
  }

  async getById(request: FastifyRequest<{ Params: WebhookIdParams }>, reply: FastifyReply) {
    const result = await this.webhookRepository.findEndpointById(request.params.id);
    if (!result) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'WebhookNotFoundError',
        code: 'WEBHOOK_NOT_FOUND',
        message: `Webhook not found: ${request.params.id}`,
      });
    }
    return reply.status(200).send(result.toJSON());
  }

  async update(request: FastifyRequest<{ Params: WebhookIdParams; Body: UpdateWebhookBody }>, reply: FastifyReply) {
    const result = await this.updateWebhookUC.execute({
      id: request.params.id,
      url: request.body.url,
      events: request.body.events as WebhookEvent[] | undefined,
      description: request.body.description,
      isActive: request.body.isActive,
    });
    return reply.status(200).send(result.toJSON());
  }

  async delete(request: FastifyRequest<{ Params: WebhookIdParams }>, reply: FastifyReply) {
    await this.deleteWebhookUC.execute(request.params.id);
    return reply.status(204).send();
  }

  async listDeliveries(request: FastifyRequest<{ Params: WebhookIdParams }>, reply: FastifyReply) {
    const deliveries = await this.webhookRepository.findDeliveriesByEndpointId(request.params.id);
    return reply.status(200).send(deliveries.map((d) => d.toJSON()));
  }

  async test(request: FastifyRequest<{ Params: WebhookIdParams }>, reply: FastifyReply) {
    const endpoint = await this.webhookRepository.findEndpointById(request.params.id);
    if (!endpoint) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'WebhookNotFoundError',
        code: 'WEBHOOK_NOT_FOUND',
        message: `Webhook not found: ${request.params.id}`,
      });
    }

    await this.dispatchEventUC.execute({
      event: WebhookEvent.USER_CREATED,
      payload: {
        test: true,
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString(),
      },
    });

    return reply.status(200).send({ message: 'Test event dispatched' });
  }
}
