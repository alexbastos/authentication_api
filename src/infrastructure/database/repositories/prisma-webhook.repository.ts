// ─── Prisma Webhook Repository ────────────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IWebhookRepository } from '../../../domain/repositories/webhook.repository.js';
import {
  WebhookEndpoint, WebhookDelivery,
  WebhookEvent, WebhookDeliveryStatus,
} from '../../../domain/entities/webhook.entity.js';
import type { IDataProtector } from '../../../application/ports/data-protector.port.js';

export class PrismaWebhookRepository implements IWebhookRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly dataProtector?: IDataProtector,
  ) {}

  // ─── Endpoint CRUD ──────────────────────────────────────────────────

  async createEndpoint(endpoint: WebhookEndpoint): Promise<WebhookEndpoint> {
    const data = endpoint.toJSON();
    const record = await this.prisma.webhookEndpoint.create({
      data: {
        id: data.id,
        url: data.url,
        secret: this.dataProtector?.protect(data.secret) ?? data.secret,
        events: data.events as any[],
        organizationId: data.organizationId,
        isActive: data.isActive,
        description: data.description,
      },
    });
    return this.toEndpointDomain(record);
  }

  async findEndpointById(id: string): Promise<WebhookEndpoint | null> {
    const record = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!record) return null;
    await this.migrateLegacySecret(record);
    return this.toEndpointDomain(record);
  }

  async listEndpoints(organizationId?: string | null): Promise<WebhookEndpoint[]> {
    const where = organizationId !== undefined ? { organizationId } : {};
    const records = await this.prisma.webhookEndpoint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    await Promise.all(records.map((record) => this.migrateLegacySecret(record)));
    return records.map((r) => this.toEndpointDomain(r));
  }

  async updateEndpoint(endpoint: WebhookEndpoint): Promise<WebhookEndpoint> {
    const data = endpoint.toJSON();
    const record = await this.prisma.webhookEndpoint.update({
      where: { id: data.id },
      data: {
        url: data.url,
        events: data.events as any[],
        isActive: data.isActive,
        description: data.description,
      },
    });
    return this.toEndpointDomain(record);
  }

  async deleteEndpoint(id: string): Promise<void> {
    await this.prisma.webhookEndpoint.delete({ where: { id } });
  }

  async findActiveEndpointsByEvent(
    event: WebhookEvent,
    organizationId?: string,
  ): Promise<WebhookEndpoint[]> {
    const records = await this.prisma.webhookEndpoint.findMany({
      where: {
        isActive: true,
        events: { has: event as any },
        ...(organizationId === undefined
          ? { organizationId: null }
          : {
            OR: [
              { organizationId },
              { organizationId: null },
            ],
          }),
      },
    });
    await Promise.all(records.map((record) => this.migrateLegacySecret(record)));
    return records.map((r) => this.toEndpointDomain(r));
  }

  // ─── Delivery Management ────────────────────────────────────────────

  async createDelivery(delivery: WebhookDelivery): Promise<WebhookDelivery> {
    const data = delivery.toJSON();
    const record = await this.prisma.webhookDelivery.create({
      data: {
        id: data.id,
        endpointId: data.endpointId,
        event: data.event as any,
        payload: data.payload as any,
        status: data.status as any,
        attempts: data.attempts,
        lastAttempt: data.lastAttempt,
        nextRetry: data.nextRetry,
        responseCode: data.responseCode,
        responseBody: data.responseBody,
      },
    });
    return this.toDeliveryDomain(record);
  }

  async updateDelivery(delivery: WebhookDelivery): Promise<void> {
    const data = delivery.toJSON();
    await this.prisma.webhookDelivery.update({
      where: { id: data.id },
      data: {
        status: data.status as any,
        attempts: data.attempts,
        lastAttempt: data.lastAttempt,
        nextRetry: data.nextRetry,
        responseCode: data.responseCode,
        responseBody: data.responseBody,
      },
    });
  }

  async findDeliveriesByEndpointId(endpointId: string, limit = 50): Promise<WebhookDelivery[]> {
    const records = await this.prisma.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return records.map((r) => this.toDeliveryDomain(r));
  }

  async findPendingRetries(limit = 100): Promise<WebhookDelivery[]> {
    const records = await this.prisma.webhookDelivery.findMany({
      where: {
        status: 'FAILED' as any,
        nextRetry: { lte: new Date() },
      },
      orderBy: { nextRetry: 'asc' },
      take: limit,
    });
    return records.map((r) => this.toDeliveryDomain(r));
  }

  // ─── Mappers ────────────────────────────────────────────────────────

  private async migrateLegacySecret(record: { id: string; secret: string }): Promise<void> {
    if (!this.dataProtector || this.dataProtector.isProtected(record.secret)) return;
    await this.prisma.webhookEndpoint.update({
      where: { id: record.id },
      data: { secret: this.dataProtector.protect(record.secret) },
    });
  }

  private toEndpointDomain(record: any): WebhookEndpoint {
    return new WebhookEndpoint({
      id: record.id,
      url: record.url,
      secret: this.dataProtector?.unprotect(record.secret) ?? record.secret,
      events: record.events as WebhookEvent[],
      organizationId: record.organizationId,
      isActive: record.isActive,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toDeliveryDomain(record: any): WebhookDelivery {
    return new WebhookDelivery({
      id: record.id,
      endpointId: record.endpointId,
      event: record.event as WebhookEvent,
      payload: record.payload as Record<string, unknown>,
      status: record.status as WebhookDeliveryStatus,
      attempts: record.attempts,
      lastAttempt: record.lastAttempt,
      nextRetry: record.nextRetry,
      responseCode: record.responseCode,
      responseBody: record.responseBody,
      createdAt: record.createdAt,
    });
  }
}
