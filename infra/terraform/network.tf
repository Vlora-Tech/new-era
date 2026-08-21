# The network, without a NAT gateway.
#
# That absence is the design, not an omission. Under App Runner every byte of
# egress was forced through a VPC connector, which meant a NAT gateway costing
# more per month than the server itself. A plain EC2 instance in a public subnet
# reaches Moyasar and Bunny directly through the internet gateway, at no hourly
# charge.
#
# "Public subnet" describes routing, not exposure. The instance is reachable on
# 80 and 443 only, has no SSH port open at all, and the database stays in
# private subnets that have no route off the VPC.

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "${var.project}-${var.environment}"
  azs  = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  public_subnets  = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i)]
  private_subnets = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 4, i + 8)]
}

resource "aws_vpc" "main" {
  cidr_block = var.vpc_cidr

  # Both required for RDS private DNS to resolve inside the VPC.
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = local.name }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = local.name }
}

# ── Subnets ────────────────────────────────────────────────────────────────

resource "aws_subnet" "public" {
  count = var.az_count

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.public_subnets[count.index]
  availability_zone = local.azs[count.index]

  # The application server gets an Elastic IP explicitly. Nothing should receive
  # a public address merely by being launched here.
  map_public_ip_on_launch = false

  tags = { Name = "${local.name}-public-${local.azs[count.index]}" }
}

resource "aws_subnet" "private" {
  count = var.az_count

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = local.azs[count.index]

  tags = { Name = "${local.name}-private-${local.azs[count.index]}" }
}

# ── Routing ────────────────────────────────────────────────────────────────

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-public" }
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  count = var.az_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# The private table has no 0.0.0.0/0 route of any kind — no internet gateway and
# no NAT. That is the plan doc's "no database subnet route to an internet
# gateway", achieved by the table simply not having one. RDS needs no outbound
# internet, so nothing is lost.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "${local.name}-private" }
}

resource "aws_route_table_association" "private" {
  count = var.az_count

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# A gateway endpoint costs nothing and keeps media traffic on AWS's network
# rather than routing it out through the internet gateway and back — which also
# means it is not billed as internet data transfer. Attached to both tables so
# it applies wherever the instance ends up.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.${var.region}.s3"
  vpc_endpoint_type = "Gateway"

  route_table_ids = [
    aws_route_table.public.id,
    aws_route_table.private.id,
  ]

  tags = { Name = "${local.name}-s3" }
}

# ── Security groups ────────────────────────────────────────────────────────

resource "aws_security_group" "app" {
  name        = "${local.name}-app"
  description = "Application server. HTTP and HTTPS in; everything out."
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-app" }
}

# Port 80 is not redundant beside 443. Caddy needs it to answer the ACME
# HTTP-01 challenge for the initial certificate and every renewal, and it
# redirects everything else to HTTPS.
resource "aws_vpc_security_group_ingress_rule" "app_http" {
  security_group_id = aws_security_group.app.id
  description       = "HTTP. ACME challenges and the redirect to HTTPS."
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "app_https" {
  security_group_id = aws_security_group.app.id
  description       = "HTTPS."
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

# No rule for port 22, deliberately. Shell access is through SSM Session
# Manager, which needs no open port, no key pair to lose, and leaves an audit
# trail in CloudTrail. An SSH port open to the internet on a box holding a
# database credential is a standing invitation for no benefit.
#
# The application ports (3001/3002) are likewise absent: Caddy reaches them over
# the loopback interface, so they are never exposed.

resource "aws_vpc_security_group_egress_rule" "app_all" {
  security_group_id = aws_security_group.app.id
  description       = "Outbound to payment, video and storage APIs."
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_security_group" "database" {
  name        = "${local.name}-database"
  description = "PostgreSQL, reachable only from the application security group."
  vpc_id      = aws_vpc.main.id

  tags = { Name = "${local.name}-database" }
}

# The rule the plan doc calls non-negotiable: 5432 from the application's
# security group, never 0.0.0.0/0 and never a raw CIDR where a group reference
# would do. A reference keeps holding as addresses change; a CIDR quietly widens
# the moment the subnet is reused.
resource "aws_vpc_security_group_ingress_rule" "database_from_app" {
  security_group_id            = aws_security_group.database.id
  description                  = "PostgreSQL from the application only."
  referenced_security_group_id = aws_security_group.app.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}
