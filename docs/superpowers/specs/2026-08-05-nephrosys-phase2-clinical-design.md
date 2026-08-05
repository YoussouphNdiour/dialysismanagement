# NephroSys Phase 2 — Clinical : Spec de design

> **Projet :** Module clinique du systeme de gestion de nephrologie NephroSys
> **Date :** 2026-08-05
> **Statut :** En cours de validation
> **Prerequis :** Phase 1 (fondations) complete — branch `feat/champs-cliniques-manquants`

---

## 1. Objectif

Construire le coeur clinique de NephroSys :
- **Seances de dialyse** : cycle complet planifiee → en cours → terminee, formulaire multi-sections, constantes vitales per-seance
- **Bilans biologiques** : 100+ champs organises en 10 onglets, statuts calcules avec seuils configurables
- **Planning hebdomadaire** : affectation patients/postes/soignants, 3 vues (grille, calendrier drag&drop, liste)
- **Configuration admin** : seuils cliniques editables, gestion des postes de dialyse

---

## 2. Decisions issues du brainstorming

| Question | Decision |
|----------|----------|
| Flux en salle | Secretaire prepare planning → infirmiere demarre seance → constantes → medecin termine |
| Constantes vitales | A la demande (nombre variable par seance) |
| Saisie bilans | Medecin saisit manuellement apres reception labo papier |
| Postes de dialyse | 20-30 postes dont VIP (chambre individuelle + tarification differente) |
| Vacations | 2/jour : matin 7H-11H, apres-midi 12H-16H |
| Remplissage seance | Mixte : infirmiere (pre-dialyse + machine + constantes), medecin (fin + adequation) |
| Seuils bilans | Configurables par l'admin dans une page dediee |
| Vues planning | 3 vues : grille, calendrier drag&drop, liste |
| Verrouillage seance | Modifiable 24h apres terminee, puis verrouillee automatiquement |

---

## 3. Schema de donnees

### 3.1. Table `postes_dialyse`

| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| nom | varchar(100) | Ex: "Poste 1", "VIP 3" |
| numero | integer | Numero d'ordre pour tri |
| is_vip | boolean default false | Chambre individuelle |
| is_active | boolean default true | Poste utilisable |
| equipement | text nullable | Description equipement specifique |
| created_at | timestamp | |

### 3.2. Table `plannings`

| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| patient_id | uuid FK patients | |
| poste_id | uuid FK postes_dialyse | |
| medecin_id | uuid FK users | |
| infirmier_id | uuid FK users | |
| jour_semaine | integer | 0=lundi, 1=mardi … 6=dimanche |
| vacation | enum (matin, apres_midi) | 7H-11H ou 12H-16H |
| recurrence | enum (hebdo, bihebdo, trihebdo) | |
| is_active | boolean default true | |
| created_at | timestamp | |

**Contrainte unique :** (poste_id, jour_semaine, vacation) — un poste ne peut avoir qu'un patient par creneau.

### 3.3. Table `dialysis_sessions`

#### Pre-dialyse / Arrivee

| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| patient_id | uuid FK patients | |
| planning_id | uuid FK plannings nullable | Null si seance manuelle |
| poste_id | uuid FK postes_dialyse | |
| physician_id | uuid FK users | |
| nurse_id | uuid FK users | |
| date_seance | date | |
| dialysis_number | integer | Numero de seance du patient |
| is_vip | boolean | Copie du poste a la creation |
| arrival_status | enum (stable, malade, urgence) | |
| arrival_weight | decimal(5,2) nullable | kg |
| dry_weight | decimal(5,2) nullable | kg |
| interdialysis_increase | decimal(5,2) nullable | Calcule: arrival - dry |
| ta_pre_dialyse | varchar(20) nullable | Ex: "140/90" |
| ta_debout | varchar(20) nullable | |
| ta_coucher | varchar(20) nullable | |
| temperature_pre | decimal(4,1) nullable | Celsius |

#### Parametres machine / Dialysat

| Champ | Type | Description |
|-------|------|-------------|
| type_dialyse | enum (hemodialyse, hemodiafiltration, dialyse_peritoneale) nullable | |
| dialyzer_type | varchar(100) nullable | Rein artificiel |
| type_abord_vasculaire | varchar(100) nullable | |
| debit_sang | decimal(6,1) nullable | ml/min |
| debit_dialysat | decimal(6,1) nullable | ml/min |
| uf_prescrite | decimal(6,2) nullable | litres |
| uf_max | decimal(6,2) nullable | litres |
| duree_prescrite | integer nullable | minutes |
| conductivite | decimal(4,2) nullable | mS/cm |
| bain_calcium | decimal(4,2) nullable | |
| bain_potassium | decimal(4,2) nullable | |
| bain_glucose | decimal(4,2) nullable | |
| bain_sodium | varchar(20) nullable | |
| temperature_bain | decimal(4,1) nullable | Celsius |
| bicarbonate | text nullable | |
| anticoagulation | text nullable | |
| aiguille_arterielle | varchar(50) nullable | |
| aiguille_veineuse | varchar(50) nullable | |
| ponction | varchar(50) nullable | |
| pression_arterielle | varchar(20) nullable | |
| pression_veineuse | varchar(20) nullable | |
| ptm | varchar(20) nullable | Pression transmembranaire |

#### Fin de seance

| Champ | Type | Description |
|-------|------|-------------|
| departure_weight | decimal(5,2) nullable | kg |
| uf_reelle | decimal(6,2) nullable | litres |
| duree_reelle | integer nullable | minutes |
| tolerance_globale | enum (bonne, moyenne, mauvaise) nullable | |
| aspect_rein | text nullable | |
| notes_fin | text nullable | |

#### Adequation dialyse

| Champ | Type | Description |
|-------|------|-------------|
| uree_pre | decimal(8,2) nullable | |
| uree_post | decimal(8,2) nullable | |
| ktv_calculated | decimal(4,2) nullable | Calcule |
| ktv_status | enum (adequate, inadequate) nullable | Calcule |
| urr_calculated | decimal(5,2) nullable | Calcule en % |

#### Clinique divers

| Champ | Type | Description |
|-------|------|-------------|
| traitement_en_cours | text nullable | |
| hemoculture | text nullable | |
| vaccination | text nullable | |
| transfusion | text nullable | |
| erythropoietine | varchar(100) nullable | |
| observations | text nullable | |

#### Statut et verrouillage

| Champ | Type | Description |
|-------|------|-------------|
| statut | enum (planifiee, en_cours, terminee, annulee) default planifiee | |
| locked_at | timestamp nullable | Rempli auto 24h apres terminee |
| created_at | timestamp | |
| updated_at | timestamp | |

### 3.4. Table `vital_signs`

| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| session_id | uuid FK dialysis_sessions | |
| heure_mesure | timestamp | |
| tension_arterielle | varchar(20) | Ex: "130/80" |
| frequence_cardiaque | integer nullable | bpm |
| frequence_respiratoire | integer nullable | cycles/min |
| spo2 | decimal(4,1) nullable | % |
| temperature | decimal(4,1) nullable | Celsius |
| glycemie | decimal(5,2) nullable | g/L |
| is_hypotension | boolean default false | Alerte infirmiere |
| notes | text nullable | |

### 3.5. Table `bilans`

#### En-tete

| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| reference | varchar(50) | Auto-genere (BIO-YYYYMMDD-NNN) |
| patient_id | uuid FK patients | |
| physician_id | uuid FK users | |
| date_bilan | timestamp | |
| type_bilan | enum (mensuel, trimestriel, semestriel, annuel) | |
| notes | text nullable | |

#### Hematologie

| Champ | Type |
|-------|------|
| hemoglobine | decimal(5,2) nullable |
| hematocrite | decimal(5,2) nullable |
| globules_blancs | decimal(8,2) nullable |
| plaquettes | decimal(10,0) nullable |
| neutrophiles | decimal(5,2) nullable |
| eosinophiles | decimal(5,2) nullable |
| basophiles | decimal(5,2) nullable |
| lymphocytes | decimal(5,2) nullable |
| monocytes | decimal(5,2) nullable |
| ferritine | decimal(8,2) nullable |
| saturation_transferrine | decimal(5,2) nullable |
| vgm | decimal(6,2) nullable |
| ccmh | decimal(5,2) nullable |

#### Biochimie renale

| Champ | Type |
|-------|------|
| creatinine | decimal(8,2) nullable |
| uree_pre | decimal(8,2) nullable |
| uree_post | decimal(8,2) nullable |
| acide_urique | decimal(6,2) nullable |
| uricemie | decimal(6,2) nullable |
| urr_calculated | decimal(5,2) nullable |
| dfg_mdrd | decimal(6,2) nullable |

#### Electrolytes

| Champ | Type |
|-------|------|
| sodium | decimal(6,2) nullable |
| potassium | decimal(5,2) nullable |
| chlore | decimal(6,2) nullable |
| calcium | decimal(5,2) nullable |
| phosphore | decimal(5,2) nullable |
| bicarbonate_bilan | decimal(6,2) nullable |
| reserve_alcaline | decimal(6,2) nullable |
| produit_ca_p | decimal(6,2) nullable |

#### Mineraux / Os

| Champ | Type |
|-------|------|
| pth | decimal(8,2) nullable |
| vitamine_d | decimal(6,2) nullable |
| phosphatase_alcaline | decimal(8,2) nullable |

#### Bilan lipidique

| Champ | Type |
|-------|------|
| hdl | decimal(6,2) nullable |
| ldl | decimal(6,2) nullable |
| cholesterol_total | decimal(6,2) nullable |
| triglycerides | decimal(6,2) nullable |

#### Nutrition et inflammation

| Champ | Type |
|-------|------|
| albumine | decimal(5,2) nullable |
| prealbumine | decimal(5,2) nullable |
| proteines_totales | decimal(6,2) nullable |
| proteidemie | decimal(6,2) nullable |
| crp | decimal(6,2) nullable |

#### Bilan hepatique

| Champ | Type |
|-------|------|
| alat | decimal(8,2) nullable |
| asat | decimal(8,2) nullable |
| gamma_gt | decimal(8,2) nullable |
| ldh | decimal(8,2) nullable |
| cpk | decimal(8,2) nullable |
| haptoglobine | decimal(6,2) nullable |
| bilirubine_totale | decimal(6,2) nullable |
| bilirubine_indirecte | decimal(6,2) nullable |
| schizocytes | varchar(50) nullable |
| rac | varchar(50) nullable |

#### Bilan martial

| Champ | Type |
|-------|------|
| cst | decimal(5,2) nullable |
| fer_serique | decimal(6,2) nullable |

#### Glycemie

| Champ | Type |
|-------|------|
| gaj | decimal(5,2) nullable |
| hba1c | decimal(4,1) nullable |

#### Urines

| Champ | Type |
|-------|------|
| pu_24h | varchar(50) nullable |
| eppu | varchar(50) nullable |
| ecbu | varchar(50) nullable |
| nau | decimal(6,2) nullable |
| ku | decimal(6,2) nullable |
| rapport_na_k | decimal(5,2) nullable |
| uree_urinaire | decimal(8,2) nullable |
| creat_urinaire | decimal(8,2) nullable |

#### PBR

| Champ | Type |
|-------|------|
| pbr_resultat | text nullable |

#### Serologies

| Champ | Type |
|-------|------|
| hbs_ag | enum (positif, negatif, non_fait) nullable |
| anti_hbs | enum (positif, negatif, non_fait) nullable |
| anti_hbc | enum (positif, negatif, non_fait) nullable |
| anti_hcv | enum (positif, negatif, non_fait) nullable |
| anti_hiv | enum (positif, negatif, non_fait) nullable |
| tpha | enum (positif, negatif, non_fait) nullable |
| vdrl | enum (positif, negatif, non_fait) nullable |

#### Statuts calcules

| Champ | Type | Regle |
|-------|------|-------|
| hb_statut | enum (ok, low, high) nullable | Compare hemoglobine vs seuils_cliniques.hemoglobine |
| potassium_statut | enum (ok, low, high) nullable | Compare potassium vs seuils_cliniques.potassium |
| phosphore_statut | enum (ok, low, high) nullable | Compare phosphore vs seuils_cliniques.phosphore |
| albumine_statut | enum (ok, low, high) nullable | Compare albumine vs seuils_cliniques.albumine |
| pth_statut | enum (ok, low, high) nullable | Compare pth vs seuils_cliniques.pth |
| ca_p_statut | enum (ok, low, high) nullable | Compare produit_ca_p vs seuils_cliniques.produit_ca_p |

#### Timestamps

| Champ | Type |
|-------|------|
| created_at | timestamp |
| updated_at | timestamp |

### 3.6. Table `seuils_cliniques`

| Champ | Type | Description |
|-------|------|-------------|
| id | uuid PK | |
| parametre | varchar(50) unique | Cle machine : hemoglobine, potassium, etc. |
| label | varchar(100) | Libelle francais affiche |
| seuil_bas | decimal(8,2) nullable | Valeur en dessous = low (null = pas de seuil bas) |
| seuil_haut | decimal(8,2) nullable | Valeur au dessus = high (null = pas de seuil haut) |
| unite | varchar(20) | g/dL, mmol/L, etc. |
| updated_at | timestamp | |

**Seed initial :**

| parametre | label | seuil_bas | seuil_haut | unite |
|-----------|-------|-----------|------------|-------|
| hemoglobine | Hemoglobine | 10.0 | 16.0 | g/dL |
| potassium | Potassium | 3.5 | 5.5 | mmol/L |
| phosphore | Phosphore | 0.8 | 1.5 | mmol/L |
| albumine | Albumine | 35.0 | 50.0 | g/L |
| pth | PTH | 150.0 | 600.0 | pg/mL |
| produit_ca_p | Produit Ca x P | null | 55.0 | mg2/dL2 |

### 3.7. Nouveaux enums

- `vacation_enum` : matin, apres_midi
- `recurrence_enum` : hebdo, bihebdo, trihebdo
- `statut_seance_enum` : planifiee, en_cours, terminee, annulee
- `type_dialyse_enum` : hemodialyse, hemodiafiltration, dialyse_peritoneale
- `arrival_status_enum` : stable, malade, urgence
- `tolerance_enum` : bonne, moyenne, mauvaise
- `type_bilan_enum` : mensuel, trimestriel, semestriel, annuel
- `serologie_result_enum` : positif, negatif, non_fait
- `bio_status_enum` : ok, low, high
- `ktv_status_enum` : adequate, inadequate

---

## 4. Seances de dialyse

### 4.1. Workflow

```
planifiee  ──→  en_cours  ──→  terminee  ──→  [verrouillee apres 24h]
     │              │
     └──→ annulee ←─┘
```

- **Planifiee** : creee depuis le planning (auto) ou manuellement. Pre-remplie avec patient, poste, medecin, infirmier.
- **En cours** : l'infirmiere clique "Demarrer". Deverrouille la saisie des constantes vitales et parametres machine.
- **Terminee** : le medecin clique "Terminer". Remplit fin de seance + adequation. Modifiable pendant 24h.
- **Verrouillee** : check a l'ouverture du formulaire — si terminee depuis > 24h, `locked_at = now()`. Formulaire en lecture seule.
- **Annulee** : possible depuis planifiee ou en_cours.

### 4.2. Pages

#### `/seances` — Liste des seances du jour

- Filtre par defaut : date = aujourd'hui
- Filtres : date, poste, patient, statut
- Colonnes : patient, poste, vacation, statut (badge colore), medecin, infirmiere
- Badges : planifiee=bleu, en_cours=orange, terminee=vert, annulee=rouge
- Accessible : admin, medecin, infirmiere, secretaire

#### `/seances/nouvelle` — Creation manuelle

- Selection : patient, date, poste, medecin, infirmier
- Pre-rempli si cree depuis le planning
- Accessible : admin, medecin, secretaire

#### `/seances/[id]` — Formulaire multi-sections (4 onglets)

**Onglet 1 — Pre-dialyse** (infirmiere au branchement) :
statut arrivee, poids arrivee, poids sec, prise de poids interdialytique (calculee auto), TA pre/debout/couche, temperature

**Onglet 2 — Machine / Dialysat** (infirmiere au branchement) :
type dialyse, dialyseur, abord vasculaire, debits sang/dialysat, UF prescrite/max, duree prescrite, conductivite, bains (Ca, K, glucose, Na), temperature bain, bicarbonate, anticoagulation, aiguilles art/vein, ponction, pressions art/vein, PTM

**Onglet 3 — Constantes vitales** (infirmiere pendant la seance) :
Tableau scrollable avec bouton "+ Releve". Chaque ligne : heure, TA, FC, FR, SpO2, temperature, glycemie, checkbox hypotension, notes. Nombre illimite de releves.

**Onglet 4 — Fin de seance** (medecin a la deconnexion) :
Poids depart, UF reelle, duree reelle, tolerance globale, aspect du rein, adequation (uree pre/post, Kt/V calcule, URR calcule, statut Kt/V), traitements en cours, hemoculture, vaccination, transfusion, erythropoietine, observations

**Boutons d'action contextuels :**
- Seance planifiee → bouton "Demarrer la seance" (infirmiere, medecin, admin)
- Seance en cours → bouton "Terminer la seance" (medecin, admin)
- Seance terminee < 24h → edition permise, badge "Modifiable encore Xh"
- Seance verrouillee → lecture seule, badge "Verrouillee"

### 4.3. Calculs automatiques

- `interdialysis_increase` = arrival_weight - dry_weight
- `ktv_calculated` = -ln(uree_post / uree_pre) + (4 - 3.5 * uree_post / uree_pre) * (arrival_weight - departure_weight) / departure_weight
- `urr_calculated` = (uree_pre - uree_post) / uree_pre * 100
- `ktv_status` = ktv_calculated >= 1.2 ? "adequate" : "inadequate"

Ces calculs sont effectues cote serveur au moment de la sauvegarde de la section "Fin de seance".

### 4.4. RBAC seances

| Action | admin | medecin | infirmiere | secretaire | facturation | patient |
|--------|-------|---------|------------|------------|-------------|---------|
| Voir liste | oui | oui | oui | oui | non | non |
| Creer seance | oui | oui | non | oui | non | non |
| Demarrer seance | oui | oui | oui | non | non | non |
| Saisir constantes | oui | oui | oui | non | non | non |
| Terminer seance | oui | oui | non | non | non | non |
| Modifier < 24h | oui | oui | non | non | non | non |

---

## 5. Bilans biologiques

### 5.1. Workflow

Pas de machine a etats. Le medecin cree un bilan, remplit les resultats section par section, sauvegarde. Les statuts sont calcules automatiquement cote serveur en comparant aux seuils de `seuils_cliniques`.

### 5.2. Pages

#### `/bilans` — Liste des bilans

- Filtres : patient, type (mensuel/trimestriel/...), periode (date debut/fin)
- Colonnes : reference, patient, date, type, badges statuts (Hb, K+, PO4, Alb, PTH, Ca x P)
- Badges : vert=ok, rouge=low ou high
- Tri par defaut : date decroissante
- Accessible : admin, medecin, infirmiere (lecture), patient (ses bilans via portail)

#### `/bilans/nouveau` — Creation bilan

- Selection : patient, type de bilan, date
- Accessible : admin, medecin

#### `/bilans/[id]` — Formulaire par onglets (10 onglets)

1. **Hematologie** : Hb, Ht, GB, plaquettes, formule leucocytaire, ferritine, sat. transferrine, VGM, CCMH
2. **Biochimie renale** : creatinine, uree pre/post, acide urique, uricemie, URR (calcule), DFG MDRD
3. **Electrolytes** : Na, K, Cl, Ca, P, bicarbonate, reserve alcaline, produit Ca x P (calcule)
4. **Mineraux / Os** : PTH, vitamine D, phosphatase alcaline
5. **Lipides** : HDL, LDL, cholesterol total, triglycerides
6. **Nutrition / Inflammation** : albumine, prealbumine, proteines totales, proteidemie, CRP
7. **Hepatique** : ALAT, ASAT, gamma GT, LDH, CPK, haptoglobine, bilirubine totale/indirecte, schizocytes, RAC
8. **Martial** : CST, fer serique
9. **Glycemie / Urines** : GAJ, HbA1c, PU 24h, EPPU, ECBU, NaU, KU, rapport Na/K, uree urinaire, creat urinaire
10. **Serologies / PBR** : HBs Ag, Anti-HBs, Anti-HBc, Anti-HCV, Anti-HIV, TPHA, VDRL, resultat PBR

### 5.3. Calculs automatiques

- `produit_ca_p` = calcium * phosphore
- `urr_calculated` = (uree_pre - uree_post) / uree_pre * 100
- Tous les `_statut` : lecture des seuils depuis `seuils_cliniques`, comparaison : valeur < seuil_bas → "low", valeur > seuil_haut → "high", sinon "ok". Si valeur null → statut null.

### 5.4. Lien patient

Sur la fiche patient (`/patients/[id]`), un bouton stat "Bilans" affiche l'historique des bilans du patient.

### 5.5. RBAC bilans

| Action | admin | medecin | infirmiere | secretaire | facturation | patient |
|--------|-------|---------|------------|------------|-------------|---------|
| Voir liste | oui | oui | oui | non | non | ses bilans |
| Creer/editer | oui | oui | non | non | non | non |

---

## 6. Planning hebdomadaire

### 6.1. Gestion des postes

#### `/planning/postes` — Page des postes de dialyse

- CRUD des postes : nom, numero, VIP (oui/non), equipement, actif/inactif
- Affichage en grille de cards : numero, nom, badge VIP dore, statut actif/inactif
- Accessible : admin, medecin, secretaire

### 6.2. Affectations recurrentes

Un planning = "le patient X est affecte au poste Y, le lundi matin, avec Dr Z et infirmiere W, toutes les semaines".

**Generation des seances :** bouton "Generer les seances de la semaine" (admin, secretaire) cree les `dialysis_sessions` en statut "planifiee" pour la semaine choisie, base sur les plannings actifs. Garde-fou : pas de doublon si deja generees pour cette semaine.

### 6.3. Les 3 vues planning (`/planning`)

Selecteur de vue en haut a droite : Grille | Calendrier | Liste

#### Vue Grille (par defaut)
- Colonnes = postes (tries par numero), lignes = creneaux (matin/apres-midi)
- Une page par jour, navigation fleches gauche/droite
- Chaque cellule : nom patient, badge VIP si applicable, badge statut seance si generee
- Cellule vide = poste libre, cliquable pour affecter
- Postes VIP visuellement distincts (bordure doree)

#### Vue Calendrier
- Semaine complete (lun→sam), colonnes = jours, lignes = postes
- Chaque case montre les 2 vacations empilees
- Drag & drop pour deplacer une affectation d'un jour/poste a un autre
- Couleurs : bleu=planifiee, orange=en cours, vert=terminee, gris=libre

#### Vue Liste
- Tableau filtrable : jour, vacation, poste, patient, medecin, infirmier, statut
- Groupement par jour avec sous-totaux (X patients matin, Y apres-midi)

### 6.4. RBAC planning

| Action | admin | medecin | infirmiere | secretaire | facturation | patient |
|--------|-------|---------|------------|------------|-------------|---------|
| Voir planning | oui | oui | oui | oui | non | non |
| Creer/modifier affectation | oui | oui | non | oui | non | non |
| Gerer postes | oui | oui | non | oui | non | non |
| Generer seances | oui | non | non | oui | non | non |

---

## 7. Configuration admin

### `/admin/configuration` — Seuils cliniques

- Tableau editable des 6 seuils : hemoglobine, potassium, phosphore, albumine, pth, produit_ca_p
- Edition inline : clic sur cellule → champ editable
- Sauvegarde par ligne (bouton save ou auto-save au blur)
- Seed initial avec valeurs nephrologiques standard
- Parametres fixes (6 lignes) — seuls les seuils et unites sont modifiables par l'admin
- Accessible : admin uniquement

---

## 8. tRPC Routers

### 8.1. `postesRouter`

| Procedure | Type | Input | Acces |
|-----------|------|-------|-------|
| list | query | — | admin, medecin, infirmiere, secretaire |
| getById | query | { id } | admin, medecin, infirmiere, secretaire |
| create | mutation | { nom, numero, isVip, equipement } | admin, medecin, secretaire |
| update | mutation | { id, ...partial } | admin, medecin, secretaire |
| toggleActive | mutation | { id } | admin |

### 8.2. `planningsRouter`

| Procedure | Type | Input | Acces |
|-----------|------|-------|-------|
| list | query | { jourSemaine?, posteId?, patientId? } | admin, medecin, infirmiere, secretaire |
| create | mutation | { patientId, posteId, medecinId, infirmierId, jourSemaine, vacation, recurrence } | admin, medecin, secretaire |
| update | mutation | { id, ...partial } | admin, medecin, secretaire |
| delete | mutation | { id } | admin, medecin, secretaire |
| generateWeekSessions | mutation | { weekStart: date } | admin, secretaire |

### 8.3. `sessionsRouter`

| Procedure | Type | Input | Acces |
|-----------|------|-------|-------|
| list | query | { date?, posteId?, patientId?, statut? } | admin, medecin, infirmiere, secretaire |
| getById | query | { id } | admin, medecin, infirmiere, secretaire |
| create | mutation | { patientId, posteId, physicianId, nurseId, dateSeance, planningId? } | admin, medecin, secretaire |
| updatePreDialyse | mutation | { id, ...champs pre-dialyse } | admin, medecin, infirmiere |
| updateMachine | mutation | { id, ...champs machine } | admin, medecin, infirmiere |
| updateFinSeance | mutation | { id, ...champs fin + adequation } | admin, medecin |
| demarrer | mutation | { id } | admin, medecin, infirmiere |
| terminer | mutation | { id } | admin, medecin |
| annuler | mutation | { id } | admin, medecin |

### 8.4. `vitalSignsRouter`

| Procedure | Type | Input | Acces |
|-----------|------|-------|-------|
| listBySession | query | { sessionId } | admin, medecin, infirmiere, secretaire |
| create | mutation | { sessionId, heureMesure, ta, fc, fr, spo2, temp, glycemie, isHypotension, notes } | admin, medecin, infirmiere |
| update | mutation | { id, ...partial } | admin, medecin, infirmiere |
| delete | mutation | { id } | admin, medecin |

### 8.5. `bilansRouter`

| Procedure | Type | Input | Acces |
|-----------|------|-------|-------|
| list | query | { patientId?, typeBilan?, dateDebut?, dateFin?, page, perPage } | admin, medecin, infirmiere |
| getById | query | { id } | admin, medecin, infirmiere |
| create | mutation | { patientId, physicianId, dateBilan, typeBilan } | admin, medecin |
| update | mutation | { id, ...tous les champs par section } | admin, medecin |
| delete | mutation | { id } | admin |

### 8.6. `seuilsRouter`

| Procedure | Type | Input | Acces |
|-----------|------|-------|-------|
| list | query | — | admin |
| update | mutation | { id, seuilBas?, seuilHaut?, unite? } | admin |

---

## 9. Tests

### 9.1. Tests unitaires (Vitest)

**Validators :** schemas Zod pour chaque router — seances (create, updatePreDialyse, updateMachine, updateFinSeance), bilans (create, update), plannings (create, update), postes (create, update), seuils (update), vital signs (create, update)

**Calculs cliniques :** fonctions pures exportees depuis `src/lib/clinical-calculations.ts` :
- `calculateInterdialysisIncrease(arrivalWeight, dryWeight)` → decimal
- `calculateKtV(ureePre, ureePost, arrivalWeight, departureWeight)` → decimal
- `calculateURR(ureePre, ureePost)` → decimal
- `calculateBioStatus(value, seuilBas, seuilHaut)` → 'ok' | 'low' | 'high' | null
- `calculateProductCaP(calcium, phosphore)` → decimal

**Permissions :** verifier que les nouvelles routes respectent la matrice RBAC

### 9.2. Tests E2E (Playwright)

- **Seance** : creer, demarrer, ajouter constantes, terminer, verifier badge verrouillage
- **Bilans** : creer, remplir onglet hematologie, verifier badge Hb
- **Planning** : vue grille, affecter patient a un poste, generer seances de la semaine
- **Configuration** : modifier un seuil, verifier impact sur statut bilan

Les tests E2E necessitent serveur + DB. Ecrits mais execution depend de Docker.

---

## 10. Routes et middleware

### Nouvelles routes a proteger

```
/seances                → admin, medecin, infirmiere, secretaire
/seances/nouvelle       → admin, medecin, secretaire
/seances/[id]           → admin, medecin, infirmiere, secretaire
/bilans                 → admin, medecin, infirmiere
/bilans/nouveau         → admin, medecin
/bilans/[id]            → admin, medecin, infirmiere
/planning               → admin, medecin, infirmiere, secretaire
/planning/postes        → admin, medecin, secretaire
/admin/configuration    → admin
```

Le middleware existant (`src/middleware.ts`) et `src/lib/permissions.ts` doivent etre etendus avec ces routes.

Le menu sidebar doit ajouter les entrees : Seances, Bilans, Planning (avec sous-menu Postes), Configuration (sous admin).
