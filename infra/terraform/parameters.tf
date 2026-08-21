# Configuration, in SSM Parameter Store.
#
# Parameter Store rather than Secrets Manager. Standard-tier parameters are
# free where Secrets Manager bills $0.40 per secret per month, and at roughly a
# dozen values that was one of the larger line items on a bill this size.
# What is given up is Secrets Manager's built-in rotation — which nothing here
# used, because the RDS master credential (the one thing that does rotate) is
# still managed by RDS itself in Secrets Manager.
#
# Everything the container needs lives under one path, named exactly as the
# environment variable. `fetch-env.sh` on the instance reads the whole path and
# writes an env file, so adding a variable is one entry here and no change
# anywhere else.

locals {
  env_path = "/${local.name}/env"

  # Non-secret. Visible to anyone who can read the parameter store, which is
  # correct — none of it is a credential.
  plain_parameters = {
    NODE_ENV                = "production"
    NEXT_TELEMETRY_DISABLED = "1"

    # Wrong value rejects every authenticated write, not just bad links.
    NEXT_PUBLIC_APP_URL = var.app_url

    PAYMENT_PROVIDER     = "moyasar"
    MOYASAR_MODE         = var.moyasar_mode
    MOYASAR_API_BASE_URL = "https://api.moyasar.com"

    STORAGE_PROVIDER = "s3"
    S3_BUCKET        = aws_s3_bucket.media.id
    S3_REGION        = var.region
    # Blank is supported: the adapter answers null and objects stream through
    # the application's own route.
    S3_PUBLIC_BASE_URL = var.cdn_public_base_url
  }

  # Owner-supplied credentials. Terraform writes a placeholder once so the
  # container has something to read, then never touches the value again — see
  # the lifecycle block below.
  third_party_parameters = {
    MOYASAR_SECRET_KEY                  = "REPLACE_ME_sk_${var.moyasar_mode}_"
    NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY = "REPLACE_ME_pk_${var.moyasar_mode}_"
    MOYASAR_WEBHOOK_SECRET_TOKEN        = "REPLACE_ME"
    BUNNY_STREAM_LIBRARY_ID             = "REPLACE_ME"
    BUNNY_STREAM_TOKEN_SECURITY_KEY     = "REPLACE_ME"
    BUNNY_STREAM_API_KEY                = "REPLACE_ME"
    BUNNY_STREAM_READONLY_API_KEY       = "REPLACE_ME"
  }
}

resource "aws_ssm_parameter" "plain" {
  for_each = local.plain_parameters

  name  = "${local.env_path}/${each.key}"
  type  = "String"
  value = each.value

  # `overwrite` defaults to false on create in some provider versions and an
  # existing parameter then fails the apply. Being explicit keeps re-applies
  # idempotent for values Terraform genuinely owns.
  overwrite = true

  tags = { Name = "${local.name}-${lower(each.key)}" }
}

# ── Generated secrets ──────────────────────────────────────────────────────

# The schema requires at least 32 characters for both.
resource "random_password" "session_secret" {
  length  = 64
  special = false
}

resource "random_password" "internal_jobs_secret" {
  length  = 64
  special = false
}

resource "aws_ssm_parameter" "session_secret" {
  name  = "${local.env_path}/SESSION_SECRET"
  type  = "SecureString"
  value = random_password.session_secret.result

  # The AWS-managed SSM key. A customer-managed key would add $1/month per key
  # for no gain here: the threat this defends against is a parameter listing,
  # not an AWS-operator compromise.
  key_id = "alias/aws/ssm"

  overwrite = true
  tags      = { Name = "${local.name}-session-secret" }
}

resource "aws_ssm_parameter" "internal_jobs_secret" {
  name      = "${local.env_path}/INTERNAL_JOBS_SECRET"
  type      = "SecureString"
  value     = random_password.internal_jobs_secret.result
  key_id    = "alias/aws/ssm"
  overwrite = true

  tags = { Name = "${local.name}-internal-jobs-secret" }
}

# ── Database URLs ──────────────────────────────────────────────────────────

resource "aws_ssm_parameter" "runtime_database_url" {
  name = "${local.env_path}/DATABASE_URL"
  type = "SecureString"

  # `sslmode=verify-full` is not decoration: with rds.force_ssl the connection
  # is encrypted either way, but only verification authenticates the server.
  # `connection_limit` bounds the Prisma pool — remember a blue/green deploy
  # briefly runs two containers, so the real peak is twice this.
  value = format(
    "postgresql://%s:%s@%s:%s/%s?sslmode=verify-full&connection_limit=%d",
    "newera_app",
    random_password.app_runtime.result,
    aws_db_instance.main.address,
    aws_db_instance.main.port,
    "newera",
    var.db_connection_limit,
  )

  key_id    = "alias/aws/ssm"
  overwrite = true

  tags = { Name = "${local.name}-runtime-database-url" }
}

# Deliberately OUTSIDE `env_path`, so the fetch script cannot sweep it into the
# application's environment. The DDL credential is read only by the migration
# command, which names this parameter explicitly.
resource "aws_ssm_parameter" "migrate_database_url" {
  name = "/${local.name}/migrate/DATABASE_URL"
  type = "SecureString"

  # No connection_limit: migrations run as a single short-lived process.
  value = format(
    "postgresql://%s:%s@%s:%s/%s?sslmode=verify-full",
    "newera_migrate",
    random_password.app_migrate.result,
    aws_db_instance.main.address,
    aws_db_instance.main.port,
    "newera",
  )

  key_id    = "alias/aws/ssm"
  overwrite = true

  tags = { Name = "${local.name}-migrate-database-url" }
}

# ── Owner-supplied ─────────────────────────────────────────────────────────

resource "aws_ssm_parameter" "third_party" {
  for_each = local.third_party_parameters

  name      = "${local.env_path}/${each.key}"
  type      = "SecureString"
  value     = each.value
  key_id    = "alias/aws/ssm"
  overwrite = true

  lifecycle {
    # The point of the arrangement. Terraform seeds a placeholder once so the
    # container has something to read; after that the value belongs to whoever
    # pasted in the real key, and no later apply reverts it. Without this, an
    # unrelated change would silently restore "REPLACE_ME" and take payments
    # down.
    ignore_changes = [value]
  }

  tags = { Name = "${local.name}-${lower(each.key)}" }
}
