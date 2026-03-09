# api/src/config/

Configuration loading modules.

## Files

- **ssm.ts** -- Loads production secrets (DATABASE_URL, SESSION_SECRET, CORS_ORIGIN, CDN_DOMAIN, APP_BASE_URL) from AWS SSM Parameter Store into environment variables.
