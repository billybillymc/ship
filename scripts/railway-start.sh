#!/bin/bash
set -e

# Start PostgreSQL
pg_ctlcluster $(pg_lsclusters -h | awk '{print $1, $2}') start

# Create database and user
su - postgres -c "psql -c \"CREATE USER ship WITH PASSWORD 'ship_dev_password';\"" 2>/dev/null || true
su - postgres -c "psql -c \"DROP DATABASE IF EXISTS ship_dev;\"" 2>/dev/null || true
su - postgres -c "psql -c \"CREATE DATABASE ship_dev OWNER ship;\"" 2>/dev/null || true
su - postgres -c "psql -c \"ALTER USER ship CREATEDB;\"" 2>/dev/null || true

echo "PostgreSQL is ready"

# Run migrations and seed with FleetGraph data
cd /app/api
node dist/db/migrate.js
node dist/db/seed-fleet.js

# Railway sets PORT dynamically; API listens on that port
# Agent needs to reach the API on that same port
API_PORT=${PORT:-3000}

# Get workspace ID for the agent
WORKSPACE_ID=$(PGPASSWORD=ship_dev_password psql -U ship -d ship_dev -h localhost -t -A -c "SELECT id FROM workspaces LIMIT 1;" 2>/dev/null || echo "")
echo "Workspace ID: ${WORKSPACE_ID}"

# Start the FleetGraph agent in background (port 3001)
cd /app/agent
SHIP_API_URL=http://localhost:${API_PORT} \
SHIP_WS_URL=ws://localhost:${API_PORT} \
AGENT_SERVICE_TOKEN=ship_fleetgraph_dev_token_do_not_use_in_prod \
WORKSPACE_ID=${WORKSPACE_ID} \
GOOGLE_AI_API_KEY=${GOOGLE_AI_API_KEY:-} \
LANGCHAIN_API_KEY=${LANGCHAIN_API_KEY:-} \
LANGCHAIN_TRACING_V2=${LANGCHAIN_TRACING_V2:-true} \
LANGCHAIN_PROJECT=${LANGCHAIN_PROJECT:-fleetgraph} \
AGENT_PORT=3001 \
node dist/index.js &

# Start API (foreground)
cd /app/api
node dist/index.js
