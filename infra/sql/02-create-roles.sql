-- The two application identities the plan requires.
--
-- Run ONCE, connected to the `newera` database as the RDS master user, after
-- 01-create-database.sql and before the first migration.
--
--   psql "$MASTER_URL/newera" \
--     -v runtime_password="'...'" -v migrate_password="'...'" \
--     -f 02-create-roles.sql
--
-- Take the two passwords from the secrets Terraform generated:
--   new-era-production/database/runtime   (the password inside the URL)
--   new-era-production/database/migrate
--
-- Why this is not in Terraform: creating a Postgres role means connecting to the
-- database, and the database is — correctly — unreachable from anywhere
-- Terraform runs. Terraform creates the credential containers and generates the
-- passwords; this file creates the roles that match them.
--
-- The separation is the point. `newera_app` can read and write rows and can do
-- nothing to the schema, so a compromised application cannot drop a table.
-- `newera_migrate` owns the schema and is used only by the release task.

\set ON_ERROR_STOP on

-- ── The migration role: owns the schema ───────────────────────────────────

CREATE ROLE newera_migrate LOGIN PASSWORD :migrate_password;

-- `ALTER DEFAULT PRIVILEGES FOR ROLE x` at the end of this file requires the
-- current user to be a MEMBER of x. On RDS the master user is `rds_superuser`,
-- not a true superuser, so it does not get that for free the way a local
-- superuser does — and the statement fails with "permission denied to change
-- default privileges" after the roles have already been created, leaving a
-- half-applied script.
--
-- Granting membership here rather than there keeps the failure from happening
-- at all. It is harmless on a local cluster, where the superuser already
-- qualifies.
GRANT newera_migrate TO CURRENT_USER;

GRANT CONNECT ON DATABASE newera TO newera_migrate;
GRANT ALL ON SCHEMA public TO newera_migrate;
ALTER SCHEMA public OWNER TO newera_migrate;

-- ── The runtime role: rows only, never the schema ─────────────────────────

CREATE ROLE newera_app LOGIN PASSWORD :runtime_password;

GRANT CONNECT ON DATABASE newera TO newera_app;
GRANT USAGE ON SCHEMA public TO newera_app;

-- Explicitly NOT granted: CREATE on the schema. Without it this role cannot
-- create, alter or drop a table whatever else it is given.
REVOKE CREATE ON SCHEMA public FROM newera_app;

-- Tables that exist now (none, on a fresh database) and sequences for the
-- id defaults.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO newera_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO newera_app;

-- The load-bearing part: every table a FUTURE migration creates is granted the
-- same way, automatically. Without this, the first migration after go-live adds
-- a table the application cannot read, and the failure appears at runtime on a
-- code path nobody exercised in staging.
--
-- The defaults are attached to newera_migrate because it is the role that will
-- be creating those objects.
ALTER DEFAULT PRIVILEGES FOR ROLE newera_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO newera_app;

ALTER DEFAULT PRIVILEGES FOR ROLE newera_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO newera_app;

-- ── Check what was actually granted ───────────────────────────────────────
-- Expect: newera_app present, and no `C` (CREATE) in its schema privileges.

SELECT
  r.rolname,
  has_schema_privilege(r.rolname, 'public', 'CREATE') AS can_create_schema_objects,
  has_database_privilege(r.rolname, 'newera', 'CONNECT') AS can_connect
FROM pg_roles r
WHERE r.rolname IN ('newera_app', 'newera_migrate');
