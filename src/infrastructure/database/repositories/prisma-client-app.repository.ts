// ─── Prisma Client App Repository ─────────────────────────────────────────

import type { PrismaClient } from '@prisma/client';
import type { IClientAppRepository } from '../../../domain/repositories/client-app.repository.js';
import { ClientApp } from '../../../domain/entities/client-app.entity.js';

export class PrismaClientAppRepository implements IClientAppRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(clientApp: ClientApp): Promise<ClientApp> {
    const data = clientApp.toJSON();
    const record = await this.prisma.clientApp.create({
      data: {
        id: data.id,
        name: data.name,
        clientId: data.clientId,
        clientSecret: data.clientSecret,
        redirectUrls: data.redirectUrls,
        isActive: data.isActive,
        grantTypes: data.grantTypes,
        scopes: data.scopes,
        tokenEndpointAuth: data.tokenEndpointAuth,
      },
    });

    return this.toDomain(record);
  }

  async findById(id: string): Promise<ClientApp | null> {
    const record = await this.prisma.clientApp.findUnique({ where: { id } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async findByClientId(clientId: string): Promise<ClientApp | null> {
    const record = await this.prisma.clientApp.findUnique({ where: { clientId } });
    if (!record) return null;
    return this.toDomain(record);
  }

  async list(): Promise<ClientApp[]> {
    const records = await this.prisma.clientApp.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toDomain(r));
  }

  async update(clientApp: ClientApp): Promise<ClientApp> {
    const data = clientApp.toJSON();
    const record = await this.prisma.clientApp.update({
      where: { id: data.id },
      data: {
        name: data.name,
        redirectUrls: data.redirectUrls,
        isActive: data.isActive,
        grantTypes: data.grantTypes,
        scopes: data.scopes,
        tokenEndpointAuth: data.tokenEndpointAuth,
      },
    });
    return this.toDomain(record);
  }

  private toDomain(record: any): ClientApp {
    return new ClientApp({
      id: record.id,
      name: record.name,
      clientId: record.clientId,
      clientSecret: record.clientSecret,
      redirectUrls: record.redirectUrls,
      isActive: record.isActive,
      grantTypes: record.grantTypes,
      scopes: record.scopes,
      tokenEndpointAuth: record.tokenEndpointAuth,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
