# Nephrology Billing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le module `acs_hms_nephrology_billing` — tarification historisée, facturation unitaire/groupée, suivi solde multi-assureur, vue secrétaire, rapports PDF/Excel.

**Architecture:** Module autonome `_inherit`-only — branche sur `acs.patient.procedure.action_done` via hook, étend `hms.patient` avec des champs calculés de balance, et utilise `acs_create_invoice()` du mixin existant. Aucun modèle ACS existant n'est modifié structurellement.

**Tech Stack:** Odoo 19, Python 3, QWeb (rapports PDF), xlsxwriter (export Excel), ir.cron (alertes), mail.template (email), acs_hms_whatsapp conditionnel.

---

## Fichiers à créer / modifier

```
acs_hms_nephrology_billing/
├── __manifest__.py                           CRÉER
├── __init__.py                               CRÉER
├── models/
│   ├── __init__.py                           CRÉER
│   ├── pricing_rule.py                       CRÉER  acs.dialysis.pricing.rule
│   ├── tariff_history.py                     CRÉER  acs.dialysis.tariff.history
│   ├── insurer.py                            CRÉER  acs.dialysis.insurer
│   │                                                acs.dialysis.patient.insurer
│   │                                                acs.dialysis.insurer.claim
│   ├── patient.py                            CRÉER  _inherit hms.patient
│   ├── procedure.py                          CRÉER  _inherit acs.patient.procedure
│   ├── account_move.py                       CRÉER  _inherit account.move + account.move.line
│   └── res_config_settings.py               CRÉER  _inherit res.company + res.config.settings
├── wizard/
│   ├── __init__.py                           CRÉER
│   ├── bulk_invoice.py                       CRÉER  acs.dialysis.bulk.invoice.wizard
│   │                                                acs.dialysis.bulk.invoice.preview
│   ├── monthly_report.py                     CRÉER  acs.dialysis.monthly.report.wizard
│   └── excel_export.py                       CRÉER  acs.dialysis.excel.export.wizard
├── report/
│   ├── report_monthly.xml                    CRÉER  QWeb rapport mensuel PDF
│   └── report_patient.xml                    CRÉER  QWeb attestation de soins PDF
├── views/
│   ├── pricing_rule_views.xml                CRÉER
│   ├── insurer_views.xml                     CRÉER
│   ├── config_settings_views.xml             CRÉER
│   ├── patient_views.xml                     CRÉER  onglet Facturation
│   ├── procedure_views.xml                   CRÉER  boutons smart billing
│   ├── account_move_views.xml                CRÉER  filtre factures dialyse
│   ├── bulk_invoice_views.xml                CRÉER
│   ├── monthly_report_views.xml              CRÉER
│   ├── excel_export_views.xml                CRÉER
│   └── menu.xml                              CRÉER
├── data/
│   ├── ir_cron.xml                           CRÉER  cron alertes impayés
│   ├── ir_sequence.xml                       CRÉER  séquence CLAIM/YYYY/XXXX
│   └── mail_template.xml                     CRÉER  email alerte impayé
└── security/
    ├── security_groups.xml                   CRÉER  groupe nephrology_billing
    └── ir.model.access.csv                   CRÉER
tests/
    ├── __init__.py                           CRÉER
    ├── test_pricing_rule.py                  CRÉER
    ├── test_auto_invoice.py                  CRÉER
    ├── test_bulk_invoice.py                  CRÉER
    └── test_balance.py                       CRÉER
```

---

## Task 1 : Scaffold du module

**Files:**
- Create: `acs_hms_nephrology_billing/__manifest__.py`
- Create: `acs_hms_nephrology_billing/__init__.py`
- Create: `acs_hms_nephrology_billing/models/__init__.py`
- Create: `acs_hms_nephrology_billing/wizard/__init__.py`
- Create: `acs_hms_nephrology_billing/tests/__init__.py`
- Create: `acs_hms_nephrology_billing/security/security_groups.xml`
- Create: `acs_hms_nephrology_billing/security/ir.model.access.csv`

- [ ] **Step 1 : Créer `__manifest__.py`**

```python
# acs_hms_nephrology_billing/__manifest__.py
{
    'name': 'ACS HMS Nephrology Billing',
    'version': '1.0.0',
    'category': 'Healthcare',
    'summary': 'Facturation des séances de dialyse — tarification, assurances, solde patient',
    'depends': ['acs_hms_nephrology', 'account', 'mail'],
    'data': [
        'security/security_groups.xml',
        'security/ir.model.access.csv',
        'data/ir_sequence.xml',
        'data/ir_cron.xml',
        'data/mail_template.xml',
        'views/pricing_rule_views.xml',
        'views/insurer_views.xml',
        'views/config_settings_views.xml',
        'views/patient_views.xml',
        'views/procedure_views.xml',
        'views/account_move_views.xml',
        'views/bulk_invoice_views.xml',
        'views/monthly_report_views.xml',
        'views/excel_export_views.xml',
        'views/menu.xml',
        'report/report_monthly.xml',
        'report/report_patient.xml',
    ],
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
```

- [ ] **Step 2 : Créer les `__init__.py`**

`acs_hms_nephrology_billing/__init__.py` :
```python
from . import models
from . import wizard
```

`acs_hms_nephrology_billing/models/__init__.py` :
```python
from . import pricing_rule
from . import tariff_history
from . import insurer
from . import patient
from . import procedure
from . import account_move
from . import res_config_settings
```

`acs_hms_nephrology_billing/wizard/__init__.py` :
```python
from . import bulk_invoice
from . import monthly_report
from . import excel_export
```

`acs_hms_nephrology_billing/tests/__init__.py` :
```python
from . import test_pricing_rule
from . import test_auto_invoice
from . import test_bulk_invoice
from . import test_balance
```

- [ ] **Step 3 : Créer `security/security_groups.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="group_nephrology_billing" model="res.groups">
        <field name="name">Facturation Dialyse</field>
        <field name="category_id" ref="base.module_category_healthcare"/>
        <field name="implied_ids" eval="[(4, ref('base.group_user'))]"/>
    </record>
</odoo>
```

- [ ] **Step 4 : Créer `security/ir.model.access.csv`** (squelette à compléter au fil des tâches)

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_dialysis_pricing_rule,access_dialysis_pricing_rule,model_acs_dialysis_pricing_rule,group_nephrology_billing,1,1,1,0
access_dialysis_tariff_history,access_dialysis_tariff_history,model_acs_dialysis_tariff_history,group_nephrology_billing,1,1,1,1
access_dialysis_insurer,access_dialysis_insurer,model_acs_dialysis_insurer,group_nephrology_billing,1,1,1,0
access_dialysis_patient_insurer,access_dialysis_patient_insurer,model_acs_dialysis_patient_insurer,group_nephrology_billing,1,1,1,1
access_dialysis_insurer_claim,access_dialysis_insurer_claim,model_acs_dialysis_insurer_claim,group_nephrology_billing,1,1,1,1
access_bulk_invoice_wizard,access_bulk_invoice_wizard,model_acs_dialysis_bulk_invoice_wizard,group_nephrology_billing,1,1,1,1
access_bulk_invoice_preview,access_bulk_invoice_preview,model_acs_dialysis_bulk_invoice_preview,group_nephrology_billing,1,1,1,1
access_monthly_report_wizard,access_monthly_report_wizard,model_acs_dialysis_monthly_report_wizard,group_nephrology_billing,1,1,1,1
access_excel_export_wizard,access_excel_export_wizard,model_acs_dialysis_excel_export_wizard,group_nephrology_billing,1,1,1,1
```

- [ ] **Step 5 : Créer `data/ir_sequence.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="seq_dialysis_insurer_claim" model="ir.sequence">
        <field name="name">Dossier Remboursement Assureur Dialyse</field>
        <field name="code">acs.dialysis.insurer.claim</field>
        <field name="prefix">CLAIM/%(year)s/</field>
        <field name="padding">4</field>
        <field name="company_id" eval="False"/>
    </record>
</odoo>
```

- [ ] **Step 6 : Commit scaffold**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_billing/
git commit -m "feat(billing): scaffold module acs_hms_nephrology_billing"
```

---

## Task 2 : Modèle `acs.dialysis.pricing.rule` + tests

**Files:**
- Create: `acs_hms_nephrology_billing/models/pricing_rule.py`
- Create: `acs_hms_nephrology_billing/tests/test_pricing_rule.py`

- [ ] **Step 1 : Écrire le test (fail attendu)**

```python
# acs_hms_nephrology_billing/tests/test_pricing_rule.py
from odoo.tests import TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestPricingRule(TransactionCase):

    def test_create_pricing_rule(self):
        rule = self.env['acs.dialysis.pricing.rule'].create({
            'name': 'Forfait IPRES',
            'price_unit': 25000.0,
        })
        self.assertEqual(rule.name, 'Forfait IPRES')
        self.assertEqual(rule.price_unit, 25000.0)
        self.assertTrue(rule.active)

    def test_archive_rule(self):
        rule = self.env['acs.dialysis.pricing.rule'].create({
            'name': 'Ancien Forfait',
            'price_unit': 20000.0,
        })
        rule.active = False
        active_rules = self.env['acs.dialysis.pricing.rule'].search([('name', '=', 'Ancien Forfait')])
        self.assertFalse(active_rules)  # archivé = invisible sans context
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestPricingRule 2>&1 | tail -20
```
Résultat attendu : erreur `KeyError: 'acs.dialysis.pricing.rule'`

- [ ] **Step 3 : Implémenter `pricing_rule.py`**

```python
# acs_hms_nephrology_billing/models/pricing_rule.py
from odoo import fields, models


class AcsDialysisPricingRule(models.Model):
    _name = 'acs.dialysis.pricing.rule'
    _description = 'Règle tarifaire dialyse'
    _order = 'name'

    name = fields.Char(string='Nom', required=True)
    price_unit = fields.Float(string='Prix HT par séance', required=True, digits=(10, 2))
    tax_ids = fields.Many2many('account.tax', string='TVA')
    active = fields.Boolean(string='Actif', default=True)
    notes = fields.Text(string='Notes internes')
```

- [ ] **Step 4 : Lancer les tests pour vérifier la réussite**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestPricingRule 2>&1 | tail -5
```
Résultat attendu : `2 tests, 0 errors, 0 failures`

- [ ] **Step 5 : Commit**

```bash
git add acs_hms_nephrology_billing/models/pricing_rule.py \
        acs_hms_nephrology_billing/tests/test_pricing_rule.py
git commit -m "feat(billing): add acs.dialysis.pricing.rule model"
```

---

## Task 3 : Modèle `acs.dialysis.tariff.history` + `get_active_rule()` + tests

**Files:**
- Create: `acs_hms_nephrology_billing/models/tariff_history.py`
- Modify: `acs_hms_nephrology_billing/tests/test_pricing_rule.py` (ajouter `TestTariffHistory`)

- [ ] **Step 1 : Ajouter les tests à `test_pricing_rule.py`**

Ajouter après la classe `TestPricingRule` existante :

```python
from datetime import date, timedelta


@tagged('post_install', '-at_install')
class TestTariffHistory(TransactionCase):

    def setUp(self):
        super().setUp()
        self.partner = self.env['res.partner'].create({'name': 'Patient Test Tarif'})
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Test Tarif',
            'partner_id': self.partner.id,
        })
        self.rule_ipres = self.env['acs.dialysis.pricing.rule'].create({
            'name': 'IPRES', 'price_unit': 25000.0,
        })
        self.rule_prive = self.env['acs.dialysis.pricing.rule'].create({
            'name': 'Privé', 'price_unit': 40000.0,
        })

    def test_get_active_rule_current(self):
        today = date.today()
        self.env['acs.dialysis.tariff.history'].create({
            'patient_id': self.patient.id,
            'pricing_rule_id': self.rule_ipres.id,
            'date_start': today - timedelta(days=30),
        })
        rule = self.env['acs.dialysis.tariff.history'].get_active_rule(
            self.patient.id, today
        )
        self.assertEqual(rule, self.rule_ipres)

    def test_get_active_rule_historical(self):
        today = date.today()
        # Ancienne règle (terminée)
        self.env['acs.dialysis.tariff.history'].create({
            'patient_id': self.patient.id,
            'pricing_rule_id': self.rule_ipres.id,
            'date_start': today - timedelta(days=365),
            'date_end': today - timedelta(days=30),
        })
        # Nouvelle règle (active)
        self.env['acs.dialysis.tariff.history'].create({
            'patient_id': self.patient.id,
            'pricing_rule_id': self.rule_prive.id,
            'date_start': today - timedelta(days=29),
        })
        # La règle d'il y a 60 jours doit retourner IPRES
        rule_old = self.env['acs.dialysis.tariff.history'].get_active_rule(
            self.patient.id, today - timedelta(days=60)
        )
        self.assertEqual(rule_old, self.rule_ipres)
        # La règle d'aujourd'hui doit retourner Privé
        rule_now = self.env['acs.dialysis.tariff.history'].get_active_rule(
            self.patient.id, today
        )
        self.assertEqual(rule_now, self.rule_prive)

    def test_get_active_rule_no_history(self):
        rule = self.env['acs.dialysis.tariff.history'].get_active_rule(
            self.patient.id, date.today()
        )
        self.assertFalse(rule)

    def test_date_constraint(self):
        from odoo.exceptions import ValidationError
        today = date.today()
        with self.assertRaises(Exception):
            self.env['acs.dialysis.tariff.history'].create({
                'patient_id': self.patient.id,
                'pricing_rule_id': self.rule_ipres.id,
                'date_start': today,
                'date_end': today - timedelta(days=1),  # fin avant début
            })
```

- [ ] **Step 2 : Lancer les tests pour vérifier l'échec**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestTariffHistory 2>&1 | tail -10
```
Résultat attendu : erreur `KeyError: 'acs.dialysis.tariff.history'`

- [ ] **Step 3 : Implémenter `tariff_history.py`**

```python
# acs_hms_nephrology_billing/models/tariff_history.py
from odoo import api, fields, models


class AcsDialysisTariffHistory(models.Model):
    _name = 'acs.dialysis.tariff.history'
    _description = 'Historique tarifaire patient dialyse'
    _order = 'date_start desc'

    patient_id = fields.Many2one(
        'hms.patient', required=True, ondelete='cascade', index=True
    )
    pricing_rule_id = fields.Many2one(
        'acs.dialysis.pricing.rule', required=True, ondelete='restrict',
        string='Règle tarifaire'
    )
    date_start = fields.Date(string='Date de début', required=True)
    date_end = fields.Date(string='Date de fin')
    notes = fields.Text(string='Motif du changement')

    _sql_constraints = [
        (
            'date_check',
            'CHECK(date_end IS NULL OR date_end >= date_start)',
            'La date de fin doit être postérieure ou égale à la date de début.',
        ),
    ]

    @api.model
    def get_active_rule(self, patient_id, rule_date):
        """Retourne la règle tarifaire active pour un patient à une date donnée.

        Args:
            patient_id (int): ID du patient
            rule_date (date): Date à laquelle chercher la règle active

        Returns:
            acs.dialysis.pricing.rule: La règle active, ou recordset vide si aucune.
        """
        record = self.search([
            ('patient_id', '=', patient_id),
            ('date_start', '<=', rule_date),
            '|',
            ('date_end', '=', False),
            ('date_end', '>=', rule_date),
        ], limit=1, order='date_start desc')
        return record.pricing_rule_id if record else self.env['acs.dialysis.pricing.rule']
```

- [ ] **Step 4 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestTariffHistory 2>&1 | tail -5
```
Résultat attendu : `4 tests, 0 errors, 0 failures`

- [ ] **Step 5 : Commit**

```bash
git add acs_hms_nephrology_billing/models/tariff_history.py \
        acs_hms_nephrology_billing/tests/test_pricing_rule.py
git commit -m "feat(billing): add acs.dialysis.tariff.history with get_active_rule()"
```

---

## Task 4 : Modèles Assureurs + tests

**Files:**
- Create: `acs_hms_nephrology_billing/models/insurer.py`

- [ ] **Step 1 : Créer les tests dans un nouveau fichier**

```python
# acs_hms_nephrology_billing/tests/test_pricing_rule.py
# Ajouter cette classe à la fin du fichier existant :

@tagged('post_install', '-at_install')
class TestInsurer(TransactionCase):

    def setUp(self):
        super().setUp()
        self.partner = self.env['res.partner'].create({'name': 'Patient Assureur'})
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Assureur',
            'partner_id': self.partner.id,
        })
        self.insurer_ipres = self.env['acs.dialysis.insurer'].create({
            'name': 'IPRES',
        })
        self.insurer_css = self.env['acs.dialysis.insurer'].create({
            'name': 'CSS',
        })

    def test_create_patient_insurer_primary(self):
        today = date.today()
        pi = self.env['acs.dialysis.patient.insurer'].create({
            'patient_id': self.patient.id,
            'insurer_id': self.insurer_ipres.id,
            'priority': 'primary',
            'coverage_rate': 80.0,
            'date_start': today - timedelta(days=30),
        })
        self.assertEqual(pi.coverage_rate, 80.0)

    def test_coverage_rate_constraint(self):
        today = date.today()
        with self.assertRaises(Exception):
            self.env['acs.dialysis.patient.insurer'].create({
                'patient_id': self.patient.id,
                'insurer_id': self.insurer_ipres.id,
                'priority': 'primary',
                'coverage_rate': 110.0,  # > 100 : invalide
                'date_start': today,
            })

    def test_insurer_claim_amount_computed(self):
        claim = self.env['acs.dialysis.insurer.claim'].create({
            'insurer_id': self.insurer_ipres.id,
            'patient_id': self.patient.id,
            'date_from': date.today().replace(day=1),
            'date_to': date.today(),
        })
        self.assertEqual(claim.state, 'draft')
        self.assertRegex(claim.name, r'^CLAIM/')
```

- [ ] **Step 2 : Lancer les tests (échec attendu)**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestInsurer 2>&1 | tail -10
```

- [ ] **Step 3 : Implémenter `insurer.py`**

```python
# acs_hms_nephrology_billing/models/insurer.py
from odoo import api, fields, models


class AcsDialysisInsurer(models.Model):
    _name = 'acs.dialysis.insurer'
    _description = 'Assureur dialyse'
    _order = 'name'

    name = fields.Char(string='Nom', required=True)
    partner_id = fields.Many2one('res.partner', string='Partenaire facturation')
    active = fields.Boolean(default=True)


class AcsDialysisPatientInsurer(models.Model):
    _name = 'acs.dialysis.patient.insurer'
    _description = "Couverture assurance du patient"
    _order = 'priority, date_start desc'

    patient_id = fields.Many2one(
        'hms.patient', required=True, ondelete='cascade', index=True
    )
    insurer_id = fields.Many2one(
        'acs.dialysis.insurer', required=True, ondelete='restrict',
        string='Assureur'
    )
    priority = fields.Selection([
        ('primary', 'Primaire'),
        ('secondary', 'Secondaire'),
    ], required=True, default='primary', string='Priorité')
    coverage_rate = fields.Float(
        string='Taux de couverture (%)', required=True, digits=(5, 2)
    )
    date_start = fields.Date(string='Début contrat', required=True)
    date_end = fields.Date(string='Fin contrat')
    policy_number = fields.Char(string='N° police / dossier')

    _sql_constraints = [
        (
            'coverage_range',
            'CHECK(coverage_rate >= 0 AND coverage_rate <= 100)',
            'Le taux de couverture doit être compris entre 0 et 100.',
        ),
    ]


class AcsDialysisInsurerClaim(models.Model):
    _name = 'acs.dialysis.insurer.claim'
    _description = 'Dossier remboursement assureur dialyse'
    _inherit = ['mail.thread']
    _order = 'date_from desc'

    name = fields.Char(
        string='Référence', default='Nouveau', copy=False, readonly=True
    )
    insurer_id = fields.Many2one(
        'acs.dialysis.insurer', required=True, ondelete='restrict', string='Assureur'
    )
    patient_id = fields.Many2one(
        'hms.patient', required=True, ondelete='restrict', string='Patient'
    )
    date_from = fields.Date(string='Période du', required=True)
    date_to = fields.Date(string='Au', required=True)
    invoice_ids = fields.Many2many('account.move', string='Factures')
    amount_claimed = fields.Float(
        string='Montant réclamé', compute='_compute_amount_claimed', store=True
    )
    amount_reimbursed = fields.Float(string='Montant remboursé')
    state = fields.Selection([
        ('draft', 'Brouillon'),
        ('submitted', 'Soumis'),
        ('reimbursed', 'Remboursé'),
        ('rejected', 'Rejeté'),
    ], default='draft', tracking=True, string='Statut')
    notes = fields.Text(string='Observations')

    @api.depends('invoice_ids', 'invoice_ids.invoice_line_ids.acs_insurance_amount')
    def _compute_amount_claimed(self):
        for rec in self:
            rec.amount_claimed = sum(
                line.acs_insurance_amount
                for inv in rec.invoice_ids
                for line in inv.invoice_line_ids
                if line.display_type not in ('line_section', 'line_note')
            )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'Nouveau') == 'Nouveau':
                vals['name'] = (
                    self.env['ir.sequence'].next_by_code('acs.dialysis.insurer.claim')
                    or 'Nouveau'
                )
        return super().create(vals_list)
```

- [ ] **Step 4 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestInsurer 2>&1 | tail -5
```
Résultat attendu : `3 tests, 0 errors, 0 failures`

- [ ] **Step 5 : Commit**

```bash
git add acs_hms_nephrology_billing/models/insurer.py \
        acs_hms_nephrology_billing/tests/test_pricing_rule.py
git commit -m "feat(billing): add insurer models (insurer, patient_insurer, insurer_claim)"
```

---

## Task 5 : Configuration société + paramètres

**Files:**
- Create: `acs_hms_nephrology_billing/models/res_config_settings.py`

- [ ] **Step 1 : Implémenter `res_config_settings.py`**

Pas de tests unitaires pour les champs de config (comportement Odoo standard).

```python
# acs_hms_nephrology_billing/models/res_config_settings.py
from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    nephro_auto_invoice = fields.Boolean(
        string='Facturation automatique fin de séance',
        default=False,
    )
    nephro_overdue_days = fields.Integer(
        string='Délai alerte impayé (jours)',
        default=30,
    )
    nephro_alert_whatsapp = fields.Boolean(
        string='Alertes impayés WhatsApp',
        default=False,
    )
    nephro_alert_email = fields.Boolean(
        string='Alertes impayés email',
        default=True,
    )


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    nephro_auto_invoice = fields.Boolean(
        related='company_id.nephro_auto_invoice',
        string='Facturation automatique fin de séance',
        readonly=False,
    )
    nephro_overdue_days = fields.Integer(
        related='company_id.nephro_overdue_days',
        string='Délai alerte impayé (jours)',
        readonly=False,
    )
    nephro_alert_whatsapp = fields.Boolean(
        related='company_id.nephro_alert_whatsapp',
        string='Alertes impayés WhatsApp',
        readonly=False,
    )
    nephro_alert_email = fields.Boolean(
        related='company_id.nephro_alert_email',
        string='Alertes impayés email',
        readonly=False,
    )
```

- [ ] **Step 2 : Commit**

```bash
git add acs_hms_nephrology_billing/models/res_config_settings.py
git commit -m "feat(billing): add company config fields (auto_invoice, overdue_days, alerts)"
```

---

## Task 6 : Extension `hms.patient` — onglet Facturation

**Files:**
- Create: `acs_hms_nephrology_billing/models/patient.py`

- [ ] **Step 1 : Ajouter les tests balance à `test_balance.py`**

```python
# acs_hms_nephrology_billing/tests/test_balance.py
from datetime import date, timedelta
from odoo.tests import TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestPatientBalance(TransactionCase):

    def setUp(self):
        super().setUp()
        self.partner = self.env['res.partner'].create({
            'name': 'Patient Balance',
            'email': 'balance@test.com',
        })
        self.patient = self.env['hms.patient'].create({
            'name': 'Patient Balance',
            'partner_id': self.partner.id,
        })
        self.env.company.nephro_overdue_days = 30

    def test_balance_zero_no_invoices(self):
        self.assertEqual(self.patient.balance_due, 0.0)
        self.assertEqual(self.patient.payment_status, 'ok')

    def test_payment_status_ok_when_paid(self):
        # Créer une facture payée
        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner.id,
            'patient_id': self.patient.id,
            'hospital_invoice_type': 'dialysis_session',
            'invoice_date': date.today(),
            'invoice_line_ids': [(0, 0, {
                'name': 'Hémodialyse test',
                'quantity': 1,
                'price_unit': 25000.0,
            })],
        })
        invoice.action_post()
        # Sans paiement : overdue si > 30j, warning sinon
        # Date = today => 0 jours => warning (0 < 30)
        self.patient.invalidate_recordset()
        self.assertEqual(self.patient.payment_status, 'warning')

    def test_payment_status_overdue(self):
        old_date = date.today() - timedelta(days=31)
        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': self.partner.id,
            'patient_id': self.patient.id,
            'hospital_invoice_type': 'dialysis_session',
            'invoice_date': old_date,
            'invoice_line_ids': [(0, 0, {
                'name': 'Hémodialyse test',
                'quantity': 1,
                'price_unit': 25000.0,
            })],
        })
        invoice.action_post()
        self.patient.invalidate_recordset()
        self.assertEqual(self.patient.payment_status, 'overdue')
        self.assertGreaterEqual(self.patient.overdue_days, 31)
```

- [ ] **Step 2 : Lancer les tests (échec attendu)**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestPatientBalance 2>&1 | tail -10
```

- [ ] **Step 3 : Implémenter `patient.py`**

```python
# acs_hms_nephrology_billing/models/patient.py
from datetime import date
from odoo import api, fields, models


class AcsPatientBilling(models.Model):
    _inherit = 'hms.patient'

    tariff_history_ids = fields.One2many(
        'acs.dialysis.tariff.history', 'patient_id',
        string='Historique tarifaire'
    )
    patient_insurer_ids = fields.One2many(
        'acs.dialysis.patient.insurer', 'patient_id',
        string='Assureurs'
    )

    # Champs balance — non stockés, calculés à la lecture
    balance_due = fields.Float(
        string='Solde dû (€)',
        compute='_compute_billing_balance',
    )
    last_payment_date = fields.Date(
        string='Dernier paiement',
        compute='_compute_billing_balance',
    )
    overdue_days = fields.Integer(
        string='Jours de retard',
        compute='_compute_billing_balance',
    )
    payment_status = fields.Selection([
        ('ok', 'À jour'),
        ('warning', 'Attention'),
        ('overdue', 'Impayé'),
    ], string='Statut paiement', compute='_compute_billing_balance')

    def _compute_billing_balance(self):
        today = date.today()
        for rec in self:
            threshold = rec.env.company.nephro_overdue_days or 30

            # Factures dialyse confirmées et non réglées
            open_moves = rec.env['account.move'].search([
                ('patient_id', '=', rec.id),
                ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
                ('state', '=', 'posted'),
                ('payment_state', 'not in', ['paid', 'reversed', 'in_payment']),
            ])
            rec.balance_due = sum(open_moves.mapped('amount_residual'))

            # Dernier paiement
            paid_moves = rec.env['account.move'].search([
                ('patient_id', '=', rec.id),
                ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
                ('payment_state', 'in', ['paid', 'in_payment']),
            ], order='invoice_date desc', limit=1)
            rec.last_payment_date = paid_moves.invoice_date if paid_moves else False

            # Jours de retard (depuis la plus ancienne facture impayée)
            if open_moves:
                dates = [m.invoice_date for m in open_moves if m.invoice_date]
                oldest = min(dates) if dates else today
                rec.overdue_days = (today - oldest).days
            else:
                rec.overdue_days = 0

            # Statut
            if rec.balance_due <= 0:
                rec.payment_status = 'ok'
            elif rec.overdue_days < threshold:
                rec.payment_status = 'warning'
            else:
                rec.payment_status = 'overdue'
```

- [ ] **Step 4 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestPatientBalance 2>&1 | tail -5
```
Résultat attendu : `3 tests, 0 errors, 0 failures`

- [ ] **Step 5 : Commit**

```bash
git add acs_hms_nephrology_billing/models/patient.py \
        acs_hms_nephrology_billing/tests/test_balance.py
git commit -m "feat(billing): extend hms.patient with billing balance and insurer fields"
```

---

## Task 7 : Extension `account.move` + extension `acs.patient.procedure`

**Files:**
- Create: `acs_hms_nephrology_billing/models/account_move.py`
- Create: `acs_hms_nephrology_billing/models/procedure.py`

- [ ] **Step 1 : Implémenter `account_move.py`**

```python
# acs_hms_nephrology_billing/models/account_move.py
from datetime import date, timedelta
from odoo import api, fields, models


class AccountMove(models.Model):
    _inherit = 'account.move'

    hospital_invoice_type = fields.Selection(
        selection_add=[
            ('dialysis_session', 'Dialyse — Séance unitaire'),
            ('dialysis_grouped', 'Dialyse — Facturation groupée'),
        ]
    )

    @api.model
    def _cron_send_overdue_alerts(self):
        """Cron quotidien — alerte impayés dialyse."""
        company = self.env.company
        threshold = company.nephro_overdue_days or 30
        cutoff = date.today() - timedelta(days=threshold)

        overdue_moves = self.search([
            ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
            ('state', '=', 'posted'),
            ('payment_state', 'not in', ['paid', 'reversed', 'in_payment']),
            ('invoice_date', '<', cutoff),
        ])

        notified = set()
        for move in overdue_moves:
            if not move.patient_id or move.patient_id.id in notified:
                continue
            notified.add(move.patient_id.id)

            if company.nephro_alert_email and move.partner_id.email:
                template = self.env.ref(
                    'acs_hms_nephrology_billing.email_template_overdue_alert',
                    raise_if_not_found=False,
                )
                if template:
                    template.send_mail(move.id, force_send=True)

            if company.nephro_alert_whatsapp and 'acs_hms_whatsapp' in self.env.registry:
                wa_model = self.env.get('acs.whatsapp.message')
                if wa_model and hasattr(wa_model, '_send_nephro_overdue_alert'):
                    wa_model._send_nephro_overdue_alert(move.patient_id, move)
```

- [ ] **Step 2 : Implémenter `procedure.py`**

```python
# acs_hms_nephrology_billing/models/procedure.py
from odoo import api, fields, models


class AcsPatientProcedureBilling(models.Model):
    _inherit = 'acs.patient.procedure'

    resolved_pricing_rule_id = fields.Many2one(
        'acs.dialysis.pricing.rule',
        string='Règle tarifaire appliquée',
        help='Calculée automatiquement à la fin de séance. Modifiable avant facturation.',
    )
    billing_state = fields.Selection([
        ('not_invoiced', 'Non facturé'),
        ('invoiced', 'Facturé'),
        ('paid', 'Payé'),
    ], string='Statut facturation',
        compute='_compute_billing_state',
        store=True,
        default='not_invoiced',
    )

    @api.depends('invoice_id', 'invoice_id.payment_state')
    def _compute_billing_state(self):
        for rec in self:
            if not rec.invoice_id:
                rec.billing_state = 'not_invoiced'
            elif rec.invoice_id.payment_state in ('paid', 'in_payment'):
                rec.billing_state = 'paid'
            else:
                rec.billing_state = 'invoiced'

    def _resolve_pricing_rule(self):
        """Résout et écrit la règle tarifaire active à la date de la séance."""
        for rec in self:
            if rec.resolved_pricing_rule_id:
                continue
            if not rec.patient_id or not rec.date:
                continue
            session_date = rec.date.date()
            rule = self.env['acs.dialysis.tariff.history'].get_active_rule(
                rec.patient_id.id, session_date
            )
            if rule:
                rec.resolved_pricing_rule_id = rule.id

    def action_done(self):
        res = super().action_done()
        self._resolve_pricing_rule()
        if self.env.company.nephro_auto_invoice:
            self.action_create_nephro_invoice()
        return res

    def _get_insurance_coverage(self, session_date):
        """Retourne (taux_primaire, taux_secondaire) en % pour la date donnée."""
        self.ensure_one()
        insurers = self.patient_id.patient_insurer_ids.filtered(
            lambda i: i.date_start <= session_date
            and (not i.date_end or i.date_end >= session_date)
        )
        primary = insurers.filtered(lambda i: i.priority == 'primary')[:1]
        secondary = insurers.filtered(lambda i: i.priority == 'secondary')[:1]
        return (
            primary.coverage_rate if primary else 0.0,
            secondary.coverage_rate if secondary else 0.0,
        )

    def _apply_insurance_amounts(self, invoice, session_date=None):
        """Calcule acs_patient_amount / acs_insurance_amount sur les lignes de facture."""
        self.ensure_one()
        if session_date is None:
            session_date = self.date.date() if self.date else fields.Date.today()

        primary_rate, secondary_rate = self._get_insurance_coverage(session_date)

        for line in invoice.invoice_line_ids.filtered(
            lambda l: l.display_type not in ('line_section', 'line_note')
        ):
            price = line.price_unit * (line.quantity or 1.0)
            primary_amount = price * primary_rate / 100.0
            secondary_amount = (price - primary_amount) * secondary_rate / 100.0
            line.write({
                'acs_insurance_amount': primary_amount + secondary_amount,
                'acs_patient_amount': price - primary_amount - secondary_amount,
            })

    def action_create_nephro_invoice(self):
        """Crée une facture Odoo pour cette séance (dialysis_session)."""
        self.ensure_one()
        if self.billing_state != 'not_invoiced':
            return

        self._resolve_pricing_rule()
        rule = self.resolved_pricing_rule_id

        # Récupère les données produit via la méthode parent
        product_data = self.get_procedure_invoice_data()

        # Surcharge du prix avec la règle tarifaire
        if rule and product_data:
            for line in product_data:
                if (
                    line.get('line_type') == 'procedure'
                    and line.get('product_id') == self.product_id
                ):
                    line['price_unit'] = rule.price_unit
                    if rule.tax_ids:
                        line['tax_ids'] = [(6, 0, rule.tax_ids.ids)]
                    break

        inv_data = {
            'physician_id': self.physician_id.id if self.physician_id else False,
            'hospital_invoice_type': 'dialysis_session',
            'procedure_id': self.id,
        }

        invoice = self.acs_create_invoice(
            partner=self.patient_id.partner_id,
            patient=self.patient_id,
            product_data=product_data,
            inv_data=inv_data,
        )
        self.invoice_id = invoice.id
        self._apply_insurance_amounts(invoice)
        return invoice
```

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_billing/models/account_move.py \
        acs_hms_nephrology_billing/models/procedure.py
git commit -m "feat(billing): extend procedure (billing hook) and account.move (dialysis types)"
```

---

## Task 8 : Tests facturation automatique

**Files:**
- Create: `acs_hms_nephrology_billing/tests/test_auto_invoice.py`

- [ ] **Step 1 : Écrire les tests**

```python
# acs_hms_nephrology_billing/tests/test_auto_invoice.py
from datetime import date, timedelta
from odoo.tests import TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestAutoInvoice(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.partner = cls.env['res.partner'].create({'name': 'Patient Fact Auto'})
        cls.patient = cls.env['hms.patient'].create({
            'name': 'Patient Fact Auto',
            'partner_id': cls.partner.id,
        })
        cls.rule = cls.env['acs.dialysis.pricing.rule'].create({
            'name': 'Test Auto', 'price_unit': 25000.0,
        })
        cls.env['acs.dialysis.tariff.history'].create({
            'patient_id': cls.patient.id,
            'pricing_rule_id': cls.rule.id,
            'date_start': date.today() - timedelta(days=365),
        })
        cls.product = cls.env['product.product'].create({
            'name': 'Hémodialyse Test',
            'type': 'service',
        })

    def _make_procedure(self):
        return self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'state': 'running',
            'date': fields.Datetime.now(),
        })

    def test_auto_invoice_creates_invoice_when_enabled(self):
        self.env.company.nephro_auto_invoice = True
        proc = self._make_procedure()
        proc.action_done()
        self.assertTrue(proc.invoice_id, "Une facture doit être créée automatiquement")
        self.assertEqual(proc.invoice_id.hospital_invoice_type, 'dialysis_session')
        self.assertEqual(proc.billing_state, 'invoiced')

    def test_no_auto_invoice_when_disabled(self):
        self.env.company.nephro_auto_invoice = False
        proc = self._make_procedure()
        proc.action_done()
        self.assertFalse(proc.invoice_id, "Pas de facture auto si config désactivée")
        self.assertEqual(proc.billing_state, 'not_invoiced')

    def test_resolved_pricing_rule_set_on_done(self):
        self.env.company.nephro_auto_invoice = False
        proc = self._make_procedure()
        proc.action_done()
        self.assertEqual(proc.resolved_pricing_rule_id, self.rule)

    def test_invoice_price_uses_pricing_rule(self):
        self.env.company.nephro_auto_invoice = True
        proc = self._make_procedure()
        proc.action_done()
        invoice = proc.invoice_id
        procedure_lines = invoice.invoice_line_ids.filtered(
            lambda l: l.product_id == self.product
        )
        self.assertTrue(procedure_lines)
        self.assertAlmostEqual(procedure_lines[0].price_unit, 25000.0, places=2)

    def test_manual_invoice_via_action(self):
        self.env.company.nephro_auto_invoice = False
        proc = self._make_procedure()
        proc.action_done()
        self.assertFalse(proc.invoice_id)
        proc.action_create_nephro_invoice()
        self.assertTrue(proc.invoice_id)
        self.assertEqual(proc.invoice_id.hospital_invoice_type, 'dialysis_session')

    def test_no_duplicate_invoice(self):
        self.env.company.nephro_auto_invoice = True
        proc = self._make_procedure()
        proc.action_done()
        first_invoice = proc.invoice_id
        proc.action_create_nephro_invoice()  # appel redondant
        self.assertEqual(proc.invoice_id, first_invoice, "Pas de double facturation")
```

- [ ] **Step 2 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestAutoInvoice 2>&1 | tail -5
```
Résultat attendu : `6 tests, 0 errors, 0 failures`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_billing/tests/test_auto_invoice.py
git commit -m "test(billing): auto-invoice tests all passing"
```

---

## Task 9 : Wizard facturation groupée + tests

**Files:**
- Create: `acs_hms_nephrology_billing/wizard/bulk_invoice.py`

- [ ] **Step 1 : Écrire les tests de facturation groupée**

```python
# acs_hms_nephrology_billing/tests/test_bulk_invoice.py
from datetime import date, datetime, timedelta
from odoo.tests import TransactionCase, tagged


@tagged('post_install', '-at_install')
class TestBulkInvoice(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.env.company.nephro_auto_invoice = False

        cls.partner = cls.env['res.partner'].create({'name': 'Patient Bulk'})
        cls.patient = cls.env['hms.patient'].create({
            'name': 'Patient Bulk',
            'partner_id': cls.partner.id,
        })
        cls.rule = cls.env['acs.dialysis.pricing.rule'].create({
            'name': 'Test Bulk', 'price_unit': 20000.0,
        })
        cls.env['acs.dialysis.tariff.history'].create({
            'patient_id': cls.patient.id,
            'pricing_rule_id': cls.rule.id,
            'date_start': date.today() - timedelta(days=365),
        })
        cls.product = cls.env['product.product'].create({
            'name': 'Hémodialyse Bulk',
            'type': 'service',
        })

    def _make_done_procedure(self, delta_days=0):
        proc = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'state': 'running',
            'date': datetime.now() - timedelta(days=delta_days),
        })
        proc.action_done()
        return proc

    def test_bulk_wizard_creates_grouped_invoice(self):
        p1 = self._make_done_procedure(5)
        p2 = self._make_done_procedure(3)

        wizard = self.env['acs.dialysis.bulk.invoice.wizard'].create({
            'date_from': date.today() - timedelta(days=10),
            'date_to': date.today(),
        })
        result = wizard.action_create_invoices()
        self.assertIn('domain', result)

        # Les deux procédures doivent être facturées
        p1.invalidate_recordset()
        p2.invalidate_recordset()
        self.assertEqual(p1.billing_state, 'invoiced')
        self.assertEqual(p2.billing_state, 'invoiced')

        # Une seule facture groupée par patient
        self.assertEqual(p1.invoice_id, p2.invoice_id)
        self.assertEqual(p1.invoice_id.hospital_invoice_type, 'dialysis_grouped')

    def test_bulk_wizard_preview(self):
        self._make_done_procedure(2)
        wizard = self.env['acs.dialysis.bulk.invoice.wizard'].create({
            'date_from': date.today() - timedelta(days=10),
            'date_to': date.today(),
        })
        wizard.action_preview()
        self.assertTrue(wizard.preview_line_ids)

    def test_bulk_wizard_skips_already_invoiced(self):
        proc = self._make_done_procedure(1)
        proc.action_create_nephro_invoice()  # facturation unitaire d'abord
        self.assertEqual(proc.billing_state, 'invoiced')
        first_invoice = proc.invoice_id

        # Le wizard ne doit pas re-facturer cette séance
        wizard = self.env['acs.dialysis.bulk.invoice.wizard'].create({
            'date_from': date.today() - timedelta(days=10),
            'date_to': date.today(),
        })
        wizard.action_create_invoices()
        proc.invalidate_recordset()
        self.assertEqual(proc.invoice_id, first_invoice, "Pas de double facturation via wizard")
```

- [ ] **Step 2 : Lancer les tests (échec attendu)**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestBulkInvoice 2>&1 | tail -10
```

- [ ] **Step 3 : Implémenter `wizard/bulk_invoice.py`**

```python
# acs_hms_nephrology_billing/wizard/bulk_invoice.py
from odoo import api, fields, models


class AcsDialysisBulkInvoicePreview(models.TransientModel):
    _name = 'acs.dialysis.bulk.invoice.preview'
    _description = 'Ligne prévisualisation facturation groupée'

    wizard_id = fields.Many2one(
        'acs.dialysis.bulk.invoice.wizard', ondelete='cascade'
    )
    procedure_id = fields.Many2one('acs.patient.procedure', string='Séance')
    patient_id = fields.Many2one('hms.patient', string='Patient')
    procedure_date = fields.Datetime(string='Date séance')
    amount_estimated = fields.Float(string='Montant estimé HT')


class AcsDialysisBulkInvoiceWizard(models.TransientModel):
    _name = 'acs.dialysis.bulk.invoice.wizard'
    _description = 'Wizard facturation groupée dialyse'

    date_from = fields.Date(
        string='Du',
        required=True,
        default=lambda self: fields.Date.today().replace(day=1),
    )
    date_to = fields.Date(
        string='Au',
        required=True,
        default=fields.Date.today,
    )
    patient_ids = fields.Many2many('hms.patient', string='Patients (vide = tous)')
    preview_line_ids = fields.One2many(
        'acs.dialysis.bulk.invoice.preview', 'wizard_id', string='Prévisualisation'
    )

    def _get_uninvoiced_procedures(self):
        domain = [
            ('state', '=', 'done'),
            ('billing_state', '=', 'not_invoiced'),
            ('date', '>=', fields.Datetime.from_string(str(self.date_from) + ' 00:00:00')),
            ('date', '<=', fields.Datetime.from_string(str(self.date_to) + ' 23:59:59')),
        ]
        if self.patient_ids:
            domain.append(('patient_id', 'in', self.patient_ids.ids))
        return self.env['acs.patient.procedure'].search(domain)

    def action_preview(self):
        self.preview_line_ids.unlink()
        procedures = self._get_uninvoiced_procedures()
        lines = [
            (0, 0, {
                'wizard_id': self.id,
                'procedure_id': proc.id,
                'patient_id': proc.patient_id.id,
                'procedure_date': proc.date,
                'amount_estimated': (
                    proc.resolved_pricing_rule_id.price_unit
                    if proc.resolved_pricing_rule_id
                    else proc.price_unit
                ),
            })
            for proc in procedures
        ]
        self.preview_line_ids = lines
        return {'type': 'ir.actions.act_window_close'}

    def action_submit(self):
        self.state = 'submitted'

    def action_reimburse(self):
        self.state = 'reimbursed'

    def action_reject(self):
        self.state = 'rejected'

    def action_create_invoices(self):
        procedures = self._get_uninvoiced_procedures()

        # Résoudre les règles tarifaires avant regroupement
        procedures._resolve_pricing_rule()

        # Regrouper par patient
        by_patient = {}
        for proc in procedures:
            pid = proc.patient_id.id
            by_patient.setdefault(pid, self.env['acs.patient.procedure'])
            by_patient[pid] |= proc

        created_invoices = self.env['account.move']
        for patient_id, procs in by_patient.items():
            patient = self.env['hms.patient'].browse(patient_id)
            invoice = self._create_grouped_invoice(patient, procs)
            created_invoices |= invoice

        return {
            'type': 'ir.actions.act_window',
            'name': 'Factures créées',
            'res_model': 'account.move',
            'view_mode': 'list,form',
            'domain': [('id', 'in', created_invoices.ids)],
        }

    def _create_grouped_invoice(self, patient, procedures):
        invoice_line_vals = []
        for proc in procedures.sorted('date'):
            # Section par séance
            invoice_line_vals.append((0, 0, {
                'display_type': 'line_section',
                'name': "Séance du %s" % (
                    proc.date.strftime('%d/%m/%Y') if proc.date else '?'
                ),
            }))
            # Ligne service hémodialyse
            rule = proc.resolved_pricing_rule_id
            line_vals = {
                'product_id': proc.product_id.id,
                'quantity': 1,
                'price_unit': rule.price_unit if rule else proc.price_unit,
            }
            if rule and rule.tax_ids:
                line_vals['tax_ids'] = [(6, 0, rule.tax_ids.ids)]
            invoice_line_vals.append((0, 0, line_vals))

            # Consommables (non exemptés)
            for cons in proc.consumable_line_ids.filtered(
                lambda l: not l.acs_invoice_exempt
            ):
                invoice_line_vals.append((0, 0, {
                    'product_id': cons.product_id.id,
                    'quantity': cons.qty,
                    'price_unit': cons.product_id.list_price,
                }))

        invoice = self.env['account.move'].create({
            'move_type': 'out_invoice',
            'partner_id': patient.partner_id.id,
            'patient_id': patient.id,
            'hospital_invoice_type': 'dialysis_grouped',
            'invoice_line_ids': invoice_line_vals,
        })

        # Lier les procédures à la facture + appliquer les montants assurance
        procedures.write({'invoice_id': invoice.id})
        for proc in procedures:
            proc._apply_insurance_amounts(
                invoice,
                session_date=proc.date.date() if proc.date else fields.Date.today(),
            )

        return invoice
```

- [ ] **Step 4 : Lancer les tests**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  --test-tags /acs_hms_nephrology_billing:TestBulkInvoice 2>&1 | tail -5
```
Résultat attendu : `3 tests, 0 errors, 0 failures`

- [ ] **Step 5 : Commit**

```bash
git add acs_hms_nephrology_billing/wizard/bulk_invoice.py \
        acs_hms_nephrology_billing/tests/test_bulk_invoice.py
git commit -m "feat(billing): bulk invoice wizard with preview and grouped invoice creation"
```

---

## Task 10 : Cron alertes impayés + template email

**Files:**
- Create: `acs_hms_nephrology_billing/data/ir_cron.xml`
- Create: `acs_hms_nephrology_billing/data/mail_template.xml`

- [ ] **Step 1 : Créer `data/ir_cron.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="ir_cron_nephro_overdue_alerts" model="ir.cron">
        <field name="name">Dialyse — Alertes factures impayées</field>
        <field name="model_id" ref="account.model_account_move"/>
        <field name="state">code</field>
        <field name="code">model._cron_send_overdue_alerts()</field>
        <field name="interval_number">1</field>
        <field name="interval_type">days</field>
        <field name="numbercall">-1</field>
        <field name="active">True</field>
        <field name="user_id" ref="base.user_root"/>
    </record>
</odoo>
```

- [ ] **Step 2 : Créer `data/mail_template.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="email_template_overdue_alert" model="mail.template">
        <field name="name">Dialyse — Alerte facture impayée</field>
        <field name="model_id" ref="account.model_account_move"/>
        <field name="subject">Facture impayée — Clinique de Dialyse</field>
        <field name="email_to">{{ object.partner_id.email }}</field>
        <field name="body_html"><![CDATA[
<p>Bonjour <strong>{{ object.patient_id.name }}</strong>,</p>
<p>
    Nous vous informons qu'une facture reste impayée pour vos soins de dialyse :
</p>
<table style="border-collapse:collapse;width:100%">
    <tr>
        <td style="padding:4px;border:1px solid #ccc"><strong>N° Facture</strong></td>
        <td style="padding:4px;border:1px solid #ccc">{{ object.name }}</td>
    </tr>
    <tr>
        <td style="padding:4px;border:1px solid #ccc"><strong>Date</strong></td>
        <td style="padding:4px;border:1px solid #ccc">{{ object.invoice_date }}</td>
    </tr>
    <tr>
        <td style="padding:4px;border:1px solid #ccc"><strong>Montant restant dû</strong></td>
        <td style="padding:4px;border:1px solid #ccc">{{ object.amount_residual }} {{ object.currency_id.symbol }}</td>
    </tr>
</table>
<p>Merci de régulariser votre situation auprès de notre secrétariat.</p>
<p>Cordialement,<br/>La clinique</p>
        ]]></field>
        <field name="auto_delete">True</field>
    </record>
</odoo>
```

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_billing/data/ir_cron.xml \
        acs_hms_nephrology_billing/data/mail_template.xml
git commit -m "feat(billing): overdue alert cron and email template"
```

---

## Task 11 : Wizard export Excel

**Files:**
- Create: `acs_hms_nephrology_billing/wizard/excel_export.py`

- [ ] **Step 1 : Implémenter `wizard/excel_export.py`**

```python
# acs_hms_nephrology_billing/wizard/excel_export.py
import base64
import io
from odoo import fields, models


class AcsDialysisExcelExportWizard(models.TransientModel):
    _name = 'acs.dialysis.excel.export.wizard'
    _description = 'Export Excel séances dialyse'

    date_from = fields.Date(
        string='Du', required=True,
        default=lambda self: fields.Date.today().replace(day=1),
    )
    date_to = fields.Date(string='Au', required=True, default=fields.Date.today)
    patient_ids = fields.Many2many('hms.patient', string='Patients (vide = tous)')
    excel_file = fields.Binary(string='Fichier Excel', readonly=True)
    excel_filename = fields.Char(string='Nom du fichier', readonly=True)

    def action_generate_excel(self):
        try:
            import xlsxwriter
        except ImportError:
            raise ImportError(
                "Le module xlsxwriter n'est pas disponible dans cet environnement."
            )

        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        ws = workbook.add_worksheet('Séances Dialyse')

        # Styles
        bold = workbook.add_format({'bold': True, 'bg_color': '#D3E4F4'})
        date_fmt = workbook.add_format({'num_format': 'dd/mm/yyyy'})
        money_fmt = workbook.add_format({'num_format': '#,##0.00'})

        # En-têtes
        headers = [
            'Date séance', 'Patient', 'N° Dossier', 'N° Facture',
            'Prix HT séance', 'Consommables HT', 'TVA', 'Total TTC',
            'Part assurance primaire', 'Part assurance secondaire',
            'Part patient', 'Statut paiement', 'Date paiement', 'Mode paiement',
        ]
        for col, h in enumerate(headers):
            ws.write(0, col, h, bold)

        # Données — factures dialyse confirmées dans la période
        domain = [
            ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
            ('state', '=', 'posted'),
            ('invoice_date', '>=', self.date_from),
            ('invoice_date', '<=', self.date_to),
        ]
        if self.patient_ids:
            domain.append(('patient_id', 'in', self.patient_ids.ids))

        moves = self.env['account.move'].search(domain, order='invoice_date, patient_id')

        row = 1
        for move in moves:
            patient = move.patient_id
            lines = move.invoice_line_ids.filtered(
                lambda l: l.display_type not in ('line_section', 'line_note')
            )
            price_ht = sum(lines.mapped('price_subtotal'))
            taxes = move.amount_tax
            total_ttc = move.amount_total
            insurance = sum(lines.mapped('acs_insurance_amount'))
            patient_part = sum(lines.mapped('acs_patient_amount'))

            # Ventilation primaire/secondaire non stockée — on met insurance total en primaire
            ws.write(row, 0, move.invoice_date, date_fmt)
            ws.write(row, 1, patient.name if patient else '')
            ws.write(row, 2, patient.patient_id if patient else '')
            ws.write(row, 3, move.name or '')
            ws.write(row, 4, price_ht, money_fmt)
            ws.write(row, 5, 0.0, money_fmt)  # consommables séparés non isolés en V1
            ws.write(row, 6, taxes, money_fmt)
            ws.write(row, 7, total_ttc, money_fmt)
            ws.write(row, 8, insurance, money_fmt)
            ws.write(row, 9, 0.0, money_fmt)
            ws.write(row, 10, patient_part, money_fmt)
            ws.write(row, 11, dict(move._fields['payment_state'].selection).get(move.payment_state, ''))
            # Date et mode paiement via account.payment
            payments = move._get_reconciled_payments()
            last_payment = payments[-1] if payments else None
            ws.write(row, 12, last_payment.date if last_payment else '', date_fmt)
            ws.write(row, 13, last_payment.journal_id.name if last_payment else '')
            row += 1

        workbook.close()
        output.seek(0)

        filename = 'seances_dialyse_%s_%s.xlsx' % (
            self.date_from.strftime('%Y%m%d'),
            self.date_to.strftime('%Y%m%d'),
        )
        self.excel_file = base64.b64encode(output.read())
        self.excel_filename = filename

        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }
```

- [ ] **Step 2 : Commit**

```bash
git add acs_hms_nephrology_billing/wizard/excel_export.py
git commit -m "feat(billing): Excel export wizard for dialysis sessions"
```

---

## Task 12 : Wizard rapport mensuel PDF

**Files:**
- Create: `acs_hms_nephrology_billing/wizard/monthly_report.py`

- [ ] **Step 1 : Implémenter `wizard/monthly_report.py`**

```python
# acs_hms_nephrology_billing/wizard/monthly_report.py
from calendar import monthrange
from datetime import date
from odoo import fields, models


class AcsDialysisMonthlyReportWizard(models.TransientModel):
    _name = 'acs.dialysis.monthly.report.wizard'
    _description = 'Wizard rapport mensuel facturation dialyse'

    month = fields.Selection(
        [(str(i), m) for i, m in enumerate([
            'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
            'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
        ], start=1)],
        string='Mois',
        required=True,
        default=lambda self: str(date.today().month),
    )
    year = fields.Integer(
        string='Année', required=True,
        default=lambda self: date.today().year,
    )

    def _get_report_data(self):
        month_int = int(self.month)
        _, last_day = monthrange(self.year, month_int)
        date_from = date(self.year, month_int, 1)
        date_to = date(self.year, month_int, last_day)

        moves = self.env['account.move'].search([
            ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
            ('state', '=', 'posted'),
            ('invoice_date', '>=', date_from),
            ('invoice_date', '<=', date_to),
        ])

        total_ttc = sum(moves.mapped('amount_total'))
        paid = moves.filtered(lambda m: m.payment_state in ('paid', 'in_payment'))
        total_paid = sum(paid.mapped('amount_total'))
        total_pending = total_ttc - total_paid

        overdue = moves.filtered(
            lambda m: m.payment_state not in ('paid', 'in_payment', 'reversed')
            and m.invoice_date and (date.today() - m.invoice_date).days > (
                self.env.company.nephro_overdue_days or 30
            )
        )
        total_overdue = sum(overdue.mapped('amount_residual'))

        # Top impayés (20 max)
        top_overdue = []
        patients_seen = {}
        for m in overdue.sorted(lambda mv: -mv.amount_residual):
            if m.patient_id and m.patient_id.id not in patients_seen:
                days = (date.today() - m.invoice_date).days if m.invoice_date else 0
                patients_seen[m.patient_id.id] = True
                top_overdue.append({
                    'patient': m.patient_id.name,
                    'amount': m.amount_residual,
                    'days': days,
                })
            if len(top_overdue) >= 20:
                break

        return {
            'date_from': date_from,
            'date_to': date_to,
            'total_ttc': total_ttc,
            'total_paid': total_paid,
            'total_pending': total_pending,
            'total_overdue': total_overdue,
            'top_overdue': top_overdue,
            'company': self.env.company,
        }

    def action_print_report(self):
        data = self._get_report_data()
        return self.env.ref(
            'acs_hms_nephrology_billing.action_report_nephro_monthly'
        ).report_action(self, data=data)
```

- [ ] **Step 2 : Commit**

```bash
git add acs_hms_nephrology_billing/wizard/monthly_report.py
git commit -m "feat(billing): monthly report wizard"
```

---

## Task 13 : Templates QWeb (rapports PDF)

**Files:**
- Create: `acs_hms_nephrology_billing/report/report_monthly.xml`
- Create: `acs_hms_nephrology_billing/report/report_patient.xml`

- [ ] **Step 1 : Créer `report/report_monthly.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Action rapport mensuel -->
    <record id="action_report_nephro_monthly" model="ir.actions.report">
        <field name="name">Rapport Mensuel Facturation Dialyse</field>
        <field name="model">acs.dialysis.monthly.report.wizard</field>
        <field name="report_type">qweb-pdf</field>
        <field name="report_name">acs_hms_nephrology_billing.report_nephro_monthly</field>
        <field name="report_file">acs_hms_nephrology_billing.report_nephro_monthly</field>
        <field name="print_report_name">'Rapport_Mensuel_Dialyse_%s_%s' % (object.month, object.year)</field>
    </record>

    <!-- Template QWeb -->
    <template id="report_nephro_monthly">
        <t t-call="web.html_container">
            <t t-foreach="docs" t-as="wizard">
                <t t-set="data" t-value="wizard._get_report_data()"/>
                <t t-call="web.external_layout">
                    <div class="page">
                        <h2>Rapport Mensuel — Facturation Dialyse</h2>
                        <p>
                            Période : <strong>
                                <t t-esc="data['date_from'].strftime('%d/%m/%Y')"/> au
                                <t t-esc="data['date_to'].strftime('%d/%m/%Y')"/>
                            </strong>
                        </p>

                        <!-- Tableau 1 : Résumé financier -->
                        <h4>Résumé financier</h4>
                        <table class="table table-sm table-bordered">
                            <thead><tr>
                                <th>CA Total TTC</th>
                                <th>Encaissé</th>
                                <th>En attente</th>
                                <th>Impayé (&gt; seuil)</th>
                            </tr></thead>
                            <tbody><tr>
                                <td><t t-esc="'%,.0f' % data['total_ttc']"/> FCFA</td>
                                <td><t t-esc="'%,.0f' % data['total_paid']"/> FCFA</td>
                                <td><t t-esc="'%,.0f' % data['total_pending']"/> FCFA</td>
                                <td><t t-esc="'%,.0f' % data['total_overdue']"/> FCFA</td>
                            </tr></tbody>
                        </table>

                        <!-- Tableau 2 : Top impayés -->
                        <h4>Top impayés</h4>
                        <table class="table table-sm table-bordered">
                            <thead><tr>
                                <th>Patient</th>
                                <th>Montant dû (FCFA)</th>
                                <th>Jours de retard</th>
                            </tr></thead>
                            <tbody>
                                <t t-foreach="data['top_overdue']" t-as="line">
                                    <tr>
                                        <td><t t-esc="line['patient']"/></td>
                                        <td><t t-esc="'%,.0f' % line['amount']"/></td>
                                        <td><t t-esc="line['days']"/></td>
                                    </tr>
                                </t>
                                <t t-if="not data['top_overdue']">
                                    <tr><td colspan="3">Aucun impayé</td></tr>
                                </t>
                            </tbody>
                        </table>

                        <p class="text-muted small">
                            Rapport généré le <t t-esc="context_timestamp(datetime.datetime.now()).strftime('%d/%m/%Y à %H:%M')"/>
                        </p>
                    </div>
                </t>
            </t>
        </t>
    </template>
</odoo>
```

- [ ] **Step 2 : Créer `report/report_patient.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Action rapport patient -->
    <record id="action_report_nephro_patient_summary" model="ir.actions.report">
        <field name="name">Attestation de Soins — Dialyse</field>
        <field name="model">hms.patient</field>
        <field name="report_type">qweb-pdf</field>
        <field name="report_name">acs_hms_nephrology_billing.report_nephro_patient_summary</field>
        <field name="report_file">acs_hms_nephrology_billing.report_nephro_patient_summary</field>
        <field name="print_report_name">'Attestation_Soins_%s' % (object.name.replace(' ', '_'))</field>
    </record>

    <!-- Template QWeb -->
    <template id="report_nephro_patient_summary">
        <t t-call="web.html_container">
            <t t-foreach="docs" t-as="patient">
                <t t-call="web.external_layout">
                    <div class="page">
                        <h2>Attestation de Soins — Dialyse</h2>
                        <table class="table table-sm" style="width:60%">
                            <tr>
                                <td><strong>Patient :</strong></td>
                                <td><t t-esc="patient.name"/></td>
                            </tr>
                            <tr>
                                <td><strong>N° Dossier :</strong></td>
                                <td><t t-esc="patient.patient_id or '—'"/></td>
                            </tr>
                        </table>

                        <!-- Tableau des factures dialyse -->
                        <t t-set="invoices" t-value="env['account.move'].search([
                            ('patient_id', '=', patient.id),
                            ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
                            ('state', '=', 'posted'),
                        ], order='invoice_date')"/>

                        <h4>Historique de facturation</h4>
                        <table class="table table-sm table-bordered">
                            <thead><tr>
                                <th>Date</th>
                                <th>N° Facture</th>
                                <th>Montant TTC</th>
                                <th>Part assurance</th>
                                <th>Part patient</th>
                                <th>Statut</th>
                            </tr></thead>
                            <tbody>
                                <t t-foreach="invoices" t-as="inv">
                                    <t t-set="lines" t-value="inv.invoice_line_ids.filtered(lambda l: l.display_type not in ('line_section','line_note'))"/>
                                    <tr>
                                        <td><t t-esc="inv.invoice_date.strftime('%d/%m/%Y') if inv.invoice_date else '—'"/></td>
                                        <td><t t-esc="inv.name"/></td>
                                        <td><t t-esc="'%,.0f' % inv.amount_total"/> FCFA</td>
                                        <td><t t-esc="'%,.0f' % sum(lines.mapped('acs_insurance_amount'))"/> FCFA</td>
                                        <td><t t-esc="'%,.0f' % sum(lines.mapped('acs_patient_amount'))"/> FCFA</td>
                                        <td><t t-esc="dict(inv._fields['payment_state'].selection).get(inv.payment_state, inv.payment_state)"/></td>
                                    </tr>
                                </t>
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="2"><strong>Total</strong></td>
                                    <td><strong><t t-esc="'%,.0f' % sum(invoices.mapped('amount_total'))"/> FCFA</strong></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>

                        <div style="margin-top:40px">
                            <p>
                                <strong>Solde restant dû :</strong>
                                <t t-esc="'%,.0f' % patient.balance_due"/> FCFA
                            </p>
                        </div>

                        <div style="margin-top:60px;border-top:1px solid #000;width:200px;text-align:center">
                            <p style="font-size:10px">Cachet et signature</p>
                        </div>
                        <p class="text-muted small">
                            Attestation délivrée par <t t-esc="env.company.name"/> le
                            <t t-esc="context_timestamp(datetime.datetime.now()).strftime('%d/%m/%Y')"/>
                        </p>
                    </div>
                </t>
            </t>
        </t>
    </template>
</odoo>
```

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_billing/report/
git commit -m "feat(billing): QWeb templates for monthly report and patient attestation"
```

---

## Task 14 : Vues — règle tarifaire, assureurs, config

**Files:**
- Create: `acs_hms_nephrology_billing/views/pricing_rule_views.xml`
- Create: `acs_hms_nephrology_billing/views/insurer_views.xml`
- Create: `acs_hms_nephrology_billing/views/config_settings_views.xml`

- [ ] **Step 1 : Créer `views/pricing_rule_views.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- List view -->
    <record id="view_dialysis_pricing_rule_list" model="ir.ui.view">
        <field name="name">acs.dialysis.pricing.rule.list</field>
        <field name="model">acs.dialysis.pricing.rule</field>
        <field name="arch" type="xml">
            <list string="Règles tarifaires">
                <field name="name"/>
                <field name="price_unit"/>
                <field name="tax_ids" widget="many2many_tags"/>
                <field name="active" optional="hide"/>
            </list>
        </field>
    </record>

    <!-- Form view -->
    <record id="view_dialysis_pricing_rule_form" model="ir.ui.view">
        <field name="name">acs.dialysis.pricing.rule.form</field>
        <field name="model">acs.dialysis.pricing.rule</field>
        <field name="arch" type="xml">
            <form string="Règle tarifaire dialyse">
                <sheet>
                    <div class="oe_title">
                        <label for="name"/>
                        <h1><field name="name"/></h1>
                    </div>
                    <group>
                        <field name="price_unit"/>
                        <field name="tax_ids" widget="many2many_tags"/>
                        <field name="active"/>
                    </group>
                    <group string="Notes">
                        <field name="notes" nolabel="1"/>
                    </group>
                </sheet>
            </form>
        </field>
    </record>

    <!-- Action -->
    <record id="action_dialysis_pricing_rule" model="ir.actions.act_window">
        <field name="name">Règles tarifaires</field>
        <field name="res_model">acs.dialysis.pricing.rule</field>
        <field name="view_mode">list,form</field>
    </record>
</odoo>
```

- [ ] **Step 2 : Créer `views/insurer_views.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Insurer list/form -->
    <record id="view_dialysis_insurer_list" model="ir.ui.view">
        <field name="name">acs.dialysis.insurer.list</field>
        <field name="model">acs.dialysis.insurer</field>
        <field name="arch" type="xml">
            <list string="Assureurs"><field name="name"/><field name="partner_id"/></list>
        </field>
    </record>

    <record id="action_dialysis_insurer" model="ir.actions.act_window">
        <field name="name">Assureurs</field>
        <field name="res_model">acs.dialysis.insurer</field>
        <field name="view_mode">list,form</field>
    </record>

    <!-- Insurer claim list -->
    <record id="view_dialysis_insurer_claim_list" model="ir.ui.view">
        <field name="name">acs.dialysis.insurer.claim.list</field>
        <field name="model">acs.dialysis.insurer.claim</field>
        <field name="arch" type="xml">
            <list string="Dossiers remboursement" decoration-success="state=='reimbursed'"
                  decoration-warning="state=='submitted'" decoration-danger="state=='rejected'">
                <field name="name"/>
                <field name="patient_id"/>
                <field name="insurer_id"/>
                <field name="date_from"/>
                <field name="date_to"/>
                <field name="amount_claimed"/>
                <field name="amount_reimbursed"/>
                <field name="state" widget="badge"
                       decoration-success="state=='reimbursed'"
                       decoration-warning="state=='submitted'"
                       decoration-danger="state=='rejected'"/>
            </list>
        </field>
    </record>

    <record id="view_dialysis_insurer_claim_form" model="ir.ui.view">
        <field name="name">acs.dialysis.insurer.claim.form</field>
        <field name="model">acs.dialysis.insurer.claim</field>
        <field name="arch" type="xml">
            <form>
                <header>
                    <button name="action_submit" string="Soumettre"
                            type="object" states="draft" class="btn-primary"/>
                    <button name="action_reimburse" string="Rembourser"
                            type="object" states="submitted" class="btn-success"/>
                    <button name="action_reject" string="Rejeter"
                            type="object" states="submitted" class="btn-danger"/>
                    <field name="state" widget="statusbar"
                           statusbar_visible="draft,submitted,reimbursed"/>
                </header>
                <sheet>
                    <div class="oe_title">
                        <h1><field name="name" readonly="1"/></h1>
                    </div>
                    <group>
                        <group>
                            <field name="patient_id"/>
                            <field name="insurer_id"/>
                        </group>
                        <group>
                            <field name="date_from"/>
                            <field name="date_to"/>
                            <field name="amount_claimed"/>
                            <field name="amount_reimbursed"/>
                        </group>
                    </group>
                    <field name="invoice_ids" widget="many2many_list">
                        <list><field name="name"/><field name="invoice_date"/><field name="amount_total"/></list>
                    </field>
                    <field name="notes"/>
                </sheet>
                <div class="oe_chatter">
                    <field name="message_follower_ids"/>
                    <field name="message_ids"/>
                </div>
            </form>
        </field>
    </record>

    <record id="action_dialysis_insurer_claim" model="ir.actions.act_window">
        <field name="name">Dossiers Remboursement</field>
        <field name="res_model">acs.dialysis.insurer.claim</field>
        <field name="view_mode">list,form</field>
    </record>
</odoo>
```

- [ ] **Step 3 : Créer `views/config_settings_views.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="res_config_settings_view_nephro_billing" model="ir.ui.view">
        <field name="name">res.config.settings.nephro.billing</field>
        <field name="model">res.config.settings</field>
        <field name="inherit_id" ref="base_setup.action_general_configuration"/>
        <field name="arch" type="xml">
            <xpath expr="//div[hasclass('o_settings_container')]" position="inside">
                <div class="app_settings_block">
                    <h2>Facturation Dialyse</h2>
                    <div class="row mt16 o_settings_container">
                        <div class="col-12 col-lg-6 o_setting_box">
                            <div class="o_setting_left_pane">
                                <field name="nephro_auto_invoice"/>
                            </div>
                            <div class="o_setting_right_pane">
                                <label for="nephro_auto_invoice"/>
                                <div class="text-muted">
                                    Crée automatiquement une facture brouillon à la fin de chaque séance.
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-lg-6 o_setting_box">
                            <div class="o_setting_right_pane">
                                <label for="nephro_overdue_days"/>
                                <field name="nephro_overdue_days" class="o_light_label"/>
                                <div class="text-muted">jours avant alerte impayé</div>
                            </div>
                        </div>
                        <div class="col-12 col-lg-6 o_setting_box">
                            <div class="o_setting_left_pane">
                                <field name="nephro_alert_email"/>
                            </div>
                            <div class="o_setting_right_pane">
                                <label for="nephro_alert_email"/>
                            </div>
                        </div>
                        <div class="col-12 col-lg-6 o_setting_box">
                            <div class="o_setting_left_pane">
                                <field name="nephro_alert_whatsapp"/>
                            </div>
                            <div class="o_setting_right_pane">
                                <label for="nephro_alert_whatsapp"/>
                            </div>
                        </div>
                    </div>
                </div>
            </xpath>
        </field>
    </record>
</odoo>
```

- [ ] **Step 4 : Commit**

```bash
git add acs_hms_nephrology_billing/views/pricing_rule_views.xml \
        acs_hms_nephrology_billing/views/insurer_views.xml \
        acs_hms_nephrology_billing/views/config_settings_views.xml
git commit -m "feat(billing): views for pricing rules, insurers, config settings"
```

---

## Task 15 : Vues patient + séance + wizard + menus

**Files:**
- Create: `acs_hms_nephrology_billing/views/patient_views.xml`
- Create: `acs_hms_nephrology_billing/views/procedure_views.xml`
- Create: `acs_hms_nephrology_billing/views/account_move_views.xml`
- Create: `acs_hms_nephrology_billing/views/bulk_invoice_views.xml`
- Create: `acs_hms_nephrology_billing/views/monthly_report_views.xml`
- Create: `acs_hms_nephrology_billing/views/excel_export_views.xml`
- Create: `acs_hms_nephrology_billing/views/menu.xml`

- [ ] **Step 1 : Créer `views/patient_views.xml`** (onglet Facturation sur fiche patient)

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="view_hms_patient_billing_tab" model="ir.ui.view">
        <field name="name">hms.patient.billing.tab</field>
        <field name="model">hms.patient</field>
        <field name="inherit_id" ref="acs_hms.view_patient_form"/>
        <field name="arch" type="xml">
            <xpath expr="//notebook" position="inside">
                <page string="Facturation" name="billing_tab"
                      groups="acs_hms_nephrology_billing.group_nephrology_billing">
                    <group>
                        <group string="Solde actuel">
                            <field name="balance_due"/>
                            <field name="last_payment_date"/>
                            <field name="overdue_days"/>
                            <field name="payment_status" widget="badge"
                                   decoration-success="payment_status=='ok'"
                                   decoration-warning="payment_status=='warning'"
                                   decoration-danger="payment_status=='overdue'"/>
                        </group>
                    </group>
                    <separator string="Historique tarifaire"/>
                    <field name="tariff_history_ids">
                        <list editable="bottom">
                            <field name="pricing_rule_id"/>
                            <field name="date_start"/>
                            <field name="date_end"/>
                            <field name="notes"/>
                        </list>
                    </field>
                    <separator string="Assureurs"/>
                    <field name="patient_insurer_ids">
                        <list editable="bottom">
                            <field name="insurer_id"/>
                            <field name="priority"/>
                            <field name="coverage_rate"/>
                            <field name="date_start"/>
                            <field name="date_end"/>
                            <field name="policy_number"/>
                        </list>
                    </field>
                    <div class="o_row">
                        <button name="%(acs_hms_nephrology_billing.action_report_nephro_patient_summary)d"
                                string="Attestation annuelle PDF"
                                type="action"
                                class="btn btn-secondary"/>
                    </div>
                </page>
            </xpath>
        </field>
    </record>

    <!-- Vue liste patients avec badge solde -->
    <record id="view_hms_patient_billing_list" model="ir.ui.view">
        <field name="name">hms.patient.billing.list</field>
        <field name="model">hms.patient</field>
        <field name="inherit_id" ref="acs_hms.view_patient_list"/>
        <field name="arch" type="xml">
            <xpath expr="//list" position="inside">
                <field name="payment_status" optional="show" widget="badge"
                       decoration-success="payment_status=='ok'"
                       decoration-warning="payment_status=='warning'"
                       decoration-danger="payment_status=='overdue'"/>
                <field name="balance_due" optional="show"/>
            </xpath>
        </field>
    </record>
</odoo>
```

- [ ] **Step 2 : Créer `views/procedure_views.xml`** (boutons smart facturation)

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="view_acs_patient_procedure_billing" model="ir.ui.view">
        <field name="name">acs.patient.procedure.billing</field>
        <field name="model">acs.patient.procedure</field>
        <field name="inherit_id" ref="acs_hms.view_acs_patient_procedure_form"/>
        <field name="arch" type="xml">
            <!-- Smart buttons -->
            <xpath expr="//div[@name='button_box']" position="inside">
                <button name="action_create_nephro_invoice"
                        type="object"
                        class="oe_stat_button"
                        icon="fa-file-invoice"
                        invisible="state != 'done' or billing_state != 'not_invoiced'"
                        groups="acs_hms_nephrology_billing.group_nephrology_billing">
                    <span class="o_stat_text">Facturer</span>
                </button>
                <button name="view_invoice"
                        type="object"
                        class="oe_stat_button"
                        icon="fa-file-text-o"
                        invisible="billing_state == 'not_invoiced'"
                        groups="acs_hms_nephrology_billing.group_nephrology_billing">
                    <div class="o_field_widget o_stat_info">
                        <span class="o_stat_text">Facture</span>
                        <span class="o_stat_value">
                            <field name="billing_state" widget="badge"
                                   decoration-success="billing_state=='paid'"
                                   decoration-info="billing_state=='invoiced'"/>
                        </span>
                    </div>
                </button>
            </xpath>
            <!-- Règle tarifaire (visible après fin de séance) -->
            <xpath expr="//sheet//group[1]" position="after">
                <group string="Facturation"
                       invisible="state not in ('done','running')"
                       groups="acs_hms_nephrology_billing.group_nephrology_billing">
                    <field name="resolved_pricing_rule_id"
                           readonly="billing_state != 'not_invoiced'"/>
                    <field name="billing_state" readonly="1"/>
                </group>
            </xpath>
        </field>
    </record>
</odoo>
```

- [ ] **Step 3 : Créer `views/account_move_views.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Action : factures dialyse en attente (séances done non facturées) -->
    <record id="action_dialysis_invoices_pending" model="ir.actions.act_window">
        <field name="name">Séances non facturées</field>
        <field name="res_model">acs.patient.procedure</field>
        <field name="view_mode">list,form</field>
        <field name="domain">[('state','=','done'),('billing_state','=','not_invoiced')]</field>
        <field name="context">{'search_default_group_by_patient': 1}</field>
    </record>

    <!-- Action : toutes les factures dialyse -->
    <record id="action_dialysis_all_invoices" model="ir.actions.act_window">
        <field name="name">Factures Dialyse</field>
        <field name="res_model">account.move</field>
        <field name="view_mode">list,form</field>
        <field name="domain">[('hospital_invoice_type','in',['dialysis_session','dialysis_grouped']),('move_type','=','out_invoice')]</field>
    </record>

    <!-- Action : soldes patients -->
    <record id="action_dialysis_patient_balances" model="ir.actions.act_window">
        <field name="name">Soldes Patients</field>
        <field name="res_model">hms.patient</field>
        <field name="view_mode">list,form</field>
        <field name="domain">[('nephrology_care','=',True)]</field>
        <field name="context">{'search_default_group_by_status': 1}</field>
    </record>
</odoo>
```

- [ ] **Step 4 : Créer les views wizard**

`views/bulk_invoice_views.xml` :
```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="view_bulk_invoice_wizard_form" model="ir.ui.view">
        <field name="name">acs.dialysis.bulk.invoice.wizard.form</field>
        <field name="model">acs.dialysis.bulk.invoice.wizard</field>
        <field name="arch" type="xml">
            <form string="Facturation groupée — Dialyse">
                <group>
                    <field name="date_from"/>
                    <field name="date_to"/>
                    <field name="patient_ids" widget="many2many_tags"/>
                </group>
                <field name="preview_line_ids">
                    <list>
                        <field name="patient_id"/>
                        <field name="procedure_date"/>
                        <field name="amount_estimated"/>
                    </list>
                </field>
                <footer>
                    <button name="action_preview" type="object" string="Prévisualiser" class="btn-secondary"/>
                    <button name="action_create_invoices" type="object" string="Créer les factures" class="btn-primary"/>
                    <button special="cancel" string="Annuler"/>
                </footer>
            </form>
        </field>
    </record>

    <record id="action_bulk_invoice_wizard" model="ir.actions.act_window">
        <field name="name">Facturation groupée</field>
        <field name="res_model">acs.dialysis.bulk.invoice.wizard</field>
        <field name="view_mode">form</field>
        <field name="target">new</field>
    </record>
</odoo>
```

`views/monthly_report_views.xml` :
```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="view_monthly_report_wizard_form" model="ir.ui.view">
        <field name="name">acs.dialysis.monthly.report.wizard.form</field>
        <field name="model">acs.dialysis.monthly.report.wizard</field>
        <field name="arch" type="xml">
            <form string="Rapport mensuel facturation">
                <group>
                    <field name="month"/>
                    <field name="year"/>
                </group>
                <footer>
                    <button name="action_print_report" type="object" string="Générer le rapport" class="btn-primary"/>
                    <button special="cancel" string="Annuler"/>
                </footer>
            </form>
        </field>
    </record>

    <record id="action_monthly_report_wizard" model="ir.actions.act_window">
        <field name="name">Rapport mensuel</field>
        <field name="res_model">acs.dialysis.monthly.report.wizard</field>
        <field name="view_mode">form</field>
        <field name="target">new</field>
    </record>
</odoo>
```

`views/excel_export_views.xml` :
```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="view_excel_export_wizard_form" model="ir.ui.view">
        <field name="name">acs.dialysis.excel.export.wizard.form</field>
        <field name="model">acs.dialysis.excel.export.wizard</field>
        <field name="arch" type="xml">
            <form string="Export Excel — Séances dialyse">
                <group>
                    <field name="date_from"/>
                    <field name="date_to"/>
                    <field name="patient_ids" widget="many2many_tags"/>
                </group>
                <group invisible="not excel_file">
                    <field name="excel_file" filename="excel_filename" widget="binary"/>
                    <field name="excel_filename" invisible="1"/>
                </group>
                <footer>
                    <button name="action_generate_excel" type="object" string="Générer l'export" class="btn-primary"/>
                    <button special="cancel" string="Fermer"/>
                </footer>
            </form>
        </field>
    </record>

    <record id="action_excel_export_wizard" model="ir.actions.act_window">
        <field name="name">Export Excel</field>
        <field name="res_model">acs.dialysis.excel.export.wizard</field>
        <field name="view_mode">form</field>
        <field name="target">new</field>
    </record>
</odoo>
```

- [ ] **Step 5 : Créer `views/menu.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Menu principal Facturation Dialyse -->
    <menuitem id="menu_nephro_billing_root"
              name="Facturation Dialyse"
              sequence="50"
              groups="acs_hms_nephrology_billing.group_nephrology_billing"/>

    <menuitem id="menu_nephro_billing_pending"
              name="Séances non facturées"
              parent="menu_nephro_billing_root"
              action="action_dialysis_invoices_pending"
              sequence="10"/>

    <menuitem id="menu_nephro_billing_all_invoices"
              name="Toutes les factures"
              parent="menu_nephro_billing_root"
              action="action_dialysis_all_invoices"
              sequence="20"/>

    <menuitem id="menu_nephro_billing_claims"
              name="Dossiers assureurs"
              parent="menu_nephro_billing_root"
              action="action_dialysis_insurer_claim"
              sequence="30"/>

    <menuitem id="menu_nephro_billing_balances"
              name="Soldes patients"
              parent="menu_nephro_billing_root"
              action="action_dialysis_patient_balances"
              sequence="40"/>

    <menuitem id="menu_nephro_billing_bulk"
              name="Facturation groupée"
              parent="menu_nephro_billing_root"
              action="action_bulk_invoice_wizard"
              sequence="50"/>

    <!-- Sous-menu Configuration -->
    <menuitem id="menu_nephro_billing_config"
              name="Configuration"
              parent="menu_nephro_billing_root"
              sequence="90"/>

    <menuitem id="menu_nephro_billing_pricing_rules"
              name="Règles tarifaires"
              parent="menu_nephro_billing_config"
              action="action_dialysis_pricing_rule"
              sequence="10"/>

    <menuitem id="menu_nephro_billing_insurers"
              name="Assureurs"
              parent="menu_nephro_billing_config"
              action="action_dialysis_insurer"
              sequence="20"/>

    <!-- Rapports -->
    <menuitem id="menu_nephro_billing_reports"
              name="Rapports"
              parent="menu_nephro_billing_root"
              sequence="80"/>

    <menuitem id="menu_nephro_billing_monthly_report"
              name="Rapport mensuel PDF"
              parent="menu_nephro_billing_reports"
              action="action_monthly_report_wizard"
              sequence="10"/>

    <menuitem id="menu_nephro_billing_excel_export"
              name="Export Excel"
              parent="menu_nephro_billing_reports"
              action="action_excel_export_wizard"
              sequence="20"/>
</odoo>
```

- [ ] **Step 6 : Commit**

```bash
git add acs_hms_nephrology_billing/views/
git commit -m "feat(billing): all views, menus, wizard forms"
```

---

## Task 16 : Tests de régression complets + installation module

- [ ] **Step 1 : Lancer tous les tests du module**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  --test-enable --stop-after-init -d test_db \
  -i acs_hms_nephrology_billing \
  --test-tags /acs_hms_nephrology_billing 2>&1 | grep -E "tests|errors|failures|ERROR|WARNING" | tail -20
```
Résultat attendu : `X tests, 0 errors, 0 failures`

- [ ] **Step 2 : Corriger les éventuelles erreurs**

Si des tests échouent, examiner le traceback et corriger le code concerné avant de continuer.

- [ ] **Step 3 : Installer le module en base de développement**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  python /usr/lib/python3/dist-packages/odoo/odoo-bin \
  -c /etc/odoo/odoo.conf -d as_shafi_dev \
  -i acs_hms_nephrology_billing --stop-after-init 2>&1 | tail -10
```
Résultat attendu : `Module acs_hms_nephrology_billing installed` (ou équivalent)

- [ ] **Step 4 : Vérifications manuelles clés**
  1. Menu "Facturation Dialyse" visible pour un utilisateur avec le groupe `nephrology_billing`
  2. Fiche patient → onglet "Facturation" avec tariff_history et patient_insurer
  3. Fiche séance `done` → bouton smart "Facturer" visible
  4. Paramètres société → section "Facturation Dialyse" présente
  5. Wizard "Facturation groupée" → formulaire s'ouvre
  6. Wizard "Rapport mensuel" → génère un PDF sans erreur

- [ ] **Step 5 : Commit final**

```bash
git add -A
git commit -m "feat(billing): module acs_hms_nephrology_billing — Sprint 3 Section 7 complet"
```

---

## Résumé des modèles créés

| Modèle | Responsabilité |
|---|---|
| `acs.dialysis.pricing.rule` | Règle tarifaire (prix HT, TVA) |
| `acs.dialysis.tariff.history` | Historique règles par patient + `get_active_rule()` |
| `acs.dialysis.insurer` | Référentiel assureurs |
| `acs.dialysis.patient.insurer` | Couverture assurance par patient (primaire/secondaire) |
| `acs.dialysis.insurer.claim` | Dossier remboursement par assureur |
| `hms.patient` (extend) | Balance, statut paiement, historique tarifaire, assureurs |
| `acs.patient.procedure` (extend) | `resolved_pricing_rule_id`, `billing_state`, hook `action_done` |
| `account.move` (extend) | Types `dialysis_session`/`dialysis_grouped`, cron alertes |
| `res.company` + `res.config.settings` (extend) | Paramètres facturation auto, alertes |
| `acs.dialysis.bulk.invoice.wizard` | Facturation groupée par période |
| `acs.dialysis.monthly.report.wizard` | Rapport PDF mensuel |
| `acs.dialysis.excel.export.wizard` | Export Excel séances |
