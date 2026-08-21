# The media bucket behind src/services/storage/s3-provider.ts.
#
# The adapter writes two prefixes, `public/` and `protected/`, mirroring the
# local adapter's two directories. The separation is structural: a guessed
# protected key cannot resolve inside the public tree. This bucket blocks all
# public access regardless, so even the "public" prefix is only reachable
# through the application or a CDN placed in front of it — never by URL guess.

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "media" {
  # Bucket names are globally unique across every AWS account, so a plain
  # project name would collide with somebody else's. The suffix is generated
  # once and kept in state.
  bucket = "${local.name}-media-${random_id.bucket_suffix.hex}"

  tags = { Name = "${local.name}-media" }
}

# All four switches on. Question stimuli are the product's stock-in-trade; a
# bucket policy or ACL that made them world-readable would put what the platform
# sells on the open web regardless of what the application checks.
resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id

  # ACLs disabled entirely. Object ownership is the account's, and access is
  # decided by IAM alone rather than by two overlapping systems.
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      # SSE-S3 rather than SSE-KMS, deliberately. KMS bills per request, and
      # this bucket is read once per image view; the images are re-encoded
      # artwork and question figures, not personal data. Should a CDN be added
      # later, SSE-S3 also keeps the origin-access configuration simple. The
      # database — which does hold personal data — uses a customer-managed key.
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id

  # Keys are UUIDs and are never reused, so versioning is not about overwrites —
  # it is the undo for a mistaken or malicious delete, which is the realistic
  # way media disappears.
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  # Depends on versioning: a noncurrent-version rule is meaningless until
  # versions exist, and applying both at once can race.
  depends_on = [aws_s3_bucket_versioning.media]

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    # Long enough to notice and recover from an accidental deletion, short
    # enough that deleted media does not accumulate cost indefinitely.
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }

  rule {
    id     = "abort-incomplete-uploads"
    status = "Enabled"

    filter {}

    # A failed upload otherwise leaves parts that are invisible in the console
    # and billed forever.
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Refuse any request that is not TLS. The application always uses HTTPS, so this
# costs nothing and closes the case where something else does not.
resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id

  # Without this, applying the policy can race the public-access block and be
  # rejected as a public policy.
  depends_on = [aws_s3_bucket_public_access_block.media]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.media.arn,
          "${aws_s3_bucket.media.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      },
    ]
  })
}
