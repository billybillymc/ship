# Root Directory

This is the **Ship** monorepo — a collaborative project management platform built with TypeScript. The root contains configuration, documentation, and deployment artifacts.

## Files

- **package.json** -- Root pnpm workspace package defining shared scripts (`dev`, `build`, `test`, `type-check`) that orchestrate the three sub-packages.
- **pnpm-workspace.yaml** -- Declares the monorepo workspace packages: `api/`, `web/`, `shared/`.
- **pnpm-lock.yaml** -- Lockfile pinning exact dependency versions across all workspaces.
- **tsconfig.json** -- Root TypeScript configuration with shared compiler options inherited by sub-packages.
- **playwright.config.ts** -- Playwright E2E test configuration for the main test suite.
- **playwright.isolated.config.ts** -- Playwright configuration for isolated E2E tests (each worker gets its own database and server).
- **docker-compose.yml** -- Docker Compose for production-like deployment (API + web + PostgreSQL).
- **docker-compose.local.yml** -- Docker Compose for local development with hot-reloading.
- **Dockerfile** -- Multi-stage Docker build for the API server.
- **Dockerfile.dev** -- Development-optimized Docker build with live reloading.
- **Dockerfile.web** -- Docker build for the web frontend (Vite build + nginx).
- **code.json** -- Federal open-source metadata file (per code.gov requirements).
- **README.md** -- Project overview and getting started guide.
- **CONTRIBUTING.md** -- Contribution guidelines.
- **LICENSE** -- Project license.
- **SECURITY.md** -- Security policy and vulnerability reporting.
- **ATTESTATION.md** -- Software supply chain attestation.
- **DEPLOYMENT.md** -- Deployment instructions for all environments.
- **DEPLOYMENT_CHECKLIST.md** -- Pre-deployment verification checklist.
- **INFRASTRUCTURE.md** / **INFRASTRUCTURE_README.md** / **INFRASTRUCTURE_SUMMARY.md** -- AWS infrastructure documentation.
- **PRESENTATION.md** -- Product presentation/demo notes.
- **ship-changelog-72h.md** -- Recent changelog of the last 72 hours of changes.
- **ship-welcome-guide.md** -- Onboarding guide for new team members.
- **test-failures.md** -- Notes on known test failures and debugging approaches.
- **-progress.txt** -- Task progress tracking file.
- **deploy-api-ship-api-*.zip** -- Archived API deployment bundles (Elastic Beanstalk).

## Directories

- **api/** -- Express backend with WebSocket collaboration, REST API, and PostgreSQL database.
- **web/** -- React + Vite frontend with TipTap rich text editor and real-time collaboration.
- **shared/** -- TypeScript type definitions shared between API and web.
- **scripts/** -- Shell scripts for development, deployment, and infrastructure management.
- **e2e/** -- Playwright end-to-end test suite.
- **docs/** -- Architectural documentation, design decisions, and reference material.
- **terraform/** -- Infrastructure-as-code for AWS (VPC, Aurora, S3, CloudFront, Elastic Beanstalk).
- **plans/** -- Product requirement documents and task plans.
- **research/** -- Research notes and prototype configurations.
