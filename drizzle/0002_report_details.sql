ALTER TABLE "citizen_reports" ADD COLUMN "latitude" double precision;
ALTER TABLE "citizen_reports" ADD COLUMN "longitude" double precision;
ALTER TABLE "citizen_reports" ADD COLUMN "photo_url" text;
ALTER TABLE "citizen_reports" ADD COLUMN "source" text DEFAULT 'WEB' NOT NULL;
