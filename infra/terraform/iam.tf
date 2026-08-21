# The instance's identity.
#
# One role, assumed by the EC2 instance and resolved automatically by the AWS
# SDK's default provider chain — which is why s3-provider.ts needs no access
# key and why nothing in this configuration stores one.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

resource "aws_iam_role" "app" {
  name = "${local.name}-app"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "${local.name}-app"
  role = aws_iam_role.app.name
}

# Shell access without an open SSH port, a key pair to lose, or a bastion —
# and every session recorded in CloudTrail. This is what lets network.tf omit
# port 22 entirely.
resource "aws_iam_role_policy_attachment" "app_ssm_core" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonSSMManagedInstanceCore"
}

# ── Media ──────────────────────────────────────────────────────────────────

resource "aws_iam_policy" "app_media" {
  name        = "${local.name}-app-media"
  description = "Read, write and delete media objects. Nothing else in the bucket."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ObjectAccessWithinMediaPrefixes"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        # Scoped to the two prefixes the adapter writes. A key outside them is
        # not merely unused — it is unreachable.
        Resource = [
          "${aws_s3_bucket.media.arn}/public/*",
          "${aws_s3_bucket.media.arn}/protected/*",
        ]
      },
      {
        /*
         * ListBucket looks redundant here and is not. Without it, S3 answers a
         * GetObject for a key that does not exist with 403 AccessDenied rather
         * than 404 NoSuchKey — it will not confirm absence to a caller who
         * cannot list.
         *
         * s3-provider.ts maps only NoSuchKey/404 to `null` and rethrows
         * everything else on purpose, so an unreachable bucket is never
         * mistaken for a missing object. Denying ListBucket would turn every
         * genuinely-missing image into a 500 instead of the 404 the interface
         * promises.
         *
         * The condition keeps the grant honest: listing only within the two
         * media prefixes, never an inventory of the whole bucket.
         */
        Sid      = "ListOnlyToDistinguishMissingFromForbidden"
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.media.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["public/*", "protected/*"]
          }
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "app_media" {
  role       = aws_iam_role.app.name
  policy_arn = aws_iam_policy.app_media.arn
}

# ── Configuration ──────────────────────────────────────────────────────────

resource "aws_iam_policy" "app_parameters" {
  name        = "${local.name}-app-parameters"
  description = "Read the application's own configuration, and the ECR image."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        /*
         * Scoped to the env path. The migration credential deliberately lives
         * outside it — at /<name>/migrate/DATABASE_URL — and is therefore NOT
         * readable with this policy.
         *
         * That is the plan doc's two-identity rule made real at the AWS layer as
         * well as inside Postgres: the running application cannot read the DDL
         * credential, so a runtime compromise cannot reach a role that can drop
         * a table. The operator running a release reads it with their own
         * credentials, not the instance's.
         */
        Sid    = "ReadApplicationEnvironment"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath",
        ]
        Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.env_path}/*"
      },
      {
        # SecureString values come back encrypted; decryption is a separate
        # grant, constrained to requests arriving via SSM.
        Sid      = "DecryptSecureStrings"
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "arn:aws:kms:${var.region}:${data.aws_caller_identity.current.account_id}:key/*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.region}.amazonaws.com"
          }
        }
      },
      {
        # Pulling the image. GetAuthorizationToken is account-wide by design —
        # the API takes no resource — so the repository scoping is on the pull
        # actions below it.
        Sid      = "EcrLogin"
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Sid    = "EcrPull"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
        ]
        Resource = aws_ecr_repository.app.arn
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "app_parameters" {
  role       = aws_iam_role.app.name
  policy_arn = aws_iam_policy.app_parameters.arn
}

# ── Logs ───────────────────────────────────────────────────────────────────

resource "aws_iam_policy" "app_logs" {
  name        = "${local.name}-app-logs"
  description = "Ship container and system logs to CloudWatch."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams",
      ]
      Resource = "${aws_cloudwatch_log_group.app.arn}:*"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "app_logs" {
  role       = aws_iam_role.app.name
  policy_arn = aws_iam_policy.app_logs.arn
}
