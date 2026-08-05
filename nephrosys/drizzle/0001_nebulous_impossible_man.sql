CREATE TYPE "public"."arrival_status" AS ENUM('stable', 'malade', 'urgence');--> statement-breakpoint
CREATE TYPE "public"."bio_status" AS ENUM('ok', 'low', 'high');--> statement-breakpoint
CREATE TYPE "public"."ktv_status" AS ENUM('adequate', 'inadequate');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('hebdo', 'bihebdo', 'trihebdo');--> statement-breakpoint
CREATE TYPE "public"."serologie_result" AS ENUM('positif', 'negatif', 'non_fait');--> statement-breakpoint
CREATE TYPE "public"."statut_seance" AS ENUM('planifiee', 'en_cours', 'terminee', 'annulee');--> statement-breakpoint
CREATE TYPE "public"."tolerance" AS ENUM('bonne', 'moyenne', 'mauvaise');--> statement-breakpoint
CREATE TYPE "public"."type_bilan" AS ENUM('mensuel', 'trimestriel', 'semestriel', 'annuel');--> statement-breakpoint
CREATE TYPE "public"."type_dialyse" AS ENUM('hemodialyse', 'hemodiafiltration', 'dialyse_peritoneale');--> statement-breakpoint
CREATE TYPE "public"."vacation" AS ENUM('matin', 'apres_midi');--> statement-breakpoint
CREATE TABLE "postes_dialyse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(100) NOT NULL,
	"numero" integer NOT NULL,
	"is_vip" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"equipement" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plannings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"poste_id" uuid NOT NULL,
	"medecin_id" uuid NOT NULL,
	"infirmier_id" uuid NOT NULL,
	"jour_semaine" integer NOT NULL,
	"vacation" "vacation" NOT NULL,
	"recurrence" "recurrence" DEFAULT 'hebdo' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plannings_poste_jour_vacation_unique" UNIQUE("poste_id","jour_semaine","vacation")
);
--> statement-breakpoint
CREATE TABLE "dialysis_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"planning_id" uuid,
	"poste_id" uuid NOT NULL,
	"physician_id" uuid NOT NULL,
	"nurse_id" uuid NOT NULL,
	"date_seance" date NOT NULL,
	"dialysis_number" integer,
	"is_vip" boolean DEFAULT false NOT NULL,
	"arrival_status" "arrival_status",
	"arrival_weight" numeric(5, 2),
	"dry_weight" numeric(5, 2),
	"interdialysis_increase" numeric(5, 2),
	"ta_pre_dialyse" varchar(20),
	"ta_debout" varchar(20),
	"ta_coucher" varchar(20),
	"temperature_pre" numeric(4, 1),
	"type_dialyse" "type_dialyse",
	"dialyzer_type" varchar(100),
	"type_abord_vasculaire" varchar(100),
	"debit_sang" numeric(6, 1),
	"debit_dialysat" numeric(6, 1),
	"uf_prescrite" numeric(6, 2),
	"uf_max" numeric(6, 2),
	"duree_prescrite" integer,
	"conductivite" numeric(4, 2),
	"bain_calcium" numeric(4, 2),
	"bain_potassium" numeric(4, 2),
	"bain_glucose" numeric(4, 2),
	"bain_sodium" varchar(20),
	"temperature_bain" numeric(4, 1),
	"bicarbonate" text,
	"anticoagulation" text,
	"aiguille_arterielle" varchar(50),
	"aiguille_veineuse" varchar(50),
	"ponction" varchar(50),
	"pression_arterielle" varchar(20),
	"pression_veineuse" varchar(20),
	"ptm" varchar(20),
	"departure_weight" numeric(5, 2),
	"uf_reelle" numeric(6, 2),
	"duree_reelle" integer,
	"tolerance_globale" "tolerance",
	"aspect_rein" text,
	"notes_fin" text,
	"uree_pre" numeric(8, 2),
	"uree_post" numeric(8, 2),
	"ktv_calculated" numeric(4, 2),
	"ktv_status" "ktv_status",
	"urr_calculated" numeric(5, 2),
	"traitement_en_cours" text,
	"hemoculture" text,
	"vaccination" text,
	"transfusion" text,
	"erythropoietine" varchar(100),
	"observations" text,
	"statut" "statut_seance" DEFAULT 'planifiee' NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vital_signs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"heure_mesure" timestamp with time zone NOT NULL,
	"tension_arterielle" varchar(20) NOT NULL,
	"frequence_cardiaque" integer,
	"frequence_respiratoire" integer,
	"spo2" numeric(4, 1),
	"temperature" numeric(4, 1),
	"glycemie" numeric(5, 2),
	"is_hypotension" boolean DEFAULT false NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "bilans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(50) NOT NULL,
	"patient_id" uuid NOT NULL,
	"physician_id" uuid NOT NULL,
	"date_bilan" timestamp with time zone NOT NULL,
	"type_bilan" "type_bilan" NOT NULL,
	"notes" text,
	"hemoglobine" numeric(5, 2),
	"hematocrite" numeric(5, 2),
	"globules_blancs" numeric(8, 2),
	"plaquettes" numeric(10, 0),
	"neutrophiles" numeric(5, 2),
	"eosinophiles" numeric(5, 2),
	"basophiles" numeric(5, 2),
	"lymphocytes" numeric(5, 2),
	"monocytes" numeric(5, 2),
	"ferritine" numeric(8, 2),
	"saturation_transferrine" numeric(5, 2),
	"vgm" numeric(6, 2),
	"ccmh" numeric(5, 2),
	"creatinine" numeric(8, 2),
	"uree_pre" numeric(8, 2),
	"uree_post" numeric(8, 2),
	"acide_urique" numeric(6, 2),
	"uricemie" numeric(6, 2),
	"urr_calculated" numeric(5, 2),
	"dfg_mdrd" numeric(6, 2),
	"sodium" numeric(6, 2),
	"potassium" numeric(5, 2),
	"chlore" numeric(6, 2),
	"calcium" numeric(5, 2),
	"phosphore" numeric(5, 2),
	"bicarbonate_bilan" numeric(6, 2),
	"reserve_alcaline" numeric(6, 2),
	"produit_ca_p" numeric(6, 2),
	"pth" numeric(8, 2),
	"vitamine_d" numeric(6, 2),
	"phosphatase_alcaline" numeric(8, 2),
	"hdl" numeric(6, 2),
	"ldl" numeric(6, 2),
	"cholesterol_total" numeric(6, 2),
	"triglycerides" numeric(6, 2),
	"albumine" numeric(5, 2),
	"prealbumine" numeric(5, 2),
	"proteines_totales" numeric(6, 2),
	"proteidemie" numeric(6, 2),
	"crp" numeric(6, 2),
	"alat" numeric(8, 2),
	"asat" numeric(8, 2),
	"gamma_gt" numeric(8, 2),
	"ldh" numeric(8, 2),
	"cpk" numeric(8, 2),
	"haptoglobine" numeric(6, 2),
	"bilirubine_totale" numeric(6, 2),
	"bilirubine_indirecte" numeric(6, 2),
	"schizocytes" varchar(50),
	"rac" varchar(50),
	"cst" numeric(5, 2),
	"fer_serique" numeric(6, 2),
	"gaj" numeric(5, 2),
	"hba1c" numeric(4, 1),
	"pu_24h" varchar(50),
	"eppu" varchar(50),
	"ecbu" varchar(50),
	"nau" numeric(6, 2),
	"ku" numeric(6, 2),
	"rapport_na_k" numeric(5, 2),
	"uree_urinaire" numeric(8, 2),
	"creat_urinaire" numeric(8, 2),
	"pbr_resultat" text,
	"hbs_ag" "serologie_result",
	"anti_hbs" "serologie_result",
	"anti_hbc" "serologie_result",
	"anti_hcv" "serologie_result",
	"anti_hiv" "serologie_result",
	"tpha" "serologie_result",
	"vdrl" "serologie_result",
	"hb_statut" "bio_status",
	"potassium_statut" "bio_status",
	"phosphore_statut" "bio_status",
	"albumine_statut" "bio_status",
	"pth_statut" "bio_status",
	"ca_p_statut" "bio_status",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seuils_cliniques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parametre" varchar(50) NOT NULL,
	"label" varchar(100) NOT NULL,
	"seuil_bas" numeric(8, 2),
	"seuil_haut" numeric(8, 2),
	"unite" varchar(20) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seuils_cliniques_parametre_unique" UNIQUE("parametre")
);
--> statement-breakpoint
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_poste_id_postes_dialyse_id_fk" FOREIGN KEY ("poste_id") REFERENCES "public"."postes_dialyse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_medecin_id_users_id_fk" FOREIGN KEY ("medecin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_infirmier_id_users_id_fk" FOREIGN KEY ("infirmier_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialysis_sessions" ADD CONSTRAINT "dialysis_sessions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialysis_sessions" ADD CONSTRAINT "dialysis_sessions_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialysis_sessions" ADD CONSTRAINT "dialysis_sessions_poste_id_postes_dialyse_id_fk" FOREIGN KEY ("poste_id") REFERENCES "public"."postes_dialyse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialysis_sessions" ADD CONSTRAINT "dialysis_sessions_physician_id_users_id_fk" FOREIGN KEY ("physician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dialysis_sessions" ADD CONSTRAINT "dialysis_sessions_nurse_id_users_id_fk" FOREIGN KEY ("nurse_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_session_id_dialysis_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."dialysis_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bilans" ADD CONSTRAINT "bilans_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bilans" ADD CONSTRAINT "bilans_physician_id_users_id_fk" FOREIGN KEY ("physician_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;