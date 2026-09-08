// ─── Application Port ─────────────────────────────────────────────────────
// Contract for JWT management — implemented by infrastructure layer

import type { Role } from '../../domain/entities/role.entity.js';

export interface TokenPayload {
  sub: string;        // User ID
  email: string;
  role: Role;
  permissions?: string[];  // Granular RBAC permissions
  sid?: string;       // Session ID (logical session)
  jti: string;        // Unique token identifier (for blocklist)
  iat: number;        // Issued at
  exp: number;        // Expiration
  iss: string;        // Issuer
  aud?: string;       // Audience (OAuth client_id)
  scopes?: string[];
  tokenUse: 'access';
}

export interface MfaTokenPayload {
  sub: string;
  challengeId: string;
  tokenUse: 'mfa';
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: 'mfa-challenge';
}

export interface IdTokenPayload {
  sub: string;
  email: string;
  emailVerified?: boolean;
  name: string;
  picture?: string;
  aud: string;        // client_id
  nonce?: string;
  auth_time?: number;
}

export interface JWKSResponse {
  keys: Record<string, unknown>[];
}

export interface ITokenManager {
  generateAccessToken(payload: {
    sub: string;
    email: string;
    role: Role;
    permissions?: string[];
    sid?: string;
    scopes?: string[];
    aud?: string;
  }): Promise<string>;
  generateRefreshToken(): string;
  generateMfaToken(payload: {
    sub: string;
    challengeId: string;
    expiresInSeconds: number;
  }): Promise<string>;
  generateIdToken(payload: IdTokenPayload): Promise<string>;
  verifyAccessToken(token: string, options?: { allowAnyAudience?: boolean }): Promise<TokenPayload>;
  verifyMfaToken(token: string): Promise<MfaTokenPayload>;
  getJWKS(): Promise<JWKSResponse>;
}
