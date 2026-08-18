// ─── TypeBox Schemas — Client App ─────────────────────────────────────────

import { Type, Static } from '@sinclair/typebox';

export const RegisterClientAppBodySchema = Type.Object({
  name: Type.String({ minLength: 2, maxLength: 100, description: 'Application name' }),
  redirectUrls: Type.Array(Type.String({ format: 'uri' }), {
    minItems: 1,
    description: 'Allowed redirect URLs',
  }),
  grantTypes: Type.Optional(Type.Array(Type.String(), { description: 'OAuth grant types (e.g. authorization_code)' })),
  scopes: Type.Optional(Type.Array(Type.String(), { description: 'Allowed OAuth scopes' })),
  tokenEndpointAuth: Type.Optional(Type.String({ description: 'Client authentication method (e.g. client_secret_post)' })),
});
export type RegisterClientAppBody = Static<typeof RegisterClientAppBodySchema>;

export const ClientAppResponseSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  clientId: Type.String(),
  clientSecret: Type.Optional(Type.String({ description: 'Only returned at creation time' })),
  redirectUrls: Type.Array(Type.String()),
  isActive: Type.Boolean(),
  grantTypes: Type.Array(Type.String()),
  scopes: Type.Array(Type.String()),
  tokenEndpointAuth: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
});

export const ClientAppListResponseSchema = Type.Array(Type.Object({
  id: Type.String(),
  name: Type.String(),
  clientId: Type.String(),
  redirectUrls: Type.Array(Type.String()),
  isActive: Type.Boolean(),
  grantTypes: Type.Array(Type.String()),
  scopes: Type.Array(Type.String()),
  tokenEndpointAuth: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
}));
