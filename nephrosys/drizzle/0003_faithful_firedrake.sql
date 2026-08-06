CREATE TYPE "public"."categorie_article" AS ENUM('medicament', 'consommable', 'acte_medical');--> statement-breakpoint
CREATE TYPE "public"."mode_paiement" AS ENUM('especes', 'cheque', 'virement', 'mobile_money');--> statement-breakpoint
CREATE TYPE "public"."statut_facture" AS ENUM('brouillon', 'validee', 'payee', 'annulee');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(200) NOT NULL,
	"categorie" "categorie_article" NOT NULL,
	"prix_unitaire" numeric(12, 2) NOT NULL,
	"unite" varchar(50) NOT NULL,
	"voie_administration" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(30) NOT NULL,
	"session_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"date_facture" date NOT NULL,
	"montant_base" numeric(12, 2) NOT NULL,
	"montant_supplements" numeric(12, 2) DEFAULT '0' NOT NULL,
	"montant_total" numeric(12, 2) NOT NULL,
	"statut" "statut_facture" DEFAULT 'brouillon' NOT NULL,
	"mode_paiement" "mode_paiement",
	"date_paiement" timestamp with time zone,
	"notes" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "factures_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "lignes_facture" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"facture_id" uuid NOT NULL,
	"article_id" uuid,
	"designation" varchar(200) NOT NULL,
	"quantite" numeric(10, 2) DEFAULT '1' NOT NULL,
	"prix_unitaire" numeric(12, 2) NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarifs_base" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar(100) NOT NULL,
	"code" varchar(50) NOT NULL,
	"montant" numeric(12, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tarifs_base_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "factures" ADD CONSTRAINT "factures_session_id_dialysis_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dialysis_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factures" ADD CONSTRAINT "factures_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factures" ADD CONSTRAINT "factures_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_facture" ADD CONSTRAINT "lignes_facture_facture_id_factures_id_fk" FOREIGN KEY ("facture_id") REFERENCES "public"."factures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lignes_facture" ADD CONSTRAINT "lignes_facture_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;