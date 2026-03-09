# terraform/modules/ssm/

SSM Parameter Store module for configuration management.

## Files

- **main.tf** -- SSM parameters for database URL, session secret, CORS origin, CDN domain, and other runtime configuration.
- **variables.tf** -- Input variables (parameter values, encryption key).
- **outputs.tf** -- Output values (parameter ARNs and names).
