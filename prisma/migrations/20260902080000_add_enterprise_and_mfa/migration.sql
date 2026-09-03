-- ============================================================================
-- Migration: add_enterprise_and_mfa
-- Adds enterprise features (sessions, orgs, RBAC, webhooks, OAuth/OIDC)
-- and MFA/2FA support
-- ============================================================================

-- CreateEnum: LoginStatus
CREATE TYPE "LoginStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum: LoginMethod
CREATE TYPE "LoginMethod" AS ENUM ('EMAIL_PASSWORD', 'SOCIAL_GOOGLE', 'SOCIAL_APPLE', 'SOCIAL_FACEBOOK', 'SOCIAL_GITHUB');

-- CreateEnum: OrgRole
CREATE TYPE "OrgRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum: MfaMethod
CREATE TYPE "MfaMethod" AS ENUM ('TOTP', 'EMAIL');

-- CreateEnum: WebhookEvent
CREATE TYPE "WebhookEvent" AS ENUM ('USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_LOGIN', 'USER_LOGOUT', 'USER_PASSWORD_CHANGED', 'USER_EMAIL_VERIFIED', 'ORG_CREATED', 'ORG_MEMBER_ADDED', 'ORG_MEMBER_REMOVED', 'MFA_ENABLED', 'MFA_DISABLED');

-- CreateEnum: WebhookDeliveryStatus
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXHAUSTED');

-- ============================================================================
-- AlterTable: users — add session tracking, profile, address, and MFA fields
-- ============================================================================

-- Session tracking on refresh_tokens
ALTER TABLE "refresh_tokens" ADD COLUMN "user_agent" VARCHAR(500);
ALTER TABLE "refresh_tokens" ADD COLUMN "ip_address" VARCHAR(45);
ALTER TABLE "refresh_tokens" ADD COLUMN "device_name" VARCHAR(200);

-- User profile fields
ALTER TABLE "users" ADD COLUMN "avatar_url" VARCHAR(500);
ALTER TABLE "users" ADD COLUMN "phone" VARCHAR(20);
ALTER TABLE "users" ADD COLUMN "birth_date" DATE;
ALTER TABLE "users" ADD COLUMN "bio" VARCHAR(500);
ALTER TABLE "users" ADD COLUMN "locale" VARCHAR(10);
ALTER TABLE "users" ADD COLUMN "timezone" VARCHAR(50);

-- User address fields
ALTER TABLE "users" ADD COLUMN "address_street" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "address_city" VARCHAR(100);
ALTER TABLE "users" ADD COLUMN "address_state" VARCHAR(50);
ALTER TABLE "users" ADD COLUMN "address_zip_code" VARCHAR(20);
ALTER TABLE "users" ADD COLUMN "address_country" VARCHAR(2);

-- MFA fields on users
ALTER TABLE "users" ADD COLUMN "mfa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "mfa_method" "MfaMethod";

-- OAuth fields on client_apps
ALTER TABLE "client_apps" ADD COLUMN "grant_types" TEXT[] DEFAULT ARRAY['authorization_code'];
ALTER TABLE "client_apps" ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY['openid', 'profile', 'email'];
ALTER TABLE "client_apps" ADD COLUMN "token_endpoint_auth" VARCHAR(50) NOT NULL DEFAULT 'client_secret_post';

-- ============================================================================
-- CreateTable: login_history
-- ============================================================================
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "email" VARCHAR(255) NOT NULL,
    "status" "LoginStatus" NOT NULL,
    "method" "LoginMethod" NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" VARCHAR(500),
    "device_name" VARCHAR(200),
    "fail_reason" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_history_user_id_idx" ON "login_history"("user_id");
CREATE INDEX "login_history_email_idx" ON "login_history"("email");
CREATE INDEX "login_history_created_at_idx" ON "login_history"("created_at");

-- AddForeignKey
ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- CreateTable: organizations
-- ============================================================================
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "logo_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- ============================================================================
-- CreateTable: organization_members
-- ============================================================================
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_members_user_id_organization_id_key" ON "organization_members"("user_id", "organization_id");
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");

ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- CreateTable: org_invitations
-- ============================================================================
CREATE TABLE "org_invitations" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "organization_id" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "invited_by" TEXT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_invitations_token_hash_key" ON "org_invitations"("token_hash");
CREATE INDEX "org_invitations_email_idx" ON "org_invitations"("email");
CREATE INDEX "org_invitations_token_hash_idx" ON "org_invitations"("token_hash");
CREATE INDEX "org_invitations_organization_id_idx" ON "org_invitations"("organization_id");

ALTER TABLE "org_invitations" ADD CONSTRAINT "org_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- CreateTable: permissions (RBAC)
-- ============================================================================
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "category" VARCHAR(50) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE INDEX "permissions_code_idx" ON "permissions"("code");
CREATE INDEX "permissions_category_idx" ON "permissions"("category");

-- ============================================================================
-- CreateTable: custom_roles (RBAC)
-- ============================================================================
CREATE TABLE "custom_roles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "organization_id" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_roles_name_organization_id_key" ON "custom_roles"("name", "organization_id");
CREATE INDEX "custom_roles_organization_id_idx" ON "custom_roles"("organization_id");

-- ============================================================================
-- CreateTable: role_permissions (RBAC join table)
-- ============================================================================
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "custom_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- CreateTable: user_roles (RBAC join table)
-- ============================================================================
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "organization_id" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);

CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "custom_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- CreateTable: webhook_endpoints
-- ============================================================================
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "secret" VARCHAR(255) NOT NULL,
    "events" "WebhookEvent"[],
    "organization_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_endpoints_organization_id_idx" ON "webhook_endpoints"("organization_id");

-- ============================================================================
-- CreateTable: webhook_deliveries
-- ============================================================================
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "event" "WebhookEvent" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_attempt" TIMESTAMP(3),
    "next_retry" TIMESTAMP(3),
    "response_code" INTEGER,
    "response_body" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_deliveries_endpoint_id_idx" ON "webhook_deliveries"("endpoint_id");
CREATE INDEX "webhook_deliveries_status_idx" ON "webhook_deliveries"("status");
CREATE INDEX "webhook_deliveries_next_retry_idx" ON "webhook_deliveries"("next_retry");

ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- CreateTable: authorization_codes (OAuth/OIDC)
-- ============================================================================
CREATE TABLE "authorization_codes" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(255) NOT NULL,
    "client_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "redirect_uri" VARCHAR(500) NOT NULL,
    "scope" VARCHAR(500) NOT NULL,
    "code_challenge" VARCHAR(255),
    "code_challenge_method" VARCHAR(10),
    "nonce" VARCHAR(255),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authorization_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "authorization_codes_code_key" ON "authorization_codes"("code");
CREATE INDEX "authorization_codes_code_idx" ON "authorization_codes"("code");
CREATE INDEX "authorization_codes_client_id_idx" ON "authorization_codes"("client_id");

-- ============================================================================
-- CreateTable: oauth_consents
-- ============================================================================
CREATE TABLE "oauth_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "scopes" TEXT[],
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_consents_user_id_client_id_key" ON "oauth_consents"("user_id", "client_id");

-- ============================================================================
-- CreateTable: mfa_secrets (MFA/2FA)
-- ============================================================================
CREATE TABLE "mfa_secrets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret" VARCHAR(500) NOT NULL,
    "method" "MfaMethod" NOT NULL DEFAULT 'TOTP',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_secrets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_secrets_user_id_method_key" ON "mfa_secrets"("user_id", "method");
CREATE INDEX "mfa_secrets_user_id_idx" ON "mfa_secrets"("user_id");

ALTER TABLE "mfa_secrets" ADD CONSTRAINT "mfa_secrets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- CreateTable: mfa_recovery_codes (MFA/2FA)
-- ============================================================================
CREATE TABLE "mfa_recovery_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_recovery_codes_user_id_idx" ON "mfa_recovery_codes"("user_id");

ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
