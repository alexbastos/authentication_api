import type { ClientApp } from '../entities/client-app.entity.js';

export interface IClientAppRepository {
  create(clientApp: ClientApp): Promise<ClientApp>;
  findById(id: string): Promise<ClientApp | null>;
  findByClientId(clientId: string): Promise<ClientApp | null>;
  list(): Promise<ClientApp[]>;
  update(clientApp: ClientApp): Promise<ClientApp>;
}
