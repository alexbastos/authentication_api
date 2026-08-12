// ─── TypeBox Schemas — User CRUD ──────────────────────────────────────────

import { Type, Static } from '@sinclair/typebox';

// ─── Address Sub-object ─────────────────────────────────────────────────

export const UserAddressSchema = Type.Object({
  street: Type.Union([Type.String(), Type.Null()], { description: 'Street address' }),
  city: Type.Union([Type.String(), Type.Null()], { description: 'City' }),
  state: Type.Union([Type.String(), Type.Null()], { description: 'State/Province' }),
  zipCode: Type.Union([Type.String(), Type.Null()], { description: 'Zip/Postal code' }),
  country: Type.Union([Type.String(), Type.Null()], { description: 'Country (ISO 3166-1 alpha-2, e.g. "BR")' }),
});

// ─── Profile Sub-object ─────────────────────────────────────────────────

export const UserProfileSchema = Type.Object({
  avatarUrl: Type.Union([Type.String(), Type.Null()], { description: 'Avatar/profile picture URL' }),
  phone: Type.Union([Type.String(), Type.Null()], { description: 'Phone number' }),
  birthDate: Type.Union([Type.String({ format: 'date' }), Type.Null()], { description: 'Date of birth (YYYY-MM-DD)' }),
  bio: Type.Union([Type.String(), Type.Null()], { description: 'Short bio/description' }),
  locale: Type.Union([Type.String(), Type.Null()], { description: 'User locale (e.g. "pt-BR")' }),
  timezone: Type.Union([Type.String(), Type.Null()], { description: 'User timezone (e.g. "America/Sao_Paulo")' }),
  address: UserAddressSchema,
});

// ─── User Response ──────────────────────────────────────────────────────

export const UserResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  email: Type.String({ format: 'email' }),
  role: Type.String({ enum: ['USER', 'ADMIN'] }),
  status: Type.String({ enum: ['ACTIVE', 'INACTIVE'] }),
  emailVerified: Type.Boolean({ description: 'Whether the user email has been verified' }),
  socialProviders: Type.Array(Type.String()),
  profile: UserProfileSchema,
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

// ─── Update User ────────────────────────────────────────────────────────

export const UpdateUserAddressSchema = Type.Optional(Type.Object({
  street: Type.Optional(Type.Union([Type.String({ maxLength: 255 }), Type.Null()])),
  city: Type.Optional(Type.Union([Type.String({ maxLength: 100 }), Type.Null()])),
  state: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
  zipCode: Type.Optional(Type.Union([Type.String({ maxLength: 20 }), Type.Null()])),
  country: Type.Optional(Type.Union([Type.String({ maxLength: 2, minLength: 2 }), Type.Null()])),
}));

export const UpdateUserBodySchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 2, maxLength: 100 })),
  email: Type.Optional(Type.String({ format: 'email' })),
  password: Type.Optional(Type.String({ minLength: 8 })),
  role: Type.Optional(Type.String({ enum: ['USER', 'ADMIN'] })),
  // Profile fields
  avatarUrl: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  phone: Type.Optional(Type.Union([Type.String({ maxLength: 20 }), Type.Null()])),
  birthDate: Type.Optional(Type.Union([Type.String({ format: 'date' }), Type.Null()])),
  bio: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  locale: Type.Optional(Type.Union([Type.String({ maxLength: 10 }), Type.Null()])),
  timezone: Type.Optional(Type.Union([Type.String({ maxLength: 50 }), Type.Null()])),
  address: UpdateUserAddressSchema,
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

