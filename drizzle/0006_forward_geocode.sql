CREATE TABLE IF NOT EXISTS forward_geocode_cache (
  query_key text PRIMARY KEY NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
