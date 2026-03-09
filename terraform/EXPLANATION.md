# terraform/

Infrastructure-as-code for AWS using Terraform. Provisions the full production stack.

## Root Configuration Files

- **vpc.tf** -- VPC with public/private subnets, NAT gateway, and internet gateway.
- **database.tf** -- Aurora PostgreSQL database cluster configuration.
- **elastic-beanstalk.tf** -- Elastic Beanstalk application and environment for the API.
- **s3-cloudfront.tf** -- S3 bucket and CloudFront distribution for the web frontend.
- **security-groups.tf** -- Security group rules for API, database, and bastion access.
- **ssm.tf** -- SSM Parameter Store entries for configuration and secrets.
- **waf.tf** -- Web Application Firewall rules for CloudFront.
- **cloudfront-logging.tf** -- CloudFront access logging configuration.
- **variables.tf** -- Input variable definitions.
- **outputs.tf** -- Output values (endpoints, resource IDs).
- **versions.tf** -- Terraform and provider version constraints.
- **terraform.tfvars.example** -- Example variable values file.
- **README.md** -- Terraform usage documentation.

## Directories

- **environments/** -- Per-environment Terraform configurations (dev, prod, shadow).
- **modules/** -- Reusable Terraform modules.
- **bootstrap/** -- One-time bootstrap for Terraform state backend.
- **cloudfront-functions/** -- CloudFront Functions (edge compute).
