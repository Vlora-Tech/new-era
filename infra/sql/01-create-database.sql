-- Create the application database with the ICU provider and the ar-SA locale.
--
-- Run ONCE, connected to the `postgres` maintenance database as the RDS master
-- user, before the first migration.
--
-- Why this is not in Terraform: `aws_db_instance.db_name` would have RDS create
-- the database with the engine's default collation. docs/aws-rds-production-plan.md
-- requires ICU with ar-SA so that Arabic ordering matches development, and that
-- cannot be expressed through the RDS API — so database.tf deliberately omits
-- `db_name` and this runs instead.
--
-- On collation drift, from the same document: ICU library versions differ
-- between the local Alpine image and RDS, and collation-aware indexes must be
-- rebuilt after a major ICU change. Uniqueness-critical columns are
-- ASCII-normalised in the application precisely so no unique index can be
-- corrupted by such a difference.

CREATE DATABASE newera
  TEMPLATE template0
  ENCODING 'UTF8'
  LOCALE_PROVIDER icu
  ICU_LOCALE 'ar-SA';

COMMENT ON DATABASE newera IS 'بناء العهد الجديد — application database.';
