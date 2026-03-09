# terraform/modules/vpc/

VPC module providing network infrastructure.

## Files

- **main.tf** -- VPC with public/private subnets across availability zones, NAT gateway, internet gateway, and route tables.
- **variables.tf** -- Input variables (CIDR blocks, AZ count, naming).
- **outputs.tf** -- Output values (VPC ID, subnet IDs, route table IDs).
