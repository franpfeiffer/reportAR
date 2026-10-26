ALTER TABLE citizen_reports
  ADD COLUMN IF NOT EXISTS assigned_area text,
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

CREATE INDEX IF NOT EXISTS citizen_reports_due_at_status_idx
  ON citizen_reports (due_at, status)
  WHERE due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_public_id uuid NOT NULL REFERENCES citizen_reports(public_id) ON DELETE CASCADE,
  type text NOT NULL,
  from_status report_status,
  to_status report_status,
  public_message text,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_events_public_id_created_at_idx
  ON report_events (report_public_id, created_at);

CREATE TABLE IF NOT EXISTS report_rate_limits (
  client_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS report_rate_limits_window_started_at_idx
  ON report_rate_limits (window_started_at);
