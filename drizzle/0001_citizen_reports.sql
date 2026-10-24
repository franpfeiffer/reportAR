CREATE TYPE "public"."report_category" AS ENUM('BACHE', 'ALUMBRADO', 'BASURA', 'ARBOLADO', 'OTRO');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('RECIBIDO', 'EN_REVISION', 'RESUELTO');--> statement-breakpoint
CREATE TABLE "citizen_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"category" "report_category" NOT NULL,
	"address" text NOT NULL,
	"description" text NOT NULL,
	"status" "report_status" DEFAULT 'RECIBIDO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "citizen_reports_public_id_unique" UNIQUE("public_id")
);
