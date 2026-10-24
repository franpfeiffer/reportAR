ALTER TABLE citizen_reports ADD COLUMN IF NOT EXISTS photo_upload_token_hash text;
ALTER TABLE citizen_reports ADD COLUMN IF NOT EXISTS photo_content_type text;
ALTER TABLE citizen_reports ADD COLUMN IF NOT EXISTS photo_filename text;
