# NephroSys Phase 3a — Opérations & Reporting

## Objectif

Ajouter les modules opérationnels à NephroSys : catalogue d'articles, facturation des séances de dialyse, tableaux de bord par rôle, et rapports PDF. Ces modules complètent le workflow clinique de la Phase 2 avec la gestion financière et le pilotage du centre.

## Stack existant

- Next.js 16 App Router, React 19, TypeScript strict
- tRPC v11, Drizzle ORM, PostgreSQL 16
- Auth.js v5 (JWT), 6 rôles : admin, medecin, infirmiere, secretaire, facturation, patient
- Tailwind CSS v4, dark mode
- `roleProcedure` pour le RBAC sur chaque endpoint tRPC

## Dépendances nouvelles

- `@react-pdf/renderer` — génération PDF côté serveur

## Global Constraints

- TypeScript strict, aucun `any`
- Labels UI en français, sans accents dans le code (noms de variables, enums)
- Dark mode obligatoire (classes `dark:`)
- YAGNI — pas de fonctionnalités non décrites ici
- Tests unitaires pour les calculs et validateurs, `pnpm tsc --noEmit` pour vérification
- snake_case pour les colonnes DB, camelCase pour TypeScript
- Les prix sont en FCFA, stockés en decimal(12,2)

---

## Module 1 : Catalogue d'articles

### Table `articles`

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| nom | varchar(200) | NOT NULL |
| categorie | enum `categorie_article` | `medicament`, `consommable`, `acte_medical` — NOT NULL |
| prix_unitaire | decimal(12,2) | NOT NULL |
| unite | varchar(50) | NOT NULL — ex: mg, ml, unité, séance |
| voie_administration | varchar(50) | NULLABLE — IV, SC, PO, IM — uniquement pertinent pour médicaments |
| is_active | boolean | NOT NULL, default true |
| created_at | timestamp | NOT NULL, default now() |
| updated_at | timestamp | NOT NULL, default now() |

### Enum `categorie_article`

Valeurs : `medicament`, `consommable`, `acte_medical`

### Router `articles`

| Procédure | Rôles | Description |
|---|---|---|
| list | admin, medecin, infirmiere, facturation | Liste tous les articles, filtrable par catégorie et statut actif |
| getById | admin, medecin, infirmiere, facturation | Détail d'un article |
| create | admin | Créer un article |
| update | admin | Modifier un article |
| toggleActive | admin | Activer/désactiver |

### Validators

```
createArticleSchema:
  nom: string, min 1, max 200
  categorie: enum ['medicament', 'consommable', 'acte_medical']
  prixUnitaire: number, positive
  unite: string, min 1, max 50
  voieAdministration: string, max 50, optional

updateArticleSchema: createArticleSchema.partial() + id: uuid
```

### UI

Page `/admin/articles` :
- Tableau avec colonnes : Nom, Catégorie, Prix unitaire, Unité, Statut
- Filtre par catégorie (select)
- Bouton "Nouvel article" → formulaire inline ou modal
- Bouton Activer/Désactiver par ligne
- Badge catégorie coloré : médicament=bleu, consommable=vert, acte=violet

---

## Module 2 : Facturation

### Table `factures`

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| reference | varchar(30) | NOT NULL, UNIQUE — format `FAC-YYYYMMDD-NNN` |
| session_id | uuid | FK → dialysis_sessions.id, NOT NULL |
| patient_id | uuid | FK → patients.id, NOT NULL |
| date_facture | date | NOT NULL |
| montant_base | decimal(12,2) | NOT NULL — forfait séance |
| montant_supplements | decimal(12,2) | NOT NULL, default 0 |
| montant_total | decimal(12,2) | NOT NULL — base + supplements |
| statut | enum `statut_facture` | NOT NULL, default 'brouillon' |
| mode_paiement | enum `mode_paiement` | NULLABLE |
| date_paiement | timestamp | NULLABLE |
| notes | text | NULLABLE |
| created_by | uuid | FK → users.id, NOT NULL |
| created_at | timestamp | NOT NULL, default now() |
| updated_at | timestamp | NOT NULL, default now() |

### Table `lignes_facture`

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| facture_id | uuid | FK → factures.id, NOT NULL, ON DELETE CASCADE |
| article_id | uuid | FK → articles.id, NULLABLE — null pour la ligne forfait |
| designation | varchar(200) | NOT NULL — libellé copié |
| quantite | decimal(10,2) | NOT NULL, default 1 |
| prix_unitaire | decimal(12,2) | NOT NULL — prix copié au moment de la facturation |
| montant | decimal(12,2) | NOT NULL — quantité × prix unitaire |
| created_at | timestamp | NOT NULL, default now() |

### Enums

**`statut_facture`** : `brouillon`, `validee`, `payee`, `annulee`

**`mode_paiement`** : `especes`, `cheque`, `virement`, `mobile_money`

### Table `tarifs_base`

Stockée dans la configuration existante (`seuils_cliniques` ou nouvelle table simple) :

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK |
| label | varchar(100) | NOT NULL — "Tarif séance standard", "Tarif séance VIP" |
| code | varchar(50) | NOT NULL, UNIQUE — `tarif_standard`, `tarif_vip` |
| montant | decimal(12,2) | NOT NULL |
| updated_at | timestamp | NOT NULL |

Seeded avec 2 lignes : `tarif_standard` = 25000, `tarif_vip` = 40000.

### Router `factures`

| Procédure | Rôles | Description |
|---|---|---|
| list | admin, facturation, medecin, infirmiere, secretaire | Liste paginée, filtres : statut, dateDebut, dateFin, patientId |
| getById | admin, facturation, medecin, infirmiere, secretaire | Détail avec lignes |
| generate | admin, facturation | Génère une facture brouillon depuis une séance terminée. Crée la facture + ligne forfait (standard/VIP selon poste). Erreur si la séance a déjà une facture. |
| addLigne | admin, facturation | Ajoute une ligne supplément (articleId, quantité). Recalcule montantSupplements et montantTotal. Uniquement si statut = brouillon. |
| removeLigne | admin, facturation | Supprime une ligne (sauf forfait). Recalcule les montants. Brouillon uniquement. |
| valider | admin, facturation | Passe de brouillon à validée. Verrouille les modifications. |
| enregistrerPaiement | admin, facturation | Enregistre le mode de paiement et la date. Passe à payée. Uniquement si validée. |
| annuler | admin | Annule une facture (brouillon ou validée). |
| stats | admin, facturation | Retourne : CA jour/semaine/mois, nb factures par statut, montant impayé total |

### Validators

```
generateFactureSchema:
  sessionId: uuid

addLigneSchema:
  factureId: uuid
  articleId: uuid
  quantite: number, positive, default 1

removeLigneSchema:
  ligneId: uuid

enregistrerPaiementSchema:
  factureId: uuid
  modePaiement: enum ['especes', 'cheque', 'virement', 'mobile_money']

factureListSchema:
  page: number, default 1
  perPage: number, default 20
  statut: enum, optional
  dateDebut: string regex YYYY-MM-DD, optional
  dateFin: string regex YYYY-MM-DD, optional
  patientId: uuid, optional
```

### Workflow facture

```
séance terminée → [Générer facture] → brouillon
  → ajouter/supprimer suppléments
  → [Valider] → validée (lecture seule)
  → [Enregistrer paiement] → payée
  
À tout moment (brouillon/validée) → [Annuler] → annulée (admin only)
```

### UI

**`/facturation`** — Liste des factures :
- Tableau : Référence, Patient, Date, Montant total, Statut, Actions
- Filtres : statut (select), période (date début/fin), patient
- Badges statut : brouillon=gris, validée=bleu, payée=vert, annulée=rouge
- Totaux en bas : CA affiché, montant impayé

**`/facturation/[id]`** — Détail facture :
- En-tête : référence, patient, date, séance liée
- Tableau des lignes : désignation, quantité, prix unitaire, montant
- Si brouillon : formulaire ajout supplément (select article + quantité), bouton supprimer par ligne
- Boutons d'action selon statut : Valider, Enregistrer paiement (avec select mode), Annuler
- Montants : base, suppléments, total

**Bouton sur `/seances/[id]`** :
- Si séance terminée et pas de facture : bouton "Générer la facture"
- Si facture existe : lien "Voir la facture"

---

## Module 3 : Tableaux de bord

### Router `dashboard`

| Procédure | Rôles | Description |
|---|---|---|
| adminStats | admin, facturation | CA jour/semaine/mois, nb séances aujourd'hui par statut, taux occupation postes, factures impayées (nb + montant), top 5 articles facturés ce mois |
| medecinStats | medecin | Mes séances du jour, patients avec Kt/V inadéquat (3 dernières séances), bilans hors seuils (nb + liste), taux adéquation Kt/V global |
| infirmiereStats | infirmiere | Séances du jour (mes patients), séances en cours nécessitant constantes, prochaines séances planifiées (aujourd'hui + demain) |
| secretaireStats | secretaire | Séances du jour (vue d'ensemble), patients sans séance cette semaine, nb nouveaux patients ce mois |

### Calculs

**Taux d'occupation postes** : (nb séances aujourd'hui) / (nb postes actifs × 2 vacations) × 100

**Taux d'adéquation Kt/V** : (nb séances terminées avec ktv_status = 'adequate') / (nb séances terminées avec ktv_status non null) × 100

**Patients Kt/V inadéquat** : patients dont les 3 dernières séances terminées ont toutes `ktv_status = 'inadequate'`

**Séances nécessitant constantes** : séances en_cours dont la dernière constante date de plus de 30 minutes

### UI

Page `/` (dashboard) :
- Détecte `session.user.role`
- Affiche le composant correspondant : `AdminDashboard`, `MedecinDashboard`, `InfirmiereDashboard`, `SecretaireDashboard`
- Rôle `facturation` → `AdminDashboard`
- Rôle `patient` → message "Portail patient bientôt disponible"

**Chaque widget** est un composant isolé avec :
- Son propre `useQuery` vers la procédure dashboard correspondante
- Un skeleton de chargement
- Une Card avec titre + contenu

**Layout des dashboards** :
- Grid responsive : 1 col mobile, 2 cols tablette, 3-4 cols desktop
- Widgets cliquables quand pertinent (ex: "Bilans hors seuils" → lien vers `/bilans?statut=hors_seuil`)

---

## Module 4 : Rapports PDF

### Routes API

**`/api/reports/patient/[id]`** (GET) :
- RBAC : admin, medecin, secretaire
- Génère un PDF avec `@react-pdf/renderer`
- Contenu :
  - En-tête : logo/nom du centre, date de génération
  - Informations patient : nom, prénom, date naissance, groupe sanguin, néphropathie initiale, poids sec
  - Tableau des 10 dernières séances : date, poste, durée effective, Kt/V, URR, poids arrivée, poids départ, tolérance
  - Dernier bilan biologique : paramètres avec valeur, seuil, statut (normal/bas/haut)
  - Évolution Kt/V : liste des 10 dernières valeurs avec date

**`/api/reports/monthly/[month]`** (GET) :
- Paramètre `month` au format `YYYY-MM`
- RBAC : admin uniquement
- Contenu :
  - En-tête : "Rapport d'activité — [mois année]"
  - Nombre total de séances (planifiées, réalisées, annulées)
  - Taux d'occupation moyen des postes
  - CA total : factures payées + impayées, répartition par mode de paiement
  - Nombre de patients actifs (au moins 1 séance ce mois)
  - Taux d'adéquation Kt/V moyen

### UI

**Bouton "Exporter PDF"** sur `/patients/[id]` — ouvre le PDF dans un nouvel onglet

**Page `/admin/rapports`** :
- Sélecteur de mois (input type month)
- Bouton "Générer le rapport mensuel"
- Ouvre le PDF dans un nouvel onglet

---

## Relations entre modules

```
articles ←── lignes_facture ──→ factures ──→ dialysis_sessions
                                    │
                                    └──→ patients
```

- La facturation dépend du catalogue (articles) et des séances (sessions)
- Le dashboard dépend de tous les modules existants (séances, bilans, factures)
- Les rapports dépendent de séances, bilans, factures
- Le catalogue est indépendant — doit être implémenté en premier

## Ordre d'implémentation recommandé

1. Catalogue d'articles (fondation)
2. Facturation (dépend du catalogue)
3. Tableaux de bord (dépend de tout)
4. Rapports PDF (dépend de tout)

---

## Hors scope (Phase 3b)

- Prescriptions médicamenteuses (médecin prescrit depuis le catalogue)
- Portail patient (lecture seule : séances, bilans, factures)
- Gestion de stock (v2)
