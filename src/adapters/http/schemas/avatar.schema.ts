// ─── TypeBox Schemas — Avatar ─────────────────────────────────────────────
// These schemas serve dual purpose: validation AND Swagger documentation

import { Type } from '@sinclair/typebox';

// ─── Upload Avatar Response ─────────────────────────────────────────────

export const UploadAvatarResponseSchema = Type.Object({
  avatarUrl: Type.String({ description: 'Pre-signed URL to access the avatar' }),
  message: Type.String({ description: 'Human-readable response message' }),
});

// ─── Delete Avatar Response ─────────────────────────────────────────────

export const DeleteAvatarResponseSchema = Type.Object({
  message: Type.String({ description: 'Human-readable response message' }),
});
