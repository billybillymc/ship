#!/bin/bash
set -e

# Start PostgreSQL
pg_ctlcluster $(pg_lsclusters -h | awk '{print $1, $2}') start

# Create database and user
su - postgres -c "psql -c \"CREATE USER ship WITH PASSWORD 'ship_dev_password';\"" 2>/dev/null || true
su - postgres -c "psql -c \"CREATE DATABASE ship_dev OWNER ship;\"" 2>/dev/null || true
su - postgres -c "psql -c \"ALTER USER ship CREATEDB;\"" 2>/dev/null || true

echo "PostgreSQL is ready"

# Run migrations, seed, and start API
cd /app/api
node dist/db/migrate.js
node dist/db/seed.js
node dist/index.js
