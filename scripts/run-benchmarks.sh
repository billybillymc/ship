#!/bin/bash
set -e

HEY=/tmp/hey
CF=/tmp/ship-bench-cookie
BASE=http://localhost:3000
LABEL="${1:-E2E}"
OUTFILE="/tmp/benchmark-${LABEL}.csv"

rm -f "$CF"

# Step 1: Get CSRF token (also sets session cookie)
TOKEN=$(curl -sf -c "$CF" "$BASE/api/csrf-token" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
echo "CSRF token obtained: ${TOKEN:0:20}..."

# Step 2: Login with CSRF
LOGIN=$(curl -sf -c "$CF" -b "$CF" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "x-csrf-token: $TOKEN" \
  -d '{"email":"dev@ship.local","password":"admin123"}')
echo "Login result: $LOGIN"

# Step 3: Verify auth
EMAIL=$(curl -sf -b "$CF" "$BASE/api/auth/me" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("email") or d.get("data",{}).get("user",{}).get("email","FAIL"))')
echo "Authenticated as: $EMAIL"

if [ "$EMAIL" = "FAIL" ] || [ -z "$EMAIL" ]; then
  echo "Auth failed!"
  exit 1
fi

# Get session cookie value for hey
SID=$(grep connect.sid "$CF" | awk '{print $NF}')
echo "Session ID: ${SID:0:20}..."

# Get a document ID for context endpoint
DOC_ID=$(curl -sf -b "$CF" "$BASE/api/documents?limit=1" | python3 -c 'import sys,json; docs=json.load(sys.stdin); print(docs[0]["id"] if docs else "none")')
echo "Doc ID: $DOC_ID"

echo "Endpoint,Connections,P50_ms,P95_ms,P99_ms,Req_per_sec" > "$OUTFILE"

run_bench() {
  local endpoint="$1"
  local url="$2"
  local conns="$3"
  local n=500

  echo "  $endpoint @ c=$conns (n=$n)..."
  local result=$($HEY -n "$n" -c "$conns" -H "Cookie: connect.sid=$SID" "$url" 2>&1)

  # Parse hey output - percentiles are in seconds
  local p50=$(echo "$result" | grep '50% in' | awk '{print $3}')
  local p95=$(echo "$result" | grep '95% in' | awk '{print $3}')
  local p99=$(echo "$result" | grep '99% in' | awk '{print $3}')
  local rps=$(echo "$result" | grep 'Requests/sec:' | awk '{print $2}')

  # Convert seconds to ms using python for reliability
  read p50_ms p95_ms p99_ms rps_int <<< $(python3 -c "
p50=${p50:-0}; p95=${p95:-0}; p99=${p99:-0}; rps=${rps:-0}
print(f'{p50*1000:.0f} {p95*1000:.0f} {p99*1000:.0f} {rps:.0f}')
")

  echo "$endpoint,$conns,$p50_ms,$p95_ms,$p99_ms,$rps_int" >> "$OUTFILE"
  echo "    P50=${p50_ms}ms P95=${p95_ms}ms P99=${p99_ms}ms RPS=${rps_int}"
}

echo ""
echo "=== Running Benchmarks ($LABEL) ==="

declare -a ENDPOINTS=(
  "GET /api/documents|$BASE/api/documents"
  "GET /api/issues|$BASE/api/issues"
  "GET /api/dashboard/my-week|$BASE/api/dashboard/my-week"
  "GET /api/documents/:id/context|$BASE/api/documents/$DOC_ID/context"
  "GET /api/auth/me|$BASE/api/auth/me"
)

CONCURRENCIES=(10 25 50)

for entry in "${ENDPOINTS[@]}"; do
  IFS='|' read -r label url <<< "$entry"
  echo ""
  echo "--- $label ---"
  for c in "${CONCURRENCIES[@]}"; do
    run_bench "$label" "$url" "$c"
  done
done

echo ""
echo "=== Results ==="
cat "$OUTFILE"
echo ""
echo "Saved to: $OUTFILE"
