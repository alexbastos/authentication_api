// ─── Google OAuth Provider ────────────────────────────────────────────────
// Validates Google ID tokens and extracts user profile

import type { ISocialAuthProvider, SocialUserInfo } from '../../application/ports/social-auth.port.js';
import { SocialProvider } from '../../domain/entities/role.entity.js';

interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
  aud: string;
}

export class GoogleOAuthProvider implements ISocialAuthProvider {
  readonly provider = SocialProvider.GOOGLE;

  constructor(private readonly googleClientId: string) {}

  async getUserInfo(idToken: string): Promise<SocialUserInfo> {
    // Validate the Google ID token using Google's tokeninfo endpoint
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );

    if (!response.ok) {
      throw new Error(`Google token validation failed: ${response.statusText}`);
    }

    const tokenInfo: GoogleTokenInfo = await response.json() as GoogleTokenInfo;

    // Verify the token was issued for our application
    if (tokenInfo.aud !== this.googleClientId) {
      throw new Error('Token was not issued for this application');
    }

    if (!tokenInfo.email_verified) {
      throw new Error('Email is not verified by Google');
    }

    return {
      provider: SocialProvider.GOOGLE,
      providerAccountId: tokenInfo.sub,
      email: tokenInfo.email,
      name: tokenInfo.name,
      avatarUrl: tokenInfo.picture,
    };
  }
}
