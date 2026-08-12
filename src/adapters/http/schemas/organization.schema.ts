// ─── TypeBox Schemas — Organization ───────────────────────────────────────

import { Type, Static } from '@sinclair/typebox';

// ─── Params ─────────────────────────────────────────────────────────────

export const OrgIdParamsSchema = Type.Object({
  orgId: Type.String({ description: 'Organization ID' }),
});
export type OrgIdParams = Static<typeof OrgIdParamsSchema>;

export const MemberParamsSchema = Type.Object({
  orgId: Type.String({ description: 'Organization ID' }),
  userId: Type.String({ description: 'User ID of the member' }),
});
export type MemberParams = Static<typeof MemberParamsSchema>;

// ─── Create Organization ────────────────────────────────────────────────

export const CreateOrganizationBodySchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 200, description: 'Organization name' }),
  slug: Type.String({
    minLength: 2,
    maxLength: 100,
    pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
    description: 'URL-friendly slug (lowercase, hyphens only)',
  }),
  description: Type.Optional(Type.String({ maxLength: 500, description: 'Short description' })),
  logoUrl: Type.Optional(Type.String({ maxLength: 500, description: 'Logo URL' })),
});
export type CreateOrganizationBody = Static<typeof CreateOrganizationBodySchema>;

// ─── Update Organization ────────────────────────────────────────────────

export const UpdateOrganizationBodySchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 2, maxLength: 200 })),
  description: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
  logoUrl: Type.Optional(Type.Union([Type.String({ maxLength: 500 }), Type.Null()])),
});
export type UpdateOrganizationBody = Static<typeof UpdateOrganizationBodySchema>;

// ─── Invite Member ──────────────────────────────────────────────────────

export const InviteMemberBodySchema = Type.Object({
  email: Type.String({ format: 'email', description: 'Email address to invite' }),
  role: Type.Optional(Type.String({
    enum: ['ADMIN', 'MEMBER', 'VIEWER'],
    default: 'MEMBER',
    description: 'Role to assign (OWNER cannot be assigned via invite)',
  })),
});
export type InviteMemberBody = Static<typeof InviteMemberBodySchema>;

// ─── Accept Invitation ──────────────────────────────────────────────────

export const AcceptInvitationBodySchema = Type.Object({
  token: Type.String({ description: 'Invitation token received via email' }),
});
export type AcceptInvitationBody = Static<typeof AcceptInvitationBodySchema>;

// ─── Change Member Role ─────────────────────────────────────────────────

export const ChangeMemberRoleBodySchema = Type.Object({
  role: Type.String({
    enum: ['ADMIN', 'MEMBER', 'VIEWER'],
    description: 'New role (OWNER cannot be assigned)',
  }),
});
export type ChangeMemberRoleBody = Static<typeof ChangeMemberRoleBodySchema>;

// ─── Response Schemas ───────────────────────────────────────────────────

export const OrganizationResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  logoUrl: Type.Union([Type.String(), Type.Null()]),
  isActive: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export const OrganizationWithRoleResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  logoUrl: Type.Union([Type.String(), Type.Null()]),
  isActive: Type.Boolean(),
  memberRole: Type.String({ description: 'Your role in the organization' }),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export const MemberResponseSchema = Type.Object({
  id: Type.String(),
  userId: Type.String(),
  organizationId: Type.String(),
  role: Type.String(),
  joinedAt: Type.String({ format: 'date-time' }),
  userName: Type.Optional(Type.String()),
  userEmail: Type.Optional(Type.String()),
});

export const InvitationResponseSchema = Type.Object({
  id: Type.String(),
  email: Type.String(),
  organizationId: Type.String(),
  role: Type.String(),
  invitedBy: Type.String(),
  expiresAt: Type.String({ format: 'date-time' }),
  acceptedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  organizationName: Type.Optional(Type.String()),
  token: Type.Optional(Type.String({ description: 'Plain token (only on creation)' })),
});

export const AcceptInvitationResponseSchema = Type.Object({
  organizationId: Type.String(),
  organizationName: Type.Optional(Type.String()),
  role: Type.String(),
  member: MemberResponseSchema,
});
