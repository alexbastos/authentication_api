-- ============================================================================
-- Authentication API — Seed Data
-- ============================================================================
-- Script para popular o banco com dados iniciais.
-- Cria um usuário admin padrão para acesso inicial ao sistema.
--
-- ⚠️  IMPORTANTE: Altere a senha do admin em produção!
--
-- O hash abaixo corresponde à senha: Admin@123456
-- (bcrypt com 12 salt rounds)
-- ============================================================================

-- ─── Admin User ─────────────────────────────────────────────────────────────
-- Senha padrão: Admin@123456
-- Hash gerado com bcrypt (salt rounds = 12)
INSERT INTO "users" ("id", "name", "email", "password_hash", "role", "status", "created_at", "updated_at")
VALUES (
    'admin-default-001',
    'System Administrator',
    'admin@authservice.local',
    '$2b$12$LJ3m3SXGHnGqHLFa9VB.aeQlXqJHVwTnbGrXOqEqJFBFqx.Oj2gOm',
    'ADMIN',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("email") DO NOTHING;

-- ─── Default Client App ────────────────────────────────────────────────────
-- Aplicação padrão para testes em desenvolvimento
INSERT INTO "client_apps" ("id", "name", "client_id", "client_secret", "redirect_urls", "is_active", "created_at", "updated_at")
VALUES (
    'client-default-001',
    'Development App',
    'app_dev_default',
    'secret_dev_default_do_not_use_in_production',
    ARRAY['http://localhost:3001/callback', 'http://localhost:3001/auth/callback'],
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("client_id") DO NOTHING;
