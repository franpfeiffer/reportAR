ALTER TABLE citizen_reports
  ADD COLUMN IF NOT EXISTS photo_storage_key text;
