# terraform/modules/security-groups/

Security group module for network access control.

## Files

- **main.tf** -- Security groups for API (EB instances), database (Aurora), and bastion access with ingress/egress rules.
- **variables.tf** -- Input variables (VPC ID, allowed CIDR blocks).
- **outputs.tf** -- Output values (security group IDs).
