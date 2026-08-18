// ─── TypeBox Schemas — RBAC ───────────────────────────────────────────────

import { Type, Static } from '@sinclair/typebox';

// ─── Shared ────────────────────────────────────────────────────────────

export const RoleIdParamsSchema = Type.Object({
  id: Type.String({ description: 'Custom Role ID' }),
});
export type RoleIdParams = Static<typeof RoleIdParamsSchema>;

export const UserRoleParamsSchema = Type.Object({
  id: Type.String({ description: 'User ID' }),
  roleId: Type.String({ description: 'Role ID' }),
});
export type UserRoleParams = Static<typeof UserRoleParamsSchema>;

export const UserIdParamsSchema = Type.Object({
  id: Type.String({ description: 'User ID' }),
});
export type UserIdParams = Static<typeof UserIdParamsSchema>;

// ─── Permission Response ───────────────────────────────────────────────

export const PermissionResponseSchema = Type.Object({
  id: Type.String(),
  code: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  category: Type.String(),
});

export const PermissionListResponseSchema = Type.Array(PermissionResponseSchema);

// ─── Create Role ───────────────────────────────────────────────────────

export const CreateRoleBodySchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 100, description: 'Role name' }),
  description: Type.Optional(Type.String({ maxLength: 255, description: 'Role description' })),
  organizationId: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Organization scope (null = global)' })),
  permissionCodes: Type.Array(Type.String(), { minItems: 1, description: 'Permission codes to assign' }),
});
export type CreateRoleBody = Static<typeof CreateRoleBodySchema>;

// ─── Update Role ───────────────────────────────────────────────────────

export const UpdateRoleBodySchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 2, maxLength: 100 })),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 255 }), Type.Null()])),
  permissionCodes: Type.Optional(Type.Array(Type.String(), { minItems: 1 })),
});
export type UpdateRoleBody = Static<typeof UpdateRoleBodySchema>;

// ─── Role Response ─────────────────────────────────────────────────────

export const RoleResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  organizationId: Type.Union([Type.String(), Type.Null()]),
  isSystem: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  permissions: Type.Array(PermissionResponseSchema),
});

export const RoleListResponseSchema = Type.Array(RoleResponseSchema);

// ─── Assign Role ───────────────────────────────────────────────────────

export const AssignRoleBodySchema = Type.Object({
  roleId: Type.String({ description: 'Role ID to assign' }),
  organizationId: Type.Optional(Type.Union([Type.String(), Type.Null()], { description: 'Organization scope' })),
});
export type AssignRoleBody = Static<typeof AssignRoleBodySchema>;

// ─── User Permissions Response ─────────────────────────────────────────

export const UserPermissionsResponseSchema = Type.Object({
  userId: Type.String(),
  permissions: Type.Array(Type.String()),
});

// ─── Error ─────────────────────────────────────────────────────────────

export const ErrorResponseSchema = Type.Object({
  statusCode: Type.Number(),
  error: Type.String(),
  code: Type.String(),
  message: Type.String(),
});

export const MessageResponseSchema = Type.Object({
  message: Type.String(),
});
