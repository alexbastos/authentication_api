// ─── Use Case: Register Client App ────────────────────────────────────────

import type { IClientAppRepository } from '../../../domain/repositories/client-app.repository.js';
import type { IHasher } from '../../ports/hasher.port.js';
import { ClientApp } from '../../../domain/entities/client-app.entity.js';
import { ClientAppAlreadyExistsError } from '../../../domain/errors/domain-errors.js';
import { v4 as uuidv4 } from 'uuid';
import type { Role } from '../../../domain/entities/role.entity.js';
import { assertGlobalAdmin } from '../../services/global-authorization.service.js';
import { InvalidRedirectUriError } from '../../../domain/errors/domain-errors.js';

export interface RegisterClientAppInput {
  name: string;
  redirectUrls: string[];
  grantTypes?: string[];
  scopes?: string[];
  tokenEndpointAuth?: string;
  requesterRole: Role;
}

export interface RegisterClientAppOutput {
  id: string;
  name: string;
  clientId: string;
  clientSecret?: string; // Returned only once, and only for confidential clients
  redirectUrls: string[];
  grantTypes: string[];
  scopes: string[];
  tokenEndpointAuth: string;
  isActive: boolean;
  createdAt: Date;
}

export class RegisterClientAppUseCase {
  constructor(
    private readonly clientAppRepository: IClientAppRepository,
    private readonly hasher: IHasher,
  ) {}

  async execute(input: RegisterClientAppInput): Promise<RegisterClientAppOutput> {
    assertGlobalAdmin(input.requesterRole);
    for (const value of input.redirectUrls) {
      let redirectUrl: URL;
      try {
        redirectUrl = new URL(value);
      } catch {
        throw new InvalidRedirectUriError();
      }
      const isLoopbackHttp = redirectUrl.protocol === 'http:'
        && (redirectUrl.hostname === '127.0.0.1' || redirectUrl.hostname === '::1');
      if ((redirectUrl.protocol !== 'https:' && !isLoopbackHttp) || redirectUrl.hash) {
        throw new InvalidRedirectUriError();
      }
    }

    const tokenEndpointAuth = input.tokenEndpointAuth ?? 'client_secret_post';
    // Generate unique client credentials
    const clientId = `app_${uuidv4().replace(/-/g, '')}`;
    const rawSecret = `secret_${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`;
    const hashedSecret = await this.hasher.hash(rawSecret);

    const now = new Date();
    const clientApp = new ClientApp({
      id: uuidv4(),
      name: input.name,
      clientId,
      clientSecret: hashedSecret, // Store hash in memory/DB but return raw once
      redirectUrls: input.redirectUrls,
      isActive: true,
      grantTypes: input.grantTypes ?? ['authorization_code'],
      scopes: input.scopes ?? ['openid', 'profile', 'email'],
      tokenEndpointAuth,
      createdAt: now,
      updatedAt: now,
    });

    const createdApp = await this.clientAppRepository.create(clientApp);

    return {
      id: createdApp.id,
      name: createdApp.name,
      clientId: createdApp.clientId,
      ...(tokenEndpointAuth === 'none' ? {} : { clientSecret: rawSecret }),
      redirectUrls: createdApp.redirectUrls as string[],
      grantTypes: createdApp.grantTypes as string[],
      scopes: createdApp.scopes as string[],
      tokenEndpointAuth: createdApp.tokenEndpointAuth,
      isActive: createdApp.isActive,
      createdAt: createdApp.createdAt,
    };
  }
}
