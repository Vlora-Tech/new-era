# The application server.
#
# One instance. That is a real single point of failure and it is a deliberate,
# recorded choice for launch — the same posture as the Single-AZ database. A
# crash means downtime until systemd restarts the container or the instance
# recovers; there is no second box to fail over to. Revisit alongside Multi-AZ,
# not before, and note that the blue/green deploy script means routine releases
# do not cause downtime even though a hardware failure would.

data "aws_ssm_parameter" "al2023_arm64" {
  # Tracks the current Amazon Linux 2023 arm64 image rather than pinning an AMI
  # id that goes stale and silently stops receiving security updates.
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-arm64"
}

resource "aws_cloudwatch_log_group" "app" {
  name = "/${local.name}/app"

  # Long enough to investigate an incident from a fortnight ago, short enough
  # not to accumulate cost on a small deployment.
  retention_in_days = 30

  tags = { Name = "${local.name}-app" }
}

resource "aws_instance" "app" {
  ami           = data.aws_ssm_parameter.al2023_arm64.value
  instance_type = var.instance_type

  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  # No key_name. Shell access is SSM Session Manager: no open port, no key to
  # lose, and an audit trail. A key pair here would be a credential whose
  # compromise is invisible.

  user_data                   = local.cloud_init
  user_data_replace_on_change = false

  root_block_device {
    volume_size = var.root_volume_gb
    volume_type = "gp3"
    encrypted   = true
    # Terminating the instance should not leave a paid-for orphan volume.
    delete_on_termination = true
  }

  metadata_options {
    http_endpoint = "enabled"
    # IMDSv2 only. IMDSv1's unauthenticated GET is the mechanism that turns a
    # server-side request forgery in the application into theft of this
    # instance's role credentials — which can read the database URL. Requiring a
    # session token closes that path, and the hop limit stops a container
    # reaching the metadata service at all.
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  # The instance is cattle: everything it is comes from cloud-init, the image in
  # ECR, and parameters in SSM. Losing it costs a rebuild, not data — which is
  # the property that makes one instance an acceptable launch risk.
  lifecycle {
    ignore_changes = [ami]
  }

  tags = { Name = local.name }

  depends_on = [
    aws_iam_role_policy_attachment.app_parameters,
    aws_iam_role_policy_attachment.app_media,
    aws_iam_role_policy_attachment.app_ssm_core,
  ]
}

locals {
  cloud_init = templatefile("${path.module}/files/cloud-init.yaml.tftpl", {
    region             = var.region
    env_path           = local.env_path
    migrate_parameter  = aws_ssm_parameter.migrate_database_url.name
    ecr_repository_url = aws_ecr_repository.app.repository_url
    app_image_tag      = var.app_image_tag
    app_port_blue      = var.app_port_blue
    app_port_green     = var.app_port_green
    domain_name        = var.domain_name
    log_group          = aws_cloudwatch_log_group.app.name
  })
}

# A stable address, so DNS does not have to be re-pointed every time the
# instance is replaced — and so the Let's Encrypt certificate survives a
# rebuild. Free while attached to a running instance.
resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id

  depends_on = [aws_internet_gateway.main]

  tags = { Name = local.name }
}
