ALTER TYPE report_category ADD VALUE IF NOT EXISTS 'INUNDACION';
ALTER TABLE citizen_reports
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS telegram_user_id text,
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_file_id text,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS citizen_reports_external_id_unique ON citizen_reports (external_id);
