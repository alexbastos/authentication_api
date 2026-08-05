// ─── Use Case: List Client Apps ───────────────────────────────────────────

import type { IClientAppRepository } from '../../../domain/repositories/client-app.repository.js';

export interface ListClientAppsOutput {
  id: string;
  name: string;
  clientId: string;
  redirectUrls: string[];
  isActive: boolean;
  createdAt: Date;
}

export class ListClientAppsUseCase {
  constructor(private readonly clientAppRepository: IClientAppRepository) {}

  async execute(): Promise<ListClientAppsOutput[]> {
    const apps = await this.clientAppRepository.list();

    return apps.map((app) => ({
      id: app.id,
      name: app.name,
      clientId: app.clientId,
      redirectUrls: [...app.redirectUrls],
      isActive: app.isActive,
      createdAt: app.createdAt,
    }));
  }
}
