# RDS for PostgreSQL, built to the baseline in docs/aws-rds-production-plan.md.

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = local.name }
}

# ── Encryption ─────────────────────────────────────────────────────────────
# A customer-managed key rather than the AWS-managed default, so the key policy,
# rotation and — should it ever be needed — revocation are ours.
#
# Encryption at rest must be enabled AT CREATION. It cannot be turned on in
# place afterwards: retrofitting means snapshot, copy-with-encryption, restore,
# and a cutover. Getting it right here is the whole opportunity.

resource "aws_kms_key" "database" {
  description             = "${local.name} RDS encryption at rest"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  tags = { Name = "${local.name}-database" }
}

resource "aws_kms_alias" "database" {
  name          = "alias/${local.name}-database"
  target_key_id = aws_kms_key.database.key_id
}

# ── Parameters ─────────────────────────────────────────────────────────────

resource "aws_db_parameter_group" "main" {
  name   = local.name
  family = "postgres17"

  # TLS is not optional and not left to the client to remember. With this set,
  # the server refuses any non-SSL connection outright, so a misconfigured
  # DATABASE_URL fails to connect rather than silently sending credentials and
  # student records in the clear.
  #
  # The application must also *verify* the certificate — `sslmode=verify-full`
  # plus the RDS CA bundle. force_ssl stops eavesdropping; only verification
  # stops impersonation. See docs/deployment.md § Database URLs.
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  # Log statements that take longer than a second. Cheap, and it is the first
  # thing anyone asks for when the platform feels slow.
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ── Instance ───────────────────────────────────────────────────────────────

resource "aws_db_instance" "main" {
  identifier = local.name

  engine = "postgres"
  # Major version pinned, minor upgrades applied automatically in the window.
  # The plan doc is explicit that major upgrades are performed deliberately,
  # never automatically — hence the major-only pin and the flag below it.
  engine_version              = "17"
  allow_major_version_upgrade = false
  auto_minor_version_upgrade  = true

  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.database.arn

  /*
   * No `db_name`, deliberately.
   *
   * RDS would create the initial database with the engine's default collation,
   * and the plan doc requires the ICU provider with the `ar-SA` locale so that
   * Arabic ordering matches development. That cannot be expressed here, so the
   * application database is created by infra/sql/01-create-database.sql from
   * the migration task instead. RDS still creates a `postgres` maintenance
   * database to connect to in order to run it.
   */

  /*
   * RDS manages the master credential in Secrets Manager and rotates it. This
   * is the plan's "master credentials in Secrets Manager with rotation" without
   * a password ever passing through Terraform state — which is what would
   * happen if the password were set here, since state records it in plaintext.
   *
   * The application never sees this secret. It is for administration and for
   * creating the two application roles; the runtime uses its own credential.
   */
  username                      = "newera_admin"
  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.database.arn

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  # Not negotiable, in the plan doc's words. A publicly reachable production
  # database is not an acceptable outcome of any hosting choice.
  publicly_accessible = false

  multi_az = var.db_multi_az

  # Point-in-time recovery. Single-AZ trades availability, not durability, and
  # this is the half that keeps the data.
  backup_retention_period = var.db_backup_retention_days
  backup_window           = "01:00-02:00" # ~04:00 Riyadh, off-peak
  maintenance_window      = "sat:02:30-sat:03:30"
  copy_tags_to_snapshot   = true

  # Two independent guards against losing everything to one command: RDS refuses
  # to delete the instance at all, and if that is lifted a final snapshot is
  # still taken. `prevent_destroy` below is the third, at the Terraform layer.
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${local.name}-final-${formatdate("YYYYMMDDhhmm", timestamp())}"

  performance_insights_enabled          = true
  performance_insights_kms_key_id       = aws_kms_key.database.arn
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  lifecycle {
    # A `terraform destroy` on a production database should require deliberately
    # editing this file first, not just a confirmation prompt at 2am.
    prevent_destroy = true

    # `timestamp()` above changes on every plan, which would otherwise show a
    # permanent diff and, worse, train everyone to ignore diffs on this resource.
    ignore_changes = [final_snapshot_identifier]
  }
}

# ── The runtime credential ─────────────────────────────────────────────────
# The plan requires two application identities: a runtime user with DML and no
# DDL rights, and a migration role with DDL used only by the release job. The
# application must never fall back to the master secret — a compromised runtime
# should not be able to drop a table.
#
# Postgres roles cannot be created from here: they live inside a database that
# is, correctly, unreachable from anywhere Terraform runs. Terraform creates the
# *containers* for those credentials and generates the passwords; the roles
# themselves are created once by infra/sql/02-create-roles.sql, run from the
# migration task. See docs/deployment.md § Bootstrapping the database.

resource "random_password" "app_runtime" {
  length  = 32
  special = false # Avoids any URL-encoding question in a connection string.
}

resource "random_password" "app_migrate" {
  length  = 32
  special = false
}

# The connection strings built from these live in parameters.tf, so that every
# value the container reads comes from one place under one path.
