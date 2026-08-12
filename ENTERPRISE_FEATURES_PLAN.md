# Baixa Prioridade — Escala e Enterprise

Implementação de 5 funcionalidades enterprise que evoluem o sistema de um serviço de autenticação para um **Identity Provider completo**, capaz de atender cenários multi-tenant com RBAC granular, webhooks e fluxos OAuth/OIDC padronizados.

> [!IMPORTANT]
> Essas 5 features são **interdependentes em alguns pontos**. A ordem de implementação proposta minimiza refactoring:
> 1. Campos Extras de Perfil *(simples, sem dependências)*
> 2. Multi-tenancy *(base para RBAC granular)*
> 3. RBAC Avançado *(depende de tenant para permissões por org)*
> 4. Webhooks *(depende das entidades de tenant e user)*
> 5. OAuth PKCE/OIDC *(depende de ClientApp aprimorado + RBAC)*

---

## User Review Required

> [!WARNING]
> **Breaking Change no JWT**: A feature de RBAC granular muda o claim `role` no JWT de uma string simples (`"USER"`) para um array de permissions (`["users:read", "users:write"]`). Isso **quebrará** qualquer microserviço que consuma o JWT e dependa do campo `role` atual. Proponho uma migração gradual: manter `role` E adicionar `permissions` como novo claim, com flag de feature para o período de transição.

> [!WARNING]
> **Breaking Change no Multi-tenancy**: Endpoints que retornam dados de usuário passarão a incluir `organizations`. Clientes que fazem parse estrito do response podem precisar de ajuste.

## Open Questions

> [!IMPORTANT]
> **1. Perfil — Quais campos extras incluir?**
> Proposta: `avatarUrl`, `phone`, `birthDate`, `bio`, `locale` (idioma), `timezone`. Deseja incluir campos de endereço completo (`street`, `city`, `state`, `zipCode`, `country`) como sub-objeto `address`, ou isso será responsabilidade de outro microserviço?

> [!IMPORTANT]
> **2. Multi-tenancy — Modelo de isolamento?**
> Proposta: **Row-Level** (todos os tenants no mesmo banco, filtro por `organizationId`). Alternativa seria schema-per-tenant (PostgreSQL schemas separados) — mais isolado mas mais complexo. Qual modelo prefere?

> [!IMPORTANT]
> **3. Webhooks — Retry policy?**
> Proposta: Retry com backoff exponencial (1s, 5s, 30s, 2min, 10min) e máximo de 5 tentativas. O payload é armazenado no banco para reenvio manual se todos os retries falharem. Concorda com essa política?

> [!IMPORTANT]
> **4. OAuth PKCE — Quais grant types suportar inicialmente?**
> Proposta: Começar com **Authorization Code + PKCE** (recomendado para SPAs/mobile) e **Client Credentials** (machine-to-machine). Implicit Flow (legado) ficaria de fora. Concorda?

---

## Proposed Changes

As mudanças estão organizadas por feature, na ordem de implementação.

---

### Feature 1: Campos Extras de Perfil

Adicionar campos opcionais de perfil ao usuário sem quebrar a API existente.

#### [MODIFY] [schema.prisma](file:///Users/alex/Documents/projetos/authentication_api/prisma/schema.prisma)

Adicionar ao modelo `User`:
```prisma
avatarUrl  String?   @map("avatar_url") @db.VarChar(500)
phone      String?   @db.VarChar(20)
birthDate  DateTime? @map("birth_date") @db.Date
bio        String?   @db.VarChar(500)
locale     String?   @db.VarChar(10) // ex: "pt-BR"
timezone   String?   @db.VarChar(50) // ex: "America/Sao_Paulo"

// Sub-objeto de endereço como campos flat (evita JSON)
addressStreet  String? @map("address_street") @db.VarChar(255)
addressCity    String? @map("address_city") @db.VarChar(100)
addressState   String? @map("address_state") @db.VarChar(50)
addressZipCode String? @map("address_zip_code") @db.VarChar(20)
addressCountry String? @map("address_country") @db.VarChar(2)  // ISO 3166-1 alpha-2
```

#### [MODIFY] [user.entity.ts](file:///Users/alex/Documents/projetos/authentication_api/src/domain/entities/user.entity.ts)

- Adicionar `UserProfile` value object com os novos campos
- Método `updateProfile(profile: Partial<UserProfile>): void`
- Getter `profile: UserProfile`

#### [MODIFY] [prisma-user.repository.ts](file:///Users/alex/Documents/projetos/authentication_api/src/infrastructure/database/repositories/prisma-user.repository.ts)

- Mapear novos campos no `toDomain()` e nos métodos `create()`/`update()`

#### [MODIFY] [update-user.use-case.ts](file:///Users/alex/Documents/projetos/authentication_api/src/application/use-cases/user/update-user.use-case.ts)

- Aceitar campos de perfil no input

#### [MODIFY] [user.schema.ts](file:///Users/alex/Documents/projetos/authentication_api/src/adapters/http/schemas/user.schema.ts)

- Adicionar `UserProfileSchema` ao schema de update e response

---

### Feature 2: Multi-tenancy (Organizações)

Modelo: **Row-Level Isolation** — coluna `organizationId` nos recursos, com filtro automático.

#### [MODIFY] [schema.prisma](file:///Users/alex/Documents/projetos/authentication_api/prisma/schema.prisma)

Novos modelos:
```prisma
enum OrgRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

model Organization {
  id          String     @id @default(cuid())
  name        String     @db.VarChar(200)
  slug        String     @unique @db.VarChar(100) // URL-friendly
  description String?    @db.VarChar(500)
  logoUrl     String?    @map("logo_url") @db.VarChar(500)
  isActive    Boolean    @default(true) @map("is_active")
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  memberships OrganizationMember[]
  invitations OrgInvitation[]

  @@index([slug])
  @@map("organizations")
}

model OrganizationMember {
  id             String       @id @default(cuid())
  userId         String       @map("user_id")
  organizationId String       @map("organization_id")
  role           OrgRole      @default(MEMBER)
  joinedAt       DateTime     @default(now()) @map("joined_at")

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([userId, organizationId])
  @@index([userId])
  @@index([organizationId])
  @@map("organization_members")
}

model OrgInvitation {
  id             String       @id @default(cuid())
  email          String       @db.VarChar(255)
  organizationId String       @map("organization_id")
  role           OrgRole      @default(MEMBER)
  invitedBy      String       @map("invited_by")
  tokenHash      String       @unique @map("token_hash") @db.VarChar(255)
  expiresAt      DateTime     @map("expires_at")
  acceptedAt     DateTime?    @map("accepted_at")
  createdAt      DateTime     @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([email])
  @@index([tokenHash])
  @@index([organizationId])
  @@map("org_invitations")
}
```

Adicionar ao modelo `User`:
```prisma
memberships OrganizationMember[]
```

#### [NEW] `src/domain/entities/organization.entity.ts`
- Entidade `Organization` com slug, nome, logo, status
- Entidade `OrganizationMember` com role

#### [NEW] `src/domain/entities/org-invitation.entity.ts`
- Entidade `OrgInvitation` com token, expiração, status

#### [MODIFY] [role.entity.ts](file:///Users/alex/Documents/projetos/authentication_api/src/domain/entities/role.entity.ts)
- Adicionar enum `OrgRole` (OWNER, ADMIN, MEMBER, VIEWER)

#### [NEW] `src/domain/repositories/organization.repository.ts`
- `IOrganizationRepository`: CRUD, findBySlug, listByUserId

#### [NEW] `src/domain/repositories/org-invitation.repository.ts`
- `IOrgInvitationRepository`: create, findByToken, findPendingByEmail

#### [NEW] `src/infrastructure/database/repositories/prisma-organization.repository.ts`
#### [NEW] `src/infrastructure/database/repositories/prisma-org-invitation.repository.ts`

#### [NEW] `src/application/use-cases/organization/create-organization.use-case.ts`
- Cria org + membro OWNER automaticamente

#### [NEW] `src/application/use-cases/organization/list-user-organizations.use-case.ts`
- Lista organizações do usuário autenticado

#### [NEW] `src/application/use-cases/organization/get-organization.use-case.ts`
#### [NEW] `src/application/use-cases/organization/update-organization.use-case.ts`

#### [NEW] `src/application/use-cases/organization/invite-member.use-case.ts`
- Gera token de convite, envia e-mail

#### [NEW] `src/application/use-cases/organization/accept-invitation.use-case.ts`
- Aceita convite e cria membership

#### [NEW] `src/application/use-cases/organization/remove-member.use-case.ts`
- Remove membro (OWNERs não podem ser removidos)

#### [NEW] `src/application/use-cases/organization/change-member-role.use-case.ts`

#### [NEW] `src/adapters/http/schemas/organization.schema.ts`
#### [NEW] `src/adapters/http/controllers/organization.controller.ts`
#### [NEW] `src/adapters/http/routes/organization.routes.ts`

**Endpoints:**
| Método | Endpoint | Descrição |
|:---|:---|:---|
| `POST` | `/api/v1/organizations` | Criar organização |
| `GET` | `/api/v1/organizations` | Listar minhas organizações |
| `GET` | `/api/v1/organizations/:id` | Detalhes da organização |
| `PUT` | `/api/v1/organizations/:id` | Atualizar organização |
| `GET` | `/api/v1/organizations/:id/members` | Listar membros |
| `POST` | `/api/v1/organizations/:id/invitations` | Convidar membro |
| `POST` | `/api/v1/organizations/invitations/accept` | Aceitar convite |
| `DELETE` | `/api/v1/organizations/:id/members/:userId` | Remover membro |
| `PUT` | `/api/v1/organizations/:id/members/:userId/role` | Alterar role do membro |

#### [NEW] `src/adapters/http/middlewares/org.middleware.ts`
- Middleware que verifica membership + org role mínimo por rota

---

### Feature 3: RBAC Avançado (Permissões Granulares)

Evoluir de `Role (USER | ADMIN)` para um modelo de **Permissions** por recurso, combinável com o `OrgRole`.

#### [MODIFY] [schema.prisma](file:///Users/alex/Documents/projetos/authentication_api/prisma/schema.prisma)

```prisma
model Permission {
  id          String  @id @default(cuid())
  code        String  @unique @db.VarChar(100)  // ex: "users:read", "posts:delete"
  description String? @db.VarChar(255)
  category    String  @db.VarChar(50)           // ex: "users", "posts", "billing"

  roles RolePermission[]

  @@index([code])
  @@index([category])
  @@map("permissions")
}

model CustomRole {
  id             String    @id @default(cuid())
  name           String    @db.VarChar(100)
  description    String?   @db.VarChar(255)
  organizationId String?   @map("organization_id")  // null = global role
  isSystem       Boolean   @default(false) @map("is_system")  // USER, ADMIN = system roles
  createdAt      DateTime  @default(now()) @map("created_at")

  permissions RolePermission[]
  userRoles   UserRole[]

  @@unique([name, organizationId])
  @@index([organizationId])
  @@map("custom_roles")
}

model RolePermission {
  roleId       String @map("role_id")
  permissionId String @map("permission_id")

  role       CustomRole @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model UserRole {
  userId         String  @map("user_id")
  roleId         String  @map("role_id")
  organizationId String? @map("organization_id")  // null = global assignment

  user User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  role CustomRole @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@index([userId])
  @@map("user_roles")
}
```

#### [NEW] `src/domain/entities/permission.entity.ts`
- `Permission` (code, description, category)
- `CustomRole` (name, permissions[], isSystem)

#### [NEW] `src/domain/repositories/permission.repository.ts`
- `IPermissionRepository`: findByCode, findByUserId, findByRoleId

#### [NEW] `src/infrastructure/database/repositories/prisma-permission.repository.ts`

#### [MODIFY] [token-manager.port.ts](file:///Users/alex/Documents/projetos/authentication_api/src/application/ports/token-manager.port.ts)
- Adicionar `permissions: string[]` ao `TokenPayload` (mantendo `role` para compatibilidade)

#### [MODIFY] [jose-token-manager.ts](file:///Users/alex/Documents/projetos/authentication_api/src/infrastructure/security/jose-token-manager.ts)
- Incluir claim `permissions` no JWT gerado

#### [MODIFY] [auth.middleware.ts](file:///Users/alex/Documents/projetos/authentication_api/src/adapters/http/middlewares/auth.middleware.ts)
- Propagar `permissions` no `request.user`

#### [NEW] `src/adapters/http/middlewares/permission.middleware.ts`
- `createPermissionMiddleware(...requiredPermissions)` — verifica se o token contém as permissions necessárias
- Substitui gradualmente o `role.middleware.ts` nas rotas que precisarem de granularidade

#### [NEW] `src/application/use-cases/rbac/list-permissions.use-case.ts`
#### [NEW] `src/application/use-cases/rbac/create-custom-role.use-case.ts`
#### [NEW] `src/application/use-cases/rbac/assign-role-to-user.use-case.ts`
#### [NEW] `src/application/use-cases/rbac/get-user-permissions.use-case.ts`

#### [NEW] `src/adapters/http/schemas/rbac.schema.ts`
#### [NEW] `src/adapters/http/controllers/rbac.controller.ts`
#### [NEW] `src/adapters/http/routes/rbac.routes.ts`

**Endpoints:**
| Método | Endpoint | Descrição |
|:---|:---|:---|
| `GET` | `/api/v1/rbac/permissions` | Listar todas as permissões |
| `POST` | `/api/v1/rbac/roles` | Criar custom role |
| `GET` | `/api/v1/rbac/roles` | Listar roles |
| `GET` | `/api/v1/rbac/roles/:id` | Detalhes da role com permissões |
| `PUT` | `/api/v1/rbac/roles/:id` | Atualizar role (add/remove permissions) |
| `DELETE` | `/api/v1/rbac/roles/:id` | Excluir custom role |
| `POST` | `/api/v1/rbac/users/:id/roles` | Atribuir role ao usuário |
| `DELETE` | `/api/v1/rbac/users/:id/roles/:roleId` | Remover role do usuário |
| `GET` | `/api/v1/rbac/users/:id/permissions` | Listar permissões efetivas |

#### [NEW] Seed de permissões base
- Migration seed com permissões padrão: `users:read`, `users:write`, `users:delete`, `users:admin`, `orgs:read`, `orgs:write`, `orgs:admin`, `apps:read`, `apps:write`, etc.
- Roles de sistema `USER` e `ADMIN` mapeados para as novas permissões

---

### Feature 4: Webhooks de Eventos de Autenticação

Sistema de webhooks assíncronos com fila de entrega e retry.

#### [MODIFY] [schema.prisma](file:///Users/alex/Documents/projetos/authentication_api/prisma/schema.prisma)

```prisma
enum WebhookEvent {
  USER_CREATED
  USER_UPDATED
  USER_DELETED
  USER_LOGIN
  USER_LOGOUT
  USER_PASSWORD_CHANGED
  USER_EMAIL_VERIFIED
  ORG_CREATED
  ORG_MEMBER_ADDED
  ORG_MEMBER_REMOVED
}

enum WebhookDeliveryStatus {
  PENDING
  SUCCESS
  FAILED
  EXHAUSTED  // All retries failed
}

model WebhookEndpoint {
  id             String         @id @default(cuid())
  url            String         @db.VarChar(500)
  secret         String         @db.VarChar(255)  // HMAC signing secret
  events         WebhookEvent[]
  organizationId String?        @map("organization_id")
  isActive       Boolean        @default(true) @map("is_active")
  description    String?        @db.VarChar(255)
  createdAt      DateTime       @default(now()) @map("created_at")
  updatedAt      DateTime       @updatedAt @map("updated_at")

  deliveries WebhookDelivery[]

  @@index([organizationId])
  @@map("webhook_endpoints")
}

model WebhookDelivery {
  id           String                @id @default(cuid())
  endpointId   String                @map("endpoint_id")
  event        WebhookEvent
  payload      Json
  status       WebhookDeliveryStatus @default(PENDING)
  attempts     Int                   @default(0)
  lastAttempt  DateTime?             @map("last_attempt")
  nextRetry    DateTime?             @map("next_retry")
  responseCode Int?                  @map("response_code")
  responseBody String?               @map("response_body") @db.VarChar(1000)
  createdAt    DateTime              @default(now()) @map("created_at")

  endpoint WebhookEndpoint @relation(fields: [endpointId], references: [id], onDelete: Cascade)

  @@index([endpointId])
  @@index([status])
  @@index([nextRetry])
  @@map("webhook_deliveries")
}
```

#### [NEW] `src/domain/entities/webhook.entity.ts`
- `WebhookEndpoint` (url, secret, events[], isActive)
- `WebhookDelivery` (payload, status, attempts, retry schedule)

#### [NEW] `src/domain/repositories/webhook.repository.ts`
- `IWebhookRepository`: CRUD endpoints + delivery management

#### [NEW] `src/infrastructure/database/repositories/prisma-webhook.repository.ts`

#### [NEW] `src/application/ports/webhook-dispatcher.port.ts`
- Interface `IWebhookDispatcher` para desacoplar o mecanismo de entrega

#### [NEW] `src/infrastructure/webhook/webhook-dispatcher.ts`
- Implementação que faz POST HTTP com payload JSON + assinatura HMAC-SHA256 no header `X-Webhook-Signature`
- Retry com backoff exponencial (1s, 5s, 30s, 2min, 10min)

#### [NEW] `src/application/use-cases/webhook/register-webhook.use-case.ts`
#### [NEW] `src/application/use-cases/webhook/list-webhooks.use-case.ts`
#### [NEW] `src/application/use-cases/webhook/update-webhook.use-case.ts`
#### [NEW] `src/application/use-cases/webhook/delete-webhook.use-case.ts`
#### [NEW] `src/application/use-cases/webhook/dispatch-event.use-case.ts`
- Recebe evento, encontra endpoints inscritos, cria deliveries
- Chamado internamente pelos use cases de auth/user

#### [NEW] `src/application/use-cases/webhook/retry-failed-deliveries.use-case.ts`
- Chamado por cron job ou worker

#### [MODIFY] Use cases que devem disparar webhooks:
- [authenticate-user.use-case.ts](file:///Users/alex/Documents/projetos/authentication_api/src/application/use-cases/auth/authenticate-user.use-case.ts) → `USER_LOGIN`
- [register-user.use-case.ts](file:///Users/alex/Documents/projetos/authentication_api/src/application/use-cases/user/register-user.use-case.ts) → `USER_CREATED`
- [update-user.use-case.ts](file:///Users/alex/Documents/projetos/authentication_api/src/application/use-cases/user/update-user.use-case.ts) → `USER_UPDATED`
- [delete-user.use-case.ts](file:///Users/alex/Documents/projetos/authentication_api/src/application/use-cases/user/delete-user.use-case.ts) → `USER_DELETED`
- [revoke-token.use-case.ts](file:///Users/alex/Documents/projetos/authentication_api/src/application/use-cases/auth/revoke-token.use-case.ts) → `USER_LOGOUT`
- [change-password.use-case.ts](file:///Users/alex/Documents/projetos/authentication_api/src/application/use-cases/auth/change-password.use-case.ts) → `USER_PASSWORD_CHANGED`
- [verify-email.use-case.ts](file:///Users/alex/Documents/projetos/authentication_api/src/application/use-cases/auth/verify-email.use-case.ts) → `USER_EMAIL_VERIFIED`

#### [NEW] `src/adapters/http/schemas/webhook.schema.ts`
#### [NEW] `src/adapters/http/controllers/webhook.controller.ts`
#### [NEW] `src/adapters/http/routes/webhook.routes.ts`

**Endpoints:**
| Método | Endpoint | Descrição |
|:---|:---|:---|
| `POST` | `/api/v1/webhooks` | Registrar webhook endpoint |
| `GET` | `/api/v1/webhooks` | Listar webhooks |
| `GET` | `/api/v1/webhooks/:id` | Detalhes do webhook |
| `PUT` | `/api/v1/webhooks/:id` | Atualizar webhook |
| `DELETE` | `/api/v1/webhooks/:id` | Deletar webhook |
| `GET` | `/api/v1/webhooks/:id/deliveries` | Histórico de entregas |
| `POST` | `/api/v1/webhooks/:id/test` | Enviar evento de teste |

---

### Feature 5: OAuth PKCE / Authorization Code Flow

Transformar a API em um **Identity Provider OIDC-compliant** com suporte a Authorization Code + PKCE.

#### [MODIFY] [schema.prisma](file:///Users/alex/Documents/projetos/authentication_api/prisma/schema.prisma)

Modificar `ClientApp` e adicionar `AuthorizationCode`:
```prisma
// Adicionar campos ao ClientApp existente:
grantTypes       String[]  @map("grant_types")       // ["authorization_code", "client_credentials"]
scopes           String[]  @default(["openid", "profile", "email"])
tokenEndpointAuth String   @default("client_secret_post") @map("token_endpoint_auth") @db.VarChar(50)
// "client_secret_post" | "client_secret_basic" | "none" (public clients)

model AuthorizationCode {
  id                  String   @id @default(cuid())
  code                String   @unique @db.VarChar(255)
  clientId            String   @map("client_id")
  userId              String   @map("user_id")
  redirectUri         String   @map("redirect_uri") @db.VarChar(500)
  scope               String   @db.VarChar(500)
  codeChallenge       String?  @map("code_challenge") @db.VarChar(255) // PKCE
  codeChallengeMethod String?  @map("code_challenge_method") @db.VarChar(10) // "S256" | "plain"
  nonce               String?  @db.VarChar(255)
  expiresAt           DateTime @map("expires_at")
  usedAt              DateTime? @map("used_at")
  createdAt           DateTime @default(now()) @map("created_at")

  @@index([code])
  @@index([clientId])
  @@map("authorization_codes")
}

model OAuthConsent {
  id             String   @id @default(cuid())
  userId         String   @map("user_id")
  clientId       String   @map("client_id")
  scopes         String[] 
  grantedAt      DateTime @default(now()) @map("granted_at")

  @@unique([userId, clientId])
  @@map("oauth_consents")
}
```

#### [NEW] `src/domain/entities/authorization-code.entity.ts`
#### [NEW] `src/domain/entities/oauth-consent.entity.ts`

#### [MODIFY] [client-app.entity.ts](file:///Users/alex/Documents/projetos/authentication_api/src/domain/entities/client-app.entity.ts)
- Adicionar `grantTypes`, `scopes`, `tokenEndpointAuth`
- Método `supportsGrantType(type: string): boolean`
- Método `isPublicClient(): boolean` (sem secret, para SPAs/mobile)

#### [NEW] `src/domain/repositories/authorization-code.repository.ts`
#### [NEW] `src/domain/repositories/oauth-consent.repository.ts`
#### [NEW] `src/infrastructure/database/repositories/prisma-authorization-code.repository.ts`
#### [NEW] `src/infrastructure/database/repositories/prisma-oauth-consent.repository.ts`

#### [MODIFY] [token-manager.port.ts](file:///Users/alex/Documents/projetos/authentication_api/src/application/ports/token-manager.port.ts)
- Adicionar `generateIdToken()` — JWT com claims OIDC (sub, email, name, picture)
- Adicionar `audience` ao payload do access token

#### [MODIFY] [jose-token-manager.ts](file:///Users/alex/Documents/projetos/authentication_api/src/infrastructure/security/jose-token-manager.ts)
- Implementar `generateIdToken()` com claims OIDC standard

#### [NEW] `src/application/use-cases/oauth/authorize.use-case.ts`
- Valida client_id, redirect_uri, scope, code_challenge
- Gera authorization code (TTL 10 min)

#### [NEW] `src/application/use-cases/oauth/exchange-code.use-case.ts`
- Troca authorization code por tokens (access + refresh + id_token)
- Valida code_verifier (PKCE)
- Valida client credentials

#### [NEW] `src/application/use-cases/oauth/client-credentials.use-case.ts`
- Grant type para comunicação machine-to-machine
- Retorna access token sem refresh token

#### [NEW] `src/application/use-cases/oauth/get-userinfo.use-case.ts`
- Retorna claims do usuário logado (OIDC UserInfo endpoint)

#### [NEW] `src/adapters/http/schemas/oauth.schema.ts`
#### [NEW] `src/adapters/http/controllers/oauth.controller.ts`
#### [NEW] `src/adapters/http/routes/oauth.routes.ts`

**Endpoints OIDC padrão:**
| Método | Endpoint | Descrição |
|:---|:---|:---|
| `GET` | `/api/v1/oauth/authorize` | Authorization endpoint (retorna code) |
| `POST` | `/api/v1/oauth/token` | Token endpoint (code → tokens) |
| `POST` | `/api/v1/oauth/revoke` | Revogação de token (RFC 7009) |
| `GET` | `/api/v1/oauth/userinfo` | UserInfo endpoint (OIDC) |
| `GET` | `/.well-known/openid-configuration` | Discovery document (OIDC) |

> [!NOTE]
> O endpoint `/.well-known/openid-configuration` é o discovery document OIDC. Retorna metadata como `issuer`, `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `response_types_supported`, `grant_types_supported`, etc. Este endpoint é essencial para que SDKs OAuth possam auto-descobrir a configuração do IdP.

---

### Wiring (todas as features)

#### [MODIFY] [container.ts](file:///Users/alex/Documents/projetos/authentication_api/src/container.ts)
- Registrar todos os novos repositórios, use cases e controllers
- Injetar `WebhookDispatcher` nos use cases que emitem eventos

#### [MODIFY] [app.ts](file:///Users/alex/Documents/projetos/authentication_api/src/app.ts)
- Registrar novas rotas (organization, rbac, webhook, oauth)
- Adicionar Swagger tags
- Mapear novos códigos de erro no error handler

#### [MODIFY] [env.ts](file:///Users/alex/Documents/projetos/authentication_api/src/infrastructure/config/env.ts)
- Novas variáveis: `WEBHOOK_RETRY_MAX`, `WEBHOOK_TIMEOUT_MS`, `OAUTH_CODE_EXPIRY_SECONDS`

---

## Resumo de Arquivos

| Status | Quantidade | Descrição |
|:---|:---|:---|
| **[NEW]** | ~40 | Novas entidades, repos, use cases, controllers, routes, schemas |
| **[MODIFY]** | ~20 | Schema Prisma, entidades existentes, container, app, env, middlewares |
| **Total** | ~60 | Arquivos impactados |

---

## Verification Plan

### Automated Tests
```bash
npm run typecheck     # Zero erros TypeScript
npm run lint          # Biome sem warnings
npx prisma generate   # Client gerado com sucesso
```

### Manual Verification
- Testar cada grupo de endpoints via Swagger UI
- Verificar que o discovery document (`/.well-known/openid-configuration`) retorna metadata OIDC válido
- Validar fluxo PKCE completo (authorize → exchange → userinfo)
- Testar webhook delivery com endpoint de teste (webhook.site)
- Verificar que permissions são incluídas no JWT
- Testar isolamento multi-tenant (usuário A não vê dados do tenant B)
