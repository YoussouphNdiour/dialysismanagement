CREATE TYPE "public"."statut_prescription" AS ENUM('prescrite', 'administree', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."type_mouvement" AS ENUM('entree', 'sortie', 'ajustement');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'gestionnaire_stock';--> statement-breakpoint
CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"numero_lot" varchar(100) NOT NULL,
	"date_peremption" date NOT NULL,
	"quantite_initiale" numeric(10, 2) NOT NULL,
	"quantite_disponible" numeric(10, 2) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mouvements_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"lot_id" uuid,
	"type_mouvement" "type_mouvement" NOT NULL,
	"quantite" numeric(10, 2) NOT NULL,
	"motif" varchar(200),
	"session_id" uuid,
	"patient_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seuils_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"seuil_min" numeric(10, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seuils_stock_article_id_unique" UNIQUE("article_id")
);
--> statement-breakpoint
CREATE TABLE "prescriptions_seance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"article_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"quantite" numeric(10, 2) NOT NULL,
	"posologie" varchar(200),
	"statut" "statut_prescription" DEFAULT 'prescrite' NOT NULL,
	"lot_id" uuid,
	"prescrit_par" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordonnances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"contenu" text NOT NULL,
	"date_prescription" date NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"prescrit_par" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_session_id_dialysis_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dialysis_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mouvements_stock" ADD CONSTRAINT "mouvements_stock_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seuils_stock" ADD CONSTRAINT "seuils_stock_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions_seance" ADD CONSTRAINT "prescriptions_seance_session_id_dialysis_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dialysis_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions_seance" ADD CONSTRAINT "prescriptions_seance_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions_seance" ADD CONSTRAINT "prescriptions_seance_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions_seance" ADD CONSTRAINT "prescriptions_seance_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prescriptions_seance" ADD CONSTRAINT "prescriptions_seance_prescrit_par_users_id_fk" FOREIGN KEY ("prescrit_par") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordonnances" ADD CONSTRAINT "ordonnances_prescrit_par_users_id_fk" FOREIGN KEY ("prescrit_par") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;