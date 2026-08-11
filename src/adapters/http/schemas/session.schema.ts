// ─── TypeBox Schemas — Sessions, Login History & Social Accounts ──────────
// These schemas serve dual purpose: validation AND Swagger documentation

import { Type, Static } from '@sinclair/typebox';

// ─── Sessions ───────────────────────────────────────────────────────────

export const SessionResponseSchema = Type.Object({
  id: Type.String({ description: 'Session (refresh token) ID' }),
  deviceName: Type.Union([Type.String(), Type.Null()], { description: 'Parsed device name (e.g. "Chrome 120 - macOS")' }),
  ipAddress: Type.Union([Type.String(), Type.Null()], { description: 'IP address from the login' }),
  userAgent: Type.Union([Type.String(), Type.Null()], { description: 'Raw User-Agent header' }),
  createdAt: Type.String({ format: 'date-time', description: 'When the session was created' }),
  expiresAt: Type.String({ format: 'date-time', description: 'When the session expires' }),
  isCurrent: Type.Boolean({ description: 'True if this is the current session' }),
});

export const SessionListResponseSchema = Type.Object({
  sessions: Type.Array(SessionResponseSchema),
});

export const SessionIdParamsSchema = Type.Object({
  id: Type.String({ description: 'Session ID to revoke' }),
});
export type SessionIdParams = Static<typeof SessionIdParamsSchema>;

// ─── Login History ──────────────────────────────────────────────────────

export const LoginHistoryItemSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  status: Type.String({ enum: ['SUCCESS', 'FAILURE'], description: 'Login attempt result' }),
  method: Type.String({
    enum: ['EMAIL_PASSWORD', 'SOCIAL_GOOGLE', 'SOCIAL_APPLE', 'SOCIAL_FACEBOOK', 'SOCIAL_GITHUB'],
    description: 'Authentication method used',
  }),
  ipAddress: Type.Union([Type.String(), Type.Null()]),
  userAgent: Type.Union([Type.String(), Type.Null()]),
  deviceName: Type.Union([Type.String(), Type.Null()]),
  failReason: Type.Union([Type.String(), Type.Null()], { description: 'Reason for failure (null if success)' }),
  createdAt: Type.String({ format: 'date-time' }),
});

export const PaginatedLoginHistoryResponseSchema = Type.Object({
  data: Type.Array(LoginHistoryItemSchema),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});

export const LoginHistoryQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1, description: 'Page number' })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20, description: 'Items per page' })),
});
export type LoginHistoryQuery = Static<typeof LoginHistoryQuerySchema>;

// ─── Social Account Management ──────────────────────────────────────────

export const LinkSocialBodySchema = Type.Object({
  provider: Type.String({
    enum: ['GOOGLE', 'APPLE', 'FACEBOOK', 'GITHUB'],
    description: 'Social provider to link',
  }),
  token: Type.String({ description: 'ID token or access token from the social provider' }),
});
export type LinkSocialBody = Static<typeof LinkSocialBodySchema>;

export const UnlinkSocialParamsSchema = Type.Object({
  provider: Type.String({
    enum: ['GOOGLE', 'APPLE', 'FACEBOOK', 'GITHUB'],
    description: 'Social provider to unlink',
  }),
});
export type UnlinkSocialParams = Static<typeof UnlinkSocialParamsSchema>;

export const SocialAccountMessageSchema = Type.Object({
  message: Type.String(),
  provider: Type.String(),
});
