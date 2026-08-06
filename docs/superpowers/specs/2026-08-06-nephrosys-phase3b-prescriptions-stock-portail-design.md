# NephroSys Phase 3b — Prescriptions, Stock & Portail Patient

## Objectif

Completer NephroSys avec les prescriptions medicamenteuses (per-seance et ordonnances de fond), la gestion de stock avec tracabilite par lot et par patient (FIFO), et un portail patient en lecture seule. Ces modules s'appuient sur le catalogue d'articles et la facturation de la Phase 3a.

## Stack existant

- Next.js 16 App Router, React 19, TypeScript strict
- tRPC v11, Drizzle ORM, PostgreSQL 16
- Auth.js v5 (JWT), 6 roles actuels : admin, medecin, infirmiere, secretaire, facturation, patient
- Tailwind CSS v4, dark mode
- `roleProcedure` pour le RBAC sur chaque endpoint tRPC
- Catalogue d'articles (medicament, consommable, acte_medical)
- Facturation avec workflow brouillon/validee/payee/annulee
- Dashboards par role, rapports PDF

## Nouveau role

Ajouter `gestionnaire_stock` a l'enum `user_role`. Ce role gere le stock, les lots, les mouvements et les seuils d'alerte.

## Global Constraints

- TypeScript strict, aucun `any`
- Labels UI en francais, sans accents dans le code (noms de variables, enums)
- Dark mode obligatoire (classes `dark:`)
- YAGNI — pas de fonctionnalites non decrites ici
- Tests unitaires pour les calculs et validateurs, `pnpm tsc --noEmit` pour verification
- snake_case pour les colonnes DB, camelCase pour TypeScript
- Les prix sont en FCFA, stockes en decimal(12,2)
- Les quantites en decimal(10,2)
- All timestamps with timezone: `timestamp('x', { withTimezone: true })`
- UUIDs as primary keys with `.defaultRandom()`

---

## Module 1 : Gestion de stock

### Enum `type_mouvement`

Valeurs : `entree`, `sortie`, `ajustement`

### Enum `statut_prescription`

Valeurs : `prescrite`, `administree`, `annulee`

### Table `lots`

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| article_id | uuid | FK → articles.id, NOT NULL |
| numero_lot | varchar(100) | NOT NULL |
| date_peremption | date | NOT NULL |
| quantite_initiale | decimal(10,2) | NOT NULL |
| quantite_disponible | decimal(10,2) | NOT NULL |
| created_by | uuid | FK → users.id, NOT NULL |
| created_at | timestamp | NOT NULL, default now() |

### Table `mouvements_stock`

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| article_id | uuid | FK → articles.id, NOT NULL |
| lot_id | uuid | FK → lots.id, NULLABLE — null pour ajustements negatifs sans lot |
| type_mouvement | enum `type_mouvement` | NOT NULL |
| quantite | decimal(10,2) | NOT NULL — positif pour entree, negatif pour sortie/ajustement |
| motif | varchar(200) | NULLABLE |
| session_id | uuid | FK → dialysis_sessions.id, NULLABLE |
| patient_id | uuid | FK → patients.id, NULLABLE |
| created_by | uuid | FK → users.id, NOT NULL |
| created_at | timestamp | NOT NULL, default now() |

### Table `seuils_stock`

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| article_id | uuid | FK → articles.id, NOT NULL, UNIQUE |
| seuil_min | decimal(10,2) | NOT NULL |
| updated_at | timestamp | NOT NULL, default now() |

### Logique FIFO

Quand une sortie est demandee (prescription per-seance ou sortie manuelle) :

1. Chercher les lots de l'article avec `quantite_disponible > 0`, tries par `date_peremption ASC` (FEFO, couvre le FIFO pour des lots recus chronologiquement)
2. Decrementer `quantite_disponible` du premier lot
3. Si le lot ne suffit pas, passer au suivant (multi-lots)
4. Creer un `mouvement_stock` par lot touche, avec `type_mouvement = 'sortie'`
5. Si stock total insuffisant : erreur `STOCK_INSUFFISANT` avec quantite disponible

### Alertes

- **Stock bas** : articles dont `SUM(quantite_disponible)` de tous lots actifs < `seuil_min` de `seuils_stock`
- **Peremption proche** : lots avec `date_peremption` dans les 30 prochains jours et `quantite_disponible > 0`
- **Badge menu** : compteur rouge dans le menu lateral "Stock" = nb articles en alerte stock bas + nb lots peremption proche

### Router `stock`

| Procedure | Roles | Description |
|---|---|---|
| etatStock | admin, gestionnaire_stock, infirmiere | Liste articles avec stock actuel (SUM lots), seuil, statut alerte. Filtrable par categorie |
| lotsByArticle | admin, gestionnaire_stock | Lots d'un article avec quantites, tries par date peremption |
| mouvements | admin, gestionnaire_stock | Historique mouvements pagine, filtrable par article, type, date |
| entree | admin, gestionnaire_stock | Reception : cree un lot + mouvement entree. Input : articleId, numeroLot, datePeremption, quantite |
| sortieManuelle | admin, gestionnaire_stock, infirmiere | Sortie manuelle FIFO. Input : articleId, quantite, motif. Cree mouvement(s) sortie |
| ajustement | admin, gestionnaire_stock | Ajustement d'inventaire (positif ou negatif). Input : articleId, lotId (pour positif), quantite, motif |
| setSeuil | admin, gestionnaire_stock | Definir/modifier seuil d'alerte. Input : articleId, seuilMin. Upsert sur seuils_stock |
| alertes | admin, gestionnaire_stock | Retourne : articles en stock bas (nom, stock actuel, seuil) + lots peremption proche (article, lot, date, quantite) |
| alertesCount | admin, gestionnaire_stock, infirmiere | Retourne juste le nombre total d'alertes (pour le badge menu) |

### Validators

```
entreeStockSchema:
  articleId: uuid
  numeroLot: string, min 1, max 100
  datePeremption: string regex YYYY-MM-DD
  quantite: number, positive

sortieManuelleSchema:
  articleId: uuid
  quantite: number, positive
  motif: string, min 1, max 200

ajustementSchema:
  articleId: uuid
  lotId: uuid, optional (requis si quantite positive)
  quantite: number (peut etre negatif)
  motif: string, min 1, max 200

setSeuilSchema:
  articleId: uuid
  seuilMin: number, positive
```

### UI

**`/stock`** — Etat du stock :
- Tableau : Article, Categorie, Stock disponible, Seuil, Statut
- Filtre par categorie (select)
- Badge statut : normal=vert, alerte=orange, rupture=rouge
- Bouton "Definir seuil" par ligne (modal/inline)
- Lien vers detail par clic sur la ligne

**`/stock/[articleId]`** — Detail article :
- En-tete : nom article, stock total, seuil
- Tableau des lots : numero, date peremption, quantite initiale, quantite dispo, badge peremption
- Formulaire "Nouvelle entree" : numero lot, date peremption, quantite
- Formulaire "Sortie manuelle" : quantite, motif
- Formulaire "Ajustement" : lot (select), quantite (+/-), motif
- Historique mouvements : type, quantite, motif, date, utilisateur

**`/stock/alertes`** — Alertes actives :
- Section "Stock bas" : tableau articles en alerte avec stock actuel et seuil
- Section "Peremption proche" : tableau lots expirant dans 30 jours

**Badge menu** : le composant sidebar existant doit afficher un badge rouge a cote de "Stock" avec le compteur d'alertes (query `alertesCount`).

**Dashboard** : le role `gestionnaire_stock` n'a pas de dashboard dedie. Le composant `DashboardClient` existant doit afficher un message "Accedez a la gestion du stock via le menu" (meme pattern que le role `patient` actuellement). Le `gestionnaire_stock` accede directement aux pages `/stock`.

---

## Module 2 : Prescriptions

### Table `prescriptions_seance`

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| session_id | uuid | FK → dialysis_sessions.id, NOT NULL |
| article_id | uuid | FK → articles.id, NOT NULL |
| patient_id | uuid | FK → patients.id, NOT NULL |
| quantite | decimal(10,2) | NOT NULL |
| posologie | varchar(200) | NULLABLE — instructions d'administration |
| statut | enum `statut_prescription` | NOT NULL, default 'prescrite' |
| lot_id | uuid | FK → lots.id, NULLABLE — renseigne a l'administration |
| prescrit_par | uuid | FK → users.id, NOT NULL |
| created_at | timestamp | NOT NULL, default now() |
| updated_at | timestamp | NOT NULL, default now() |

### Table `ordonnances`

| Colonne | Type | Contraintes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| patient_id | uuid | FK → patients.id, NOT NULL |
| contenu | text | NOT NULL — texte libre de la prescription |
| date_prescription | date | NOT NULL |
| is_active | boolean | NOT NULL, default true |
| prescrit_par | uuid | FK → users.id, NOT NULL |
| created_at | timestamp | NOT NULL, default now() |
| updated_at | timestamp | NOT NULL, default now() |

### Workflow prescriptions per-seance

```
medecin ajoute prescription → statut 'prescrite'
  → seance terminee → auto: FIFO stock, lot_id renseigne → statut 'administree'
  → medecin annule avant fin → statut 'annulee'
```

**Integration avec `sessions.terminer`** : modifier la procedure existante pour, apres les traitements actuels :

1. Chercher toutes les `prescriptions_seance` de la seance avec `statut = 'prescrite'`
2. Pour chaque prescription :
   a. Tenter la decrementation FIFO du stock (meme logique que `stock.sortieManuelle`)
   b. Si succes : mettre `statut = 'administree'`, renseigner `lot_id`, creer `mouvement_stock` avec `session_id` et `patient_id`
   c. Si stock insuffisant : laisser `statut = 'prescrite'` (la seance se termine quand meme), la prescription reste en attente — visible comme alerte
3. La seance passe a `terminee` dans tous les cas

### Router `prescriptions`

| Procedure | Roles | Description |
|---|---|---|
| listBySession | admin, medecin, infirmiere | Prescriptions d'une seance avec article et lot |
| addToSession | medecin | Ajouter une prescription. Verifie : seance existe, statut planifiee ou en_cours, article actif, categorie medicament ou acte_medical |
| cancelPrescription | medecin | Annuler une prescription. Verifie : statut = prescrite, seance non terminee |
| ordonnancesList | admin, medecin, infirmiere, patient | Ordonnances d'un patient, triees par date DESC. Pour role patient : filtre auto sur son patient_id |
| ordonnanceCreate | medecin | Creer une ordonnance texte libre. Input : patientId, contenu |
| ordonnanceToggle | medecin | Activer/desactiver une ordonnance |

### Validators

```
addPrescriptionSchema:
  sessionId: uuid
  articleId: uuid
  quantite: number, positive
  posologie: string, max 200, optional

cancelPrescriptionSchema:
  prescriptionId: uuid

ordonnanceCreateSchema:
  patientId: uuid
  contenu: string, min 1

ordonnanceToggleSchema:
  ordonnanceId: uuid
```

### UI

**Onglet "Prescriptions"** dans `/seances/[id]` (nouvel onglet apres "Fin de seance") :
- Tableau : Article, Quantite, Posologie, Statut, Lot (si administre)
- Badges : prescrite=bleu, administree=vert, annulee=rouge
- Formulaire d'ajout (si seance non terminee et non verrouillee, role medecin) : select article (filtre medicament + acte_medical), quantite, posologie optionnelle
- Bouton annuler par ligne (si prescrite et seance non terminee)

**Onglet "Ordonnances"** dans `/patients/[id]` (nouvel onglet) :
- Liste des ordonnances avec : date, contenu (tronque), statut actif/inactif
- Badge : active=vert, inactive=gris
- Formulaire creation (role medecin) : textarea contenu
- Toggle activer/desactiver par ligne (role medecin)

---

## Module 3 : Portail patient

### Modification schema `patients`

Ajouter une colonne a la table `patients` :

| Colonne | Type | Contraintes |
|---|---|---|
| user_id | uuid | FK → users.id, NULLABLE, UNIQUE — lie le patient a un compte utilisateur |

Modifier le formulaire d'edition patient (admin) pour permettre l'association d'un compte utilisateur (select parmi les users avec role `patient` non encore associes).

### Router `portail`

| Procedure | Roles | Description |
|---|---|---|
| monProfil | patient | Infos patient : nom, prenom, date naissance, groupe sanguin, nephropathie, poids sec |
| mesSeances | patient | Seances du patient paginee, triees par date DESC. Colonnes : date, poste, statut, Kt/V |
| seanceDetail | patient | Detail d'une seance (constantes, tolerance, Kt/V). Verifie appartenance |
| mesBilans | patient | Bilans du patient, tries par date DESC |
| bilanDetail | patient | Detail bilan avec valeurs et statut (normal/bas/haut via seuils) |
| mesFactures | patient | Factures du patient (statut != brouillon). Colonnes : reference, date, montant, statut |
| mesOrdonnances | patient | Ordonnances actives du patient |

**Resolution patient_id** : chaque procedure fait `SELECT id FROM patients WHERE user_id = ctx.session.user.id`. Si aucun resultat, erreur `PROFIL_NON_CONFIGURE` ("Votre profil patient n'est pas encore configure. Contactez l'administration.").

### Layout portail

Layout separe du dashboard soignant. Pas de sidebar complexe — navigation simple :

- Header avec nom du patient + bouton deconnexion
- Navigation horizontale ou sidebar legere : Accueil, Seances, Bilans, Factures, Ordonnances
- Toutes les pages sont lecture seule, pas de formulaires

### UI

**`/portail`** — Accueil :
- Card "Prochaines seances" : 3 prochaines seances planifiees (date, poste)
- Card "Derniere ordonnance" : ordonnance active la plus recente (contenu tronque)
- Message de bienvenue avec nom du patient

**`/portail/seances`** — Mes seances :
- Tableau pagine : Date, Poste, Duree, Kt/V, Statut
- Clic sur une ligne → detail

**`/portail/seances/[id]`** — Detail seance :
- Infos generales : date, poste, medecin, duree
- Constantes enregistrees (tableau)
- Kt/V et URR si disponibles
- Tolerance globale

**`/portail/bilans`** — Mes bilans :
- Tableau : Date, Reference, nb parametres hors seuil
- Clic → detail

**`/portail/bilans/[id]`** — Detail bilan :
- Tableau parametres : nom, valeur, seuils, statut (badge normal/bas/haut)

**`/portail/factures`** — Mes factures :
- Tableau : Reference, Date, Montant total, Statut
- Pas de detail (lecture seule liste)

**`/portail/ordonnances`** — Mes ordonnances :
- Liste : Date, Contenu (complet), Medecin prescripteur

### Securite

- Toutes les procedures verifient que les donnees appartiennent au patient connecte
- Le patient ne voit jamais les factures `brouillon`
- Aucune mutation — lecture seule uniquement
- Le layout portail n'est accessible qu'au role `patient`

---

## Relations entre modules

```
articles ←── lots ←── mouvements_stock
    │            │
    │            └──→ prescriptions_seance ──→ dialysis_sessions
    │                        │
    └── seuils_stock         └──→ patients ←── ordonnances
                                     │
                                     └── user_id → users (portail)
```

- Le stock depend du catalogue (articles) — doit etre implemente en premier
- Les prescriptions dependent du stock (FIFO, lots) et des seances
- Le portail depend de tout (seances, bilans, factures, ordonnances) — en dernier
- La modification de `sessions.terminer` lie prescriptions et stock

## Ordre d'implementation recommande

1. Schema + enums + migration (nouveau role, tables lots/mouvements/seuils/prescriptions/ordonnances, colonne patients.user_id)
2. Stock router + validators + tests
3. Stock UI (etat, detail, alertes, badge menu)
4. Prescriptions router + validators + tests (inclut modification sessions.terminer)
5. Prescriptions UI (onglet seance + onglet ordonnances patient)
6. Portail router + validators
7. Portail layout + pages (accueil, seances, bilans, factures, ordonnances)
8. Association user-patient dans le formulaire d'edition patient

---

## Hors scope

- Notifications email
- Suivi des prises quotidiennes par le patient
- Commandes fournisseur / bons de commande
- Historique des prix d'achat
