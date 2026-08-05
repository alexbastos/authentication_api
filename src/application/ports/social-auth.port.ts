// ─── Application Port ─────────────────────────────────────────────────────
// Contract for social auth provider — implemented per provider in infra layer

import type { SocialProvider } from '../../domain/entities/role.entity.js';

export interface SocialUserInfo {
  provider: SocialProvider;
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface ISocialAuthProvider {
  readonly provider: SocialProvider;
  getUserInfo(token: string): Promise<SocialUserInfo>;
}

/**
 * Registry of social auth providers, keyed by provider name.
 * Use cases depend on this interface, not concrete implementations.
 */
export interface ISocialAuthProviderRegistry {
  getProvider(provider: SocialProvider): ISocialAuthProvider | undefined;
  hasProvider(provider: SocialProvider): boolean;
}
