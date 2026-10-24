CREATE TYPE report_urgency AS ENUM ('URGENTE', 'NO_URGENTE');
CREATE TYPE report_urgency_classification_status AS ENUM ('AUTO_ASSIGNED', 'NEEDS_REVIEW', 'UNAVAILABLE', 'REVIEWED');

ALTER TABLE citizen_reports
  ADD COLUMN urgency report_urgency,
  ADD COLUMN suggested_urgency report_urgency,
  ADD COLUMN urgent_probability double precision,
  ADD COLUMN urgency_classification_status report_urgency_classification_status,
  ADD COLUMN urgency_classification_model text;

-- Undo prior automatic category changes: the reporter's selected category remains authoritative.
UPDATE citizen_reports
SET category = declared_category
WHERE declared_category IS NOT NULL
  AND classification_status = 'AUTO_ASSIGNED';

-- Existing reports have never been classified for urgency and need municipal triage.
UPDATE citizen_reports
SET urgency_classification_status = 'NEEDS_REVIEW';
