# api/src/db/scripts/

Diagnostic and remediation scripts for database data integrity issues.

## Files

- **orphan-diagnostic.ts** -- CLI script that queries PostgreSQL for orphaned entities (dangling associations, issues/sprints without projects, projects without programs) after migration 027.
- **orphan-diagnostic.sql** -- SQL queries for diagnosing orphaned document relationships.
- **orphan-remediation.sql** -- SQL statements to fix orphaned document relationships.
