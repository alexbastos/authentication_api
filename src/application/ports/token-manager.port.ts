// ─── Application Port ─────────────────────────────────────────────────────
// Contract for JWT management — implemented by infrastructure layer

import type { Role } from '../../domain/entities/role.entity.js';

export interface TokenPayload {
  sub: string;        // User ID
  email: string;
  role: Role;
  jti: string;        // Unique token identifier (for blocklist)
  iat: number;        // Issued at
  exp: number;        // Expiration
  iss: string;        // Issuer
}

export interface JWKSResponse {
  keys: Record<string, unknown>[];
}

export interface ITokenManager {
  generateAccessToken(payload: { sub: string; email: string; role: Role }): Promise<string>;
  generateRefreshToken(): string;
  verifyAccessToken(token: string): Promise<TokenPayload>;
  getJWKS(): Promise<JWKSResponse>;
}
