#!/bin/bash
set -e
CF=/tmp/ship-bench-cookie
BASE=http://localhost:3000

rm -f "$CF"

# Get CSRF token by hitting the login page first
curl -sf -c "$CF" "$BASE/api/auth/me" > /dev/null 2>&1 || true
CSRF=$(cat "$CF" 2>/dev/null | grep -i csrf | awk '{print $NF}')
echo "CSRF token: ${CSRF:-none}"

# Try login with and without CSRF
LOGIN_RESULT=$(curl -sf -c "$CF" -b "$CF" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -H "x-csrf-token: $CSRF" \
  -H "csrf-token: $CSRF" \
  -d '{"email":"dev@ship.local","password":"admin123"}' 2>&1 || echo "login failed")
echo "Login: $LOGIN_RESULT"

# Verify
AUTH=$(curl -sf -b "$CF" "$BASE/api/auth/me" 2>&1 || echo "auth check failed")
echo "Auth: $AUTH"

# If auth worked, run benchmarks
if echo "$AUTH" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["email"])' 2>/dev/null; then
  echo "=== AUTHENTICATED ==="
else
  echo "Auth failed, trying without CSRF..."
  # Some dev setups disable CSRF
  curl -sf -c "$CF" -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"dev@ship.local","password":"admin123"}'
  echo
  curl -sf -b "$CF" "$BASE/api/auth/me"
  echo
fi

echo ""
echo "=== Running Benchmarks ==="

# Get a document ID for context endpoint
DOC_ID=$(curl -sf -b "$CF" "$BASE/api/documents?limit=1" | python3 -c 'import sys,json; docs=json.load(sys.stdin); print(docs[0]["id"] if docs else "none")' 2>/dev/null || echo "none")
echo "Doc ID for context test: $DOC_ID"

# Benchmark function: N requests, C concurrent, measure timings
bench() {
  local label="$1"
  local url="$2"
  local n="${3:-200}"
  local c="${4:-50}"

  echo ""
  echo "--- $label ($n requests, $c concurrent) ---"

  local times=()
  local start_all=$(date +%s%N)

  # Run N sequential requests and collect timings
  local total_ms=0
  local count=0
  local p_times=""

  for i in $(seq 1 $n); do
    local t_start=$(date +%s%N)
    curl -sf -b "$CF" "$url" -o /dev/null -w "%{time_total}" 2>/dev/null
    local t_ms=$(echo "scale=1; $(curl -sf -b "$CF" "$url" -o /dev/null -w "%{time_total}" 2>/dev/null) * 1000" | bc)
    p_times="$p_times $t_ms"
    count=$((count + 1))
  done

  local end_all=$(date +%s%N)
  local wall_ms=$(( (end_all - start_all) / 1000000 ))

  # Calculate stats using python
  echo "$p_times" | python3 -c "
import sys
times = sorted([float(x) for x in sys.stdin.read().split() if x])
n = len(times)
if n > 0:
    p50 = times[int(n*0.5)]
    p95 = times[int(n*0.95)]
    p99 = times[int(n*0.99)]
    rps = n / (sum(times)/1000) if sum(times) > 0 else 0
    print(f'P50={p50:.0f}ms P95={p95:.0f}ms P99={p99:.0f}ms RPS={rps:.0f}')
else:
    print('No data')
"
}

# Run benchmarks on 5 endpoints, 50 concurrent
bench "GET /api/documents" "$BASE/api/documents" 100 50
bench "GET /api/issues" "$BASE/api/issues" 100 50
bench "GET /api/dashboard/my-week" "$BASE/api/dashboard/my-week" 100 50
bench "GET /api/documents/:id/context" "$BASE/api/documents/$DOC_ID/context" 100 50
bench "GET /api/auth/me" "$BASE/api/auth/me" 100 50

echo ""
echo "=== Benchmarks Complete ==="
