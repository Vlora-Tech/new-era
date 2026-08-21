# The alarms the plan doc names: CPU, freeable storage, connection count, read
# and write latency, and failed connection attempts.
#
# These are the deep checks that /api/health deliberately is not. A health probe
# is wired to an actuator that replaces instances, so making it fail on a
# database blip turns a recoverable incident into a self-sustaining outage.
# Depth belongs here, where the consequence is that a human is paged.

resource "aws_sns_topic" "alarms" {
  name = "${local.name}-alarms"

  tags = { Name = "${local.name}-alarms" }
}

resource "aws_sns_topic_subscription" "alarms_email" {
  # No address, no subscription — the topic still exists and alarms still fire,
  # they just reach nobody until someone subscribes. Said plainly because a
  # silent alarm topic is worse than no alarm at all.
  count = var.alarm_email == "" ? 0 : 1

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

locals {
  db_dimensions = { DBInstanceIdentifier = aws_db_instance.main.id }

  # Free storage floor: 15% of allocated, in bytes. Proportional rather than a
  # fixed number so it stays meaningful if the instance grows.
  storage_floor_bytes = var.db_allocated_storage * 1024 * 1024 * 1024 * 0.15
}

resource "aws_cloudwatch_metric_alarm" "db_cpu" {
  alarm_name          = "${local.name}-db-cpu"
  alarm_description   = "Sustained high CPU. Usually a missing index or a query that grew with the data."
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = local.db_dimensions
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  # Missing data on a database that should always report means the instance is
  # not reporting, which is itself worth knowing.
  treat_missing_data = "breaching"
}

resource "aws_cloudwatch_metric_alarm" "db_storage" {
  alarm_name          = "${local.name}-db-free-storage"
  alarm_description   = "Free storage below 15%. Autoscaling should act first; if this fires, it did not."
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = local.db_dimensions
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 1
  threshold           = local.storage_floor_bytes
  comparison_operator = "LessThanThreshold"

  alarm_actions      = [aws_sns_topic.alarms.arn]
  ok_actions         = [aws_sns_topic.alarms.arn]
  treat_missing_data = "breaching"
}

resource "aws_cloudwatch_metric_alarm" "db_connections" {
  alarm_name        = "${local.name}-db-connections"
  alarm_description = "Connection count above what a blue/green deploy should ever need. Suspect a leak."
  namespace         = "AWS/RDS"
  metric_name       = "DatabaseConnections"
  dimensions        = local.db_dimensions
  statistic         = "Maximum"
  period            = 300
  # Doubled, because a blue/green deploy briefly runs two containers and both
  # hold a full pool. Plus headroom for a migration and an administrative
  # session. Past this, something is leaking connections rather than being busy.
  threshold           = var.db_connection_limit * 2 + 10
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"

  alarm_actions      = [aws_sns_topic.alarms.arn]
  ok_actions         = [aws_sns_topic.alarms.arn]
  treat_missing_data = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "db_read_latency" {
  alarm_name          = "${local.name}-db-read-latency"
  alarm_description   = "Read latency above 50ms sustained."
  namespace           = "AWS/RDS"
  metric_name         = "ReadLatency"
  dimensions          = local.db_dimensions
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 0.05 # seconds
  comparison_operator = "GreaterThanThreshold"

  alarm_actions      = [aws_sns_topic.alarms.arn]
  ok_actions         = [aws_sns_topic.alarms.arn]
  treat_missing_data = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "db_write_latency" {
  alarm_name          = "${local.name}-db-write-latency"
  alarm_description   = "Write latency above 50ms sustained."
  namespace           = "AWS/RDS"
  metric_name         = "WriteLatency"
  dimensions          = local.db_dimensions
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 0.05
  comparison_operator = "GreaterThanThreshold"

  alarm_actions      = [aws_sns_topic.alarms.arn]
  ok_actions         = [aws_sns_topic.alarms.arn]
  treat_missing_data = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "db_login_failures" {
  alarm_name = "${local.name}-db-login-failures"
  # Two very different causes, both worth a look: a broken credential after a
  # rotation, or somebody trying credentials that do not work.
  alarm_description   = "Failed connection attempts. A bad rotation, or an attempt to guess."
  namespace           = "AWS/RDS"
  metric_name         = "LoginFailures"
  dimensions          = local.db_dimensions
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"

  alarm_actions      = [aws_sns_topic.alarms.arn]
  treat_missing_data = "notBreaching"
}

# ── The application ────────────────────────────────────────────────────────

# The instance itself. StatusCheckFailed covers both halves — the system check
# (AWS's hardware and network) and the instance check (the OS stopped
# responding) — so it fires whether the failure is under us or in the box.
#
# On a single-instance deployment this alarm is the whole availability story,
# which is why it evaluates fast and treats missing data as breaching: an
# instance that has stopped reporting metrics is not healthy, it is gone.
resource "aws_cloudwatch_metric_alarm" "app_status_check" {
  alarm_name          = "${local.name}-app-status-check"
  alarm_description   = "The application instance failed a status check or stopped reporting."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"

  alarm_actions      = [aws_sns_topic.alarms.arn]
  ok_actions         = [aws_sns_topic.alarms.arn]
  treat_missing_data = "breaching"
}

# Recover the instance in place on a failed SYSTEM check — AWS-side hardware.
# It keeps the instance id, the Elastic IP and the EBS volume, so the box comes
# back as itself with no DNS change and no certificate re-issue.
#
# Deliberately NOT wired to the instance check above: that one usually means the
# application wedged the OS, and rebooting on a crash-loop hides the fault
# instead of surfacing it.
resource "aws_cloudwatch_metric_alarm" "app_auto_recover" {
  alarm_name          = "${local.name}-app-auto-recover"
  alarm_description   = "Recover the instance when AWS-side hardware fails."
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  dimensions          = { InstanceId = aws_instance.app.id }
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"

  alarm_actions = [
    "arn:aws:automate:${var.region}:ec2:recover",
    aws_sns_topic.alarms.arn,
  ]
  treat_missing_data = "notBreaching"
}

# Disk. Docker images, layers from every past deploy, and Caddy's access log all
# accumulate on one 20 GiB volume; a full root filesystem takes the application
# down in a way that reads like a mystery. Requires the CloudWatch agent, which
# cloud-init installs.
resource "aws_cloudwatch_metric_alarm" "app_disk" {
  alarm_name          = "${local.name}-app-disk"
  alarm_description   = "Root volume above 85%. Usually old Docker images; run 'docker image prune -af'."
  namespace           = "CWAgent"
  metric_name         = "disk_used_percent"
  dimensions          = { InstanceId = aws_instance.app.id, path = "/", fstype = "xfs" }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"

  alarm_actions = [aws_sns_topic.alarms.arn]
  # The agent may not be reporting yet on a fresh instance; absence here is not
  # a full disk.
  treat_missing_data = "notBreaching"
}
