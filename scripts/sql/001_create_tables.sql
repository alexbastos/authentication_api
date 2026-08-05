-- ============================================================================
-- Authentication API — Database Schema
-- ============================================================================
-- Script de criação das tabelas para o microserviço de autenticação.
-- Execute este script em um banco PostgreSQL limpo.
--
-- Ordem de execução:
--   1. Criar o banco de dados (se necessário)
--   2. Executar este script
--
-- Exemplo:
--   psql -U auth_user -d auth_db -f 001_create_tables.sql
-- ============================================================================

-- ─── Extensions ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- Para gen_random_uuid() se necessário

-- ─── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─── Table: users ───────────────────────────────────────────────────────────
-- Tabela principal de usuários. Suporta login local (email/senha) e social.
-- O campo password_hash é opcional para usuários que fazem login apenas via
-- provedores sociais (Google, Apple, etc.).
CREATE TABLE IF NOT EXISTS "users" (
    "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "name"          VARCHAR(100) NOT NULL,
    "email"         VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "role"          "Role"       NOT NULL DEFAULT 'USER',
    "status"        "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Índices da tabela users
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");

-- ─── Table: social_accounts ─────────────────────────────────────────────────
-- Vincula contas de provedores sociais (Google, Apple, Facebook, GitHub) aos
-- usuários. Um usuário pode ter múltiplas contas sociais vinculadas.
-- O campo provider_account_id é o ID único do usuário no provedor social.
CREATE TABLE IF NOT EXISTS "social_accounts" (
    "id"                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id"             TEXT        NOT NULL,
    "provider"            VARCHAR(50) NOT NULL,
    "provider_account_id" VARCHAR(255) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "social_accounts_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Índices da tabela social_accounts
CREATE UNIQUE INDEX IF NOT EXISTS "social_accounts_provider_provider_account_id_key"
    ON "social_accounts"("provider", "provider_account_id");
CREATE INDEX IF NOT EXISTS "social_accounts_user_id_idx" ON "social_accounts"("user_id");

-- ─── Table: refresh_tokens ──────────────────────────────────────────────────
-- Armazena refresh tokens com suporte a Token Rotation.
-- O campo "family" agrupa tokens de uma mesma sessão para detecção de reuso.
-- Quando um refresh token já revogado é reutilizado, TODOS os tokens da mesma
-- família são revogados (indicando possível roubo de token).
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "token"      VARCHAR(500) NOT NULL,
    "user_id"    TEXT         NOT NULL,
    "family"     VARCHAR(100) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_tokens_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- Índices da tabela refresh_tokens
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_family_idx" ON "refresh_tokens"("family");
CREATE INDEX IF NOT EXISTS "refresh_tokens_token_idx" ON "refresh_tokens"("token");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- ─── Table: client_apps ─────────────────────────────────────────────────────
-- Registra aplicações terceiras (clientes OAuth) que podem utilizar este IdP.
-- Cada aplicação recebe um client_id e client_secret únicos.
-- O campo redirect_urls armazena as URLs de redirecionamento permitidas.
CREATE TABLE IF NOT EXISTS "client_apps" (
    "id"            TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "name"          VARCHAR(100) NOT NULL,
    "client_id"     VARCHAR(100) NOT NULL,
    "client_secret" VARCHAR(255) NOT NULL,
    "redirect_urls" TEXT[]       NOT NULL DEFAULT '{}',
    "is_active"     BOOLEAN      NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_apps_pkey" PRIMARY KEY ("id")
);

-- Índices da tabela client_apps
CREATE UNIQUE INDEX IF NOT EXISTS "client_apps_client_id_key" ON "client_apps"("client_id");
CREATE INDEX IF NOT EXISTS "client_apps_client_id_idx" ON "client_apps"("client_id");

-- ─── Trigger: auto-update updated_at ────────────────────────────────────────
-- Trigger function para atualizar automaticamente o campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplica o trigger nas tabelas users e client_apps
DO $$ BEGIN
    CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON "users"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_client_apps_updated_at
        BEFORE UPDATE ON "client_apps"
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ─── Comentários ────────────────────────────────────────────────────────────
COMMENT ON TABLE "users" IS 'Tabela principal de identidade dos usuários';
COMMENT ON TABLE "social_accounts" IS 'Vínculos de contas sociais (Google, Apple, etc.)';
COMMENT ON TABLE "refresh_tokens" IS 'Refresh tokens com suporte a rotação e detecção de reuso';
COMMENT ON TABLE "client_apps" IS 'Aplicações terceiras registradas como clientes OAuth';

COMMENT ON COLUMN "users"."password_hash" IS 'Hash bcrypt da senha. NULL para usuários que usam apenas login social';
COMMENT ON COLUMN "users"."status" IS 'ACTIVE = conta ativa, INACTIVE = soft delete';
COMMENT ON COLUMN "refresh_tokens"."family" IS 'Agrupa tokens de uma sessão para detecção de reuso';
COMMENT ON COLUMN "refresh_tokens"."revoked_at" IS 'NULL = token válido, NOT NULL = token revogado';
COMMENT ON COLUMN "client_apps"."redirect_urls" IS 'URLs de redirecionamento OAuth autorizadas';
