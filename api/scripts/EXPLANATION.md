# api/scripts/

CLI utility scripts for database and user management.

## Files

- **check-db-user.ts** -- Diagnostic script that checks whether a specific user exists in both the shadow and dev databases.
- **create-test-user.ts** -- Creates or updates a test user with a hardcoded password and ensures a corresponding person document exists.
- **migrate-shadow.ts** -- Runs full schema and migration files against the shadow (UAT) database via a port-forwarded connection.
