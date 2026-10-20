ALTER TABLE "refresh_tokens"
ADD COLUMN "audience" VARCHAR(255) NOT NULL DEFAULT 'authentication-api',
ADD COLUMN "organization_id" VARCHAR(255);
