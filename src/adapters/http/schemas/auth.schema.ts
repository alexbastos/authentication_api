// ─── TypeBox Schemas — Auth ───────────────────────────────────────────────
// These schemas serve dual purpose: validation AND Swagger documentation

import { Type, Static } from '@sinclair/typebox';

// ─── Shared Response Schemas ────────────────────────────────────────────

export const ErrorResponseSchema = Type.Object({
  statusCode: Type.Number(),
  error: Type.String(),
  code: Type.String(),
  message: Type.String(),
});

export const TokenResponseSchema = Type.Object({
  accessToken: Type.String({ description: 'JWT access token (RS256, 15min TTL)' }),
  refreshToken: Type.String({ description: 'Refresh token for token renewal' }),
  user: Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.String({ format: 'email' }),
    role: Type.String({ enum: ['USER', 'ADMIN'] }),
  }),
});

// ─── Login ──────────────────────────────────────────────────────────────

export const LoginBodySchema = Type.Object({
  email: Type.String({ format: 'email', description: 'User email address' }),
  password: Type.String({ minLength: 8, description: 'User password' }),
});
export type LoginBody = Static<typeof LoginBodySchema>;

// ─── Register ───────────────────────────────────────────────────────────

export const RegisterBodySchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 100, description: 'Full name' }),
  email: Type.String({ format: 'email', description: 'Email address (must be unique)' }),
  password: Type.String({
    minLength: 8,
    description: 'Password (min 8 chars, uppercase, lowercase, digit, special char)',
  }),
});
export type RegisterBody = Static<typeof RegisterBodySchema>;

export const RegisterResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  role: Type.String(),
  status: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
});

// ─── Social Login ───────────────────────────────────────────────────────

export const SocialLoginBodySchema = Type.Object({
  provider: Type.String({ enum: ['GOOGLE', 'APPLE', 'FACEBOOK', 'GITHUB'], description: 'Social provider name' }),
  token: Type.String({ description: 'ID token or access token from the social provider' }),
});
export type SocialLoginBody = Static<typeof SocialLoginBodySchema>;

export const SocialLoginResponseSchema = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
  user: Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.String(),
    role: Type.String(),
  }),
  isNewUser: Type.Boolean({ description: 'True if the user was auto-registered' }),
});

// ─── Refresh Token ──────────────────────────────────────────────────────

export const RefreshTokenBodySchema = Type.Object({
  refreshToken: Type.String({ description: 'Refresh token to exchange for a new pair' }),
});
export type RefreshTokenBody = Static<typeof RefreshTokenBodySchema>;

export const RefreshTokenResponseSchema = Type.Object({
  accessToken: Type.String(),
  refreshToken: Type.String(),
});

// ─── Logout / Revoke ────────────────────────────────────────────────────

export const LogoutBodySchema = Type.Object({
  refreshToken: Type.Optional(Type.String({ description: 'Refresh token to revoke' })),
});
export type LogoutBody = Static<typeof LogoutBodySchema>;

// ─── Validate Token ─────────────────────────────────────────────────────

export const ValidateTokenBodySchema = Type.Object({
  token: Type.String({ description: 'JWT access token to validate' }),
});
export type ValidateTokenBody = Static<typeof ValidateTokenBodySchema>;

export const ValidateTokenResponseSchema = Type.Object({
  valid: Type.Boolean(),
  payload: Type.Object({
    sub: Type.String(),
    email: Type.String(),
    role: Type.String(),
    jti: Type.String(),
    iat: Type.Number(),
    exp: Type.Number(),
    iss: Type.String(),
  }),
});

// ─── JWKS ───────────────────────────────────────────────────────────────

export const JWKSResponseSchema = Type.Object({
  keys: Type.Array(Type.Any()),
});
