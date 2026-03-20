#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/ubuntu/projects/paperclip-refactor-foundation"
API_BASE="http://127.0.0.1:3100"
COMPANY_ID="05100f6d-b0a4-4a15-b785-61949b90c6df"
LOG_DIR="$REPO_DIR/ops/watchdog"
RUN_TS="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_LOG="$LOG_DIR/$RUN_TS.log"

mkdir -p "$LOG_DIR"
exec >>"$RUN_LOG" 2>&1

echo "== watchdog start $RUN_TS =="

cd "$REPO_DIR"
export PATH="/home/ubuntu/.local/bin:$PATH"

health_json="$(curl -fsS "$API_BASE/api/health")"
echo "$health_json"

if ! echo "$health_json" | jq -e '.status == "ok" and .authReady == true' >/dev/null; then
  echo "health check failed; restarting server"
  pkill -f "tsx src/index.ts" || true
  sleep 2
  cd "$REPO_DIR/server"
  nohup pnpm dev > "$REPO_DIR/paperclip-prod.log" 2>&1 < /dev/null &
  sleep 8
  curl -fsS "$API_BASE/api/health"
  cd "$REPO_DIR"
fi

issues_json="$(curl -fsS "$API_BASE/api/companies/$COMPANY_ID/issues?limit=250")"
echo "$issues_json" | jq '[.[] | select(.executionRunId != null or .status=="in_progress" or .status=="blocked")] | length as $n | {activeIssueCount:$n}'

stale_runs_json="$(
  echo "$issues_json" | jq '
    [.[] 
      | select(.executionRunId != null)
      | select(.status != "done" and .status != "cancelled")
      | select(.activeRun == null)
      | select(((now - ((.updatedAt | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601))) > 900))
      | {identifier, issueId: .id, executionRunId, status, assigneeAgentId}
    ]'
)"
echo "$stale_runs_json"

stale_count="$(echo "$stale_runs_json" | jq 'length')"
if [ "$stale_count" -gt 0 ]; then
  echo "stale execution-backed issues detected: $stale_count"
  echo "watchdog will not mutate them; heartbeat/orphan recovery should clear them safely"
fi

strings "$REPO_DIR/paperclip-prod.log" | tail -n 200 > "$LOG_DIR/$RUN_TS.prod.tail.txt" || true

if rg -qi 'process_lost|listen EADDRINUSE|startup heartbeat recovery failed|periodic heartbeat recovery failed' "$LOG_DIR/$RUN_TS.prod.tail.txt"; then
  echo "fatal pattern found in prod log tail; restarting server"
  pkill -f "tsx src/index.ts" || true
  sleep 2
  cd "$REPO_DIR/server"
  nohup pnpm dev > "$REPO_DIR/paperclip-prod.log" 2>&1 < /dev/null &
  sleep 8
  curl -fsS "$API_BASE/api/health"
  cd "$REPO_DIR"
fi

echo "running focal validation suite"
pnpm -C "$REPO_DIR/server" exec vitest run \
  src/__tests__/openclaw-gateway-adapter.test.ts \
  src/__tests__/heartbeat-adapter-concurrency.test.ts \
  src/__tests__/agent-permissions.test.ts \
  src/__tests__/issues-create-route.test.ts \
  src/__tests__/access-skills.test.ts

echo "rendering health dashboard"
node "$REPO_DIR/scripts/render_oracle_health_dashboard.mjs"

echo "== watchdog complete $RUN_TS =="
