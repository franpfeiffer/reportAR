CREATE TABLE "reverse_geocode_cache" (
	"coordinate_key" text PRIMARY KEY NOT NULL,
	"address" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "reverse_geocode_gate" (
	"id" integer PRIMARY KEY NOT NULL,
	"last_request_at" timestamp with time zone DEFAULT now() NOT NULL
);
