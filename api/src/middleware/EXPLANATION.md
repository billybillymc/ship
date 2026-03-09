# api/src/middleware/

Express middleware for cross-cutting concerns.

## Files

- **auth.ts** -- Authentication middleware supporting Bearer API tokens and session cookies. Enforces 15-minute inactivity and 12-hour absolute session timeouts, workspace membership verification, and role-based access control (super-admin, workspace admin).
- **visibility.ts** -- Helpers to check workspace admin status and generate parameterized SQL fragments for document visibility filtering (workspace-visible, private to creator, or admin override).
