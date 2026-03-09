# terraform/environments/

Per-environment Terraform configurations. Each subdirectory is a separate Terraform root module with its own state.

## Directories

- **dev/** -- Development environment configuration.
- **prod/** -- Production environment configuration.
- **shadow/** -- Shadow/UAT environment configuration (mirrors prod for pre-merge testing).
