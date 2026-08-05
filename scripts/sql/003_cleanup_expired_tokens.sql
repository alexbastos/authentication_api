-- ============================================================================
-- Authentication API — Cleanup Script
-- ============================================================================
-- Script para limpeza de dados expirados.
-- Pode ser executado como um cron job no banco ou via aplicação.
--
-- Exemplo de agendamento no PostgreSQL usando pg_cron:
--   SELECT cron.schedule('cleanup-expired-tokens', '0 3 * * *',
--     $$DELETE FROM refresh_tokens WHERE expires_at < NOW()$$
--   );
-- ============================================================================

-- ─── Remove expired refresh tokens ─────────────────────────────────────────
DELETE FROM "refresh_tokens"
WHERE "expires_at" < CURRENT_TIMESTAMP;

-- ─── Remove revoked refresh tokens older than 30 days ───────────────────────
DELETE FROM "refresh_tokens"
WHERE "revoked_at" IS NOT NULL
  AND "revoked_at" < CURRENT_TIMESTAMP - INTERVAL '30 days';
