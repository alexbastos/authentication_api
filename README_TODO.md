# TODO: Evolução da Authentication API

Este documento lista as funcionalidades, melhorias de segurança e recursos de gerenciamento que devem ser implementados na API de Autenticação para atingir um nível de maturidade de produção completo.

---

## 🔴 Alta Prioridade (Funcionalidade & Segurança Crítica)

- [x] **Verificação de E-mail (Email Verification):**
  - **Motivo:** Evitar que usuários criem contas usando e-mails de terceiros.
  - **Como:** Enviar um e-mail com um link/código de confirmação após o registro (`POST /auth/register`). Restringir acesso a certas rotas até a confirmação.

- [x] **Esqueci minha senha (Password Reset):**
  - **Motivo:** Fluxo essencial para recuperação de acesso.
  - **Como:** Endpoint para solicitar reset (envia e-mail com token) e endpoint para redefinir a senha usando o token recebido.

- [x] **Troca de Senha Autenticada:**
  - **Motivo:** Permitir que o usuário logado altere sua própria senha.
  - **Como:** Endpoint `PUT /users/me/password` que exija a senha atual para confirmar a troca.

- [x] **Proteção contra Força Bruta (Brute Force Protection):**
  - **Motivo:** Impedir ataques automatizados de adivinhação de senha.
  - **Como:** Bloqueio temporário da conta ou do IP após X tentativas de login falhas. Pode usar o Redis para armazenar as tentativas.

- [ ] **Autenticação de 2 Fatores (MFA/2FA):**
  - **Motivo:** Camada extra de segurança, essencial para perfis de `ADMIN` ou dados sensíveis.
  - **Como:** Implementar TOTP (Google Authenticator, Authy) ou envio de código via e-mail/SMS.

---

## 🟡 Média Prioridade (Experiência e Controle de Sessão)

- [ ] **Listagem de Sessões Ativas:**
  - **Motivo:** Dar visibilidade ao usuário de onde ele está logado.
  - **Como:** Salvar metadados do User-Agent e IP ao gerar o Refresh Token. Criar um endpoint `GET /users/me/sessions`.

- [ ] **Revogação de Sessão Específica:**
  - **Motivo:** Permitir que o usuário encerre o acesso em um dispositivo perdido sem deslogar dos demais.
  - **Como:** Endpoint `DELETE /users/me/sessions/:id` para revogar um Refresh Token específico.

- [ ] **Histórico de Login (Auditoria):**
  - **Motivo:** Segurança e auditoria.
  - **Como:** Tabela para registrar data, IP, status (sucesso/falha) e dispositivo de cada tentativa de login.

- [ ] **Gerenciamento de Vínculos Sociais:**
  - **Motivo:** Flexibilidade de acesso.
  - **Como:** Permitir que um usuário que criou a conta com e-mail/senha vincule também sua conta do Google posteriormente, ou remova esse vínculo (`POST /users/me/social`, `DELETE /users/me/social/:provider`).

---

## 🟢 Baixa Prioridade (Escala e Enterprise)

- [ ] **Campos Extras de Perfil:**
  - Adicionar avatar/foto de perfil, telefone, data de nascimento, endereço, etc., conforme a necessidade do produto.

- [ ] **Suporte a Organizações / Tenants (Multi-tenancy):**
  - Preparar a estrutura para que usuários pertençam a uma ou mais empresas, com regras de isolamento de dados.

- [ ] **Roles e Permissões Granulares (RBAC Avançado):**
  - Evoluir do modelo simples (`USER`/`ADMIN`) para um modelo de permissões por recurso (ex: `users:read`, `posts:delete`).

- [ ] **Webhooks de Eventos de Autenticação:**
  - Enviar eventos via Webhook quando um usuário for criado, logar, ou for desativado, para sincronizar com outros microsserviços.

- [ ] **Suporte a Fluxos OAuth Completos (PKCE / Authorization Code):**
  - Tornar a API um verdadeiro "Identity Provider" (IdP) padrão OIDC para que aplicações de terceiros possam usar o seu sistema para login.
