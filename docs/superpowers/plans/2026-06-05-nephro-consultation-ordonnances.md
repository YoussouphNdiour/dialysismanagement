# Nephro Consultation & Ordonnances Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Étendre le système d'ordonnances d'`acs_hms` pour les besoins néphro-spécifiques — flag néphro, groupes médicaments pré-configurés, traçabilité croisée séance/bilan, onglet patient, badge portail.

**Architecture:** Tout dans `acs_hms_nephrology` via `_inherit` — trois fichiers Python nouveaux, deux XML de vues nouveaux, un XML de données. Aucun nouveau module, aucune migration, non-destructif vis-à-vis des modules ACS existants.

**Tech Stack:** Odoo 19, Python 3, QWeb, `odoo.tests.common.TransactionCase`

---

## Carte des fichiers

| Fichier | Statut | Responsabilité |
|---|---|---|
| `acs_hms_nephrology/models/nephro_prescription.py` | Créer | `_inherit prescription.order` — champs `is_nephro_prescription`, `nephro_context` |
| `acs_hms_nephrology/models/nephro_procedure.py` | Créer | `_inherit acs.patient.procedure` — champs calculés `nephro_prescription_ids`, `nephro_prescription_count` |
| `acs_hms_nephrology/models/nephro_bilan.py` | Créer | `_inherit acs.nephro.bilan` — Many2many `prescription_ids` |
| `acs_hms_nephrology/models/__init__.py` | Modifier | Importer les trois nouveaux modèles |
| `acs_hms_nephrology/views/nephro_prescription_view.xml` | Créer | Onglet "Ordonnances Néphro" sur patient + section bilan + champs header ordonnance |
| `acs_hms_nephrology/views/nephro_procedure_view.xml` | Créer | Bouton stat `nephro_prescription_count` sur fiche séance |
| `acs_hms_nephrology/data/nephro_medicament_groups.xml` | Créer | 5 `medicament.group` néphro pré-configurés |
| `acs_hms_nephrology/__manifest__.py` | Modifier | Ajouter `acs_hms_nephrology_bilans` dans `depends`, enregistrer nouveaux fichiers |
| `acs_hms_nephrology/tests/test_nephro_prescription.py` | Créer | Tests unitaires des trois extensions |
| `acs_hms_nephrology/tests/__init__.py` | Modifier | Importer le nouveau fichier de tests |
| `acs_hms_nephrology_portal/views/portal_ordonnances.xml` | Modifier | Badge "Néphro" conditionnel sur le template QWeb |

---

## Task 1 : Extension `prescription.order` — flag néphro

**Files:**
- Create: `acs_hms_nephrology/models/nephro_prescription.py`
- Modify: `acs_hms_nephrology/models/__init__.py`
- Modify: `acs_hms_nephrology/__manifest__.py`
- Create: `acs_hms_nephrology/tests/test_nephro_prescription.py`
- Modify: `acs_hms_nephrology/tests/__init__.py`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `acs_hms_nephrology/tests/test_nephro_prescription.py` :

```python
# -*- coding: utf-8 -*-
from odoo.tests.common import TransactionCase


class TestNephroPrescription(TransactionCase):

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Test Dialyse Patient'})

    def test_prescription_has_nephro_flag(self):
        """prescription.order doit avoir is_nephro_prescription et nephro_context"""
        prescription = self.env['prescription.order'].create({
            'patient_id': self.patient.id,
            'is_nephro_prescription': True,
            'nephro_context': 'background',
        })
        self.assertTrue(prescription.is_nephro_prescription)
        self.assertEqual(prescription.nephro_context, 'background')

    def test_standard_prescription_has_no_nephro_flag(self):
        """is_nephro_prescription vaut False par défaut"""
        prescription = self.env['prescription.order'].create({
            'patient_id': self.patient.id,
        })
        self.assertFalse(prescription.is_nephro_prescription)
        self.assertFalse(prescription.nephro_context)
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
cd /Users/yusper/Downloads/modules\ 19/as\ shafi
python -m pytest acs_hms_nephrology/tests/test_nephro_prescription.py -v 2>&1 | head -30
```

Attendu : erreur `KeyError: 'is_nephro_prescription'` ou équivalent.

- [ ] **Step 3 : Créer le modèle**

Créer `acs_hms_nephrology/models/nephro_prescription.py` :

```python
# -*- coding: utf-8 -*-
from odoo import fields, models


class PrescriptionOrderNephro(models.Model):
    _inherit = 'prescription.order'

    is_nephro_prescription = fields.Boolean(
        string='Ordonnance Néphro',
        default=False,
        help='Marquer comme ordonnance spécifique néphro/dialyse',
        tracking=True,
    )
    nephro_context = fields.Selection([
        ('background', 'Traitement de fond'),
        ('dose_adjustment', 'Ajustement de dose'),
        ('inter_session', 'Consultation inter-séances'),
    ], string='Contexte néphro')
```

- [ ] **Step 4 : Importer dans `__init__.py`**

Modifier `acs_hms_nephrology/models/__init__.py` — ajouter à la fin (avant le commentaire vim) :

```python
from . import nephro_prescription
```

- [ ] **Step 5 : Enregistrer dans le manifest**

Dans `acs_hms_nephrology/__manifest__.py`, ajouter `acs_hms_nephrology_bilans` dans `depends` et préparer l'entrée pour les futures données :

```python
'depends': ['acs_hms', 'acs_hms_nephrology_bilans'],
```

> Si `acs_hms_nephrology_bilans` est déjà dans `depends`, ne pas le dupliquer.

- [ ] **Step 6 : Enregistrer le test dans `tests/__init__.py`**

Modifier `acs_hms_nephrology/tests/__init__.py` — ajouter :

```python
from . import test_nephro_prescription
```

- [ ] **Step 7 : Lancer le test pour vérifier qu'il passe**

```bash
python -m pytest acs_hms_nephrology/tests/test_nephro_prescription.py::TestNephroPrescription::test_prescription_has_nephro_flag -v
python -m pytest acs_hms_nephrology/tests/test_nephro_prescription.py::TestNephroPrescription::test_standard_prescription_has_no_nephro_flag -v
```

Attendu : `PASSED` pour les deux.

- [ ] **Step 8 : Commit**

```bash
git add acs_hms_nephrology/models/nephro_prescription.py \
        acs_hms_nephrology/models/__init__.py \
        acs_hms_nephrology/__manifest__.py \
        acs_hms_nephrology/tests/test_nephro_prescription.py \
        acs_hms_nephrology/tests/__init__.py
git commit -m "feat(nephro): add is_nephro_prescription flag and nephro_context to prescription.order"
```

---

## Task 2 : Extension `acs.patient.procedure` — compteur ordonnances néphro

**Files:**
- Create: `acs_hms_nephrology/models/nephro_procedure.py`
- Modify: `acs_hms_nephrology/models/__init__.py`
- Modify: `acs_hms_nephrology/tests/test_nephro_prescription.py`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `acs_hms_nephrology/tests/test_nephro_prescription.py` :

```python
    def test_procedure_nephro_prescription_count(self):
        """acs.patient.procedure doit exposer nephro_prescription_count"""
        # Créer un produit procedure minimal
        product = self.env['product.product'].create({
            'name': 'Hémodialyse',
            'hospital_product_type': 'procedure',
        })
        procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
        })
        self.assertEqual(procedure.nephro_prescription_count, 0)

        # Créer une ordonnance néphro liée
        self.env['prescription.order'].create({
            'patient_id': self.patient.id,
            'procedure_id': procedure.id,
            'is_nephro_prescription': True,
        })
        procedure.invalidate_recordset()
        self.assertEqual(procedure.nephro_prescription_count, 1)

    def test_non_nephro_prescription_not_counted(self):
        """Une ordonnance standard ne doit pas augmenter nephro_prescription_count"""
        product = self.env['product.product'].create({
            'name': 'Hémodialyse 2',
            'hospital_product_type': 'procedure',
        })
        procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
        })
        self.env['prescription.order'].create({
            'patient_id': self.patient.id,
            'procedure_id': procedure.id,
            'is_nephro_prescription': False,
        })
        procedure.invalidate_recordset()
        self.assertEqual(procedure.nephro_prescription_count, 0)
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

```bash
python -m pytest acs_hms_nephrology/tests/test_nephro_prescription.py::TestNephroPrescription::test_procedure_nephro_prescription_count -v
```

Attendu : `AttributeError: nephro_prescription_count`.

- [ ] **Step 3 : Créer le modèle**

Créer `acs_hms_nephrology/models/nephro_procedure.py` :

```python
# -*- coding: utf-8 -*-
from odoo import api, fields, models


class AcsPatientProcedureNephro(models.Model):
    _inherit = 'acs.patient.procedure'

    nephro_prescription_ids = fields.One2many(
        'prescription.order',
        'procedure_id',
        string='Ordonnances Néphro',
        domain=[('is_nephro_prescription', '=', True)],
    )
    nephro_prescription_count = fields.Integer(
        compute='_compute_nephro_prescription_count',
        string='Ordonnances Néphro',
    )

    @api.depends('nephro_prescription_ids')
    def _compute_nephro_prescription_count(self):
        for rec in self:
            rec.nephro_prescription_count = len(
                rec.nephro_prescription_ids
            )
```

- [ ] **Step 4 : Importer dans `__init__.py`**

Modifier `acs_hms_nephrology/models/__init__.py` — ajouter :

```python
from . import nephro_procedure
```

- [ ] **Step 5 : Lancer les tests**

```bash
python -m pytest acs_hms_nephrology/tests/test_nephro_prescription.py -v
```

Attendu : `PASSED` pour les 4 tests.

- [ ] **Step 6 : Commit**

```bash
git add acs_hms_nephrology/models/nephro_procedure.py \
        acs_hms_nephrology/models/__init__.py \
        acs_hms_nephrology/tests/test_nephro_prescription.py
git commit -m "feat(nephro): add nephro_prescription_count computed field on acs.patient.procedure"
```

---

## Task 3 : Extension `acs.nephro.bilan` — lien Many2many prescriptions

**Files:**
- Create: `acs_hms_nephrology/models/nephro_bilan.py`
- Modify: `acs_hms_nephrology/models/__init__.py`
- Modify: `acs_hms_nephrology/tests/test_nephro_prescription.py`

- [ ] **Step 1 : Écrire le test qui échoue**

Ajouter dans `test_nephro_prescription.py` :

```python
    def test_bilan_can_link_prescriptions(self):
        """acs.nephro.bilan doit pouvoir lier des ordonnances néphro via prescription_ids"""
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
        })
        prescription = self.env['prescription.order'].create({
            'patient_id': self.patient.id,
            'is_nephro_prescription': True,
            'nephro_context': 'background',
        })
        bilan.prescription_ids = [(4, prescription.id)]
        bilan.invalidate_recordset()
        self.assertIn(prescription, bilan.prescription_ids)

    def test_bilan_prescription_ids_empty_by_default(self):
        """prescription_ids vaut [] par défaut sur un bilan"""
        bilan = self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
        })
        self.assertFalse(bilan.prescription_ids)
```

- [ ] **Step 2 : Lancer pour vérifier l'échec**

```bash
python -m pytest acs_hms_nephrology/tests/test_nephro_prescription.py::TestNephroPrescription::test_bilan_can_link_prescriptions -v
```

Attendu : `AttributeError: prescription_ids`.

- [ ] **Step 3 : Créer le modèle**

Créer `acs_hms_nephrology/models/nephro_bilan.py` :

```python
# -*- coding: utf-8 -*-
from odoo import fields, models


class AcsNephroBilanPrescription(models.Model):
    _inherit = 'acs.nephro.bilan'

    prescription_ids = fields.Many2many(
        'prescription.order',
        'nephro_bilan_prescription_rel',
        'bilan_id',
        'prescription_id',
        string='Ordonnances actives au moment du bilan',
        domain=[('is_nephro_prescription', '=', True)],
    )
```

- [ ] **Step 4 : Importer dans `__init__.py`**

Modifier `acs_hms_nephrology/models/__init__.py` — ajouter :

```python
from . import nephro_bilan
```

- [ ] **Step 5 : Lancer tous les tests**

```bash
python -m pytest acs_hms_nephrology/tests/test_nephro_prescription.py -v
```

Attendu : `PASSED` pour les 6 tests.

- [ ] **Step 6 : Commit**

```bash
git add acs_hms_nephrology/models/nephro_bilan.py \
        acs_hms_nephrology/models/__init__.py \
        acs_hms_nephrology/tests/test_nephro_prescription.py
git commit -m "feat(nephro): add prescription_ids Many2many on acs.nephro.bilan"
```

---

## Task 4 : Vues — onglet patient, header ordonnance, section bilan

**Files:**
- Create: `acs_hms_nephrology/views/nephro_prescription_view.xml`
- Modify: `acs_hms_nephrology/__manifest__.py`

- [ ] **Step 1 : Créer le fichier XML**

Créer `acs_hms_nephrology/views/nephro_prescription_view.xml` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<odoo>

    <!-- ============================================================ -->
    <!-- 1. Champs néphro dans l'en-tête du formulaire d'ordonnance   -->
    <!-- ============================================================ -->
    <record id="view_prescription_order_nephro_inherit" model="ir.ui.view">
        <field name="name">prescription.order.form.nephro</field>
        <field name="model">prescription.order</field>
        <field name="inherit_id" ref="acs_hms.view_prescription_order_form"/>
        <field name="arch" type="xml">
            <!-- Insérer les champs néphro après le champ physician_id dans l'en-tête -->
            <xpath expr="//field[@name='physician_id']" position="after">
                <field name="is_nephro_prescription"/>
                <field name="nephro_context"
                       invisible="not is_nephro_prescription"
                       required="is_nephro_prescription"/>
            </xpath>
        </field>
    </record>

    <!-- ============================================================ -->
    <!-- 2. Onglet "Ordonnances Néphro" sur la fiche patient          -->
    <!-- ============================================================ -->
    <record id="view_patient_form_nephro_prescriptions" model="ir.ui.view">
        <field name="name">hms.patient.form.nephro.prescriptions</field>
        <field name="model">hms.patient</field>
        <field name="inherit_id" ref="acs_hms_nephrology.view_patient_form"/>
        <field name="arch" type="xml">
            <!-- Insérer après l'onglet Néphropathie Initiale -->
            <xpath expr="//page[@name='nephrology_history']" position="after">
                <page name="nephro_prescriptions" string="Ordonnances Néphro">
                    <div class="mb-2">
                        <button name="%(acs_hms.act_open_hms_prescription_order_view)d"
                                type="action"
                                string="Nouvelle ordonnance néphro"
                                class="btn btn-primary"
                                context="{'default_patient_id': active_id,
                                          'default_is_nephro_prescription': True,
                                          'default_nephro_context': 'inter_session'}"
                                icon="fa-plus"/>
                    </div>
                    <field name="prescription_ids"
                           domain="[('is_nephro_prescription', '=', True)]"
                           context="{'default_is_nephro_prescription': True}"
                           nolabel="1"
                           readonly="1">
                        <list decoration-muted="state == 'canceled'"
                              decoration-success="state == 'prescription'"
                              default_order="prescription_date desc">
                            <field name="prescription_date" string="Date"/>
                            <field name="nephro_context" string="Contexte"/>
                            <field name="prescription_line_ids"
                                   widget="many2many_tags"
                                   string="Médicaments"
                                   options="{'color_field': 'display_name'}"/>
                            <field name="state"
                                   widget="badge"
                                   decoration-success="state == 'prescription'"
                                   decoration-warning="state == 'draft'"
                                   decoration-danger="state == 'canceled'"/>
                            <field name="physician_id" string="Médecin"/>
                        </list>
                    </field>
                </page>
            </xpath>
        </field>
    </record>

    <!-- ============================================================ -->
    <!-- 3. Section prescriptions sur le formulaire acs.nephro.bilan  -->
    <!-- ============================================================ -->
    <record id="view_nephro_bilan_prescriptions_inherit" model="ir.ui.view">
        <field name="name">acs.nephro.bilan.form.prescriptions</field>
        <field name="model">acs.nephro.bilan</field>
        <field name="inherit_id" ref="acs_hms_nephrology_bilans.view_nephro_bilan_form"/>
        <field name="arch" type="xml">
            <!-- Insérer avant le champ notes -->
            <xpath expr="//field[@name='notes']" position="before">
                <group string="Ordonnances actives au moment du bilan">
                    <field name="prescription_ids"
                           widget="many2many_tags"
                           domain="[('patient_id', '=', patient_id),
                                    ('is_nephro_prescription', '=', True),
                                    ('state', '=', 'prescription')]"
                           context="{'default_patient_id': patient_id}"
                           nolabel="1"
                           options="{'no_create': True}"/>
                </group>
            </xpath>
        </field>
    </record>

</odoo>
```

> **Note :** L'`inherit_id` du bilan (`acs_hms_nephrology_bilans.view_nephro_bilan_form`) doit correspondre à l'ID exact de la vue form dans le module bilans. Vérifier avec :
> ```bash
> grep -n "id=\"view_nephro_bilan_form\"\|id='view_nephro_bilan_form'" \
>   acs_hms_nephrology_bilans/views/*.xml
> ```
> Si l'ID diffère, corriger la référence `ref=` en conséquence.

- [ ] **Step 2 : Vérifier l'ID de la vue bilan**

```bash
grep -rn 'id="view_nephro_bilan' /Users/yusper/Downloads/modules\ 19/as\ shafi/acs_hms_nephrology_bilans/views/
```

Relever l'ID exact et ajuster `ref="acs_hms_nephrology_bilans.<ID_EXACT>"` dans la section 3 du XML si nécessaire.

- [ ] **Step 3 : Vérifier l'ID de la vue form ordonnance**

```bash
grep -n 'id="view_prescription_order_form"' /Users/yusper/Downloads/modules\ 19/as\ shafi/acs_hms/views/prescription_view.xml
```

Si l'ID diffère de `view_prescription_order_form`, ajuster `ref="acs_hms.<ID_EXACT>"`.

- [ ] **Step 4 : Vérifier l'ID de la vue form patient néphro**

```bash
grep -n 'id="view_patient_form"' /Users/yusper/Downloads/modules\ 19/as\ shafi/acs_hms_nephrology/views/nephrology_view.xml
```

Ajuster `ref="acs_hms_nephrology.<ID_EXACT>"` si nécessaire.

- [ ] **Step 5 : Enregistrer dans le manifest**

Dans `acs_hms_nephrology/__manifest__.py`, ajouter dans `'data'` **avant** `'views/menu_item.xml'` :

```python
'views/nephro_prescription_view.xml',
```

- [ ] **Step 6 : Redémarrer Odoo et vérifier visuellement**

```bash
# Dans le conteneur Docker
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  odoo -u acs_hms_nephrology --stop-after-init -d <nom_db>
```

Vérifier dans l'UI :
- Dossier patient → onglet "Ordonnances Néphro" présent
- Formulaire ordonnance → champs `is_nephro_prescription` + `nephro_context` visibles
- Fiche bilan → section "Ordonnances actives au moment du bilan" présente

- [ ] **Step 7 : Commit**

```bash
git add acs_hms_nephrology/views/nephro_prescription_view.xml \
        acs_hms_nephrology/__manifest__.py
git commit -m "feat(nephro): add Ordonnances Néphro tab on patient, prescription header fields, bilan section"
```

---

## Task 5 : Bouton stat sur la fiche séance

**Files:**
- Create: `acs_hms_nephrology/views/nephro_procedure_view.xml`
- Modify: `acs_hms_nephrology/__manifest__.py`

- [ ] **Step 1 : Identifier la vue fiche séance cible**

```bash
grep -n 'id="view_acs_patient_procedure_form"' \
  /Users/yusper/Downloads/modules\ 19/as\ shafi/acs_hms_nephrology/views/nephrology_view.xml
```

La vue néphro hérite déjà de `acs_hms.view_acs_patient_procedure_form`. On va hériter de la vue néphro elle-même pour s'insérer après les stat buttons existants.

- [ ] **Step 2 : Créer le fichier XML**

Créer `acs_hms_nephrology/views/nephro_procedure_view.xml` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<odoo>

    <!-- Bouton stat "Ordonnances Néphro" sur la fiche séance -->
    <record id="view_acs_patient_procedure_nephro_rx_btn" model="ir.ui.view">
        <field name="name">acs.patient.procedure.nephro.rx.btn</field>
        <field name="model">acs.patient.procedure</field>
        <field name="inherit_id" ref="acs_hms.view_acs_patient_procedure_form"/>
        <field name="arch" type="xml">
            <!-- Insérer après le bouton Ordonnances existant -->
            <xpath expr="//button[@name='action_prescription']" position="after">
                <button name="action_nephro_prescription"
                        groups="acs_hms.group_hms_jr_doctor"
                        type="object"
                        class="oe_stat_button"
                        icon="fa-medkit">
                    <field string="Ordo. Néphro"
                           name="nephro_prescription_count"
                           widget="statinfo"/>
                </button>
            </xpath>
        </field>
    </record>

</odoo>
```

- [ ] **Step 3 : Ajouter la méthode `action_nephro_prescription` dans le modèle**

Modifier `acs_hms_nephrology/models/nephro_procedure.py` — ajouter la méthode dans `AcsPatientProcedureNephro` :

```python
    def action_nephro_prescription(self):
        action = self.env['ir.actions.actions']._for_xml_id(
            'acs_hms.act_open_hms_prescription_order_view'
        )
        action['domain'] = [
            ('procedure_id', '=', self.id),
            ('is_nephro_prescription', '=', True),
        ]
        action['context'] = {
            'default_patient_id': self.patient_id.id,
            'default_physician_id': self.physician_id.id,
            'default_procedure_id': self.id,
            'default_is_nephro_prescription': True,
        }
        return action
```

- [ ] **Step 4 : Ajouter un test pour `action_nephro_prescription`**

Ajouter dans `acs_hms_nephrology/tests/test_nephro_prescription.py` :

```python
    def test_action_nephro_prescription_returns_action(self):
        """action_nephro_prescription doit retourner une action avec le bon domaine"""
        product = self.env['product.product'].create({
            'name': 'Hémodialyse Action Test',
            'hospital_product_type': 'procedure',
        })
        procedure = self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': product.id,
        })
        action = procedure.action_nephro_prescription()
        self.assertEqual(action['type'], 'ir.actions.act_window')
        self.assertIn(('is_nephro_prescription', '=', True), action['domain'])
        self.assertIn(('procedure_id', '=', procedure.id), action['domain'])
        self.assertTrue(action['context'].get('default_is_nephro_prescription'))
```

- [ ] **Step 5 : Lancer les tests**

```bash
python -m pytest acs_hms_nephrology/tests/test_nephro_prescription.py -v
```

Attendu : `PASSED` pour les 7 tests.

- [ ] **Step 6 : Enregistrer dans le manifest**

Dans `'data'` du manifest, ajouter avant `'views/menu_item.xml'` :

```python
'views/nephro_procedure_view.xml',
```

- [ ] **Step 7 : Commit**

```bash
git add acs_hms_nephrology/views/nephro_procedure_view.xml \
        acs_hms_nephrology/models/nephro_procedure.py \
        acs_hms_nephrology/tests/test_nephro_prescription.py \
        acs_hms_nephrology/__manifest__.py
git commit -m "feat(nephro): add nephro prescription stat button on procedure form"
```

---

## Task 6 : Données — groupes médicaments néphro pré-configurés

**Files:**
- Create: `acs_hms_nephrology/data/nephro_medicament_groups.xml`
- Modify: `acs_hms_nephrology/__manifest__.py`

> Ces données créent uniquement des `medicament.group` (structures). Les `product.product` référencés sont des produits minimaux avec `noupdate="1"` — l'équipe pharmacie les complète en production (noms commerciaux, prix, stock). Si les produits existent déjà avec le même `default_code`, ils ne sont pas écrasés.

- [ ] **Step 1 : Créer le fichier XML**

Créer `acs_hms_nephrology/data/nephro_medicament_groups.xml` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<odoo noupdate="1">

    <!-- ============================================================ -->
    <!-- Produits médicaments néphro (squelettes — à compléter)       -->
    <!-- noupdate="1" : ne pas écraser si déjà existants en prod      -->
    <!-- ============================================================ -->

    <record id="nephro_product_epo_alfa" model="product.product">
        <field name="name">Érythropoïétine alfa (EPO)</field>
        <field name="default_code">NEPHRO-EPO-ALFA</field>
        <field name="hospital_product_type">medicament</field>
        <field name="type">consu</field>
    </record>

    <record id="nephro_product_darbepoetin" model="product.product">
        <field name="name">Darbépoétine alfa (Aranesp)</field>
        <field name="default_code">NEPHRO-ARANESP</field>
        <field name="hospital_product_type">medicament</field>
        <field name="type">consu</field>
    </record>

    <record id="nephro_product_fer_saccharose" model="product.product">
        <field name="name">Fer saccharose IV (Venofer)</field>
        <field name="default_code">NEPHRO-FER-IV</field>
        <field name="hospital_product_type">medicament</field>
        <field name="type">consu</field>
    </record>

    <record id="nephro_product_calcitriol" model="product.product">
        <field name="name">Calcitriol (Vit D active oral)</field>
        <field name="default_code">NEPHRO-CALCITRIOL</field>
        <field name="hospital_product_type">medicament</field>
        <field name="type">consu</field>
    </record>

    <record id="nephro_product_paricalcitol" model="product.product">
        <field name="name">Paricalcitol IV (Zemplar)</field>
        <field name="default_code">NEPHRO-PARICALCITOL</field>
        <field name="hospital_product_type">medicament</field>
        <field name="type">consu</field>
    </record>

    <record id="nephro_product_carbonate_calcium" model="product.product">
        <field name="name">Carbonate de calcium (chélateur phosphore)</field>
        <field name="default_code">NEPHRO-CACO3</field>
        <field name="hospital_product_type">medicament</field>
        <field name="type">consu</field>
    </record>

    <record id="nephro_product_sevelamer" model="product.product">
        <field name="name">Sevelamer (Renagel)</field>
        <field name="default_code">NEPHRO-SEVELAMER</field>
        <field name="hospital_product_type">medicament</field>
        <field name="type">consu</field>
    </record>

    <record id="nephro_product_amlodipine" model="product.product">
        <field name="name">Amlodipine (antihypertenseur)</field>
        <field name="default_code">NEPHRO-AMLODIPINE</field>
        <field name="hospital_product_type">medicament</field>
        <field name="type">consu</field>
    </record>

    <record id="nephro_product_furosemide" model="product.product">
        <field name="name">Furosémide (diurétique)</field>
        <field name="default_code">NEPHRO-FUROSEMIDE</field>
        <field name="hospital_product_type">medicament</field>
        <field name="type">consu</field>
    </record>

    <!-- ============================================================ -->
    <!-- Groupes médicaments néphro                                   -->
    <!-- ============================================================ -->

    <record id="nephro_group_epo" model="medicament.group">
        <field name="name">Protocole EPO / Aranesp</field>
        <field name="medicament_group_line_ids" eval="[
            (0, 0, {'product_id': ref('nephro_product_epo_alfa'),   'dose': 4000, 'qty_per_day': 1, 'days': 7,  'short_comment': 'Voie SC — adapter selon Hb'}),
            (0, 0, {'product_id': ref('nephro_product_darbepoetin'),'dose': 30,   'qty_per_day': 1, 'days': 14, 'short_comment': 'Voie SC — adapter selon Hb'}),
        ]"/>
    </record>

    <record id="nephro_group_fer_iv" model="medicament.group">
        <field name="name">Fer IV (Venofer)</field>
        <field name="medicament_group_line_ids" eval="[
            (0, 0, {'product_id': ref('nephro_product_fer_saccharose'), 'dose': 100, 'qty_per_day': 1, 'days': 1, 'short_comment': 'IV lent en fin de séance — max 200 mg/séance'}),
        ]"/>
    </record>

    <record id="nephro_group_vit_d" model="medicament.group">
        <field name="name">Vitamine D active</field>
        <field name="medicament_group_line_ids" eval="[
            (0, 0, {'product_id': ref('nephro_product_calcitriol'),   'dose': 0.25, 'qty_per_day': 1, 'days': 30, 'short_comment': 'Oral — adapter selon PTH'}),
            (0, 0, {'product_id': ref('nephro_product_paricalcitol'), 'dose': 5,    'qty_per_day': 1, 'days': 7,  'short_comment': 'IV en fin de séance — selon PTH'}),
        ]"/>
    </record>

    <record id="nephro_group_chelateurs" model="medicament.group">
        <field name="name">Chélateurs de phosphore</field>
        <field name="medicament_group_line_ids" eval="[
            (0, 0, {'product_id': ref('nephro_product_carbonate_calcium'), 'dose': 500, 'qty_per_day': 3, 'days': 30, 'short_comment': 'Oral — pendant les repas'}),
            (0, 0, {'product_id': ref('nephro_product_sevelamer'),         'dose': 800, 'qty_per_day': 3, 'days': 30, 'short_comment': 'Oral — pendant les repas'}),
        ]"/>
    </record>

    <record id="nephro_group_antihyp" model="medicament.group">
        <field name="name">Antihypertenseurs / Diurétiques</field>
        <field name="medicament_group_line_ids" eval="[
            (0, 0, {'product_id': ref('nephro_product_amlodipine'), 'dose': 5,  'qty_per_day': 1, 'days': 30, 'short_comment': 'Oral matin'}),
            (0, 0, {'product_id': ref('nephro_product_furosemide'), 'dose': 40, 'qty_per_day': 1, 'days': 30, 'short_comment': 'Oral matin — hors jours de dialyse'}),
        ]"/>
    </record>

</odoo>
```

- [ ] **Step 2 : Enregistrer dans le manifest**

Dans `'data'` du manifest, ajouter **avant** les vues (les données avant les vues) :

```python
'data/nephro_medicament_groups.xml',
```

Le manifest final de `'data'` doit avoir l'ordre :

```python
'data': [
    'security/security.xml',
    'security/ir.model.access.csv',
    'data/data.xml',
    'data/nephrology_holidays.xml',
    'data/nephro_medicament_groups.xml',   # ← nouveau
    'reports/nephrology_report.xml',
    'reports/patient_procedure_report.xml',
    'views/nephrology_base_view.xml',
    'views/nephrology_view.xml',
    'views/imaging_view.xml',
    'views/hms_base_view.xml',
    'views/appointment_generator_view.xml',
    'views/session_generator_view.xml',
    'views/patient_customization_view.xml',
    'views/patient_tabs_order.xml',
    'views/nephro_prescription_view.xml',  # ← nouveau
    'views/nephro_procedure_view.xml',     # ← nouveau
    'views/menu_item.xml',
],
```

- [ ] **Step 3 : Tester l'installation des données**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  odoo -u acs_hms_nephrology --stop-after-init -d <nom_db> 2>&1 | grep -i "error\|nephro_group"
```

Vérifier dans Configuration → Medicament Groups que les 5 groupes néphro apparaissent.

- [ ] **Step 4 : Commit**

```bash
git add acs_hms_nephrology/data/nephro_medicament_groups.xml \
        acs_hms_nephrology/__manifest__.py
git commit -m "feat(nephro): add 5 nephro medicament groups (EPO, Fer IV, Vit D, chélateurs, antihyp)"
```

---

## Task 7 : Badge "Néphro" sur le portail patient

**Files:**
- Modify: `acs_hms_nephrology_portal/views/portal_ordonnances.xml` (ou template QWeb équivalent)

- [ ] **Step 1 : Localiser le template QWeb**

```bash
grep -rn "portal_ordonnances\|ordonnances" \
  /Users/yusper/Downloads/modules\ 19/as\ shafi/acs_hms_nephrology_portal/views/ \
  --include="*.xml" | grep "t-foreach\|t-as\|prescription"
```

Identifier le bloc qui itère sur les prescriptions (chercher `t-foreach="prescriptions"`).

- [ ] **Step 2 : Ajouter le badge**

Dans le template, trouver la colonne ou cellule qui affiche le nom/titre de l'ordonnance. Ajouter juste après :

```xml
<t t-if="prescription.is_nephro_prescription">
    <span class="badge bg-info ms-1">Néphro</span>
</t>
```

Exemple de contexte attendu dans le template :

```xml
<!-- AVANT -->
<td><t t-esc="prescription.name"/></td>

<!-- APRÈS -->
<td>
    <t t-esc="prescription.name"/>
    <t t-if="prescription.is_nephro_prescription">
        <span class="badge bg-info ms-1">Néphro</span>
    </t>
</td>
```

- [ ] **Step 3 : Vérifier visuellement**

Naviguer vers `/my/ordonnances` avec un compte patient test. Créer une ordonnance avec `is_nephro_prescription=True`. Vérifier que le badge "Néphro" apparaît.

- [ ] **Step 4 : Commit**

```bash
git add acs_hms_nephrology_portal/views/portal_ordonnances.xml
git commit -m "feat(portal): add Néphro badge on /my/ordonnances for nephro prescriptions"
```

---

## Task 8 : Vérification finale et mise à jour module

**Files:**
- Modify: `acs_hms_nephrology/__manifest__.py` (version bump)

- [ ] **Step 1 : Lancer la suite de tests complète**

```bash
python -m pytest acs_hms_nephrology/tests/ -v
python -m pytest acs_hms_nephrology_bilans/tests/ -v
```

Attendu : tous `PASSED`, aucun `ERROR`.

- [ ] **Step 2 : Mise à jour complète du module en Docker**

```bash
docker exec odoo-19-as-shafi-minhn92-odoo19-1 \
  odoo -u acs_hms_nephrology,acs_hms_nephrology_portal \
  --stop-after-init -d <nom_db> 2>&1 | tail -20
```

Vérifier : aucun `ERROR` ou `WARNING` lié aux vues héritées.

- [ ] **Step 3 : Checklist fonctionnelle manuelle**

- [ ] Dossier patient → onglet "Ordonnances Néphro" visible pour médecin et secrétaire
- [ ] Bouton "Nouvelle ordonnance néphro" → ouvre form avec `is_nephro_prescription=True` pré-coché
- [ ] Sélectionner groupe "Protocole EPO / Aranesp" → lignes pré-remplies automatiquement
- [ ] Champ `nephro_context` visible uniquement si `is_nephro_prescription=True`
- [ ] Fiche séance → bouton stat "Ordo. Néphro" présent (0 si aucune ordonnance)
- [ ] Clic bouton stat → liste filtrée sur `is_nephro_prescription=True`
- [ ] Formulaire bilan → section "Ordonnances actives au moment du bilan" avec tags
- [ ] Portail `/my/ordonnances` → badge "Néphro" sur ordonnances néphro

- [ ] **Step 4 : Bump version dans manifest**

Dans `acs_hms_nephrology/__manifest__.py` :

```python
'version': '1.0.4',
```

- [ ] **Step 5 : Commit final**

```bash
git add acs_hms_nephrology/__manifest__.py
git commit -m "chore(nephro): bump version to 1.0.4 — section 3.5 complete"
```

---

## Self-Review

**Couverture spec :**
- ✅ EPO/Aranesp (dose, fréquence, voie) → `medicament.group` + champs existants `prescription.line`
- ✅ Fer IV, Vitamine D active, Chélateurs, Antihypertenseurs/diurétiques → groupes Task 6
- ✅ `prescription_ids` sur `acs.nephro.bilan` → Task 3
- ✅ `nephro_prescription_ids` sur `acs.patient.procedure` → Task 2
- ✅ Onglet "Ordonnances Néphro" sur dossier patient → Task 4
- ✅ Liste ordonnances actives avec dates et médicaments → Task 4 (colonnes list view)
- ✅ Badge portail → Task 7

**Cohérence des types :**
- `nephro_prescription_count` défini dans Task 2 modèle, référencé dans Task 5 vue → cohérent
- `action_nephro_prescription` définie dans Task 5 modèle, référencée dans Task 5 vue → cohérent
- `prescription_ids` sur bilan défini Task 3, référencé dans Task 4 vue → cohérent
- `is_nephro_prescription` défini Task 1, utilisé partout → cohérent

**Placeholders :** aucun TBD ou TODO dans le plan.
