// ─── TypeBox Schemas — MFA ────────────────────────────────────────────────
// These schemas serve dual purpose: validation AND Swagger documentation

import { Type, Static } from '@sinclair/typebox';
import { AuthenticatedLoginResponseSchema } from './auth.schema.js';

const MfaConfigurationMethodSchema = Type.String({ enum: ['TOTP', 'EMAIL'] });
const MfaVerificationMethodSchema = Type.String({ enum: ['TOTP', 'EMAIL', 'RECOVERY'] });
const RecoveryCodeSchema = Type.String({
  pattern: '^[0-9A-F]{8}-[0-9A-F]{8}$',
  description: 'Single-use recovery code in XXXXXXXX-XXXXXXXX uppercase hexadecimal format',
});

export const MfaBadRequestErrorResponseSchema = Type.Object({
  statusCode: Type.Literal(400),
  error: Type.String(),
  code: Type.String({ enum: ['MFA_METHOD_NOT_ALLOWED', 'MFA_NOT_ENABLED', 'MFA_SETUP_NOT_STARTED', 'VALIDATION_ERROR'] }),
  message: Type.String(),
}, { description: 'MFA request is not valid for the current account or challenge state' });

export const MfaUnauthorizedErrorResponseSchema = Type.Object({
  statusCode: Type.Literal(401),
  error: Type.String(),
  code: Type.String({
    enum: [
      'MFA_TOKEN_INVALID', 'MFA_TOKEN_EXPIRED', 'MFA_CODE_INVALID',
      'MISSING_TOKEN', 'INVALID_TOKEN', 'TOKEN_REVOKED', 'USER_NOT_FOUND',
    ],
  }),
  message: Type.String(),
}, { description: 'The MFA challenge token or verification code is not valid' });

export const MfaConflictErrorResponseSchema = Type.Object({
  statusCode: Type.Literal(409),
  error: Type.String(),
  code: Type.Literal('MFA_ALREADY_ENABLED'),
  message: Type.String(),
});

export const MfaRateLimitErrorResponseSchema = Type.Object({
  statusCode: Type.Literal(429),
  error: Type.String(),
  code: Type.String({ enum: ['MFA_ATTEMPTS_EXCEEDED', 'MFA_RATE_LIMITED'] }),
  message: Type.String(),
}, { description: 'The challenge was invalidated after too many attempts, or a new email code was requested too soon' });

// ─── Setup MFA ──────────────────────────────────────────────────────────

export const SetupMfaBodySchema = Type.Object({
  method: Type.String({ enum: ['TOTP', 'EMAIL'], description: 'MFA method to set up' }),
}, { examples: [{ method: 'TOTP' }, { method: 'EMAIL' }] });
export type SetupMfaBody = Static<typeof SetupMfaBodySchema>;

export const SetupTotpResponseSchema = Type.Object({
  method: Type.Literal('TOTP'),
  qrCodeUrl: Type.String({
    pattern: '^data:image/png;base64,',
    description: 'PNG QR code encoded as a data:image/png;base64 Data URL',
  }),
  secret: Type.String({ description: 'TOTP secret for manual entry' }),
  message: Type.String(),
}, {
  additionalProperties: false,
  examples: [{
    method: 'TOTP',
    qrCodeUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
    secret: 'JBSWY3DPEHPK3PXP',
    message: 'Scan the QR code with your authenticator app, then verify with a code.',
  }],
});

export const SetupEmailResponseSchema = Type.Object({
  method: Type.Literal('EMAIL'),
  message: Type.String({ description: 'Confirms that the setup verification code was sent automatically' }),
}, {
  additionalProperties: false,
  examples: [{
    method: 'EMAIL',
    message: 'A verification code has been sent to your email.',
  }],
});

export const SetupMfaResponseSchema = Type.Unsafe<
  | typeof SetupTotpResponseSchema.static
  | typeof SetupEmailResponseSchema.static
>({
  oneOf: [SetupTotpResponseSchema, SetupEmailResponseSchema],
  discriminator: { propertyName: 'method' },
});

// ─── Verify MFA Setup ───────────────────────────────────────────────────

export const VerifyMfaSetupBodySchema = Type.Object({
  code: Type.String({ minLength: 6, maxLength: 6, description: 'Verification code from authenticator app or email' }),
}, { examples: [{ code: '123456' }] });
export type VerifyMfaSetupBody = Static<typeof VerifyMfaSetupBodySchema>;

export const VerifyMfaSetupResponseSchema = Type.Object({
  recoveryCodes: Type.Array(RecoveryCodeSchema, {
    minItems: 10,
    maxItems: 10,
    description: 'Exactly 10 recovery codes. Returned only once; regenerate to obtain a new list.',
  }),
  message: Type.String(),
}, {
  examples: [{
    recoveryCodes: [
      'A1B2C3D4-E5F60718', '11223344-55667788', 'ABCDEF12-34567890', '90ABCDEF-12345678',
      '13579BDF-2468ACE0', 'CAFE1234-BEEF5678', 'DEADBEEF-1234ABCD', '01020304-A0B0C0D0',
      'FACE5678-C0DE1234', 'AAAABBBB-CCCCDDDD',
    ],
    message: 'Two-factor authentication has been enabled. Save your recovery codes securely.',
  }],
});

// ─── Validate MFA Code (login step 2) ───────────────────────────────────

export const ValidateMfaCodeBodySchema = Type.Object({
  mfaToken: Type.String({ description: 'Temporary MFA token received from login' }),
  code: Type.String({ minLength: 1, description: 'TOTP code, email code, or recovery code' }),
  method: Type.String({ enum: ['TOTP', 'EMAIL', 'RECOVERY'], description: 'Must be one of the availableMethods returned for this login attempt' }),
}, {
  examples: [
    { mfaToken: 'temporary-mfa-token', code: '123456', method: 'TOTP' },
    { mfaToken: 'temporary-mfa-token', code: '123456', method: 'EMAIL' },
    { mfaToken: 'temporary-mfa-token', code: 'A1B2C3D4-E5F60718', method: 'RECOVERY' },
  ],
});
export type ValidateMfaCodeBody = Static<typeof ValidateMfaCodeBodySchema>;

export const ValidateMfaCodeResponseSchema = AuthenticatedLoginResponseSchema;

// ─── Disable MFA ────────────────────────────────────────────────────────

export const DisableMfaBodySchema = Type.Object({
  code: Type.String({ minLength: 1, description: 'Code used to confirm disabling MFA' }),
  method: MfaVerificationMethodSchema,
}, {
  examples: [
    { code: '123456', method: 'TOTP' },
    { code: '123456', method: 'EMAIL' },
    { code: 'A1B2C3D4-E5F60718', method: 'RECOVERY' },
  ],
});
export type DisableMfaBody = Static<typeof DisableMfaBodySchema>;

// ─── Get MFA Status ─────────────────────────────────────────────────────

export const MfaStatusResponseSchema = Type.Object({
  enabled: Type.Boolean(),
  method: Type.Union([MfaConfigurationMethodSchema, Type.Null()]),
  recoveryCodesRemaining: Type.Number(),
}, {
  examples: [
    { enabled: true, method: 'TOTP', recoveryCodesRemaining: 8 },
    { enabled: false, method: null, recoveryCodesRemaining: 0 },
  ],
});

// ─── Regenerate Recovery Codes ──────────────────────────────────────────

export const RegenerateRecoveryCodesBodySchema = Type.Object({
  code: Type.String({ minLength: 1, description: 'Code from the configured method, or a recovery code' }),
  method: MfaVerificationMethodSchema,
}, {
  examples: [
    { code: '123456', method: 'TOTP' },
    { code: '123456', method: 'EMAIL' },
    { code: 'A1B2C3D4-E5F60718', method: 'RECOVERY' },
  ],
});
export type RegenerateRecoveryCodesBody = Static<typeof RegenerateRecoveryCodesBodySchema>;

export const RegenerateRecoveryCodesResponseSchema = Type.Object({
  recoveryCodes: Type.Array(RecoveryCodeSchema, { minItems: 10, maxItems: 10 }),
  message: Type.String(),
}, {
  examples: [{
    recoveryCodes: [
      'A1B2C3D4-E5F60718', '11223344-55667788', 'ABCDEF12-34567890', '90ABCDEF-12345678',
      '13579BDF-2468ACE0', 'CAFE1234-BEEF5678', 'DEADBEEF-1234ABCD', '01020304-A0B0C0D0',
      'FACE5678-C0DE1234', 'AAAABBBB-CCCCDDDD',
    ],
    message: 'Recovery codes have been regenerated. Save them securely.',
  }],
});

// ─── Send Email Code ───────────────────────────────────────────────────

export const SendMfaEmailCodeBodySchema = Type.Object({
  mfaToken: Type.Optional(Type.String({
    description: 'Required during login. Omit when authenticating this request with a Bearer token for an account action.',
  })),
}, {
  additionalProperties: false,
  examples: [{ mfaToken: 'temporary-mfa-token' }, {}],
});
export type SendMfaEmailCodeBody = Static<typeof SendMfaEmailCodeBodySchema>;

// ─── Shared ─────────────────────────────────────────────────────────────

export const MfaMessageResponseSchema = Type.Object({
  message: Type.String({ description: 'Human-readable response message' }),
}, {
  examples: [
    { message: 'Verification code sent to your email.' },
    { message: 'Two-factor authentication has been disabled.' },
  ],
});
