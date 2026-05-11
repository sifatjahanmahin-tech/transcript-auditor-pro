#!/usr/bin/env bash
# Run load test against a live backend instance.
#
# Usage:
#   ./tests/load_test.sh                        # 20 users vs localhost:8000
#   ./tests/load_test.sh http://my-api.com 20   # custom host + users
#   ./tests/load_test.sh http://localhost:8000 20 60  # host, users, duration(s)
#
# Prerequisites:
#   pip install locust
#   export AUDIT_PRO_TEST_TOKEN=<your jwt>   (for auth-protected tasks)

HOST="${1:-http://localhost:8000}"
USERS="${2:-20}"
DURATION="${3:-60}"
SPAWN_RATE=2

echo "================================================"
echo "  Transcript Auditor Pro — Load Test"
echo "  Host     : $HOST"
echo "  Users    : $USERS"
echo "  Spawn    : ${SPAWN_RATE}/s"
echo "  Duration : ${DURATION}s"
echo "================================================"

if [ -z "$AUDIT_PRO_TEST_TOKEN" ]; then
  echo ""
  echo "  WARNING: AUDIT_PRO_TEST_TOKEN not set."
  echo "  Auth-protected tasks will be skipped."
  echo "  Get a token: python -m cli.client login"
  echo ""
fi

locust -f tests/locustfile.py \
  --headless \
  -u "$USERS" \
  -r "$SPAWN_RATE" \
  -t "${DURATION}s" \
  --host "$HOST" \
  --only-summary \
  --exit-code-on-error 1 \
  --html "tests/load_report_$(date +%Y%m%d_%H%M%S).html"

STATUS=$?
if [ $STATUS -eq 0 ]; then
  echo ""
  echo "  PASS — all requests within acceptable failure threshold."
else
  echo ""
  echo "  FAIL — error rate exceeded threshold. Check report above."
fi
exit $STATUS
