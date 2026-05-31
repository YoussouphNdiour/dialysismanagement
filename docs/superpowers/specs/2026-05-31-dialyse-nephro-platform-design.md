# Plateforme Clinique Dialyse/Néphrologie — Design Complet

**Date :** 2026-05-31
**Projet :** As-Shafi — Clinique de Dialyse/Néphrologie
**Stack :** Odoo 19 (existant en production), Docker, VPS Contabo PRO4 (12 vCPU / 24 GB RAM)
**Conteneur :** `odoo-19-as-shafi-minhn92-odoo19-1` → port 19019

---

## 1. Contexte et objectifs

### Modules existants
| Module | Rôle |
|---|---|
| `acs_hms_base` | Socle HMS : patients, médecins, stock, facturation |
| `acs_hms` | Flux cliniques : RDV, prescriptions, traitements, procédures |
| `acs_hms_nephrology` | Dialyse : séances, plannings, imagerie, dossier néphro |
| `acs_hms_nephrology_fr_custom` | Traductions françaises personnalisées |
| `acs_hms_whatsapp` | Rappels et envois WhatsApp via WasenderAPI |

### Objectifs
1. **Suivi clinique** : enrichir la séance d'hémodialyse, ajouter les bilans biologiques et le suivi des complications
2. **Plannings** : refonte du générateur de séances, vue calendrier visuelle, gestion absences
3. **Facturation** : tarification par forfait/assurance, facturation automatique, suivi solde patient
4. **Interface infirmier** : vue tablette temps réel pendant la séance
5. **Dashboard médecin** : vue globale des postes, alertes, indicateurs cliniques
6. **Portail patient** : accès web/mobile aux séances, bilans, RDV, ordonnances, factures

### Utilisateurs
| Rôle | Device | Interface |
|---|---|---|
| Médecin néphrologue | PC bureau | Dashboard + dossier patient |
| Infirmier | Tablette (pendant séance) | Interface séance temps réel |
| Secrétaire | PC | Planning + facturation |
| Patient | Téléphone / navigateur | Portail web responsive |

### Périmètre clinique
- 50 à 150 patients dialysés
- 150 à 500 séances par semaine

---

## 2. Architecture globale

### Nouveaux modules à créer
```
acs_hms_nephrology (existant — améliorations profondes)
│
├── acs_hms_nephrology_bilans           [NOUVEAU]
├── acs_hms_nephrology_complications    [NOUVEAU]
├── acs_hms_nephrology_dashboard        [NOUVEAU - OWL]
├── acs_hms_nephrology_portal           [NOUVEAU]
├── acs_hms_nephrology_billing          [NOUVEAU]
└── acs_hms_nephrology_fr_custom        (existant — étendu)
```

### Dépendances
```
acs_hms_base
    └── acs_hms
            └── acs_hms_nephrology
                    ├── acs_hms_nephrology_bilans
                    ├── acs_hms_nephrology_complications
                    ├── acs_hms_nephrology_billing
                    ├── acs_hms_nephrology_dashboard
                    │       ├── dépend de bilans
                    │       └── dépend de complications
                    └── acs_hms_nephrology_portal
                            ├── dépend de bilans
                            ├── dépend de billing
                            └── dépend de website (Odoo natif)
```

### Navigation par rôle
- **Médecin** : Dashboard jour → dossier patient → consultation → rapports
- **Infirmier** : Liste patients du jour → fiche séance interactive → validation fin
- **Secrétaire** : Planning → facturation → rappels WhatsApp
- **Patient** : Portail → séances → bilans → RDV → ordonnances → factures

---

## 3. Suivi clinique étendu (Priorité A)

### 3.1 Séance d'hémodialyse améliorée (`acs_hms_nephrology`)

**Champs ajoutés à `acs.patient.procedure` :**

**Avant la séance**
- `arrival_status` (selection) : Normal / Fatigué / Douleur / Fièvre / Autre
- `pre_dialysis_bp` (Char) : Tension artérielle pré-dialyse (obligatoire)
- `pre_dialysis_temp` (Float) : Température pré-dialyse
- `parameter_change_reason` (Text) : Motif si changement de protocole habituel

**Signes vitaux étendus (`hemodialysis.vital.sign`)**
- Ajout `spo2` (Float) : SpO2 (%)
- Ajout `temperature` (Float) : Température (°C)
- Ajout `glycemia` (Float) : Glycémie si patient diabétique
- Alerte automatique si TA systolique < 90 mmHg → badge "HYPOTENSION"
- Horodatage automatique à la saisie

**Fin de séance**
- `departure_weight` (Float) : Poids sortie
- `actual_uf` (Float) : UF réelle calculée automatiquement (poids arrivée - poids sortie)
- `actual_duration` (Float) : Durée effective (heure début → heure fin)
- `global_tolerance` (selection) : Bonne / Moyenne / Mauvaise
- `ktv_calculated` (Float) : KT/V calculé automatiquement (formule Daugirdas II)
- `ktv_status` (selection) : Adéquat (≥1.2) / Insuffisant (<1.2) — badge coloré
- `urr_calculated` (Float) : URR calculé automatiquement
- `end_notes` (Text) : Notes de fin de séance

**Formule KT/V Daugirdas II**
```
Kt/V = -ln(R - 0.008×t) + (4 - 3.5×R) × UF/W
R = urée post / urée pré
t = durée en heures
UF = ultrafiltration en litres
W = poids post-dialyse en kg
```

**Suivi poids sec (historique)**
- Nouveau modèle `acs.dry.weight.history` : patient, date, valeur, modifié par, motif

### 3.2 Bilans biologiques (`acs_hms_nephrology_bilans`)

**Modèle principal : `acs.nephro.bilan`**
- Patient, date, médecin prescripteur
- Type : Mensuel / Trimestriel / Semestriel / Annuel / Ponctuel
- Pièces jointes PDF laboratoire

**Groupes de paramètres**

| Groupe | Paramètres | Unité | Valeur cible |
|---|---|---|---|
| Hématologie | Hémoglobine, Hématocrite, GB, Plaquettes, Ferritine | g/dL, %, G/L, µg/L | Hb 10–12 g/dL |
| Biochimie rénale | Créatinine, Urée pré, Urée post, Acide urique | µmol/L, mmol/L | — |
| Électrolytes | Na, K, Ca, P, HCO3, Rapport CaxP | mmol/L | K < 5.5, P 1.1–1.8 |
| Minéraux-os | PTH, Vit D, PAL | pg/mL, ng/mL, UI/L | PTH 150–300 |
| Nutrition/Inflammation | Albumine, Protéines totales, CRP, Pré-albumine | g/L, mg/L | Albumine > 35 |
| Sérologies (annuel) | HBsAg, Anti-HBs, Anti-HBc, Anti-VHC, Anti-VIH | — | — |

**Valeurs cibles paramétrables** : menu configuration → seuils modifiables par le médecin

**Badges automatiques** : vert (dans cible) / orange (limite) / rouge (hors cible)

**Alerte bilans en retard** : cron quotidien → liste patients sans bilan depuis > 30 jours

**Courbes d'évolution** : composant OWL sur fiche patient → graphique ligne 12 mois par paramètre avec trait pointillé cible

### 3.3 Postes de dialyse (`acs_hms_nephrology` — module de base)

> ⚠️ `acs.dialysis.station` est défini dans `acs_hms_nephrology` (module parent) car il est référencé par le planning (`acs.nephrology.schedule`) et les séances. Le placer dans un module enfant créerait une dépendance circulaire.

**Modèle : `acs.dialysis.station`**
- `name` : Nom/numéro (ex: "Poste 3 - Salle B")
- `room` : Salle / Secteur
- `station_type` (selection) : Standard / Isolement
- `active` (Boolean) : actif ou en maintenance
- `equipment_model` (Char) : modèle du générateur

### 3.4 Complications per-séance (`acs_hms_nephrology_complications`)

**Modèle : `acs.dialysis.complication`**
- `procedure_id` : lien séance
- `complication_type` (selection) : Hypotension / Crampes / Nausées-Vomissements / Douleur thoracique / Fièvre / Prurit / Arrêt prématuré / Autre
- `occurrence_time` (Datetime) : heure de survenue
- `bp_at_occurrence` (Char) : TA au moment de la complication
- `action_taken` (Text) : action prise
- `resolution` (selection) : Oui / Non / Partielle
- `early_stop_duration` (Integer) : durée arrêt en minutes si arrêt prématuré

### 3.5 Consultation néphro inter-séances

**Ordonnance type néphro** (extension `acs_hms`) :
- EPO / Aranesp (dose, fréquence, voie)
- Fer IV (dose par séance)
- Vitamine D active (dose)
- Chélateurs de phosphore
- Antihypertenseurs, diurétiques

**Traçabilité complète** : ordonnance → séance → bilan (liens Many2one croisés)

---

## 4. Plannings et RDV (Priorité B)

### 4.1 Planning amélioré (`acs.nephrology.schedule` étendu)

Champs ajoutés :
- `station_id` (Many2one → `acs.dialysis.station`) : poste de dialyse
- `physician_id` (Many2one → `hms.physician`) : médecin référent du créneau
- `nurse_ids` (Many2many → `res.users`) : infirmiers assignés
- `max_patients` (Integer) : capacité max → alerte si dépassée

### 4.2 Générateur de séances massif (refonte)

**Wizard `nephrology.session.generator` en 4 étapes :**

1. **Sélection patients** : checkbox multi-sélection, filtres par planning / médecin
2. **Période** : date début/fin, exclusion jours fériés (paramétrable), prévisualisation compte
3. **Paramètres** : poste par patient, médecin/infirmier, duplication paramètres dernière séance, création RDV agenda
4. **Validation** : tableau récapitulatif avec détection conflits (poste occupé, RDV existant) en orange → bouton "Confirmer et créer tout"

### 4.3 Vue planning visuel (OWL — `acs_hms_nephrology_dashboard`)

**Mode Jour** : colonnes par poste, carte patient colorée (vert/orange/rouge/bleu), clic → fiche séance

**Mode Semaine** : ligne par patient, colonnes jours

**Mode Mois** : vue synthétique, taux occupation postes

**Actions** : drag & drop, clic droit (annuler/reporter/voir dossier), indicateur taux occupation

### 4.4 Gestion absences et reports

**Modèle `acs.dialysis.absence`** :
- `patient_id`, `start_date`, `end_date`
- `reason` (selection) : Hospitalisation / Voyage / Refus / Décès / Autre
- Séances annulées → statut "Absence justifiée"
- WhatsApp automatique à la reprise

**Report de séance** : ancienne date → nouvelle date + vérification poste + WhatsApp patient

**Liste d'attente** : si poste saturé → file d'attente + notification automatique si libération

### 4.5 Widget résumé du jour (OWL — secrétaire)

Affiche : nb patients matin/après-midi, nb postes occupés, confirmés / non confirmés / absents / reportés

---

## 5. Interface infirmier tablette (`acs_hms_nephrology_dashboard`)

### Accès
- Route dédiée : `/dialyse/infirmier`
- Vue optimisée tactile (grands boutons, lisible à 50cm)
- Responsive tablette Android/iPad via navigateur
- Authentification Odoo unifiée
- Filtre automatique sur poste/salle de l'infirmier connecté

### Écran 1 — Liste patients du jour
Tableau : Poste / Patient / Arrivé / Statut / Action

Actions rapides : [Marquer arrivée] / [Démarrer séance] / [Signaler absence]

### Écran 2 — Fiche séance en cours
- Saisie poids arrivée → calcul automatique UF prévue et prise interdialytique
- Paramètres séance : débit sanguin, débit dialysat, rein, anticoagulation
- Signes vitaux 6 mesures : TA, FC, FR, SpO2, Température, Glycémie
- Rappel automatique toutes les 30 min (notification + son + vibration)
- Alerte visuelle instantanée si TA systolique < 90 mmHg → champ rouge + badge

### Écran 3 — Saisie complication (popup tactile)
- Boutons type de complication (grands, tactiles)
- TA au moment, action prise, résolution
- Horodatage automatique
- Alerte transmise immédiatement au dashboard médecin

### Écran 4 — Fin de séance
- Poids sortie → UF réelle calculée
- Durée effective
- KT/V et URR calculés automatiquement avec badge adéquation
- Tolérance globale
- Résumé complications
- Bouton [VALIDER LA SÉANCE] → statut "Terminée", facturation auto, WhatsApp patient

---

## 6. Dashboard médecin (`acs_hms_nephrology_dashboard`)

### Vue principale
- KPIs jour / semaine / mois (nb séances)
- Compteur alertes actives (rouge / orange)
- Tableau postes temps réel : poste, patient, statut, durée en cours, KT/V (si terminé), alerte

### Panel alertes (sidebar)
- 🔴 Critique : TA < 90, arrêt prématuré, complication non résolue
- ⚠️ Attention : KT/V < 1.2, bio anormale, absence non justifiée, bilan en retard
- Actions depuis le panel : voir séance, marquer traitée, planifier consultation

### Slide panel dossier patient (sans quitter le dashboard)
- Informations clés : âge, groupe sanguin, durée dialyse, planning, médecin
- Dernière séance : durée, KT/V, UF, tolérance, complications
- Bilans récents : valeurs clés avec badges colorés
- Poids sec + date dernière modification
- Traitement en cours (EPO, Fer IV)
- Boutons : ouvrir dossier complet / prescrire / voir historique / planifier consultation

### Graphiques mensuels (OWL)
- KT/V moyen + évolution vs mois précédent
- Taux séances adéquates (KT/V ≥ 1.2)
- Complications par type sur 6 mois
- Taux occupation postes par jour de semaine
- Bilans en retard + sérologies à renouveler

### Dashboard secrétaire (simplifié)
- Planning du jour (arrivées, absences)
- Facturation en attente
- Rappels WhatsApp à envoyer
- Absences à traiter

---

## 7. Facturation (`acs_hms_nephrology_billing`)

### 7.1 Tarification

**Modèle `acs.dialysis.pricing.rule`** :
- Nom (ex: "Forfait IPRES", "AMU", "Privé", "Indigent")
- Prix HT, taux TVA
- Taux couverture assurance (%)
- Part patient (%)
- Actif/Inactif

Lié au patient via `Many2one` → règle tarifaire appliquée automatiquement à chaque facturation

### 7.2 Facturation automatique

**Depuis la séance** : bouton "Facturer" → `account.move` avec :
- Ligne service hémodialyse (product)
- Lignes consommables utilisés
- Prix selon règle tarifaire patient
- Part assurance déduite automatiquement

**Facturation groupée (wizard)** :
- Sélection patients + période
- Tableau prévisualisation : séances / montant / assurance / net dû
- Bouton "Créer toutes les factures"

**Consommables** : rein artificiel, lignes de sang, aiguilles, EPO/Fer IV injectés → ajoutés automatiquement à la facture depuis `consumable_line_ids`

### 7.3 Suivi financier patient

- Solde actuel (factures dues - paiements)
- Historique : date / séance / montant / payé / reste / statut
- Encaissement rapide : Espèces / Virement / Chèque / Mobile Money (Wave, Orange Money)
- Badge statut : ✅ À jour / ⚠️ Retard / 🔴 Impayé
- Acomptes et plans de paiement échelonnés
- Alerte automatique si impayé > X jours (paramétrable)

**Gestion assureurs** :
- Dossier remboursement par assureur
- Récapitulatif séances couvertes + montant à réclamer
- Statut : En attente / Soumis / Remboursé / Rejeté
- Export listing assureur (PDF ou Excel)

### 7.4 Rapports financiers

- Rapport mensuel : CA total, encaissé vs attente, répartition par assureur, top impayés, évolution 12 mois
- Rapport patient PDF : récapitulatif annuel + attestation de soins
- Export Excel global : toutes séances d'une période

---

## 8. Portail patient (`acs_hms_nephrology_portal`)

### Accès
- URL : `https://votre-clinique.com/mon-espace`
- Portail natif Odoo (module `website`)
- Responsive mobile
- Création de compte par la secrétaire → invitation WhatsApp/email automatique

### Pages

**Accueil** : résumé prochain RDV, dernière séance, dernier bilan, solde, messages clinique

**Mes séances** :
- Historique tableau : date / durée / KT/V / UF / tolérance
- Détail séance : signes vitaux, paramètres, complications, notes
- Téléchargement CR PDF
- Langage simplifié : "Votre séance a été efficace" au lieu de KT/V brut (configurable)

**Mes bilans** :
- Tableau résultats avec colonne "Normal" et badge statut
- Message automatique si valeurs anormales : "Votre médecin a été informé"
- Graphique évolution 6 mois (mobile)
- Visibilité des paramètres configurable par le médecin

**Mes RDV** :
- Liste prochaines séances avec poste et médecin
- Bouton [Je ne pourrai pas venir] → motif + notification secrétaire + confirmation WhatsApp
- Rappels automatiques WhatsApp : J-1 à 18h et J à 6h30

**Mes ordonnances** : liste actives, aperçu médicaments/posologies, téléchargement PDF

**Mes factures** : solde, historique, téléchargement PDF facture et attestation de soins annuelle

---

## 9. Ordre de livraison (Sprints)

### Sprint 1 — Fondations cliniques (3-4 semaines)
- `acs_hms_nephrology` améliorations (séance enrichie, KT/V auto, poids sec historique)
- `acs_hms_nephrology_complications` (complications + postes de dialyse)
- `acs_hms_nephrology_bilans` (bilans biologiques complets)

### Sprint 2 — Interface & Planning (3-4 semaines)
- `acs_hms_nephrology_dashboard` — Interface infirmier tablette (OWL)
- `acs_hms_nephrology_dashboard` — Dashboard médecin (OWL)
- `acs_hms_nephrology` — Générateur séances refondu + vue calendrier (OWL)

### Sprint 3 — Facturation & Portail (3-4 semaines)
- `acs_hms_nephrology_billing` (tarification, facturation auto, suivi financier)
- `acs_hms_nephrology_portal` (portail patient complet)
- `acs_hms_nephrology_fr_custom` — extension traductions FR

---

## 10. Contraintes techniques

- **Odoo 19** en production (Docker) — aucune migration de données
- **OWL** (Odoo Web Library) pour tous les composants interactifs
- **Bus Odoo** (longpolling) pour les alertes temps réel dashboard médecin
- **Pas de LLM local** — VPS déjà chargé (9 instances Odoo + 9 PostgreSQL)
- **WhatsApp** via WasenderAPI (module `acs_hms_whatsapp` existant)
- **Exports** : PDF via QWeb (natif Odoo), Excel via `xlsxwriter` (disponible dans Odoo)
- Tous les modules doivent être **non-destructifs** vis-à-vis des modules ACS existants
