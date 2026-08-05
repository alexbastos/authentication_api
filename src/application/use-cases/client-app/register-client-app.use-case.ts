// ─── Use Case: Register Client App ────────────────────────────────────────

import type { IClientAppRepository } from '../../../domain/repositories/client-app.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import { ClientApp } from '../../../domain/entities/client-app.entity.js';
import { ClientAppAlreadyExistsError } from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';

export interface RegisterClientAppInput {
  name: string;
  redirectUrls: string[];
}

export interface RegisterClientAppOutput {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string; // Returned only at creation time
  redirectUrls: string[];
  createdAt: Date;
}

export class RegisterClientAppUseCase {
  constructor(
    private readonly clientAppRepository: IClientAppRepository,
  ) {}

  async execute(input: RegisterClientAppInput): Promise<RegisterClientAppOutput> {
    // Generate unique client credentials
    const clientId = `app_${uuidv4().replace(/-/g, '')}`;
    const clientSecret = `secret_${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`;

    const now = new Date();
    const clientApp = new ClientApp({
      id: uuidv4(),
      name: input.name,
      clientId,
      clientSecret,
      redirectUrls: input.redirectUrls,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const created = await this.clientAppRepository.create(clientApp);

    return {
      id: created.id,
      name: created.name,
      clientId: created.clientId,
      clientSecret: created.clientSecret,
      redirectUrls: [...created.redirectUrls],
      createdAt: created.createdAt,
    };
  }
}
