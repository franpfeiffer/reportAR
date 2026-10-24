CREATE TYPE report_classification_status AS ENUM ('AUTO_ASSIGNED', 'NEEDS_REVIEW', 'UNAVAILABLE', 'REVIEWED');
ALTER TABLE citizen_reports
  ADD COLUMN declared_category report_category,
  ADD COLUMN suggested_category report_category,
  ADD COLUMN classification_probability double precision,
  ADD COLUMN classification_status report_classification_status,
  ADD COLUMN classification_model text;
