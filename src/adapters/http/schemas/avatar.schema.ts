// ─── TypeBox Schemas — Avatar ─────────────────────────────────────────────
// These schemas serve dual purpose: validation AND Swagger documentation

import { Type } from '@sinclair/typebox';
import type { MultipartFile } from '@fastify/multipart';

// ─── Upload Avatar Request ──────────────────────────────────────────────

export const createUploadAvatarBodySchema = () => Type.Object({
  avatar: Type.Unsafe<MultipartFile>({
    isFile: true,
    description: 'PNG or JPEG image file, up to the configured size limit (5 MB by default)',
  }),
});
export type UploadAvatarBody = ReturnType<typeof createUploadAvatarBodySchema>['static'];

// ─── Upload Avatar Response ─────────────────────────────────────────────

export const UploadAvatarResponseSchema = Type.Object({
  avatarUrl: Type.String({
    format: 'uri',
    description: 'Pre-signed URL valid for 7 days. Fetch GET /users/me to obtain a renewed URL.',
  }),
  message: Type.String({ description: 'Human-readable response message' }),
}, { description: 'Avatar uploaded successfully' });

// ─── Delete Avatar Response ─────────────────────────────────────────────

export const DeleteAvatarResponseSchema = Type.Object({
  message: Type.String({ description: 'Human-readable response message' }),
}, { description: 'Avatar removed, or already absent' });
