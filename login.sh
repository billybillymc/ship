#!/bin/bash
set -e

COOKIE_JAR=/tmp/bench-cookies.txt
rm -f "$COOKIE_JAR"

# Step 1: Get CSRF token (this also sets the session cookie)
RESPONSE=$(curl -s http://localhost:3000/api/csrf-token \
  -c "$COOKIE_JAR" \
  -H "Origin: http://localhost:5173")

echo "CSRF response: $RESPONSE"

CSRF=$(echo "$RESPONSE" | node -p "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).token")
echo "CSRF token: ${CSRF:0:30}..."

# Step 2: Login using the same session
RESULT=$(curl -s http://localhost:3000/api/auth/login \
  -X POST \
  -b "$COOKIE_JAR" \
  -c "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -H "Origin: http://localhost:5173" \
  -d '{"email":"admin@example.com","password":"password"}')

echo "Login result: $RESULT"

# Save CSRF for later use
echo "$CSRF" > /tmp/bench-csrf.txt
