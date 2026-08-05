// ─── TypeBox Schemas — User CRUD ──────────────────────────────────────────

import { Type, Static } from '@sinclair/typebox';

// ─── User Response ──────────────────────────────────────────────────────

export const UserResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String({ format: 'email' }),
  role: Type.String({ enum: ['USER', 'ADMIN'] }),
  status: Type.String({ enum: ['ACTIVE', 'INACTIVE'] }),
  socialProviders: Type.Array(Type.String()),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

// ─── Update User ────────────────────────────────────────────────────────

export const UpdateUserBodySchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 2, maxLength: 100 })),
  email: Type.Optional(Type.String({ format: 'email' })),
  password: Type.Optional(Type.String({ minLength: 8 })),
  role: Type.Optional(Type.String({ enum: ['USER', 'ADMIN'] })),
});
export type UpdateUserBody = Static<typeof UpdateUserBodySchema>;

// ─── User Params ────────────────────────────────────────────────────────

export const UserIdParamsSchema = Type.Object({
  id: Type.String({ description: 'User ID' }),
});
export type UserIdParams = Static<typeof UserIdParamsSchema>;

// ─── List Users Query ───────────────────────────────────────────────────

export const ListUsersQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1, description: 'Page number' })),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20, description: 'Items per page' })),
  role: Type.Optional(Type.String({ enum: ['USER', 'ADMIN'], description: 'Filter by role' })),
  status: Type.Optional(Type.String({ enum: ['ACTIVE', 'INACTIVE'], description: 'Filter by status' })),
  search: Type.Optional(Type.String({ description: 'Search by name or email' })),
});
export type ListUsersQuery = Static<typeof ListUsersQuerySchema>;

// ─── Paginated Response ─────────────────────────────────────────────────

export const PaginatedUsersResponseSchema = Type.Object({
  data: Type.Array(Type.Object({
    id: Type.String(),
    name: Type.String(),
    email: Type.String(),
    role: Type.String(),
    status: Type.String(),
    createdAt: Type.String({ format: 'date-time' }),
  })),
  total: Type.Number(),
  page: Type.Number(),
  limit: Type.Number(),
  totalPages: Type.Number(),
});
