# Live Integration Testing

Use this to verify real Shortcut/Linear migration + sync behavior with your own API keys.

## What it does

`npm run test:live` runs an end-to-end smoke scenario:

1. Validates Shortcut + Linear credentials.
2. Creates a Shortcut fixture story with labels, description, links, estimate, and comment.
3. Runs `SHORTCUT_TO_LINEAR` sync and verifies the Linear issue carries the same data.
4. Updates the Shortcut story and verifies update propagation.
5. Runs `LINEAR_TO_SHORTCUT` reverse checks.
6. Archives created fixture records.
7. Writes a JSON report under `artifacts/live/`.

## Required environment

Set at least:

- `GOODBYE_SHORTCUT_TOKEN` (or `GOODBYE_LIVE_SHORTCUT_TOKEN`)
- `GOODBYE_LINEAR_TOKEN` (or `GOODBYE_LIVE_LINEAR_TOKEN`)
- `GOODBYE_LINEAR_TEAM_ID` (or `GOODBYE_LIVE_LINEAR_TEAM_ID`)

Optional:

- `GOODBYE_LIVE_SHORTCUT_TEAM_ID` to scope to a specific Shortcut team.
- `GOODBYE_LIVE_PREFIX=GS-LIVE` for fixture naming.

## Run

```bash
npm run test:live
```

## Output

The script always writes a report:

- `artifacts/live/live-smoke-<run-id>.json`

It includes:

- pass/fail checks
- created fixture IDs
- any cleanup failures
- total runtime

## Notes

- This script writes real records to your workspace.
- If a run fails before cleanup, use the report file to manually find fixture IDs.
