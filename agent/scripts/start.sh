#!/bin/sh
set -e

echo "Waiting for Ship API to be ready..."
until node -e "fetch('${SHIP_API_URL}/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" 2>/dev/null; do
  sleep 2
done
echo "Ship API is ready."

echo "Resolving workspace ID..."
export WORKSPACE_ID=$(node -e "
fetch('${SHIP_API_URL}/api/workspaces', {
  headers: { 'Authorization': 'Bearer ${AGENT_SERVICE_TOKEN}' }
}).then(r => r.json()).then(d => {
  const ws = d?.data?.workspaces ?? [];
  console.log(ws[0]?.id ?? '');
}).catch(() => console.log(''));
")
echo "Workspace ID: ${WORKSPACE_ID}"

echo "Starting FleetGraph agent..."
exec node dist/index.js
