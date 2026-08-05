// ─── Social Auth Provider Registry ────────────────────────────────────────

import type { ISocialAuthProvider, ISocialAuthProviderRegistry } from '../../application/ports/social-auth.port.js';
import { SocialProvider } from '../../domain/entities/role.entity.js';

export class SocialAuthProviderRegistry implements ISocialAuthProviderRegistry {
  private providers = new Map<SocialProvider, ISocialAuthProvider>();

  register(provider: ISocialAuthProvider): void {
    this.providers.set(provider.provider, provider);
  }

  getProvider(provider: SocialProvider): ISocialAuthProvider | undefined {
    return this.providers.get(provider);
  }

  hasProvider(provider: SocialProvider): boolean {
    return this.providers.has(provider);
  }
}
