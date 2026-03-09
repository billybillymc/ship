# terraform/environments/shadow/

Shadow/UAT environment Terraform configuration. Mirrors production for pre-merge validation.

## Files

- **main.tf** -- Root module instantiating all infrastructure modules with shadow settings.
- **variables.tf** -- Input variable definitions for the shadow environment.
- **outputs.tf** -- Output values (shadow endpoints, resource IDs).
- **versions.tf** -- Terraform and provider version constraints.
- **terraform.tfvars.example** -- Example variable values for shadow.
- **tfplan** -- Cached Terraform execution plan.
