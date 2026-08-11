# Documentação de Usuários - Authentication API

Este documento descreve a estrutura de dados e as funcionalidades (endpoints) relacionados à entidade Usuário no sistema. A aplicação foi construída seguindo os padrões de **Clean Architecture**, garantindo alta segurança e separação clara de responsabilidades.

## 1. Estrutura de Dados do Usuário (Banco de Dados)

Na tabela `users` (PostgreSQL), um usuário possui os seguintes campos principais:

* **Identificação:** `id` (formato CUID)
* **Perfil:** `name` (Nome) e `email` (único)
* **Segurança:** `passwordHash` (opcional, pois usuários registrados exclusivamente via Login Social não possuem senha armazenada no banco)
* **Controle de Acesso:**
  * `role`: Define as permissões globais do usuário (`USER` ou `ADMIN`).
  * `status`: Define se a conta está ativa (`ACTIVE` ou `INACTIVE`).
* **Rastreabilidade:** `createdAt` (data de criação) e `updatedAt` (data da última modificação).
* **Relacionamentos:**
  * `socialAccounts`: Lista de contas sociais (ex: Google, Apple) atreladas ao usuário. Permite vínculos e desvínculos posteriores.
  * `refreshTokens`: Histórico de tokens de sessão emitidos para o usuário. Inclui metadados como `userAgent`, `ipAddress` e `deviceName` para controle de sessão.
  * `loginHistory`: Registro de auditoria contendo todas as tentativas de login (sucesso ou falha), com dispositivo, método (senha/social) e IP.

---

## 2. Endpoints de Autenticação (`/api/v1/auth/*`)

Estes são os endpoints públicos (ou parcialmente públicos) responsáveis pelo acesso e gerenciamento da sessão do usuário na plataforma.

| Método | Endpoint | Descrição |
|---|---|---|
| **POST** | `/auth/register` | Cria uma conta tradicional usando email e senha (com validação estrita de complexidade de senha). |
| **POST** | `/auth/login` | Realiza o login tradicional com email e senha, retornando o Access Token (15 min) e o Refresh Token (7 dias). |
| **POST** | `/auth/login/social` | Recebe o token do Google (ou Apple/Facebook), valida a integridade diretamente com o provedor, cadastra o usuário no banco se for o primeiro acesso, e retorna os tokens internos. |
| **POST** | `/auth/refresh` | Troca um Refresh Token válido por um novo par de tokens. Implementa **Token Rotation** (o token antigo é invalidado no banco imediatamente por segurança). Preserva os metadados do dispositivo da sessão original. |
| **POST** | `/auth/logout` | Encerra a sessão. Revoga o Refresh Token no banco de dados e adiciona o Access Token atual a uma **Blocklist no Redis**, impedindo seu uso imediato, mesmo antes da expiração. |

---

## 3. Endpoints de Gerenciamento de Usuários (`/api/v1/users/*`)

Estes endpoints exigem autenticação. O cliente deve enviar o `Bearer Token` (Access Token) válido no cabeçalho `Authorization`.

| Método | Endpoint | Regras e Descrição |
|---|---|---|
| **GET** | `/users/me` | Retorna os dados do próprio usuário logado. Muito utilizado pelo frontend para popular perfis e menus após o login. |
| **GET** | `/users/:id` | Busca os detalhes de um usuário específico pelo ID.<br>🛡️ *Regra de Acesso:* Usuários comuns só podem buscar o próprio ID. Administradores podem buscar dados de qualquer usuário. |
| **PUT** | `/users/:id` | Atualiza os dados de perfil (ex: alterar o nome).<br>🛡️ *Regra de Acesso:* Usuários comuns só podem atualizar seus próprios dados. Administradores podem alterar dados de qualquer usuário e modificar a `role` (ex: promover um usuário a ADMIN). |
| **DELETE** | `/users/:id` | Desativa o usuário (**Soft Delete**).<br>🛡️ *Regra de Acesso:* Não apaga o registro fisicamente do banco de dados. Modifica o `status` para `INACTIVE` e **revoga automaticamente todos os tokens de sessão** daquela pessoa, desconectando-a instantaneamente de todos os dispositivos. |
| **GET** | `/users` | Lista todos os usuários cadastrados no sistema.<br>🛡️ *Regra de Acesso:* **Apenas ADMIN**. Suporta paginação e busca flexível por nome/email, bem como filtros avançados por `role` e `status`. |

---

## 4. Endpoints de Experiência e Controle (`/api/v1/users/me/*`)

Estes endpoints permitem que o próprio usuário gerencie ativamente a segurança da sua conta e suas opções de login.

| Funcionalidade | Método | Endpoint | Descrição |
|---|---|---|---|
| **Sessões Ativas** | **GET** | `/users/me/sessions` | Lista todos os dispositivos onde o usuário está atualmente logado. Inclui o IP, nome do navegador/OS e data de acesso. Identifica qual é a sessão atual (`isCurrent`). |
| **Revogar Sessão** | **DELETE** | `/users/me/sessions/:id` | Encerra remotamente uma sessão específica (ex: deslogar de um celular perdido) sem afetar os outros dispositivos do usuário. |
| **Auditoria de Login** | **GET** | `/users/me/login-history` | Retorna o histórico de todas as tentativas de login (com sucesso ou falha). Útil para o usuário identificar acessos suspeitos em sua conta. |
| **Vincular Conta Social** | **POST** | `/users/me/social` | Permite que um usuário que criou a conta com e-mail/senha vincule uma conta social (ex: Google) posteriormente para facilitar os próximos acessos. |
| **Desvincular Conta** | **DELETE** | `/users/me/social/:provider` | Remove o vínculo com uma rede social. O sistema bloqueia a remoção se isso for deixar o usuário sem nenhuma forma de login (ex: sem senha e sem outra rede social vinculada). |

> **Nota:** Todos esses endpoints e seus respectivos modelos de requisição/resposta (schemas) podem ser testados de forma interativa através do painel do Swagger, disponível na rota local ou de produção: `/docs/authentication_api/`.
