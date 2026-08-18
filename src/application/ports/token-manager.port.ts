// ─── Application Port ─────────────────────────────────────────────────────
// Contract for JWT management — implemented by infrastructure layer

import type { Role } from '../../domain/entities/role.entity.js';

export interface TokenPayload {
  sub: string;        // User ID
  email: string;
  role: Role;
  permissions?: string[];  // Granular RBAC permissions
  jti: string;        // Unique token identifier (for blocklist)
  iat: number;        // Issued at
  exp: number;        // Expiration
  iss: string;        // Issuer
  aud?: string;       // Audience (OAuth client_id)
}

export interface IdTokenPayload {
  sub: string;
  email: string;
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
    scopes?: string[];
    aud?: string;
  }): Promise<string>;
  generateRefreshToken(): string;
  generateIdToken(payload: IdTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<TokenPayload>;
  getJWKS(): Promise<JWKSResponse>;
}
