// ─── Use Case: List Client Apps ───────────────────────────────────────────

import type { IClientAppRepository } from '../../../domain/repositories/client-app.repository.js';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';

export interface ListClientAppsOutput {
  id: string;
  name: string;
  clientId: string;
  redirectUrls: string[];
  isActive: boolean;
  createdAt: Date;
  grantTypes: string[];
  scopes: string[];
  tokenEndpointAuth: string;
}

export class ListClientAppsUseCase {
  constructor(private readonly clientAppRepository: IClientAppRepository) {}

  async execute(requesterRole: Role): Promise<ListClientAppsOutput[]> {
    assertGlobalAdmin(requesterRole);
    const apps = await this.clientAppRepository.list();

    return apps.map((app) => ({
      id: app.id,
      name: app.name,
      clientId: app.clientId,
      redirectUrls: [...app.redirectUrls],
      isActive: app.isActive,
      createdAt: app.createdAt,
      grantTypes: [...app.grantTypes],
      scopes: [...app.scopes],
      tokenEndpointAuth: app.tokenEndpointAuth,
    }));
  }
}
