CREATE TYPE "public"."user_role" AS ENUM('CITIZEN', 'MUNICIPAL_ADMIN');--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" "user_role" DEFAULT 'CITIZEN' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_auth_user_id_unique" UNIQUE("auth_user_id")
);
