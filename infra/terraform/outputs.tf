output "app_public_ip" {
  description = <<-EOT
    The Elastic IP. Point your domain's A record here.

    Caddy cannot obtain a certificate until that record resolves — Let's Encrypt
    validates the name, and there is no public certificate for a bare address.
  EOT
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "Where the platform answers once DNS resolves."
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_eip.app.public_ip}"
}

output "ecr_repository_url" {
  description = "Push both the application and migrate images here."
  value       = aws_ecr_repository.app.repository_url
}

output "instance_id" {
  description = "For SSM Session Manager. There is no SSH port and no key pair."
  value       = aws_instance.app.id
}

output "shell_command" {
  description = "Open a shell on the server. Needs the Session Manager plugin installed locally."
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.region}"
}

output "deploy_command" {
  description = <<-EOT
    Release a new version. Run the migration first, confirm it exits 0, then
    deploy — that order is the reason nothing migrates at container start.
  EOT
  value = join("\n", [
    "aws ssm start-session --target ${aws_instance.app.id} --region ${var.region}",
    "  sudo new-era-migrate <tag>   # then confirm exit 0",
    "  sudo new-era-deploy  <tag>   # blue/green; leaves the old container serving if the new one is unhealthy",
  ])
}

output "database_endpoint" {
  description = "Private endpoint. Resolvable only inside the VPC, by design."
  value       = aws_db_instance.main.address
}

output "database_master_secret_arn" {
  description = <<-EOT
    RDS-managed master credential, rotated by RDS.

    Administration and the one-time role bootstrap only. Neither the application
    nor the instance role can read it, so a runtime compromise cannot reach a
    credential that can drop a table.
  EOT
  value       = aws_db_instance.main.master_user_secret[0].secret_arn
}

output "media_bucket" {
  description = "Media bucket name, matching the S3_BUCKET parameter."
  value       = aws_s3_bucket.media.id
}

output "parameter_path" {
  description = <<-EOT
    Where the container's configuration lives. Set the real Moyasar and Bunny
    values here; Terraform seeded placeholders and will not overwrite them.

      aws ssm put-parameter --name <path>/MOYASAR_SECRET_KEY \
        --value '...' --type SecureString --overwrite
  EOT
  value       = local.env_path
}
