CREATE TABLE IF NOT EXISTS sync_cursors (
  scope_key TEXT PRIMARY KEY,
  shortcut_updated_at TIMESTAMPTZ,
  linear_updated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_job_runs (
  id BIGSERIAL PRIMARY KEY,
  queue_job_id TEXT NOT NULL,
  scope_key TEXT NOT NULL,
  source TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
  delta JSONB,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS sync_job_runs_queue_job_id_uq
  ON sync_job_runs (queue_job_id);

CREATE INDEX IF NOT EXISTS sync_job_runs_scope_started_idx
  ON sync_job_runs (scope_key, started_at DESC);

CREATE TABLE IF NOT EXISTS sync_events (
  id BIGSERIAL PRIMARY KEY,
  scope_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_ts TIMESTAMPTZ NOT NULL,
  level TEXT NOT NULL,
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT
);

CREATE INDEX IF NOT EXISTS sync_events_scope_event_ts_idx
  ON sync_events (scope_key, event_ts DESC);
