# api/src/test/

Test configuration and setup.

## Files

- **setup.ts** -- Vitest setup file that sets `NODE_ENV=test` and truncates all database tables with CASCADE before each test file for isolation.
