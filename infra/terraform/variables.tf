variable "region" {
  description = <<-EOT
    AWS region. Owner-chosen: us-east-1.

    Recorded rather than assumed. docs/aws-rds-production-plan.md deferred this
    pending the PDPL data-residency review, and us-east-1 places Saudi students'
    personal data in Northern Virginia. See docs/deployment.md § Region.
  EOT
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Name prefix for every resource."
  type        = string
  default     = "new-era"
}

variable "environment" {
  description = "Environment name. One environment for now, per the plan."
  type        = string
  default     = "production"
}

# ── Network ────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "CIDR for the VPC. /16 leaves room to add subnets later."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = <<-EOT
    Availability Zones to span.

    Two is the floor, not a preference: an RDS subnet group requires subnets in
    at least two AZs even when the instance itself is Single-AZ.
  EOT
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2
    error_message = "An RDS subnet group requires at least two Availability Zones."
  }
}

# ── Application server ─────────────────────────────────────────────────────

variable "instance_type" {
  description = <<-EOT
    EC2 instance type. Graviton (t4g) — cheaper than equivalent x86.

    t4g.small (2 vCPU, 2 GiB) is the sensible floor. t4g.micro at 1 GiB is
    tempting at half the price and is a false economy here: `sharp` decodes and
    re-encodes uploads in memory, and a Next.js server plus an image being
    resized will not fit comfortably. An OOM-killed container during an upload
    is a worse bill than the extra six dollars.
  EOT
  type        = string
  default     = "t4g.small"
}

variable "root_volume_gb" {
  description = "Root EBS volume. Holds the OS, Docker images and logs."
  type        = number
  default     = 20
}

variable "app_port_blue" {
  description = "First application port. Caddy load-balances across both for zero-downtime deploys."
  type        = number
  default     = 3001
}

variable "app_port_green" {
  description = "Second application port."
  type        = number
  default     = 3002
}

variable "domain_name" {
  description = <<-EOT
    Public domain, e.g. platform.example.com. Point its A record at the Elastic
    IP in the outputs.

    Leave empty and Caddy serves plain HTTP on port 80 so the stack is testable
    — but there is then no TLS, so it must not carry real students. Automatic
    Let's Encrypt certificates require a resolvable domain; there is no way to
    obtain a public certificate for a bare IP address.
  EOT
  type        = string
  default     = ""
}

variable "app_url" {
  description = <<-EOT
    Public origin, e.g. https://platform.example.com.

    Load-bearing beyond cosmetics: src/lib/security/origin-check.ts compares the
    browser's Origin header against it on every cookie-authenticated mutation,
    so a wrong value does not merely produce bad links — it rejects every write.
  EOT
  type        = string
  default     = ""
}

variable "app_image_tag" {
  description = "ECR image tag the deploy script pulls. A git SHA once you stop using `latest`."
  type        = string
  default     = "latest"
}

# ── Database ───────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = <<-EOT
    RDS instance class. db.t4g.micro is the owner-chosen launch size.

    Adequate for launch traffic with a bounded Prisma pool, and resizing is a
    modify-in-place with a short interruption — so this is reversible, unlike
    most of the choices in this configuration. Watch the connection-count and
    CPU alarms in observability.tf; they are what will tell you it is time.
  EOT
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Initial storage (GiB). gp3, autoscaling to db_max_storage."
  type        = number
  default     = 20
}

variable "db_max_storage" {
  description = "Storage autoscaling ceiling (GiB). Prevents a runaway bill."
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = <<-EOT
    Multi-AZ. False is the recorded launch-stage choice: roughly half the
    instance cost, accepting downtime during an AZ failure or minor-version
    maintenance. It trades availability, not durability — point-in-time recovery
    still protects the data. Flipping it later is a modify-in-place.
  EOT
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "Automated backup retention. Plan proposes 14; confirm against the retention policy."
  type        = number
  default     = 14
}

variable "db_connection_limit" {
  description = <<-EOT
    Prisma pool size, appended to DATABASE_URL as `?connection_limit=`.

    Must stay well below the instance's max_connections with headroom for
    migrations and administrative sessions. db.t4g.micro is small: keep this
    small too, and remember a blue/green deploy briefly runs two containers, so
    the real peak is double this number.
  EOT
  type        = number
  default     = 5
}

# ── Third-party services ───────────────────────────────────────────────────

variable "moyasar_mode" {
  description = <<-EOT
    "test" or "live". The application cross-checks this against the key prefix
    and refuses to start on a mismatch, so a live key with mode "test" fails
    loudly rather than charging real cards against test bookkeeping.
  EOT
  type        = string
  default     = "test"

  validation {
    condition     = contains(["test", "live"], var.moyasar_mode)
    error_message = "moyasar_mode must be \"test\" or \"live\"."
  }
}

variable "cdn_public_base_url" {
  description = <<-EOT
    Optional CDN origin in front of the media bucket.

    Empty is supported: the S3 adapter answers null for a public URL and the
    application streams public objects through its own route instead.
  EOT
  type        = string
  default     = ""
}

variable "alarm_email" {
  description = "Address subscribed to the CloudWatch alarm topic. Empty creates the topic with no subscription."
  type        = string
  default     = ""
}
