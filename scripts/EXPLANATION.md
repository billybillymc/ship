# scripts/

Shell scripts for development, deployment, and infrastructure management.

## Development

- **dev.sh** -- Sets up local development: auto-creates database and `.env.local`, finds available ports for multi-worktree dev, starts API and web servers in parallel.
- **worktree-init.sh** -- Initializes a new git worktree with unique ports, dependencies, database, and seed data.
- **watch-tests.sh** -- Displays real-time E2E test progress by polling `test-results/summary.json`.

## Deployment

- **deploy.sh** -- Builds API, tests Docker image, packages bundle, deploys to Elastic Beanstalk for a specified environment.
- **deploy-api.sh** -- Alternative API deployment: builds, zips, uploads to S3, deploys to EB.
- **deploy-frontend.sh** -- Builds web frontend, syncs to S3, invalidates CloudFront cache.
- **deploy-web.sh** -- Newer frontend deployment with CloudFront invalidation wait.
- **deploy-infrastructure.sh** -- Runs `terraform init/plan/apply` to provision the full AWS stack.

## Database

- **init-database.sh** -- Fetches DB URL from SSM and applies schema.sql to a remote database.
- **copy-db-to-shadow.sh** -- Copies dev/prod database to shadow (UAT) via pg_dump/restore with migration.
- **copy-db-via-ssm.sh** -- Database copy using SSM Session Manager port forwarding through a bastion host.

## Infrastructure

- **terraform.sh** -- Terraform CLI wrapper with automatic environment directory and SSM config sync.
- **sync-terraform-config.sh** -- Pulls Terraform variables from SSM Parameter Store into `terraform.tfvars`.
- **configure-caia.sh** -- Interactive script for configuring CAIA OAuth credentials in Secrets Manager.

## Quality Checks

- **check-empty-tests.sh** -- Pre-commit hook catching empty test bodies that silently pass.
- **check-api-coverage.sh** -- Pre-commit hook verifying frontend API calls have corresponding backend routes.
