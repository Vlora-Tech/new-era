terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Local state is fine to `plan` with and wrong to `apply` with from more than
  # one machine. Before the first apply, move state to S3 with a DynamoDB lock
  # table (or S3 native locking) — a lost or concurrently-written state file is
  # how infrastructure ends up orphaned and billing with nothing to destroy it.
  # Deliberately left commented: creating the backend bucket is itself a
  # decision, and this configuration stops at `plan`.
  #
  # backend "s3" {
  #   bucket       = "new-era-tfstate-<account-id>"
  #   key          = "platform/terraform.tfstate"
  #   region       = "us-east-1"
  #   encrypt      = true
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
