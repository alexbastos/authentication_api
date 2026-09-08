# Revisão de Arquitetura e Segurança

Data: 08/09/2026

## 1. Resumo executivo

O projeto está **parcialmente conforme** com Clean Architecture. A Dependency
Rule está respeitada nas dependências estáticas verificadas: `domain` não
depende de camadas externas; `application` depende de domínio e portas
internas; Fastify, Prisma, Redis, AWS e JOSE permanecem nas bordas; e
`src/container.ts` é o composition root. Foram adicionados testes
arquiteturais para impedir regressões.

A revisão confirmou falhas de autorização, isolamento de tenant, atomicidade
de tokens, OAuth/PKCE, MFA, SSRF em webhooks, exposição de segredos e deploy do
banco. As correções viáveis foram implementadas. Não é uma afirmação de
segurança absoluta: não houve teste contra infraestrutura PostgreSQL/Redis/S3/
SES real, análise dinâmica externa ou pentest.

## 2. Veredito de Clean Architecture

**Parcialmente conforme.**

- `domain -> domain`: conforme; não importa Fastify, Prisma, Redis ou AWS.
- `application -> domain/application ports`: conforme nas dependências
  estáticas; não importa adapters ou infrastructure.
- `adapters -> application/domain`: conforme; controllers traduzem HTTP para
  casos de uso e não acessam repositórios diretamente.
- `infrastructure -> application ports/domain`: conforme; implementações de
  Prisma, Redis, AWS, JOSE e rede ficam na borda.
- `container -> todas as camadas`: permitido, pois é o composition root.
- Limitação: casos de uso ainda criam datas, UUIDs e aleatoriedade diretamente
  em alguns fluxos. Isso reduz determinismo de teste, embora não viole a
  direção entre as camadas. O modelo de domínio também permanece anêmico em
  partes de OAuth/RBAC.

Evidência automatizada: `src/architecture/dependency-rules.test.ts` cobre
domínio, aplicação e controllers.

## 3. Achados

| ID | Severidade | Confiança | Categoria | Resultado |
|---|---|---|---|---|
| SEC-01 | Crítica | Alta | Autorização | Corrigido: RBAC, client apps e webhooks exigem ADMIN na rota e no caso de uso. |
| SEC-02 | Alta | Alta | BOLA/multi-tenant | Corrigido: perfis, membros, convites, roles e webhooks agora aplicam ownership/tenant. |
| SEC-03 | Alta | Alta | OAuth/OIDC | Corrigido: PKCE S256 obrigatório, codes com hash e consumo atômico, client auth exata e middlewares consent/UserInfo corrigidos. |
| SEC-04 | Alta | Alta | Refresh/session | Corrigido: refresh opaco com hash, rotação atômica, detecção de reuso e logout vinculado à sessão assinada. |
| SEC-05 | Alta | Alta | MFA | Corrigido: desafio discriminado, token dedicado de 5 minutos, consumo único, replay e tentativas limitados. |
| SEC-06 | Alta | Alta | Segredos | Corrigido: MFA e webhook protegidos por AES-256-GCM; client secrets, recovery codes e tokens verificáveis ficam como hash. |
| SEC-07 | Alta | Alta | Webhook/SSRF | Corrigido parcialmente: HTTPS, DNS/IP público, bloqueio de redes especiais, redirects proibidos e revalidação por entrega. |
| SEC-08 | Alta | Alta | Tokens de conta | Corrigido: verificação de e-mail e reset são consumidos com a alteração e revogação numa transação. |
| SEC-09 | Alta | Alta | JWT | Corrigido: RS256 fixo, issuer/audience/tipo/claims validados, `jti`/`sid` e estado atual do usuário/sessão conferidos. |
| DB-01 | Alta | Alta | Persistência | Corrigido: e-mail case-insensitive, unicidade de role global e FKs de tenant na nova migration. |
| OPS-01 | Alta | Alta | Deploy | Corrigido: Compose executa `prisma migrate deploy`; scripts SQL divergentes e credenciais previsíveis foram neutralizados. |
| ARC-01 | Média | Alta | Arquitetura | Corrigido: parsing de User-Agent e geolocalização deixaram de criar dependência application -> infrastructure. |
| SEC-10 | Média | Alta | Avatar/upload | Corrigido: multipart OpenAPI, magic bytes, tamanho, troca segura, DELETE idempotente e URL de 7 dias renovada no GET. |
| OPS-02 | Média | Alta | Config/logs | Corrigido: validação de produção, CORS, Swagger, trust proxy, redaction, readiness real e Redis obrigatório em produção. |
| RES-01 | Alta | Alta | MFA/política | Residual: administradores sem MFA ainda podem autenticar; falta decidir onboarding/recovery antes de impor a política. |
| RES-02 | Média | Alta | OIDC/chaves | Residual: não há discovery canônico nem rotação de `kid`; `auth_time` ainda representa a criação do code. |
| RES-03 | Média | Média | SSRF | Residual: validação DNS e conexão são operações separadas; pinning/egress proxy é necessário contra DNS rebinding/TOCTOU. |
| RES-04 | Média | Alta | Supply chain | Residual: `npm audit` sinaliza 3 highs no Prisma CLI/config/deepmerge; a correção requer migração de major/versionamento coordenado. |
| RES-05 | Média | Alta | Testes | Residual: concorrência é coberta por contratos/mocks, não por integração com PostgreSQL e Redis reais. |
| RES-06 | Baixa | Alta | Privacidade | Residual: falta política explícita de retenção/minimização para login history e payloads de webhook. |
| RES-07 | Baixa | Alta | Manutenção | Residual: o lint global já tinha 447 erros e termina com 470; arquivos novos da revisão passam isoladamente. |

### Evidência, impacto e correção

- **SEC-01/SEC-02:** rotas de RBAC/webhook/client app e controllers permitiam
  operações sensíveis sem defesa em profundidade; listagem de membros e leitura
  de perfis não aplicavam todas as fronteiras. Um usuário autenticado podia
  alcançar dados/operações administrativas. Foram adicionados
  `assertGlobalAdmin`, checagem self/admin, membership, vínculo de convite ao
  e-mail autenticado e validação de organização. Testes: authorization
  boundaries, middleware e webhook tenant boundaries.
- **SEC-03:** authorization codes eram reutilizáveis sob concorrência e PKCE/
  client auth tinham estados ambíguos. O code bruto agora só é devolvido ao
  cliente, o digest é persistido, `consume` é condicional e PKCE aceita apenas
  S256. `/oauth/consent` usa sessão interna e `/oauth/userinfo` usa audience
  OAuth. Testes: one-time grant, PKCE e boundary de middlewares.
- **SEC-04/SEC-08:** revogações e consumo de tokens eram várias escritas sem
  transação. Uma falha intermediária podia deixar token ou sessão reutilizável.
  Repositórios Prisma agora fazem compare-and-set e transações para rotation,
  reset, e-mail, desativação, logout e revogação de sessão.
- **SEC-05/SEC-06:** o segundo fator não tinha contrato completo no login e
  segredos permaneciam expostos em repouso. O login é uma união discriminada;
  MFA token não é access token; Redis controla desafio/replay/tentativas; os
  segredos usam envelope AES-GCM e os códigos usam hash.
- **SEC-07:** URLs de webhook podiam alcançar redes internas e os secrets eram
  retornados em consultas. A URL é validada no cadastro e em cada entrega,
  redirects são proibidos, resposta remota não é persistida e o secret só é
  exibido na criação. A assinatura cobre timestamp e corpo.
- **OPS-01:** o Compose montava `scripts/sql`, um snapshot antigo que não criava
  o schema atual e continha credenciais conhecidas. Um job `migrate` não root
  passou a bloquear a API até as migrations Prisma terminarem.

## 4. Matriz de dependências

| Origem | Domain | Application | Adapters | Infrastructure | Bibliotecas externas |
|---|---:|---:|---:|---:|---|
| Domain | Sim | Não | Não | Não | Nenhuma dependência de framework |
| Application | Sim | Sim | Não | Não | Node crypto/UUID em fluxos ainda não portados |
| Adapters HTTP | Sim | Sim | Sim | Não | Fastify, TypeBox |
| Infrastructure | Sim | Sim (ports) | Não | Sim | Prisma, Redis, AWS, JOSE, bcrypt, fetch |
| Composition root | Sim | Sim | Sim | Sim | Permitido |

Violações estáticas restantes da Dependency Rule: **0** nas regras
automatizadas. Severidade das violações corrigidas: ARC-01, média.

## 5. Matriz de autorização

| Endpoint/grupo | Identidade exigida | Papel/permissão | Ownership/tenant |
|---|---|---|---|
| register/login/social/verify/resend/forgot/reset/refresh | Pública | Rate limit e prova específica | Tokens/códigos vinculados ao usuário |
| JWKS e health | Pública | Leitura | Health não expõe detalhes das dependências |
| logout | Access token interno válido | Qualquer usuário | `sid` assinado determina sessão/família revogada |
| users/me, avatar, sessions, history, social links, MFA account actions | Bearer interno + sessão ativa | Qualquer usuário | Somente o próprio `sub` |
| GET/PUT/DELETE users/{id} | Bearer interno | Próprio usuário ou ADMIN; role só ADMIN | Self/admin validado no caso de uso |
| GET users, client-apps | Bearer interno | ADMIN | Global |
| organizações: criar/listar | Bearer interno | Qualquer usuário | Criador vira OWNER; lista só memberships |
| organização e membros: ler | Bearer interno | Membro | `orgId` + membership |
| organização: editar/convidar/remover membro | Bearer interno | OWNER ou org ADMIN | Mesma organização; OWNER protegido |
| organização: mudar role | Bearer interno | OWNER | OWNER não pode ser atribuído/removido implicitamente |
| aceitar convite | Bearer interno | Conta convidada | E-mail autenticado deve coincidir; consumo atômico |
| RBAC e webhooks | Bearer interno | ADMIN global | `organizationId` existente e isolado |
| OAuth authorize/consent | Sessão interna válida | Usuário autenticado | Client, redirect e scopes cadastrados |
| OAuth token | Client auth conforme cadastro + code + PKCE | basic/post/none exato | Code vinculado a client, user e redirect |
| OAuth UserInfo | Access token OAuth | Scope `openid`; claims por scope | `sub` do token e usuário ativo |
| MFA verify/email-code de login | `mfaToken` dedicado | Método listado no desafio | Challenge/user, TTL e tentativas |

## 6. Correções e arquivos principais

- Contratos e HTTP: `src/adapters/http/schemas`, `src/adapters/http/routes`,
  `src/adapters/http/controllers`, `src/app.ts`.
- Auth/OAuth/MFA: `src/application/use-cases/auth`, `oauth`, `mfa` e
  `src/application/services/mfa-challenge.service.ts`.
- Portas/atomicidade: `src/application/ports` e
  `src/infrastructure/database/repositories`.
- Tokens/segredos: `src/infrastructure/security`.
- Webhook/SSRF: `src/infrastructure/webhook` e use cases de webhook.
- Banco: `prisma/schema.prisma` e
  `prisma/migrations/20260907190000_harden_role_uniqueness/migration.sql`.
- Produção: `.env.example`, `.dockerignore`, `docker/Dockerfile`,
  `docker-compose.yml`, `scripts/generate-version.js`.
- Documentação: `README.md`, `README_USER.md`,
  `MFA_IMPLEMENTATION_STATUS.md`.

## 7. Decisões e compatibilidade

- Login e social login respondem HTTP 200 com discriminador `type`.
- Tokens de sessão nunca são emitidos antes do segundo fator.
- `avatarUrl` saiu do PUT genérico; avatar usa somente endpoints dedicados.
- DELETE de avatar é idempotente e retorna 200.
- URL de avatar vale sete dias e é renovada em cada leitura do perfil.
- Client/webhook secrets são retornados somente na criação.
- Mudanças de MFA revogam as sessões anteriores; o usuário precisa autenticar
  novamente.
- O campo `refreshToken` do logout continua aceito por compatibilidade, mas a
  família é resolvida a partir do `sid` assinado, não do body.
- O schema SQL legado foi mantido apenas como arquivo histórico e falha
  explicitamente; Prisma migrations são a fonte de verdade.

## 8. Testes

Foram adicionados/expandidos testes para:

- regras de dependência entre camadas;
- avatar/OpenAPI, MIME real, tamanho, troca e idempotência;
- login MFA discriminado, token isolado, expiração, uso único e tentativas;
- JWT com tipo, algoritmo, issuer e audience incorretos;
- middleware com usuário/sessão revogada;
- authorization code concorrente, PKCE e refresh rotation;
- BOLA de usuário, membership/OWNER, social MFA e recovery code concorrente;
- SSRF e isolamento de tenant de webhook;
- middlewares distintos de consent e UserInfo;
- readiness PostgreSQL/Redis e revogação de sessão/logout.

## 9. Validação final

| Comando | Resultado |
|---|---|
| `npm run typecheck` | PASS, 0 erros |
| `npm run lint -- --max-diagnostics=20` | FAIL, 470 erros; baseline era 447 |
| `npm test -- --run` | PASS, 14 arquivos e 58 testes |
| `npm run build` | PASS |
| `npx prisma validate` | PASS |
| `docker compose config --quiet` | PASS com variáveis placeholder |
| `git diff --check` | PASS |
| `npm audit --omit=dev --json` | FAIL, 3 highs no encadeamento Prisma CLI/config/deepmerge; baseline 7 (5 high, 2 moderate) |
| Docker image build | Não executado: daemon Docker indisponível no ambiente |

O lint direcionado aos novos arquivos de arquitetura/segurança/testes passa.
Não foi aplicado `lint:fix` global porque isso produziria uma refatoração
cosmética extensa e misturaria o débito preexistente com as correções de risco.

## 10. Riscos residuais e decisões externas

1. Definir um fluxo de enrollment/recovery antes de exigir MFA para ADMIN.
2. Definir issuer público canônico, discovery OIDC, rotação de chaves/`kid` e
   origem correta de `auth_time`.
3. Usar proxy de egress ou conexão com resolução fixada para eliminar o TOCTOU
   de DNS em webhooks.
4. Planejar upgrade coordenado do Prisma que elimine o advisory sem mudança de
   major não testada.
5. Executar testes de integração concorrente em PostgreSQL e Redis reais e
   validar a imagem Docker em CI.
6. Definir retenção de histórico/payloads, rotação do encryption key, TLS de
   Redis/PostgreSQL na topologia real e imagens fixadas por digest.
7. Tratar o backlog de lint em alteração separada e revisável.
