-- PostgreSQL treats NULL values as distinct in ordinary unique constraints.
-- Global roles use organization_id = NULL, so enforce the intended invariant.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM custom_roles
    GROUP BY name, organization_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate custom role names must be resolved before applying this migration';
  END IF;
END $$;

DROP INDEX IF EXISTS custom_roles_name_organization_id_key;
CREATE UNIQUE INDEX custom_roles_name_organization_id_key
  ON custom_roles (name, organization_id) NULLS NOT DISTINCT;

-- Normalize existing identities and enforce case-insensitive uniqueness even
-- for writes performed outside the application.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM users
    GROUP BY lower(trim(email))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Case-insensitive duplicate user emails must be resolved before applying this migration';
  END IF;
END $$;

UPDATE users SET email = lower(trim(email)) WHERE email <> lower(trim(email));
CREATE UNIQUE INDEX users_email_ci_key ON users (lower(email));

-- Tenant-scoped records must not reference organizations that do not exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM custom_roles r
    LEFT JOIN organizations o ON o.id = r.organization_id
    WHERE r.organization_id IS NOT NULL AND o.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM user_roles r
    LEFT JOIN organizations o ON o.id = r.organization_id
    WHERE r.organization_id IS NOT NULL AND o.id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM webhook_endpoints w
    LEFT JOIN organizations o ON o.id = w.organization_id
    WHERE w.organization_id IS NOT NULL AND o.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Dangling organization references must be resolved before applying this migration';
  END IF;
END $$;

ALTER TABLE custom_roles
  ADD CONSTRAINT custom_roles_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE webhook_endpoints
  ADD CONSTRAINT webhook_endpoints_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
