# terraform/modules/aurora/

Aurora PostgreSQL database module.

## Files

- **main.tf** -- Aurora PostgreSQL cluster with subnet group, parameter group, and instance configuration.
- **variables.tf** -- Input variables (instance class, engine version, credentials, networking).
- **outputs.tf** -- Output values (cluster endpoint, reader endpoint, port).
