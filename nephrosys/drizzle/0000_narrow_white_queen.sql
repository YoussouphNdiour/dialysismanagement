CREATE TYPE "public"."patient_statut" AS ENUM('actif', 'inactif', 'transfere', 'decede');--> statement-breakpoint
CREATE TYPE "public"."sexe" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'secretaire', 'medecin', 'infirmiere', 'facturation', 'patient');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'patient' NOT NULL,
	"nom" varchar(100) NOT NULL,
	"prenom" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"nom" varchar(100) NOT NULL,
	"prenom" varchar(100) NOT NULL,
	"date_naissance" date,
	"sexe" "sexe",
	"telephone" varchar(20),
	"groupe_sanguin" varchar(10),
	"taille_cm" numeric(5, 1),
	"poids_sec_kg" numeric(5, 1),
	"nephropathie" text,
	"date_premiere_dialyse" date,
	"medecin_ref_id" uuid,
	"statut" "patient_statut" DEFAULT 'actif' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_medecin_ref_id_users_id_fk" FOREIGN KEY ("medecin_ref_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;