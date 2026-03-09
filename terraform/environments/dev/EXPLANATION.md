# terraform/environments/dev/

Development environment Terraform configuration.

## Files

- **main.tf** -- Root module instantiating all infrastructure modules with dev-specific settings.
- **variables.tf** -- Input variable definitions for the dev environment.
- **outputs.tf** -- Output values (dev endpoints, resource IDs).
- **versions.tf** -- Terraform and provider version constraints.
