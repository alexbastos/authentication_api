# 🔐 Authentication API — Identity Provider Centralizado

Microserviço de autenticação reutilizável e modular que atua como **Provedor de Identidade (IdP) centralizado**, construído com **Clean Architecture**, **Node.js**, **TypeScript** e **Fastify**.

Emite tokens **JWT RS256** padrão OAuth 2.0 / OIDC que podem ser consumidos por múltiplas aplicações sem acoplamento.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Arquitetura](#-arquitetura)
- [Stack Tecnológica](#-stack-tecnológica)
- [Requisitos](#-requisitos)
- [Início Rápido](#-início-rápido)
- [Configuração](#-configuração)
- [Endpoints da API](#-endpoints-da-api)
- [Social Login (Google)](#-social-login-google)
- [Token Strategy](#-token-strategy)
- [Integração com API Gateway](#-integração-com-api-gateway)
- [Banco de Dados](#-banco-de-dados)
- [Docker & Deploy](#-docker--deploy)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Estrutura do Projeto](#-estrutura-do-projeto)

---

## 🎯 Visão Geral

Este serviço é um **Identity Broker** centralizado que:

- ✅ Autentica usuários via **email/senha** ou **Social Login** (Google, Apple, Facebook, GitHub)
- ✅ Emite **seu próprio JWT** padronizado (RS256) — nenhum outro microserviço precisa saber que o Google existe
- ✅ Fornece endpoint **JWKS público** para validação stateless por outros serviços
- ✅ Implementa **Refresh Token Rotation** com detecção de reuso
- ✅ Mantém **blocklist de tokens** via Redis para logout efetivo
- ✅ Suporta **RBAC** (Role-Based Access Control) com roles USER e ADMIN
- ✅ Possui **Swagger UI** auto-gerado para documentação dos endpoints
- ✅ Gerencia **Client Apps** (aplicações terceiras que usam o IdP)
- ✅ Preparado para rodar em **AWS ECS Fargate** com Docker

### Fluxo de Autenticação

```
┌──────────┐    ┌────────────┐    ┌──────────────┐    ┌──────────┐
│ Frontend  │───▶│ API Gateway │───▶│  Auth Service │───▶│ PostgreSQL│
│           │    │            │    │              │    │          │
│           │    │  Valida JWT│    │ Emite JWT    │    │ Usuários │
│           │    │  via JWKS  │    │ RS256        │    │ Tokens   │
└──────────┘    └────────────┘    └──────┬───────┘    └──────────┘
                                         │
                                   ┌─────▼─────┐
                                   │   Redis    │
                                   │ Blocklist  │
                                   │ Rate Limit │
                                   └───────────┘
```

---

## 🏛 Arquitetura

O projeto segue a **Clean Architecture** (Arquitetura Limpa) do Uncle Bob, dividido em 4 camadas concêntricas:

```
┌─────────────────────────────────────────────────┐
│              Infrastructure (Camada 4)           │
│  Prisma, Redis, Fastify, Google OAuth, bcrypt   │
│  ┌─────────────────────────────────────────────┐ │
│  │         Adapters (Camada 3)                 │ │
│  │  Controllers, Routes, Schemas, Middlewares  │ │
│  │  ┌─────────────────────────────────────────┐│ │
│  │  │      Application (Camada 2)             ││ │
│  │  │  Use Cases, Ports (Interfaces)          ││ │
│  │  │  ┌─────────────────────────────────────┐││ │
│  │  │  │       Domain (Camada 1)             │││ │
│  │  │  │  Entities, Errors, Repository IF    │││ │
│  │  │  └─────────────────────────────────────┘││ │
│  │  └─────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Regra de Dependência
As dependências apontam **sempre para dentro**:
- Domain não conhece nada externo
- Application conhece Domain, mas não Infrastructure
- Adapters conhecem Application e Domain
- Infrastructure implementa interfaces definidas nas camadas internas

---

## 🛠 Stack Tecnológica

| Componente | Tecnologia | Versão |
|:---|:---|:---|
| Runtime | Node.js | >= 20 LTS |
| Linguagem | TypeScript | 5.x |
| Framework Web | Fastify | 5.x |
| ORM | Prisma | 6.x |
| Banco de Dados | PostgreSQL | 15+ |
| Cache/Blocklist | Redis (ioredis) | 7+ |
| JWT | jose (RS256) | 6.x |
| Password Hash | bcrypt | 5.x |
| Validação | TypeBox + Zod | - |
| Documentação | @fastify/swagger | - |
| Rate Limiting | @fastify/rate-limit | - |
| Containerização | Docker | - |

---

## 📦 Requisitos

- **Node.js** >= 20.0.0
- **npm** >= 9.0.0
- **Docker** e **Docker Compose** (para ambiente local)
- **OpenSSL** (para gerar chaves RSA)

---

## 🚀 Início Rápido

### 1. Clone o repositório

```bash
git clone <repo-url>
cd authentication_api
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

### 4. Gere as chaves RSA para JWT

```bash
npm run keys:generate
# ou
bash scripts/generate-keys.sh
```

### 5. Suba o banco de dados e Redis (Docker)

```bash
docker-compose up -d postgres redis
```

### 6. Execute as migrações do banco

```bash
npx prisma migrate dev --name init
# ou use o script SQL diretamente:
# psql -U auth_user -d auth_db -f scripts/sql/001_create_tables.sql
```

### 7. Gere o Prisma Client

```bash
npm run db:generate
```

### 8. Inicie o servidor

```bash
npm run dev
```

### 9. Acesse o Swagger UI

Abra no navegador: **http://localhost:3000/docs**

---

## ⚙️ Configuração

Todas as variáveis de ambiente estão documentadas no arquivo `.env.example`:

| Variável | Descrição | Default |
|:---|:---|:---|
| `PORT` | Porta do servidor | `3000` |
| `HOST` | Host de escuta | `0.0.0.0` |
| `NODE_ENV` | Ambiente (development/production/test) | `development` |
| `DATABASE_URL` | Connection string PostgreSQL | - |
| `REDIS_HOST` | Host do Redis | `localhost` |
| `REDIS_PORT` | Porta do Redis | `6379` |
| `JWT_PRIVATE_KEY_PATH` | Caminho da chave privada RSA | `./keys/private.pem` |
| `JWT_PUBLIC_KEY_PATH` | Caminho da chave pública RSA | `./keys/public.pem` |
| `JWT_ACCESS_TOKEN_EXPIRY` | TTL do access token | `15m` |
| `JWT_REFRESH_TOKEN_EXPIRY_DAYS` | TTL do refresh token (dias) | `7` |
| `JWT_ISSUER` | Emissor do JWT | `authentication-api` |
| `GOOGLE_CLIENT_ID` | Client ID do Google OAuth | - |
| `GOOGLE_CLIENT_SECRET` | Client Secret do Google OAuth | - |
| `BCRYPT_SALT_ROUNDS` | Rounds do bcrypt | `12` |
| `RATE_LIMIT_MAX` | Máximo de requests por janela | `100` |
| `RATE_LIMIT_WINDOW_MS` | Janela do rate limit (ms) | `60000` |
| `CORS_ORIGIN` | Origens permitidas (separadas por vírgula) | `http://localhost:3001` |

---

## 📡 Endpoints da API

### Auth (Autenticação)

| Método | Endpoint | Descrição | Auth |
|:---|:---|:---|:---|
| `POST` | `/api/v1/auth/register` | Registrar novo usuário | ❌ |
| `POST` | `/api/v1/auth/login` | Login com email/senha | ❌ |
| `POST` | `/api/v1/auth/login/social` | Login com social provider | ❌ |
| `POST` | `/api/v1/auth/refresh` | Renovar access token | ❌ |
| `POST` | `/api/v1/auth/logout` | Logout (revogar tokens) | ✅ Bearer |
| `POST` | `/api/v1/auth/validate` | Validar token (API Gateway) | ❌ |
| `GET` | `/api/v1/auth/.well-known/jwks.json` | Chaves públicas (JWKS) | ❌ |

### Users (CRUD)

| Método | Endpoint | Descrição | Auth |
|:---|:---|:---|:---|
| `GET` | `/api/v1/users/me` | Perfil do usuário autenticado | ✅ Bearer |
| `GET` | `/api/v1/users` | Listar usuários (paginado) | ✅ Admin |
| `GET` | `/api/v1/users/:id` | Buscar usuário por ID | ✅ Bearer |
| `PUT` | `/api/v1/users/:id` | Atualizar usuário | ✅ Bearer |
| `DELETE` | `/api/v1/users/:id` | Desativar usuário (soft delete) | ✅ Bearer |

### Client Apps

| Método | Endpoint | Descrição | Auth |
|:---|:---|:---|:---|
| `POST` | `/api/v1/client-apps` | Registrar app cliente | ✅ Admin |
| `GET` | `/api/v1/client-apps` | Listar apps clientes | ✅ Admin |

### Outros

| Método | Endpoint | Descrição |
|:---|:---|:---|
| `GET` | `/health` | Health check |
| `GET` | `/docs` | Swagger UI |

---

## 🌐 Social Login (Google)

### Como funciona

1. O **Frontend** exibe o botão "Login com Google"
2. O Google autentica o usuário e devolve um **ID Token**
3. O Frontend envia esse ID Token para `POST /api/v1/auth/login/social`
4. O serviço **valida** o token com o Google, **descarta** o token do Google
5. O serviço **encontra ou cria** o usuário e emite o **seu próprio JWT**
6. O Frontend passa a usar apenas o JWT interno para todos os outros microserviços

### Configuração do Google

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um projeto e ative a API "Google+ API" ou "People API"
3. Em **Credentials**, crie um **OAuth 2.0 Client ID** (tipo: Web Application)
4. Copie o `Client ID` e `Client Secret` para o `.env`

### Request de exemplo

```bash
curl -X POST http://localhost:3000/api/v1/auth/login/social \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "GOOGLE",
    "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  }'
```

### Adicionando novos provedores

Para adicionar um novo provedor (ex: Apple):

1. Crie `src/infrastructure/social/apple-oauth.provider.ts` implementando `ISocialAuthProvider`
2. Registre no container (`src/container.ts`):
   ```typescript
   socialRegistry.register(new AppleOAuthProvider(env.APPLE_CLIENT_ID));
   ```
3. **Nenhuma mudança** nas camadas Domain, Application ou Adapters!

---

## 🔑 Token Strategy

### Access Token (JWT RS256)

- **Algoritmo**: RS256 (assimétrico)
- **TTL**: 15 minutos (configurável)
- **Conteúdo**: `sub` (userId), `email`, `role`, `jti` (unique ID), `iat`, `exp`, `iss`
- **Verificação**: Outros serviços verificam usando a chave pública via JWKS endpoint

### Refresh Token

- **Formato**: UUID opaco
- **TTL**: 7 dias (configurável)
- **Armazenamento**: PostgreSQL com campo `family` para detecção de reuso
- **Rotação**: Cada uso gera um novo par (access + refresh) e invalida o anterior

### Detecção de Reuso de Refresh Token

```
Cenário: Atacante rouba o refresh token T1

Tempo 1: Usuário legítimo usa T1 → Recebe T2 (T1 é revogado)
Tempo 2: Atacante tenta usar T1 (já revogado)
         → Sistema detecta reuso
         → TODOS os tokens da família são revogados
         → Usuário legítimo é deslogado (segurança)
```

### Token Blocklist (Redis)

- Quando o usuário faz logout, o `jti` do access token é adicionado ao Redis
- O TTL no Redis é igual ao tempo restante de expiração do token
- Toda validação de token consulta o Redis antes de aceitar

---

## 🌉 Integração com API Gateway

### Opção 1: Validação via endpoint `/validate`

O API Gateway pode chamar `POST /api/v1/auth/validate` passando o token:

```bash
curl -X POST http://auth-service:3000/api/v1/auth/validate \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJ..."}'
```

Resposta:
```json
{
  "valid": true,
  "payload": {
    "sub": "user-id-123",
    "email": "user@example.com",
    "role": "USER",
    "jti": "unique-token-id",
    "iat": 1720000000,
    "exp": 1720000900,
    "iss": "authentication-api"
  }
}
```

### Opção 2: Validação via JWKS (recomendado para performance)

O API Gateway busca a chave pública do endpoint JWKS e valida o JWT localmente, sem fazer chamada HTTP ao auth service:

```
GET http://auth-service:3000/api/v1/auth/.well-known/jwks.json
```

### AWS API Gateway

No AWS API Gateway, configure um **Lambda Authorizer** que:
1. Busca a chave pública do JWKS endpoint (com cache de 5 minutos)
2. Verifica a assinatura RS256 do token
3. Retorna as claims do token como contexto da requisição

---

## 🗄 Banco de Dados

### Scripts SQL

Os scripts de criação de tabelas estão em `scripts/sql/`:

| Arquivo | Descrição |
|:---|:---|
| `001_create_tables.sql` | Criação de todas as tabelas, índices e triggers |
| `002_seed_data.sql` | Dados iniciais (admin + client app de dev) |
| `003_cleanup_expired_tokens.sql` | Limpeza de tokens expirados (cron job) |

### Executar scripts SQL manualmente

```bash
# Criar tabelas
psql -U auth_user -d auth_db -f scripts/sql/001_create_tables.sql

# Popular com dados iniciais
psql -U auth_user -d auth_db -f scripts/sql/002_seed_data.sql

# Limpar tokens expirados (rodar periodicamente)
psql -U auth_user -d auth_db -f scripts/sql/003_cleanup_expired_tokens.sql
```

### Usar Prisma Migrations (recomendado)

```bash
# Criar e aplicar migration
npx prisma migrate dev --name init

# Aplicar migrations em produção
npx prisma migrate deploy

# Visualizar banco no Prisma Studio
npx prisma studio
```

### Modelo de Dados

```
┌──────────────┐     ┌─────────────────┐     ┌───────────────┐
│    users     │     │ social_accounts  │     │ refresh_tokens│
├──────────────┤     ├─────────────────┤     ├───────────────┤
│ id       PK  │──┬──│ id          PK  │     │ id        PK  │
│ name         │  │  │ user_id     FK  │     │ token         │
│ email    UQ  │  │  │ provider        │     │ user_id   FK  │──┐
│ password_hash│  │  │ provider_acct_id│     │ family        │  │
│ role         │  │  └─────────────────┘     │ expires_at    │  │
│ status       │  │                          │ revoked_at    │  │
│ created_at   │  │                          └───────────────┘  │
│ updated_at   │  │                                             │
└──────────────┘  │  ┌───────────────┐                          │
                  │  │  client_apps  │                          │
                  │  ├───────────────┤                          │
                  └──│ id        PK  │                          │
                     │ name          │                          │
                     │ client_id  UQ │                          │
                     │ client_secret │                          │
                     │ redirect_urls │                          │
                     │ is_active     │                          │
                     └───────────────┘                          │
                                                                │
                        users.id ◄──────────────────────────────┘
```

---

## 🐳 Docker & Deploy

### Ambiente Local

```bash
# Subir tudo (app + postgres + redis)
docker-compose up -d

# Subir apenas banco e redis (para dev local)
docker-compose up -d postgres redis

# Ver logs
docker-compose logs -f app

# Parar tudo
docker-compose down
```

### Build da Imagem

```bash
docker build -t authentication-api -f docker/Dockerfile .
```

### Deploy no AWS ECS Fargate

1. **Push para ECR:**
   ```bash
   aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
   docker tag authentication-api:latest <account>.dkr.ecr.<region>.amazonaws.com/authentication-api:latest
   docker push <account>.dkr.ecr.<region>.amazonaws.com/authentication-api:latest
   ```

2. **Task Definition** — configure:
   - Image: `<ecr-url>/authentication-api:latest`
   - CPU: 256 (0.25 vCPU) ou 512
   - Memory: 512 MB ou 1024 MB
   - Port Mapping: 3000
   - Environment variables via AWS Secrets Manager
   - Health check: `GET /health`

3. **Infraestrutura AWS recomendada:**
   - **Amazon RDS** PostgreSQL 15 (Multi-AZ para produção)
   - **Amazon ElastiCache** Redis 7 (cluster mode)
   - **AWS Secrets Manager** para chaves RSA e credenciais
   - **Application Load Balancer** na frente do ECS
   - **API Gateway** para gerenciar rotas e rate limiting

---

## 📝 Scripts Disponíveis

| Script | Comando | Descrição |
|:---|:---|:---|
| Dev | `npm run dev` | Inicia em modo desenvolvimento (hot reload) |
| Build | `npm run build` | Compila TypeScript para JavaScript |
| Start | `npm start` | Inicia em modo produção |
| Type Check | `npm run typecheck` | Verifica tipos TypeScript |
| Lint | `npm run lint` | Verifica code style (Biome) |
| Lint Fix | `npm run lint:fix` | Corrige code style automaticamente |
| Test | `npm test` | Executa todos os testes |
| Test Unit | `npm run test:unit` | Testes unitários (domain + application) |
| Test Integration | `npm run test:integration` | Testes de integração |
| DB Generate | `npm run db:generate` | Gera Prisma Client |
| DB Migrate | `npm run db:migrate` | Cria/aplica migrações (dev) |
| DB Migrate Prod | `npm run db:migrate:prod` | Aplica migrações (produção) |
| DB Studio | `npm run db:studio` | Abre Prisma Studio |
| Keys Generate | `npm run keys:generate` | Gera par de chaves RSA |
| Docker Up | `npm run docker:up` | Sobe ambiente Docker |
| Docker Down | `npm run docker:down` | Para ambiente Docker |

---

## 📁 Estrutura do Projeto

```
authentication_api/
├── src/
│   ├── domain/                          # 🟢 Camada 1: Entidades
│   │   ├── entities/                    # Objetos de domínio puros
│   │   │   ├── user.entity.ts           # User + ProviderInfo (value object)
│   │   │   ├── role.entity.ts           # Enums: Role, UserStatus, SocialProvider
│   │   │   ├── client-app.entity.ts     # ClientApp (apps terceiras)
│   │   │   ├── refresh-token.entity.ts  # RefreshToken com rotação
│   │   │   └── index.ts
│   │   ├── errors/                      # Erros de domínio tipados
│   │   │   ├── domain-errors.ts         # Hierarquia de erros
│   │   │   └── index.ts
│   │   └── repositories/               # Contratos (interfaces)
│   │       ├── user.repository.ts       # IUserRepository
│   │       ├── refresh-token.repository.ts
│   │       ├── client-app.repository.ts
│   │       └── index.ts
│   │
│   ├── application/                     # 🔵 Camada 2: Casos de Uso
│   │   ├── use-cases/
│   │   │   ├── auth/                    # Autenticação
│   │   │   │   ├── authenticate-user.use-case.ts
│   │   │   │   ├── authenticate-social.use-case.ts
│   │   │   │   ├── validate-token.use-case.ts
│   │   │   │   ├── refresh-token.use-case.ts
│   │   │   │   └── revoke-token.use-case.ts
│   │   │   ├── user/                    # CRUD Usuários
│   │   │   │   ├── register-user.use-case.ts
│   │   │   │   ├── get-user.use-case.ts
│   │   │   │   ├── update-user.use-case.ts
│   │   │   │   ├── delete-user.use-case.ts
│   │   │   │   └── list-users.use-case.ts
│   │   │   └── client-app/              # Apps Clientes
│   │   │       ├── register-client-app.use-case.ts
│   │   │       └── list-client-apps.use-case.ts
│   │   └── ports/                       # Interfaces para infraestrutura
│   │       ├── hasher.port.ts           # IHasher
│   │       ├── token-manager.port.ts    # ITokenManager
│   │       ├── social-auth.port.ts      # ISocialAuthProvider
│   │       ├── cache.port.ts            # ICacheProvider
│   │       └── index.ts
│   │
│   ├── adapters/                        # 🟡 Camada 3: Adaptadores
│   │   └── http/
│   │       ├── controllers/             # Recebem HTTP, chamam Use Cases
│   │       │   ├── auth.controller.ts
│   │       │   ├── user.controller.ts
│   │       │   └── client-app.controller.ts
│   │       ├── routes/                  # Definição de endpoints + schemas
│   │       │   ├── auth.routes.ts
│   │       │   ├── user.routes.ts
│   │       │   └── client-app.routes.ts
│   │       ├── schemas/                 # TypeBox (validação + Swagger)
│   │       │   ├── auth.schema.ts
│   │       │   ├── user.schema.ts
│   │       │   └── client-app.schema.ts
│   │       └── middlewares/             # Hooks de autenticação/autorização
│   │           ├── auth.middleware.ts
│   │           └── role.middleware.ts
│   │
│   ├── infrastructure/                  # 🔴 Camada 4: Frameworks & Drivers
│   │   ├── database/
│   │   │   └── repositories/           # Implementações Prisma
│   │   │       ├── prisma-user.repository.ts
│   │   │       ├── prisma-refresh-token.repository.ts
│   │   │       └── prisma-client-app.repository.ts
│   │   ├── cache/
│   │   │   └── redis-cache.provider.ts  # Redis (ioredis)
│   │   ├── security/
│   │   │   ├── bcrypt-hasher.ts         # bcrypt
│   │   │   └── jose-token-manager.ts    # JWT RS256 + JWKS
│   │   ├── social/
│   │   │   ├── google-oauth.provider.ts # Google OAuth
│   │   │   └── social-auth-registry.ts  # Registry de providers
│   │   └── config/
│   │       └── env.ts                   # Validação de env vars (Zod)
│   │
│   ├── container.ts                     # 🔧 Composição de dependências (DI)
│   ├── app.ts                           # Fastify setup + plugins + error handler
│   └── server.ts                        # Entry point + graceful shutdown
│
├── prisma/
│   └── schema.prisma                    # Schema do Prisma ORM
│
├── scripts/
│   ├── generate-keys.sh                 # Gerar chaves RSA
│   └── sql/                             # Scripts SQL
│       ├── 001_create_tables.sql        # Criação das tabelas
│       ├── 002_seed_data.sql            # Dados iniciais
│       └── 003_cleanup_expired_tokens.sql
│
├── docker/
│   └── Dockerfile                       # Multi-stage build
├── docker-compose.yml                   # Dev environment
├── .env.example                         # Template de variáveis
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md                            # Este arquivo
```

---

## 📄 Licença

ISC
