// ─── TypeBox Schemas — MFA ────────────────────────────────────────────────
// These schemas serve dual purpose: validation AND Swagger documentation

import { Type, Static } from '@sinclair/typebox';

// ─── Setup MFA ──────────────────────────────────────────────────────────

export const SetupMfaBodySchema = Type.Object({
  method: Type.String({ enum: ['TOTP', 'EMAIL'], description: 'MFA method to set up' }),
});
export type SetupMfaBody = Static<typeof SetupMfaBodySchema>;

export const SetupMfaResponseSchema = Type.Object({
  method: Type.String({ enum: ['TOTP', 'EMAIL'] }),
  qrCodeUrl: Type.Optional(Type.String({ description: 'QR code as data URL (TOTP only)' })),
  secret: Type.Optional(Type.String({ description: 'TOTP secret for manual entry (TOTP only)' })),
  message: Type.String(),
});

// ─── Verify MFA Setup ───────────────────────────────────────────────────

export const VerifyMfaSetupBodySchema = Type.Object({
  code: Type.String({ minLength: 6, maxLength: 6, description: 'Verification code from authenticator app or email' }),
});
export type VerifyMfaSetupBody = Static<typeof VerifyMfaSetupBodySchema>;

export const VerifyMfaSetupResponseSchema = Type.Object({
  recoveryCodes: Type.Array(Type.String(), { description: 'Recovery codes (shown only once)' }),
  message: Type.String(),
});

// ─── Validate MFA Code (login step 2) ───────────────────────────────────

export const ValidateMfaCodeBodySchema = Type.Object({
  mfaToken: Type.String({ description: 'Temporary MFA token received from login' }),
  code: Type.String({ minLength: 1, description: 'TOTP code, email code, or recovery code' }),
  method: Type.Optional(Type.String({ enum: ['TOTP', 'EMAIL', 'RECOVERY'], description: 'Verification method (defaults to TOTP)' })),
});
export type ValidateMfaCodeBody = Static<typeof ValidateMfaCodeBodySchema>;

export const ValidateMfaCodeResponseSchema = Type.Object({
  accessToken: Type.String({ description: 'JWT access token' }),
  refreshToken: Type.String({ description: 'Refresh token' }),
  user: Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.String({ format: 'email' }),
    role: Type.String({ enum: ['USER', 'ADMIN'] }),
    emailVerified: Type.Boolean(),
  }),
});

// ─── Disable MFA ────────────────────────────────────────────────────────

export const DisableMfaBodySchema = Type.Object({
  code: Type.String({ minLength: 1, description: 'TOTP code or recovery code to confirm disabling' }),
});
export type DisableMfaBody = Static<typeof DisableMfaBodySchema>;

// ─── Get MFA Status ─────────────────────────────────────────────────────

export const MfaStatusResponseSchema = Type.Object({
  enabled: Type.Boolean(),
  method: Type.Union([Type.String({ enum: ['TOTP', 'EMAIL'] }), Type.Null()]),
  recoveryCodesRemaining: Type.Number(),
});

// ─── Regenerate Recovery Codes ──────────────────────────────────────────

export const RegenerateRecoveryCodesBodySchema = Type.Object({
  code: Type.String({ minLength: 6, maxLength: 6, description: 'TOTP code to confirm regeneration' }),
});
export type RegenerateRecoveryCodesBody = Static<typeof RegenerateRecoveryCodesBodySchema>;

export const RegenerateRecoveryCodesResponseSchema = Type.Object({
  recoveryCodes: Type.Array(Type.String()),
  message: Type.String(),
});

// ─── Shared ─────────────────────────────────────────────────────────────

export const MfaMessageResponseSchema = Type.Object({
  message: Type.String({ description: 'Human-readable response message' }),
});
