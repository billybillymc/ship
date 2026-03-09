# api/src/services/

Business logic services separated from route handlers for reusability and testability.

## Files

- **accountability.ts** -- Detects missing accountability items (standups, weekly plans/retros, unstarted sprints, changes-requested items) by querying documents and sprint schedules.
- **ai-analysis.ts** -- AI-powered quality analysis of weekly plans and retros via AWS Bedrock (Claude), scoring items on verifiability, conciseness, and workload.
- **audit.ts** -- Logs audit events (action, actor, resource, IP, user agent) to the `audit_logs` table. Silently absorbs failures to avoid disrupting requests.
- **caia.ts** -- Treasury CAIA OAuth/OIDC integration for PIV smartcard auth, including issuer discovery, PKCE authorization, and token exchange.
- **invite-acceptance.ts** -- Handles workspace invite acceptance: creates memberships, finds/reuses person documents by email, cleans up duplicates.
- **oauth-state.ts** -- Manages OAuth state parameters with database-backed storage, cryptographic generation, one-time consumption, and 10-minute expiration.
- **secrets-manager.ts** -- CRUD for CAIA OAuth credentials in AWS Secrets Manager with automatic placeholder creation.
- **accountability.test.ts** -- Unit tests for the accountability service.
