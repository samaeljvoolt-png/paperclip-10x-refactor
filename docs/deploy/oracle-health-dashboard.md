# Oracle Health Dashboard

The Oracle watchdog now writes a compact operational dashboard on every run.

## Outputs

- HTML: `ops/dashboard/latest.html`
- JSON: `ops/dashboard/latest.json`
- Watchdog logs: `ops/watchdog/*.log`
- Internal route: `/api/companies/:companyId/oracle-health-dashboard`
- Internal JSON route: `/api/companies/:companyId/oracle-health-dashboard.json`

## What It Shows

- instance health and bootstrap state
- issue status distribution
- active issues
- queued issues that already have an execution run id
- blocked issues
- in-progress issues that have been idle for 30 minutes or more
- tail of the latest watchdog log

## Generation

The dashboard is refreshed automatically by:

```bash
*/10 * * * * /home/ubuntu/projects/paperclip-refactor-foundation/scripts/oracle_watchdog.sh
```

You can also render it manually:

```bash
cd /home/ubuntu/projects/paperclip-refactor-foundation
node scripts/render_oracle_health_dashboard.mjs
```

## Notes

- The watchdog is intentionally non-destructive. It no longer mutates issue state during stale-run inspection.
- Orphan recovery remains the responsibility of the Paperclip heartbeat/runtime layer.
