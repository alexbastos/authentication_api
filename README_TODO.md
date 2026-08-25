# TODO: Evolução da Authentication API

Este documento lista as funcionalidades, melhorias de segurança e recursos de gerenciamento da API de Autenticação, com o status atual de cada item.

> **Última atualização:** 25/08/2026

---

## 🔴 Alta Prioridade (Funcionalidade & Segurança Crítica)

- [x] **Verificação de E-mail (Email Verification):**
  - **Status:** ✅ Implementado
  - Envio automático de e-mail de verificação após registro via AWS SES. Rate-limit de 3 requisições/15min por IP e cooldown de 2 minutos por e-mail no reenvio. Endpoints: `POST /auth/verify-email`, `POST /auth/resend-verification`.

- [x] **Esqueci minha senha (Password Reset):**
  - **Status:** ✅ Implementado
  - Fluxo completo com token de expiração de 1 hora. Endpoints: `POST /auth/forgot-password`, `POST /auth/reset-password`. Revoga todas as sessões ativas ao resetar.

- [x] **Troca de Senha Autenticada:**
  - **Status:** ✅ Implementado
  - Endpoint `PUT /auth/change-password` com validação da senha atual e verificação de complexidade.

- [x] **Proteção contra Força Bruta (Brute Force Protection):**
  - **Status:** ✅ Implementado
  - Bloqueio após 5 tentativas falhas em 15 minutos por IP. Utiliza Redis com fallback resiliente (rate-limit não derruba a API se o Redis cair).

- [ ] **Autenticação de 2 Fatores (MFA/2FA):**
  - **Status:** ⏳ Pendente
  - **Motivo:** Camada extra de segurança, essencial para perfis de `ADMIN` ou dados sensíveis.
  - **Como:** Implementar TOTP (Google Authenticator, Authy) ou envio de código via e-mail/SMS.

---

## 🟡 Média Prioridade (Experiência e Controle de Sessão)

- [x] **Listagem de Sessões Ativas:**
  - **Status:** ✅ Implementado
  - Metadados de User-Agent, IP e nome do dispositivo salvos no Refresh Token. Use-case `list-sessions`, controller e rotas de sessão disponíveis.

- [x] **Revogação de Sessão Específica:**
  - **Status:** ✅ Implementado
  - Use-case `revoke-session` para revogar um Refresh Token específico sem afetar as demais sessões.

- [x] **Histórico de Login (Auditoria):**
  - **Status:** ✅ Implementado
  - Modelo `LoginHistory` no Prisma com registro de data, IP, User-Agent, dispositivo, método de login (e-mail/social) e motivo de falha. Use-case `get-login-history`.

- [x] **Gerenciamento de Vínculos Sociais:**
  - **Status:** ✅ Implementado
  - Use-cases `link-social-account` e `unlink-social-account`. Validação para impedir remoção do último método de autenticação. Suporte a Google, Apple, Facebook e GitHub.

---

## 🟢 Baixa Prioridade (Escala e Enterprise)

- [x] **Campos Extras de Perfil:**
  - **Status:** ✅ Implementado
  - Avatar, telefone, data de nascimento, bio, locale, timezone e endereço completo (rua, cidade, estado, CEP, país). Entidade `UserProfile` e método `updateProfile()`.

- [x] **Suporte a Organizações / Tenants (Multi-tenancy):**
  - **Status:** ✅ Implementado
  - CRUD completo de organizações com slug único. Sistema de convites por e-mail com token. Papéis por organização: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`. Use-cases: criar, atualizar, convidar, aceitar convite, alterar papel e remover membro.

- [x] **Roles e Permissões Granulares (RBAC Avançado):**
  - **Status:** ✅ Implementado
  - Modelo `CustomRole` com permissões por recurso (ex: `users:read`, `posts:delete`). CRUD de roles customizados, atribuição/remoção de roles a usuários, listagem de permissões. Suporte a roles por organização e roles de sistema.

- [x] **Webhooks de Eventos de Autenticação:**
  - **Status:** ✅ Implementado
  - Registro de endpoints com secret para assinatura HMAC. Eventos suportados: `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`, `USER_LOGIN`, `USER_LOGOUT`, `USER_PASSWORD_CHANGED`, `USER_EMAIL_VERIFIED`, `ORG_CREATED`, `ORG_MEMBER_ADDED`, `ORG_MEMBER_REMOVED`. Sistema de retry com status de entrega.

- [x] **Suporte a Fluxos OAuth Completos (PKCE / Authorization Code):**
  - **Status:** ✅ Implementado
  - Authorization Code Flow com PKCE (S256). Endpoints de autorização, consentimento, troca de token e userinfo. Modelo de `AuthorizationCode` e `OAuthConsent`. Client Apps com grant types, scopes e autenticação configuráveis.

---

## 📊 Resumo de Progresso

| Prioridade | Total | Concluído | Pendente |
|---|---|---|---|
| 🔴 Alta | 5 | 4 | 1 |
| 🟡 Média | 4 | 4 | 0 |
| 🟢 Baixa | 5 | 5 | 0 |
| **Total** | **14** | **13** | **1** |

> **Próximo passo:** Implementar Autenticação de 2 Fatores (MFA/2FA) — a única funcionalidade de alta prioridade ainda pendente.
