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

export const MessageResponseSchema = Type.Object({
  message: Type.String({ description: 'Human-readable response message' }),
});

export const LoginUserSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String({ format: 'email' }),
  role: Type.String({ enum: ['USER', 'ADMIN'] }),
  emailVerified: Type.Boolean(),
});

export const AuthenticatedLoginResponseSchema = Type.Object({
  type: Type.Literal('authenticated', { description: 'Discriminator for a completed login' }),
  accessToken: Type.String({ description: 'JWT access token (RS256, 15min TTL)' }),
  refreshToken: Type.String({ description: 'Refresh token for token renewal' }),
  user: LoginUserSchema,
}, {
  additionalProperties: false,
  examples: [{
    type: 'authenticated',
    accessToken: 'jwt-access-token',
    refreshToken: 'refresh-token',
    user: {
      id: 'user-id',
      name: 'Nome',
      email: 'usuario@email.com',
      role: 'USER',
      emailVerified: true,
    },
  }],
});

export const MfaRequiredLoginResponseSchema = Type.Object({
  type: Type.Literal('mfa_required', { description: 'Discriminator for a pending MFA challenge' }),
  mfaToken: Type.String({
    description: 'Single-use MFA challenge token. Valid for 5 minutes and accepted only by MFA challenge endpoints.',
  }),
  availableMethods: Type.Array(
    Type.String({ enum: ['TOTP', 'EMAIL', 'RECOVERY'] }),
    {
      minItems: 1,
      uniqueItems: true,
      description: 'Methods accepted for this login attempt. The client must only offer these values.',
    },
  ),
}, {
  additionalProperties: false,
  examples: [{
    type: 'mfa_required',
    mfaToken: 'temporary-mfa-token',
    availableMethods: ['TOTP', 'EMAIL', 'RECOVERY'],
  }],
});

export const LoginResponseSchema = Type.Unsafe<
  | typeof AuthenticatedLoginResponseSchema.static
  | typeof MfaRequiredLoginResponseSchema.static
>({
  oneOf: [AuthenticatedLoginResponseSchema, MfaRequiredLoginResponseSchema],
  discriminator: { propertyName: 'type' },
  description: 'A completed login or an MFA challenge. Session tokens are never returned before MFA succeeds.',
});

// Backwards-compatible schema name for internal imports.
export const TokenResponseSchema = AuthenticatedLoginResponseSchema;

// ─── Login ──────────────────────────────────────────────────────────────

export const LoginBodySchema = Type.Object({
  email: Type.String({ format: 'email', description: 'User email address' }),
  password: Type.String({ minLength: 8, maxLength: 1024, description: 'User password' }),
}, {
  examples: [{ email: 'usuario@email.com', password: 'SecurePassword123!' }],
});
export type LoginBody = Static<typeof LoginBodySchema>;

// ─── Register ───────────────────────────────────────────────────────────

export const RegisterBodySchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 100, description: 'Full name' }),
  email: Type.String({ format: 'email', description: 'Email address (must be unique)' }),
  password: Type.String({
    minLength: 8,
    maxLength: 72,
    description: 'Password (8-72 UTF-8 bytes, uppercase, lowercase, digit, special char)',
  }),
});
export type RegisterBody = Static<typeof RegisterBodySchema>;

export const RegisterResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String(),
  role: Type.String(),
  status: Type.String(),
  emailVerified: Type.Boolean({ description: 'False until the user confirms their email' }),
  createdAt: Type.String({ format: 'date-time' }),
});

// ─── Email Verification ─────────────────────────────────────────────────

export const VerifyEmailBodySchema = Type.Object({
  token: Type.String({ description: 'Verification token received by email' }),
});
export type VerifyEmailBody = Static<typeof VerifyEmailBodySchema>;

// ─── Resend Verification Email ───────────────────────────────────────────

export const ResendVerificationBodySchema = Type.Object({
  email: Type.String({ format: 'email', description: 'User email address' }),
});
export type ResendVerificationBody = Static<typeof ResendVerificationBodySchema>;

// ─── Forgot Password ─────────────────────────────────────────────────────

export const ForgotPasswordBodySchema = Type.Object({
  email: Type.String({ format: 'email', description: 'Email address of the account to recover' }),
});
export type ForgotPasswordBody = Static<typeof ForgotPasswordBodySchema>;

// ─── Reset Password ──────────────────────────────────────────────────────

export const ResetPasswordBodySchema = Type.Object({
  token: Type.String({ description: 'Password reset token received by email' }),
  newPassword: Type.String({
    minLength: 8,
    maxLength: 72,
    description: 'New password (must meet complexity requirements)',
  }),
});
export type ResetPasswordBody = Static<typeof ResetPasswordBodySchema>;

// ─── Change Password ─────────────────────────────────────────────────────

export const ChangePasswordBodySchema = Type.Object({
  currentPassword: Type.String({ minLength: 1, description: 'Current account password' }),
  newPassword: Type.String({
    minLength: 8,
    maxLength: 72,
    description: 'New password (must meet complexity requirements)',
  }),
});
export type ChangePasswordBody = Static<typeof ChangePasswordBodySchema>;

// ─── Social Login ───────────────────────────────────────────────────────

export const SocialLoginBodySchema = Type.Object({
  provider: Type.String({ enum: ['GOOGLE', 'APPLE', 'FACEBOOK', 'GITHUB'], description: 'Social provider name' }),
  token: Type.String({ description: 'ID token or access token from the social provider' }),
});
export type SocialLoginBody = Static<typeof SocialLoginBodySchema>;

export const AuthenticatedSocialLoginResponseSchema = Type.Object({
  type: Type.Literal('authenticated'),
  accessToken: Type.String(),
  refreshToken: Type.String(),
  user: Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.String(),
    role: Type.String({ enum: ['USER', 'ADMIN'] }),
    emailVerified: Type.Boolean(),
  }),
  isNewUser: Type.Boolean({ description: 'True if the user was auto-registered' }),
}, { additionalProperties: false });

export const SocialLoginResponseSchema = Type.Unsafe<
  | typeof AuthenticatedSocialLoginResponseSchema.static
  | typeof MfaRequiredLoginResponseSchema.static
>({
  oneOf: [AuthenticatedSocialLoginResponseSchema, MfaRequiredLoginResponseSchema],
  discriminator: { propertyName: 'type' },
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
  refreshToken: Type.Optional(Type.String({
    description: 'Deprecated compatibility field. The complete refresh family is resolved from the signed access-token session and revoked atomically.',
  })),
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
