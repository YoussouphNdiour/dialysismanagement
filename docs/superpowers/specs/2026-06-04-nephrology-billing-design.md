# Module `acs_hms_nephrology_billing` — Design Spec

**Date :** 2026-06-04
**Sprint :** Sprint 3 — Section 7
**Projet :** As-Shafi — Clinique de Dialyse/Néphrologie
**Stack :** Odoo 19, module autonome, dépend de `acs_hms_nephrology` + `account`

---

## 1. Contexte et objectifs

Ce module gère la facturation des séances de dialyse. Il est **entièrement isolé** de la logique clinique : le module `acs_hms_nephrology` peut fonctionner sans lui. Il s'appuie sur les hooks d'extension Odoo (`_inherit`, `selection_add`, `acs_update_record_state`) pour brancher la logique billing sur les modèles existants sans les modifier.

**Périmètre :**
- Tarification par règle avec historique (multi-règles dans le temps)
- Couverture multi-assureur (primaire + secondaire) par patient
- Facturation unitaire par séance (manuelle ou automatique selon config)
- Facturation groupée par période via wizard
- Suivi solde patient avec alertes (visuel + WhatsApp + email)
- Vue secrétaire dédiée
- Rapports : PDF mensuel, attestation de soins patient, export Excel

---

## 2. Architecture

### Approche retenue

**Module autonome avec lien faible** (Approche B) : `acs_hms_nephrology_billing` crée ses propres modèles et extend `acs.patient.procedure` et `hms.patient` uniquement pour les champs billing. Aucun code clinique n'est modifié.

### Dépendances

```
acs_hms_base
    └── acs_hms
            └── acs_hms_nephrology
                    └── acs_hms_nephrology_billing   ← CE MODULE
                            └── account (Odoo natif)
```

### Structure des fichiers

```
acs_hms_nephrology_billing/
├── __manifest__.py
├── models/
│   ├── __init__.py
│   ├── pricing_rule.py          # acs.dialysis.pricing.rule + acs.dialysis.tariff.history
│   ├── insurer.py               # acs.dialysis.insurer + acs.dialysis.patient.insurer
│   │                            # + acs.dialysis.insurer.claim
│   ├── patient.py               # _inherit hms.patient
│   ├── procedure.py             # _inherit acs.patient.procedure
│   ├── account_move.py          # _inherit account.move
│   └── res_config_settings.py   # paramètres société
├── wizard/
│   ├── __init__.py
│   ├── bulk_invoice.py          # acs.dialysis.bulk.invoice.wizard
│   ├── monthly_report.py        # acs.dialysis.monthly.report.wizard
│   └── excel_export.py          # acs.dialysis.excel.export.wizard
├── report/
│   ├── report_monthly.xml       # QWeb rapport mensuel PDF
│   └── report_patient.xml       # QWeb attestation de soins PDF
├── views/
│   ├── pricing_rule_views.xml
│   ├── insurer_views.xml
│   ├── patient_views.xml        # onglet "Facturation" sur fiche patient
│   ├── procedure_views.xml      # bouton "Facturer" sur fiche séance
│   ├── account_move_views.xml   # filtre/liste factures dialyse
│   └── menu.xml
├── security/
│   ├── security_groups.xml      # groupe nephrology_billing
│   └── ir.model.access.csv
└── tests/
    ├── __init__.py
    ├── test_pricing_rule.py
    ├── test_auto_invoice.py
    ├── test_bulk_invoice.py
    └── test_balance.py
```

---

## 3. Modèles de données

### 3.1 `acs.dialysis.pricing.rule`

Règle tarifaire de base. Un enregistrement par type de couverture (IPRES, CSS, AMU, Privé, Indigent...).

| Champ | Type | Requis | Description |
|---|---|---|---|
| `name` | Char | Oui | Ex: "Forfait IPRES" |
| `price_unit` | Float | Oui | Prix HT par séance |
| `tax_ids` | M2M `account.tax` | Non | TVA applicable |
| `active` | Boolean | — | Archivage Odoo standard |
| `notes` | Text | Non | Commentaire interne |

---

### 3.2 `acs.dialysis.tariff.history`

Historique des règles tarifaires d'un patient. Permet de retrouver quelle règle s'appliquait à une date donnée (même pattern que `acs.dry.weight.history`).

| Champ | Type | Requis | Description |
|---|---|---|---|
| `patient_id` | M2O `hms.patient` | Oui | Patient concerné |
| `pricing_rule_id` | M2O `acs.dialysis.pricing.rule` | Oui | Règle appliquée |
| `date_start` | Date | Oui | Début de validité |
| `date_end` | Date | Non | Fin (null = actif) |
| `notes` | Text | Non | Motif du changement de régime |

**Méthode utilitaire :**
```python
def get_active_rule(self, patient_id, date):
    """Retourne la règle tarifaire active pour un patient à une date donnée."""
```

Contrainte SQL : `CHECK(date_end IS NULL OR date_end >= date_start)`

---

### 3.3 `acs.dialysis.insurer`

Référentiel des assureurs.

| Champ | Type | Requis | Description |
|---|---|---|---|
| `name` | Char | Oui | Nom (IPRES, CSS, AXA...) |
| `partner_id` | M2O `res.partner` | Non | Pour facturation assureur |
| `active` | Boolean | — | Archivage |

---

### 3.4 `acs.dialysis.patient.insurer`

Lien patient ↔ assureur avec taux de couverture. Gère le multi-assureur (primaire + secondaire).

| Champ | Type | Requis | Description |
|---|---|---|---|
| `patient_id` | M2O `hms.patient` | Oui | Patient |
| `insurer_id` | M2O `acs.dialysis.insurer` | Oui | Assureur |
| `priority` | Selection `primary/secondary` | Oui | Ordre d'application |
| `coverage_rate` | Float | Oui | % couverture (0–100) |
| `date_start` | Date | Oui | Début contrat |
| `date_end` | Date | Non | Fin contrat (null = actif) |
| `policy_number` | Char | Non | N° police / dossier assureur |

Contrainte : un patient ne peut avoir qu'un assureur primaire actif à la fois, et qu'un assureur secondaire actif à la fois.

---

### 3.5 `acs.dialysis.insurer.claim`

Dossier de remboursement groupé par assureur et par patient sur une période.

| Champ | Type | Requis | Description |
|---|---|---|---|
| `name` | Char | — | Référence auto (séquence `CLAIM/YYYY/XXXX`) |
| `insurer_id` | M2O `acs.dialysis.insurer` | Oui | Assureur |
| `patient_id` | M2O `hms.patient` | Oui | Patient |
| `date_from` | Date | Oui | Période début |
| `date_to` | Date | Oui | Période fin |
| `invoice_ids` | M2M `account.move` | — | Factures concernées |
| `amount_claimed` | Float | — | Calculé depuis `invoice_ids` |
| `amount_reimbursed` | Float | Non | Saisi à réception remboursement |
| `state` | Selection | — | `draft/submitted/reimbursed/rejected` |
| `notes` | Text | Non | Observations / motif rejet |

---

### 3.6 Extension `hms.patient` (`_inherit`)

Ajouts via `acs_hms_nephrology_billing` :

```python
tariff_history_ids     = One2many('acs.dialysis.tariff.history', 'patient_id')
patient_insurer_ids    = One2many('acs.dialysis.patient.insurer', 'patient_id')

# Champs calculés (compute, store=False)
balance_due            = Float  # total factures ouvertes part patient
last_payment_date      = Date   # date dernier paiement enregistré
overdue_days           = Integer  # jours depuis facture la plus ancienne impayée
payment_status         = Selection('ok/warning/overdue')
#   ok      : balance_due == 0
#   warning : 0 < overdue_days < nephro_overdue_days
#   overdue : overdue_days >= nephro_overdue_days
```

---

### 3.7 Extension `acs.patient.procedure` (`_inherit`)

Ajouts via `acs_hms_nephrology_billing` :

```python
resolved_pricing_rule_id = Many2one('acs.dialysis.pricing.rule')
# Calculé automatiquement à action_done() depuis tariff.history,
# mais modifiable manuellement avant facturation.

billing_state = Selection([
    ('not_invoiced', 'Non facturé'),
    ('invoiced',     'Facturé'),
    ('paid',         'Payé'),
], default='not_invoiced', compute='_compute_billing_state', store=True)
# Déduit de invoice_id.payment_state
```

**Override de `action_done`** :
```python
def action_done(self):
    res = super().action_done()
    self._resolve_pricing_rule()
    if self.env.company.nephro_auto_invoice:
        self.action_create_nephro_invoice()
    return res
```

---

### 3.8 Extension `account.move` (`_inherit`)

```python
hospital_invoice_type = Selection(selection_add=[
    ('dialysis_session', 'Dialyse — Séance unitaire'),
    ('dialysis_grouped', 'Dialyse — Facturation groupée'),
])
```

---

## 4. Logique de facturation

### 4.1 Construction d'une facture de séance

Méthode `action_create_nephro_invoice()` sur `acs.patient.procedure` :

1. Résoudre `resolved_pricing_rule_id` si non encore défini
2. Calculer parts assurance :
   - Assureur primaire actif à la date : `amount_primary = price_unit * coverage_rate_primary / 100`
   - Assureur secondaire actif : `amount_secondary = (price_unit - amount_primary) * coverage_rate_secondary / 100`
   - Part patient : `patient_amount = price_unit - amount_primary - amount_secondary`
3. Appeler `acs_create_invoice()` (mixin existant) avec :
   - Ligne service hémodialyse : `product_id`, `price_unit` selon règle, `tax_ids`
   - Lignes consommables depuis `consumable_line_ids` (sauf `acs_invoice_exempt`)
   - `acs_patient_amount` et `acs_insurance_amount` sur chaque ligne
   - `hospital_invoice_type = 'dialysis_session'`
4. Écrire `invoice_id` sur la procédure

La facture est créée en statut **`draft`** — la secrétaire confirme (`action_post`) avant envoi.

### 4.2 Facturation groupée — `acs.dialysis.bulk.invoice.wizard`

Wizard transient :

| Champ | Description |
|---|---|
| `date_from` / `date_to` | Période de sélection |
| `patient_ids` | Patients ciblés (vide = tous) |
| `preview_line_ids` | O2M lignes de prévisualisation (séance, patient, montant estimé) |

Bouton **"Prévisualiser"** : charge `preview_line_ids` (séances `done` + `not_invoiced` dans la période).

Bouton **"Créer les factures"** :
- Groupe les séances par patient
- Pour chaque patient : crée un `account.move` unique avec sections par séance (`display_type = 'line_section'`)
- `hospital_invoice_type = 'dialysis_grouped'`
- Marque toutes les procédures concernées `billing_state = 'invoiced'`

### 4.3 Alertes impayés — cron quotidien

`ir.cron` déclenché chaque nuit :

```python
# Recherche factures dialyse impayées depuis > nephro_overdue_days jours
moves = env['account.move'].search([
    ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
    ('payment_state', 'not in', ['paid', 'reversed']),
    ('invoice_date', '<', date.today() - timedelta(days=company.nephro_overdue_days)),
])
for move in moves:
    patient = move.patient_id
    # 1. Badge visuel : payment_status recompute automatique
    # 2. WhatsApp si company.nephro_alert_whatsapp
    if company.nephro_alert_whatsapp:
        env['acs.whatsapp.message'].send_nephro_overdue_alert(patient, move)
    # 3. Email si company.nephro_alert_email
    if company.nephro_alert_email:
        move.message_post_with_template(template_overdue_id)
```

---

## 5. Configuration société (`res.config.settings`)

| Clé | Type | Défaut | Description |
|---|---|---|---|
| `nephro_auto_invoice` | Boolean | False | Facturation auto à `action_done` |
| `nephro_overdue_days` | Integer | 30 | Seuil alerte impayé (jours) |
| `nephro_alert_whatsapp` | Boolean | False | Alertes impayés via WhatsApp |
| `nephro_alert_email` | Boolean | True | Alertes impayés via email |

---

## 6. Vue secrétaire

### Groupe de sécurité

`nephrology_billing` (hérite de `base.group_user`) — visible dans Paramètres → Utilisateurs.

### Menu principal : "Facturation Dialyse"

| Sous-menu | Modèle | Vue |
|---|---|---|
| Factures en attente | `acs.patient.procedure` | List filtrée `billing_state=not_invoiced, state=done` |
| Toutes les factures | `account.move` | List filtrée `hospital_invoice_type in dialysis_*` |
| Dossiers assureurs | `acs.dialysis.insurer.claim` | List + kanban par state |
| Facturation groupée | Wizard `bulk_invoice` | Form |
| Soldes patients | `hms.patient` | List avec badge `payment_status` |

### Sur la fiche séance (`acs.patient.procedure`)

- Smart button **"Facturer"** visible si `billing_state == 'not_invoiced'` et `state == 'done'`
- Smart button **"Facture"** visible si `billing_state in ['invoiced', 'paid']` — ouvre `invoice_id`
- Champ `resolved_pricing_rule_id` visible et modifiable en statut `done` avant facturation

### Sur la fiche patient (`hms.patient`)

Nouvel onglet **"Facturation"** avec :
- Widget solde courant + badge statut (`ok` vert / `warning` orange / `overdue` rouge)
- Date dernier paiement, jours de retard
- Sous-onglet "Historique tarifaire" (`tariff_history_ids`)
- Sous-onglet "Assureurs" (`patient_insurer_ids`)
- Bouton "Attestation annuelle" → rapport PDF patient

---

## 7. Rapports

### 7.1 Rapport mensuel PDF (`report.nephro.billing.monthly`)

Déclenché via `acs.dialysis.monthly.report.wizard` (sélection mois + année + société).

Contenu :
- En-tête : clinique, période, date d'édition
- Tableau 1 : CA total (HT / TVA / TTC), Encaissé, En attente, Impayé
- Tableau 2 : Répartition par assureur (assureur, séances, montant réclamé, remboursé, en attente)
- Tableau 3 : Top impayés (patient, montant, jours retard) — limité à 20 lignes
- Tableau 4 : Évolution 12 mois (mois, CA, encaissé) — tableau textuel

Template QWeb : `report/report_monthly.xml`
Action report : `nephro_billing.action_report_monthly`

### 7.2 Attestation de soins patient PDF (`report.nephro.patient.invoice.summary`)

Déclenché depuis la fiche patient ou la liste soldes.

Contenu :
- En-tête : nom patient, N° dossier, période
- Tableau : date séance / N° facture / montant HT / part assurance / part patient / statut
- Total payé / solde restant dû
- Pied de page : "Attestation de soins délivrée par [Clinique] le [Date]"

Template QWeb : `report/report_patient.xml`
Wizard sélection période : inclus dans le bouton "Attestation annuelle" (année courante par défaut)

### 7.3 Export Excel (`acs.dialysis.excel.export.wizard`)

Wizard avec `date_from`, `date_to`, `patient_ids` (optionnel).

Colonnes du fichier `.xlsx` :
1. Date séance
2. Nom patient
3. N° dossier
4. N° facture
5. Prix HT (séance)
6. Consommables HT
7. TVA
8. Total TTC
9. Part assurance primaire
10. Part assurance secondaire
11. Part patient
12. Statut paiement
13. Date paiement
14. Mode paiement (Espèces / Virement / Chèque / Mobile Money)

Généré via `xlsxwriter` (disponible dans l'environnement Odoo).

---

## 8. Tests

| Fichier | Ce qui est testé |
|---|---|
| `test_pricing_rule.py` | `get_active_rule()` : règle active à une date, changement de régime |
| `test_auto_invoice.py` | `action_done` → facture auto si config activée ; pas de facture si désactivée |
| `test_bulk_invoice.py` | Wizard groupé : prévisualisation, création factures, marquage `billing_state` |
| `test_balance.py` | `payment_status` : ok / warning / overdue selon solde et paramètre jours |

Chaque test hérite de `TransactionCase` Odoo. Les tests créent leurs propres fixtures (pricing rule, patient, procedure) sans dépendre de données démo.

---

## 9. Contraintes techniques

- **Non-destructif** : aucune modification des modèles ACS existants, uniquement `_inherit`
- **Odoo 19** : API `account.move` v19 (pas de `move_type` déprécié)
- **`acs_create_invoice()`** : méthode du mixin `acs.hms.mixin` réutilisée telle quelle
- **`acs_insurance_amount`** : champ déjà présent sur `account.move.line` dans `acs_hms_base` — utilisé directement
- **WhatsApp** : appel via le module `acs_hms_whatsapp` existant, pas de dépendance directe (appel conditionnel via `if 'acs_hms_whatsapp' in self.env.registry`)
- **Exports PDF** : QWeb natif Odoo, pas de lib externe
- **Exports Excel** : `xlsxwriter`, disponible dans l'environnement Odoo
