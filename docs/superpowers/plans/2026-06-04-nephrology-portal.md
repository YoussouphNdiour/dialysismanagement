# Portail Patient Néphro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer le module `acs_hms_nephrology_portal` — portail web mobile-first permettant au patient dialysé de consulter ses séances, bilans, RDV, ordonnances et factures depuis son téléphone.

**Architecture:** Portal Odoo natif (portal.CustomerPortal) avec SSR via templates QWeb héritant de `portal.portal_layout`. Controllers HTTP Python pour 7 routes GET + 1 POST. CSS mobile-first Bootstrap overrides. Chart.js natif Odoo 19 pour graphiques bilans.

**Tech Stack:** Odoo 19, Python 3, QWeb, Bootstrap 5 (Odoo), Chart.js (Odoo natif), `portal.CustomerPortal`, `ir.rule`, `portal.wizard` natif.

---

## Champ de référence (à ne pas recréer)

Modèles existants utilisés (lecture seule depuis le portail) :

| Modèle | Champs clés |
|---|---|
| `hms.patient` | `partner_id`, `name` |
| `acs.patient.procedure` | `patient_id`, `date`, `actual_duration`, `actual_uf`, `ktv_calculated`, `ktv_status` ('adequate'/'insufficient'), `global_tolerance` ('good'/'average'/'poor') |
| `hms.appointment` | `patient_id`, `date`, `date_to`, `physician_id`, `state` ('draft'/'confirm'/'done'/'cancel') |
| `acs.nephro.bilan` | `patient_id`, `exam_date`, `hemoglobin`, `potassium`, `phosphorus`, `potassium`, `creatinine`, `bilan_type` |
| `prescription.order` | `patient_id`, `prescription_date`, `state` ('draft'/'done'/'canceled'), `prescription_line_ids` |
| `account.move` | `partner_id`, `move_type`, `hospital_invoice_type`, `payment_state`, `state` |

Groupes sécurité existants :
- `acs_hms_base.group_hms_user` — utilisateurs internes
- `acs_hms_base.group_hms_manager` — managers
- `acs_hms.group_hms_receptionist` — secrétaires

---

## File Map

```
acs_hms_nephrology_portal/
├── __manifest__.py                          CREATE
├── __init__.py                              CREATE
├── controllers/
│   ├── __init__.py                          CREATE
│   └── portal.py                           CREATE  (7 GET + 1 POST routes)
├── models/
│   ├── __init__.py                          CREATE
│   ├── res_company.py                       CREATE  (2 champs config portail)
│   ├── res_config_settings.py              CREATE  (expose champs en settings)
│   └── hms_appointment.py                  CREATE  (3 champs cancel + notify)
├── security/
│   ├── ir.model.access.csv                 CREATE
│   └── portal_rules.xml                    CREATE  (5 ir.rule)
├── views/
│   └── hms_patient_views.xml               CREATE  (bouton Inviter au portail)
├── views/
│   └── res_config_settings_view.xml        CREATE
├── report/
│   └── report_seance_portal.xml            CREATE  (CR séance simplifié QWeb)
├── static/src/css/
│   └── portal_nephro.css                   CREATE
└── templates/
    ├── portal_layout.xml                   CREATE  (layout + nav bottom mobile)
    ├── portal_home.xml                     CREATE  (/my résumé)
    ├── portal_seances.xml                  CREATE  (/my/seances list + detail)
    ├── portal_bilans.xml                   CREATE  (/my/bilans + Chart.js)
    ├── portal_rdv.xml                      CREATE  (/my/rdv + dialog annulation)
    ├── portal_ordonnances.xml              CREATE  (/my/ordonnances)
    └── portal_factures.xml                 CREATE  (/my/factures redirect)
```

---

## Task 1 : Scaffold module — manifest + __init__ files

**Files:**
- Create: `acs_hms_nephrology_portal/__manifest__.py`
- Create: `acs_hms_nephrology_portal/__init__.py`
- Create: `acs_hms_nephrology_portal/controllers/__init__.py`
- Create: `acs_hms_nephrology_portal/models/__init__.py`

- [ ] **Step 1 : Créer la structure de répertoires**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
mkdir -p acs_hms_nephrology_portal/{controllers,models,security,views,report,templates}
mkdir -p acs_hms_nephrology_portal/static/src/css
```

- [ ] **Step 2 : Créer `__manifest__.py`**

```python
# -*- coding: utf-8 -*-
{
    'name': 'ACS Nephrology — Portail Patient',
    'version': '1.0.0',
    'category': 'Healthcare',
    'summary': 'Portail web responsive pour les patients en hémodialyse',
    'author': 'As-Shafi Custom',
    'license': 'LGPL-3',
    'depends': [
        'portal',
        'website',
        'acs_hms_nephrology',
        'acs_hms_nephrology_bilans',
        'acs_hms_nephrology_billing',
    ],
    'data': [
        'security/portal_rules.xml',
        'security/ir.model.access.csv',
        'views/hms_patient_views.xml',
        'views/res_config_settings_view.xml',
        'report/report_seance_portal.xml',
        'templates/portal_layout.xml',
        'templates/portal_home.xml',
        'templates/portal_seances.xml',
        'templates/portal_bilans.xml',
        'templates/portal_rdv.xml',
        'templates/portal_ordonnances.xml',
        'templates/portal_factures.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'acs_hms_nephrology_portal/static/src/css/portal_nephro.css',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
```

- [ ] **Step 3 : Créer `__init__.py` racine**

```python
# -*- coding: utf-8 -*-
from . import controllers
from . import models
```

- [ ] **Step 4 : Créer `controllers/__init__.py`**

```python
# -*- coding: utf-8 -*-
from . import portal
```

- [ ] **Step 5 : Créer `models/__init__.py`**

```python
# -*- coding: utf-8 -*-
from . import res_company
from . import res_config_settings
from . import hms_appointment  # contient HmsAppointmentPortal ET HmsPatientPortal
```

- [ ] **Step 6 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_portal/
git commit -m "feat(portal): scaffold module structure and manifest"
```

---

## Task 2 : Modèles — config portail + extension hms.appointment

**Files:**
- Create: `acs_hms_nephrology_portal/models/res_company.py`
- Create: `acs_hms_nephrology_portal/models/res_config_settings.py`
- Create: `acs_hms_nephrology_portal/models/hms_appointment.py`

- [ ] **Step 1 : Créer `models/res_company.py`**

```python
# -*- coding: utf-8 -*-
from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    portal_simplified_language = fields.Boolean(
        string='Langage simplifié séances',
        default=True,
        help='Affiche "Séance efficace" au lieu de la valeur brute KT/V',
    )
    portal_show_raw_values = fields.Boolean(
        string='Afficher aussi la valeur brute',
        default=False,
        help='Si activé, montre KT/V numérique en plus du texte simplifié',
    )
```

- [ ] **Step 2 : Créer `models/res_config_settings.py`**

```python
# -*- coding: utf-8 -*-
from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    portal_simplified_language = fields.Boolean(
        related='company_id.portal_simplified_language',
        readonly=False,
        string='Langage simplifié (KT/V → texte patient)',
    )
    portal_show_raw_values = fields.Boolean(
        related='company_id.portal_show_raw_values',
        readonly=False,
        string='Afficher aussi la valeur brute KT/V',
    )
```

- [ ] **Step 3 : Créer `models/hms_appointment.py`**

```python
# -*- coding: utf-8 -*-
from odoo import api, fields, models


class HmsAppointmentPortal(models.Model):
    _inherit = 'hms.appointment'

    patient_cancelled = fields.Boolean(
        string='Annulé par le patient',
        default=False,
        copy=False,
    )
    cancel_reason = fields.Text(
        string='Motif annulation patient',
        copy=False,
    )
    cancel_date = fields.Datetime(
        string='Date annulation patient',
        readonly=True,
        copy=False,
    )

    def _notify_cancel_to_secretary(self):
        """Notifie la secrétaire d'une annulation via email (+ WhatsApp optionnel).

        Le template mail est défini dans Task 16 data/mail_template.xml.
        raise_if_not_found=False : si absent, on tombe en fallback chatter.
        """
        self.ensure_one()
        # --- Email via template (défini en Task 16) ---
        template = self.env.ref(
            'acs_hms_nephrology_portal.mail_template_rdv_cancel',
            raise_if_not_found=False,
        )
        if template:
            template.send_mail(self.id, force_send=False)
        else:
            # Fallback : note dans le chatter du RDV
            self.message_post(
                body=f"Annulation patient. Motif : {self.cancel_reason or '(non précisé)'}",
                subtype_xmlid='mail.mt_note',
            )
        # --- WhatsApp optionnel ---
        if 'acs_hms_whatsapp' in self.env.registry:
            patient_name = self.patient_id.name or 'Patient'
            date_str = self.date.strftime('%d/%m/%Y %H:%M') if self.date else ''
            msg = (
                f"[PORTAIL] {patient_name} a annulé sa séance du {date_str}."
                f"\nMotif : {self.cancel_reason or '(non précisé)'}"
            )
            try:
                self.env['acs.whatsapp'].sudo().send_whatsapp_message(
                    partner_id=self.physician_id.partner_id.id if self.physician_id else False,
                    message=msg,
                )
            except Exception:
                pass  # WhatsApp optionnel, ne bloque pas
```

- [ ] **Step 4 : Vérifier la syntaxe Python**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
python3 -c "
import ast, sys
for f in [
    'acs_hms_nephrology_portal/models/res_company.py',
    'acs_hms_nephrology_portal/models/res_config_settings.py',
    'acs_hms_nephrology_portal/models/hms_appointment.py',
]:
    ast.parse(open(f).read())
    print(f'OK: {f}')
"
```

Expected: 3 lignes `OK: ...`

- [ ] **Step 5 : Commit**

```bash
git add acs_hms_nephrology_portal/models/
git commit -m "feat(portal): add company config fields and appointment cancel extension"
```

---

## Task 3 : Sécurité — ir.rule et ir.model.access.csv

**Files:**
- Create: `acs_hms_nephrology_portal/security/portal_rules.xml`
- Create: `acs_hms_nephrology_portal/security/ir.model.access.csv`

- [ ] **Step 1 : Créer `security/portal_rules.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- ir.rule : chaque patient portal ne voit que ses propres données -->

    <record id="rule_portal_procedure" model="ir.rule">
        <field name="name">Portal: séances patient uniquement</field>
        <field name="model_id" ref="acs_hms.model_acs_patient_procedure"/>
        <field name="groups" eval="[(4, ref('base.group_portal'))]"/>
        <field name="domain_force">
            [('patient_id.partner_id', '=', user.partner_id.id)]
        </field>
    </record>

    <record id="rule_portal_bilan" model="ir.rule">
        <field name="name">Portal: bilans patient uniquement</field>
        <field name="model_id" ref="acs_hms_nephrology_bilans.model_acs_nephro_bilan"/>
        <field name="groups" eval="[(4, ref('base.group_portal'))]"/>
        <field name="domain_force">
            [('patient_id.partner_id', '=', user.partner_id.id)]
        </field>
    </record>

    <record id="rule_portal_appointment" model="ir.rule">
        <field name="name">Portal: RDV patient uniquement</field>
        <field name="model_id" ref="acs_hms.model_hms_appointment"/>
        <field name="groups" eval="[(4, ref('base.group_portal'))]"/>
        <field name="domain_force">
            [('patient_id.partner_id', '=', user.partner_id.id)]
        </field>
    </record>

    <record id="rule_portal_prescription" model="ir.rule">
        <field name="name">Portal: ordonnances patient uniquement</field>
        <field name="model_id" ref="acs_hms.model_prescription_order"/>
        <field name="groups" eval="[(4, ref('base.group_portal'))]"/>
        <field name="domain_force">
            [('patient_id.partner_id', '=', user.partner_id.id)]
        </field>
    </record>

    <record id="rule_portal_invoice" model="ir.rule">
        <field name="name">Portal: factures patient uniquement</field>
        <field name="model_id" ref="account.model_account_move"/>
        <field name="groups" eval="[(4, ref('base.group_portal'))]"/>
        <field name="domain_force">
            [('partner_id', '=', user.partner_id.id),
             ('move_type', '=', 'out_invoice')]
        </field>
    </record>
</odoo>
```

- [ ] **Step 2 : Créer `security/ir.model.access.csv`**

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_portal_procedure,Portal séances,acs_hms.model_acs_patient_procedure,base.group_portal,1,0,0,0
access_portal_bilan,Portal bilans,acs_hms_nephrology_bilans.model_acs_nephro_bilan,base.group_portal,1,0,0,0
access_portal_appointment,Portal RDV,acs_hms.model_hms_appointment,base.group_portal,1,1,0,0
access_portal_prescription,Portal ordonnances,acs_hms.model_prescription_order,base.group_portal,1,0,0,0
access_portal_invoice,Portal factures,account.model_account_move,base.group_portal,1,0,0,0
access_portal_prescription_line,Portal lignes ordonnances,acs_hms.model_prescription_line,base.group_portal,1,0,0,0
```

Note : `hms.appointment` a `perm_write=1` car le controller POST écrit `patient_cancelled`, `cancel_reason`, `cancel_date`.

- [ ] **Step 3 : Valider le XML**

```bash
python3 -c "
import xml.etree.ElementTree as ET
ET.parse('acs_hms_nephrology_portal/security/portal_rules.xml')
print('XML OK')
"
```

Expected: `XML OK`

- [ ] **Step 4 : Commit**

```bash
git add acs_hms_nephrology_portal/security/
git commit -m "feat(portal): add ir.rule isolation and model access for portal group"
```

---

## Task 4 : Controller — classe de base + page /my

**Files:**
- Create: `acs_hms_nephrology_portal/controllers/portal.py`

- [ ] **Step 1 : Créer `controllers/portal.py` — squelette + helpers**

```python
# -*- coding: utf-8 -*-
import json
from collections import defaultdict
from datetime import date, timedelta

from odoo import fields, http
from odoo.http import request
from odoo.addons.portal.controllers.portal import CustomerPortal, pager as portal_pager


class NephrologyPortal(CustomerPortal):
    """Portail patient hémodialyse."""

    # ------------------------------------------------------------------ #
    #  Helpers privés                                                      #
    # ------------------------------------------------------------------ #

    def _get_current_patient(self):
        """Retourne hms.patient lié au portal user courant, ou False."""
        partner = request.env.user.partner_id
        return request.env['hms.patient'].sudo().search(
            [('partner_id', '=', partner.id)], limit=1
        )

    def _get_simplified_label(self, ktv_status):
        """Retourne le texte simplifié selon le statut KT/V."""
        company = request.env.company
        if not company.portal_simplified_language:
            return None
        if ktv_status == 'adequate':
            return ('success', '✓ Séance efficace')
        if ktv_status == 'insufficient':
            return ('warning', '⚠ Séance insuffisante')
        return None

    def _build_chart_data(self, bilans):
        """
        Construit le dict Chart.js depuis une liste de acs.nephro.bilan
        sur les 6 derniers mois. Retourne un JSON string.
        """
        today = date.today()
        months = []
        for i in range(5, -1, -1):
            d = today.replace(day=1) - timedelta(days=i * 30)
            months.append(d.strftime('%b %Y'))

        # Index bilans par mois (dernier bilan du mois retenu)
        by_month = defaultdict(dict)
        for b in bilans:
            key = b.exam_date.strftime('%b %Y') if b.exam_date else None
            if key:
                by_month[key] = b

        def series(field):
            return [
                round(getattr(by_month.get(m), field, None) or 0, 2)
                for m in months
            ]

        chart_data = {
            'labels': months,
            'hemoglobin': series('hemoglobin'),
            'potassium': series('potassium'),
            'phosphorus': series('phosphorus'),
        }
        return json.dumps(chart_data)

    # ------------------------------------------------------------------ #
    #  /my — page résumé                                                   #
    # ------------------------------------------------------------------ #

    def _prepare_home_portal_values(self, counters):
        values = super()._prepare_home_portal_values(counters)
        patient = self._get_current_patient()
        if not patient:
            return values
        if 'seances_count' in counters:
            values['seances_count'] = request.env['acs.patient.procedure'].sudo().search_count(
                [('patient_id', '=', patient.id)]
            )
        if 'bilans_count' in counters:
            values['bilans_count'] = request.env['acs.nephro.bilan'].sudo().search_count(
                [('patient_id', '=', patient.id)]
            )
        if 'rdv_count' in counters:
            values['rdv_count'] = request.env['hms.appointment'].sudo().search_count([
                ('patient_id', '=', patient.id),
                ('date', '>=', fields.Datetime.now()),
                ('state', 'in', ['draft', 'confirm']),
            ])
        return values

    @http.route('/my/nephro', auth='user', website=True)
    def portal_nephro_home(self, **kw):
        patient = self._get_current_patient()
        if not patient:
            return request.render('acs_hms_nephrology_portal.portal_no_patient', {})

        # Prochain RDV
        next_rdv = request.env['hms.appointment'].sudo().search([
            ('patient_id', '=', patient.id),
            ('date', '>=', fields.Datetime.now()),
            ('state', 'in', ['draft', 'confirm']),
        ], order='date asc', limit=1)

        # Dernier bilan
        last_bilan = request.env['acs.nephro.bilan'].sudo().search(
            [('patient_id', '=', patient.id)], order='exam_date desc', limit=1
        )

        # Dernière séance
        last_procedure = request.env['acs.patient.procedure'].sudo().search(
            [('patient_id', '=', patient.id)], order='date desc', limit=1
        )

        # Ordonnances actives
        active_rx = request.env['prescription.order'].sudo().search([
            ('patient_id', '=', patient.id),
            ('state', 'not in', ['canceled']),
        ], order='prescription_date desc', limit=3)

        # Solde patient (via billing module)
        balance_due = getattr(patient, 'balance_due', 0.0)
        payment_status = getattr(patient, 'payment_status', False)

        return request.render('acs_hms_nephrology_portal.portal_home', {
            'patient': patient,
            'next_rdv': next_rdv,
            'last_bilan': last_bilan,
            'last_procedure': last_procedure,
            'active_rx': active_rx,
            'balance_due': balance_due,
            'payment_status': payment_status,
        })
```

- [ ] **Step 2 : Vérifier la syntaxe**

```bash
python3 -c "import ast; ast.parse(open('acs_hms_nephrology_portal/controllers/portal.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_portal/controllers/portal.py
git commit -m "feat(portal): add base controller class, helpers, and /my/nephro home route"
```

---

## Task 5 : Controller — /my/seances

**Files:**
- Modify: `acs_hms_nephrology_portal/controllers/portal.py`

- [ ] **Step 1 : Ajouter les routes séances à la fin de la classe `NephrologyPortal`**

```python
    # ------------------------------------------------------------------ #
    #  /my/seances                                                         #
    # ------------------------------------------------------------------ #

    @http.route('/my/seances', auth='user', website=True)
    def portal_seances(self, page=1, **kw):
        patient = self._get_current_patient()
        if not patient:
            return request.redirect('/my/nephro')

        Procedure = request.env['acs.patient.procedure'].sudo()
        domain = [('patient_id', '=', patient.id)]
        total = Procedure.search_count(domain)
        pager = portal_pager(
            url='/my/seances',
            total=total,
            page=int(page),
            step=20,
        )
        procedures = Procedure.search(
            domain, limit=20, offset=pager['offset'], order='date desc'
        )
        company = request.env.company
        return request.render('acs_hms_nephrology_portal.portal_seances', {
            'patient': patient,
            'procedures': procedures,
            'pager': pager,
            'simplified': company.portal_simplified_language,
            'show_raw': company.portal_show_raw_values,
            'page_name': 'seances',
        })

    @http.route('/my/seances/<int:procedure_id>', auth='user', website=True)
    def portal_seance_detail(self, procedure_id, **kw):
        patient = self._get_current_patient()
        if not patient:
            return request.redirect('/my/nephro')

        procedure = request.env['acs.patient.procedure'].sudo().search([
            ('id', '=', procedure_id),
            ('patient_id', '=', patient.id),
        ], limit=1)
        if not procedure:
            return request.redirect('/my/seances')

        company = request.env.company
        simplified_label = self._get_simplified_label(procedure.ktv_status)
        return request.render('acs_hms_nephrology_portal.portal_seance_detail', {
            'patient': patient,
            'procedure': procedure,
            'simplified_label': simplified_label,
            'show_raw': company.portal_show_raw_values,
            'page_name': 'seances',
        })
```

- [ ] **Step 2 : Vérifier la syntaxe**

```bash
python3 -c "import ast; ast.parse(open('acs_hms_nephrology_portal/controllers/portal.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_portal/controllers/portal.py
git commit -m "feat(portal): add /my/seances list and detail routes"
```

---

## Task 6 : Controller — /my/bilans

**Files:**
- Modify: `acs_hms_nephrology_portal/controllers/portal.py`

- [ ] **Step 1 : Ajouter la route bilans**

```python
    # ------------------------------------------------------------------ #
    #  /my/bilans                                                          #
    # ------------------------------------------------------------------ #

    @http.route('/my/bilans', auth='user', website=True)
    def portal_bilans(self, page=1, **kw):
        patient = self._get_current_patient()
        if not patient:
            return request.redirect('/my/nephro')

        Bilan = request.env['acs.nephro.bilan'].sudo()
        domain = [('patient_id', '=', patient.id)]
        total = Bilan.search_count(domain)
        pager = portal_pager(
            url='/my/bilans',
            total=total,
            page=int(page),
            step=10,
        )
        bilans = Bilan.search(
            domain, limit=10, offset=pager['offset'], order='exam_date desc'
        )
        # Données Chart.js — 6 derniers mois (sans pagination)
        bilans_chart = Bilan.search(domain, order='exam_date asc', limit=6)
        chart_data = self._build_chart_data(bilans_chart)

        return request.render('acs_hms_nephrology_portal.portal_bilans', {
            'patient': patient,
            'bilans': bilans,
            'pager': pager,
            'chart_data': chart_data,
            'page_name': 'bilans',
        })

    @http.route('/my/bilans/<int:bilan_id>', auth='user', website=True)
    def portal_bilan_detail(self, bilan_id, **kw):
        patient = self._get_current_patient()
        if not patient:
            return request.redirect('/my/nephro')

        bilan = request.env['acs.nephro.bilan'].sudo().search([
            ('id', '=', bilan_id),
            ('patient_id', '=', patient.id),
        ], limit=1)
        if not bilan:
            return request.redirect('/my/bilans')

        return request.render('acs_hms_nephrology_portal.portal_bilan_detail', {
            'patient': patient,
            'bilan': bilan,
            'page_name': 'bilans',
        })
```

- [ ] **Step 2 : Vérifier la syntaxe**

```bash
python3 -c "import ast; ast.parse(open('acs_hms_nephrology_portal/controllers/portal.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_portal/controllers/portal.py
git commit -m "feat(portal): add /my/bilans list and detail routes with Chart.js data"
```

---

## Task 7 : Controller — /my/rdv + POST annulation

**Files:**
- Modify: `acs_hms_nephrology_portal/controllers/portal.py`

- [ ] **Step 1 : Ajouter les routes RDV**

```python
    # ------------------------------------------------------------------ #
    #  /my/rdv                                                             #
    # ------------------------------------------------------------------ #

    @http.route('/my/rdv', auth='user', website=True)
    def portal_rdv(self, **kw):
        patient = self._get_current_patient()
        if not patient:
            return request.redirect('/my/nephro')

        appointments = request.env['hms.appointment'].sudo().search([
            ('patient_id', '=', patient.id),
            ('date', '>=', fields.Datetime.now()),
            ('state', 'in', ['draft', 'confirm']),
        ], order='date asc', limit=50)

        cancelled_flash = kw.get('cancelled') == '1'
        return request.render('acs_hms_nephrology_portal.portal_rdv', {
            'patient': patient,
            'appointments': appointments,
            'cancelled_flash': cancelled_flash,
            'page_name': 'rdv',
        })

    @http.route(
        '/my/rdv/<int:appointment_id>/cancel',
        auth='user',
        website=True,
        methods=['POST'],
        csrf=True,
    )
    def portal_rdv_cancel(self, appointment_id, cancel_reason='', **kw):
        patient = self._get_current_patient()
        if not patient:
            return request.redirect('/my/nephro')

        appointment = request.env['hms.appointment'].sudo().search([
            ('id', '=', appointment_id),
            ('patient_id', '=', patient.id),
            ('state', 'in', ['draft', 'confirm']),
        ], limit=1)

        if not appointment:
            return request.redirect('/my/rdv')

        appointment.write({
            'patient_cancelled': True,
            'cancel_reason': cancel_reason,
            'cancel_date': fields.Datetime.now(),
        })
        appointment._notify_cancel_to_secretary()
        return request.redirect('/my/rdv?cancelled=1')
```

- [ ] **Step 2 : Vérifier la syntaxe**

```bash
python3 -c "import ast; ast.parse(open('acs_hms_nephrology_portal/controllers/portal.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_portal/controllers/portal.py
git commit -m "feat(portal): add /my/rdv list and POST cancel route"
```

---

## Task 8 : Controller — /my/ordonnances et /my/factures

**Files:**
- Modify: `acs_hms_nephrology_portal/controllers/portal.py`

- [ ] **Step 1 : Ajouter les routes ordonnances et factures**

```python
    # ------------------------------------------------------------------ #
    #  /my/ordonnances                                                     #
    # ------------------------------------------------------------------ #

    @http.route('/my/ordonnances', auth='user', website=True)
    def portal_ordonnances(self, show_all=False, **kw):
        patient = self._get_current_patient()
        if not patient:
            return request.redirect('/my/nephro')

        domain = [('patient_id', '=', patient.id)]
        if not show_all:
            domain.append(('state', 'not in', ['canceled']))

        prescriptions = request.env['prescription.order'].sudo().search(
            domain, order='prescription_date desc', limit=50
        )
        return request.render('acs_hms_nephrology_portal.portal_ordonnances', {
            'patient': patient,
            'prescriptions': prescriptions,
            'show_all': show_all,
            'page_name': 'ordonnances',
        })

    # ------------------------------------------------------------------ #
    #  /my/factures — redirect vers portal account natif                  #
    # ------------------------------------------------------------------ #

    @http.route('/my/factures', auth='user', website=True)
    def portal_factures(self, **kw):
        """Redirige vers le portail natif Odoo account, filtré dialyse."""
        return request.redirect('/my/invoices')
```

- [ ] **Step 2 : Vérifier la syntaxe — fichier controller complet**

```bash
python3 -c "import ast; ast.parse(open('acs_hms_nephrology_portal/controllers/portal.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_portal/controllers/portal.py
git commit -m "feat(portal): add /my/ordonnances and /my/factures routes"
```

---

## Task 9 : Templates — layout + page home

**Files:**
- Create: `acs_hms_nephrology_portal/templates/portal_layout.xml`
- Create: `acs_hms_nephrology_portal/templates/portal_home.xml`

- [ ] **Step 1 : Créer `templates/portal_layout.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Barre de navigation bottom mobile — injectée dans portal_layout -->
    <template id="portal_nephro_bottom_nav" name="Nephro bottom nav">
        <nav class="nephro-bottom-nav d-md-none">
            <a t-attf-href="/my/nephro"
               t-attf-class="nephro-nav-item #{'active' if page_name == 'home' else ''}">
                <i class="fa fa-home"/>
                <span>Accueil</span>
            </a>
            <a t-attf-href="/my/seances"
               t-attf-class="nephro-nav-item #{'active' if page_name == 'seances' else ''}">
                <i class="fa fa-tint"/>
                <span>Séances</span>
            </a>
            <a t-attf-href="/my/bilans"
               t-attf-class="nephro-nav-item #{'active' if page_name == 'bilans' else ''}">
                <i class="fa fa-flask"/>
                <span>Bilans</span>
            </a>
            <a t-attf-href="/my/rdv"
               t-attf-class="nephro-nav-item #{'active' if page_name == 'rdv' else ''}">
                <i class="fa fa-calendar"/>
                <span>RDV</span>
            </a>
            <a t-attf-href="/my/ordonnances"
               t-attf-class="nephro-nav-item #{'active' if page_name == 'ordonnances' else ''}">
                <i class="fa fa-file-text"/>
                <span>Ordonnances</span>
            </a>
        </nav>
    </template>

    <!-- Extension portal_layout : ajoute la nav bottom -->
    <template id="portal_nephro_layout" inherit_id="portal.portal_layout" name="Nephro portal layout">
        <xpath expr="//div[hasclass('o_portal_wrap')]" position="inside">
            <t t-call="acs_hms_nephrology_portal.portal_nephro_bottom_nav"/>
        </xpath>
    </template>

    <!-- Page "dossier non lié" -->
    <template id="portal_no_patient" name="Portail: dossier non lié">
        <t t-call="portal.portal_layout">
            <div class="container py-4 text-center">
                <i class="fa fa-exclamation-circle fa-3x text-warning mb-3"/>
                <h3>Dossier non lié</h3>
                <p class="text-muted">
                    Votre compte n'est pas encore associé à un dossier patient.<br/>
                    Contactez la clinique pour activer votre accès.
                </p>
                <a href="/web/login" class="btn btn-primary">Retour</a>
            </div>
        </t>
    </template>
</odoo>
```

- [ ] **Step 2 : Créer `templates/portal_home.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <template id="portal_home" name="Portail patient — Accueil">
        <t t-call="portal.portal_layout">
            <t t-set="page_name" t-value="'home'"/>
            <div class="o_portal_wrap">
                <div class="container py-4">
                    <h2 class="mb-4">
                        Bonjour, <t t-esc="patient.name"/>
                    </h2>

                    <div class="row g-3">
                        <!-- Prochain RDV -->
                        <div class="col-6 col-md-3">
                            <a href="/my/rdv" class="text-decoration-none">
                                <div class="nephro-card">
                                    <div class="text-muted small mb-1">Prochain RDV</div>
                                    <t t-if="next_rdv">
                                        <strong t-esc="next_rdv.date and next_rdv.date.strftime('%d/%m %H:%M')"/>
                                        <div class="text-muted small" t-if="next_rdv.physician_id">
                                            Dr <t t-esc="next_rdv.physician_id.name"/>
                                        </div>
                                    </t>
                                    <t t-else="">
                                        <span class="text-muted">Aucun prévu</span>
                                    </t>
                                </div>
                            </a>
                        </div>

                        <!-- Dernier bilan -->
                        <div class="col-6 col-md-3">
                            <a href="/my/bilans" class="text-decoration-none">
                                <div class="nephro-card">
                                    <div class="text-muted small mb-1">Dernier bilan</div>
                                    <t t-if="last_bilan">
                                        <strong>
                                            Hb: <t t-esc="'%.1f' % (last_bilan.hemoglobin or 0)"/> g/dL
                                        </strong>
                                        <div class="text-muted small">
                                            <t t-esc="last_bilan.exam_date and last_bilan.exam_date.strftime('%d/%m/%Y')"/>
                                        </div>
                                    </t>
                                    <t t-else="">
                                        <span class="text-muted">Aucun bilan</span>
                                    </t>
                                </div>
                            </a>
                        </div>

                        <!-- Solde -->
                        <div class="col-6 col-md-3">
                            <a href="/my/factures" class="text-decoration-none">
                                <div class="nephro-card">
                                    <div class="text-muted small mb-1">Solde</div>
                                    <strong>
                                        <t t-esc="'%.0f' % (balance_due or 0)"/> MAD
                                    </strong>
                                    <div class="mt-1">
                                        <t t-if="payment_status == 'ok'">
                                            <span class="badge bg-success">À jour</span>
                                        </t>
                                        <t t-elif="payment_status == 'warning'">
                                            <span class="badge bg-warning text-dark">En attente</span>
                                        </t>
                                        <t t-elif="payment_status == 'overdue'">
                                            <span class="badge bg-danger">En retard</span>
                                        </t>
                                    </div>
                                </div>
                            </a>
                        </div>

                        <!-- Ordonnances actives -->
                        <div class="col-6 col-md-3">
                            <a href="/my/ordonnances" class="text-decoration-none">
                                <div class="nephro-card">
                                    <div class="text-muted small mb-1">Ordonnances</div>
                                    <strong>
                                        <t t-esc="len(active_rx)"/> active(s)
                                    </strong>
                                    <div class="text-muted small text-truncate" t-if="active_rx">
                                        <t t-foreach="active_rx[:2]" t-as="rx">
                                            <t t-esc="rx.name"/><br/>
                                        </t>
                                    </div>
                                </div>
                            </a>
                        </div>
                    </div>

                    <!-- Navigation secondaire (desktop) -->
                    <div class="d-none d-md-flex gap-2 mt-4">
                        <a href="/my/seances" class="btn btn-outline-primary">Mes séances</a>
                        <a href="/my/bilans" class="btn btn-outline-primary">Mes bilans</a>
                        <a href="/my/rdv" class="btn btn-outline-primary">Mes RDV</a>
                        <a href="/my/ordonnances" class="btn btn-outline-primary">Mes ordonnances</a>
                        <a href="/my/factures" class="btn btn-outline-primary">Mes factures</a>
                    </div>
                </div>
            </div>
            <t t-call="acs_hms_nephrology_portal.portal_nephro_bottom_nav"/>
        </t>
    </template>
</odoo>
```

- [ ] **Step 3 : Valider le XML**

```bash
python3 -c "
import xml.etree.ElementTree as ET
for f in ['acs_hms_nephrology_portal/templates/portal_layout.xml',
          'acs_hms_nephrology_portal/templates/portal_home.xml']:
    ET.parse(f)
    print(f'OK: {f}')
"
```

Expected: 2 lignes `OK: ...`

- [ ] **Step 4 : Commit**

```bash
git add acs_hms_nephrology_portal/templates/portal_layout.xml \
        acs_hms_nephrology_portal/templates/portal_home.xml
git commit -m "feat(portal): add portal layout with mobile nav and home summary page"
```

---

## Task 10 : Templates — séances (liste + détail)

**Files:**
- Create: `acs_hms_nephrology_portal/templates/portal_seances.xml`

- [ ] **Step 1 : Créer `templates/portal_seances.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Liste des séances -->
    <template id="portal_seances" name="Portail — Mes séances">
        <t t-call="portal.portal_layout">
            <t t-set="page_name" t-value="'seances'"/>
            <div class="o_portal_wrap">
                <div class="container py-4">
                    <h2 class="mb-3">Mes séances</h2>

                    <t t-if="not procedures">
                        <p class="text-muted">Aucune séance enregistrée.</p>
                    </t>

                    <t t-if="procedures">
                        <div class="table-responsive">
                            <table class="table nephro-table-responsive">
                                <thead class="table-light">
                                    <tr>
                                        <th>Date</th>
                                        <th>Durée</th>
                                        <th>Efficacité</th>
                                        <th>UF retirée</th>
                                        <th>Tolérance</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <t t-foreach="procedures" t-as="p">
                                        <tr>
                                            <td data-label="Date">
                                                <t t-esc="p.date and p.date.strftime('%d/%m/%Y %H:%M')"/>
                                            </td>
                                            <td data-label="Durée">
                                                <t t-esc="'%.1fh' % (p.actual_duration or 0)"/>
                                            </td>
                                            <td data-label="Efficacité">
                                                <t t-if="simplified and p.ktv_status == 'adequate'">
                                                    <span class="badge bg-success">✓ Efficace</span>
                                                    <t t-if="show_raw">
                                                        <small class="text-muted ms-1">
                                                            KT/V: <t t-esc="'%.2f' % (p.ktv_calculated or 0)"/>
                                                        </small>
                                                    </t>
                                                </t>
                                                <t t-elif="simplified and p.ktv_status == 'insufficient'">
                                                    <span class="badge bg-warning text-dark">⚠ Insuffisant</span>
                                                    <t t-if="show_raw">
                                                        <small class="text-muted ms-1">
                                                            KT/V: <t t-esc="'%.2f' % (p.ktv_calculated or 0)"/>
                                                        </small>
                                                    </t>
                                                </t>
                                                <t t-else="">
                                                    <t t-esc="'%.2f' % (p.ktv_calculated or 0)"/>
                                                </t>
                                            </td>
                                            <td data-label="UF retirée">
                                                <t t-esc="'%.0f ml' % (p.actual_uf or 0)"/>
                                            </td>
                                            <td data-label="Tolérance">
                                                <t t-if="p.global_tolerance == 'good'">
                                                    <span class="badge bg-success">Bonne</span>
                                                </t>
                                                <t t-elif="p.global_tolerance == 'average'">
                                                    <span class="badge bg-warning text-dark">Moyenne</span>
                                                </t>
                                                <t t-elif="p.global_tolerance == 'poor'">
                                                    <span class="badge bg-danger">Mauvaise</span>
                                                </t>
                                                <t t-else="">—</t>
                                            </td>
                                            <td>
                                                <a t-attf-href="/my/seances/#{p.id}"
                                                   class="btn btn-sm btn-outline-secondary">
                                                    Détail
                                                </a>
                                            </td>
                                        </tr>
                                    </t>
                                </tbody>
                            </table>
                        </div>
                        <t t-call="portal.pager" t-if="pager"/>
                    </t>
                </div>
            </div>
            <t t-call="acs_hms_nephrology_portal.portal_nephro_bottom_nav"/>
        </t>
    </template>

    <!-- Détail d'une séance -->
    <template id="portal_seance_detail" name="Portail — Détail séance">
        <t t-call="portal.portal_layout">
            <t t-set="page_name" t-value="'seances'"/>
            <div class="o_portal_wrap">
                <div class="container py-4">
                    <a href="/my/seances" class="btn btn-sm btn-outline-secondary mb-3">
                        ← Retour aux séances
                    </a>
                    <h2 class="mb-1">
                        Séance du <t t-esc="procedure.date and procedure.date.strftime('%d/%m/%Y')"/>
                    </h2>
                    <p class="text-muted">
                        Durée : <t t-esc="'%.1fh' % (procedure.actual_duration or 0)"/>
                    </p>

                    <div class="row g-3 mt-2">
                        <div class="col-12 col-md-6">
                            <div class="nephro-card">
                                <h5>Résumé</h5>
                                <dl class="row mb-0">
                                    <dt class="col-6">Efficacité</dt>
                                    <dd class="col-6">
                                        <t t-if="simplified_label">
                                            <span t-attf-class="badge bg-#{simplified_label[0]}">
                                                <t t-esc="simplified_label[1]"/>
                                            </span>
                                            <t t-if="show_raw">
                                                <small class="text-muted ms-1">
                                                    KT/V: <t t-esc="'%.2f' % (procedure.ktv_calculated or 0)"/>
                                                </small>
                                            </t>
                                        </t>
                                        <t t-else="">
                                            <t t-esc="'%.2f' % (procedure.ktv_calculated or 0)"/>
                                        </t>
                                    </dd>
                                    <dt class="col-6">UF retirée</dt>
                                    <dd class="col-6">
                                        <t t-esc="'%.0f ml' % (procedure.actual_uf or 0)"/>
                                    </dd>
                                    <dt class="col-6">Tolérance</dt>
                                    <dd class="col-6">
                                        <t t-if="procedure.global_tolerance == 'good'">
                                            <span class="badge bg-success">Bonne</span>
                                        </t>
                                        <t t-elif="procedure.global_tolerance == 'average'">
                                            <span class="badge bg-warning text-dark">Moyenne</span>
                                        </t>
                                        <t t-elif="procedure.global_tolerance == 'poor'">
                                            <span class="badge bg-danger">Mauvaise</span>
                                        </t>
                                        <t t-else="">—</t>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>

                    <!-- Téléchargement CR PDF -->
                    <div class="mt-4">
                        <a t-attf-href="/report/pdf/acs_hms_nephrology_portal.action_report_seance_portal/#{procedure.id}"
                           class="btn btn-primary" target="_blank">
                            <i class="fa fa-download me-1"/>
                            Télécharger le compte-rendu (PDF)
                        </a>
                    </div>
                </div>
            </div>
            <t t-call="acs_hms_nephrology_portal.portal_nephro_bottom_nav"/>
        </t>
    </template>
</odoo>
```

- [ ] **Step 2 : Valider le XML**

```bash
python3 -c "
import xml.etree.ElementTree as ET
ET.parse('acs_hms_nephrology_portal/templates/portal_seances.xml')
print('OK')
"
```

Expected: `OK`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_portal/templates/portal_seances.xml
git commit -m "feat(portal): add seances list and detail templates"
```

---

## Task 11 : Templates — bilans + Chart.js

**Files:**
- Create: `acs_hms_nephrology_portal/templates/portal_bilans.xml`

- [ ] **Step 1 : Créer `templates/portal_bilans.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Liste des bilans -->
    <template id="portal_bilans" name="Portail — Mes bilans">
        <t t-call="portal.portal_layout">
            <t t-set="page_name" t-value="'bilans'"/>
            <div class="o_portal_wrap">
                <div class="container py-4">
                    <h2 class="mb-3">Mes bilans biologiques</h2>

                    <!-- Graphiques évolution 6 mois -->
                    <t t-if="bilans">
                        <div class="nephro-card mb-4">
                            <h5 class="mb-3">Évolution — 6 derniers mois</h5>
                            <div class="row g-3">
                                <div class="col-12 col-md-4">
                                    <canvas id="chartHemoglobin" height="120"/>
                                </div>
                                <div class="col-12 col-md-4">
                                    <canvas id="chartPotassium" height="120"/>
                                </div>
                                <div class="col-12 col-md-4">
                                    <canvas id="chartPhosphorus" height="120"/>
                                </div>
                            </div>
                        </div>
                        <script type="text/javascript">
                            (function() {
                                var data = <t t-out="chart_data"/>;
                                function makeChart(id, label, key, color) {
                                    var ctx = document.getElementById(id);
                                    if (!ctx) return;
                                    new Chart(ctx, {
                                        type: 'line',
                                        data: {
                                            labels: data.labels,
                                            datasets: [{
                                                label: label,
                                                data: data[key],
                                                borderColor: color,
                                                backgroundColor: color + '22',
                                                tension: 0.3,
                                                fill: true,
                                                pointRadius: 4,
                                            }]
                                        },
                                        options: {
                                            responsive: true,
                                            plugins: { legend: { display: true } },
                                            scales: { y: { beginAtZero: false } }
                                        }
                                    });
                                }
                                makeChart('chartHemoglobin', 'Hémoglobine (g/dL)', 'hemoglobin', '#e74c3c');
                                makeChart('chartPotassium',  'Potassium (mmol/L)',  'potassium',  '#3498db');
                                makeChart('chartPhosphorus', 'Phosphore (mmol/L)',  'phosphorus', '#2ecc71');
                            })();
                        </script>
                    </t>

                    <!-- Tableau bilans -->
                    <t t-if="not bilans">
                        <p class="text-muted">Aucun bilan enregistré.</p>
                    </t>
                    <t t-if="bilans">
                        <div class="table-responsive">
                            <table class="table nephro-table-responsive">
                                <thead class="table-light">
                                    <tr>
                                        <th>Date</th>
                                        <th>Type</th>
                                        <th>Hb (g/dL)</th>
                                        <th>K (mmol/L)</th>
                                        <th>P (mmol/L)</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <t t-foreach="bilans" t-as="b">
                                        <tr>
                                            <td data-label="Date">
                                                <t t-esc="b.exam_date and b.exam_date.strftime('%d/%m/%Y')"/>
                                            </td>
                                            <td data-label="Type">
                                                <!-- Affichage direct de la clé technique (monthly/quarterly/etc.) -->
                                                <t t-esc="b.bilan_type or '—'"/>
                                            </td>
                                            <td data-label="Hb">
                                                <t t-esc="'%.1f' % (b.hemoglobin or 0)"/>
                                            </td>
                                            <td data-label="K">
                                                <t t-esc="'%.2f' % (b.potassium or 0)"/>
                                            </td>
                                            <td data-label="P">
                                                <t t-esc="'%.2f' % (b.phosphorus or 0)"/>
                                            </td>
                                            <td>
                                                <a t-attf-href="/my/bilans/#{b.id}"
                                                   class="btn btn-sm btn-outline-secondary">
                                                    Détail
                                                </a>
                                            </td>
                                        </tr>
                                    </t>
                                </tbody>
                            </table>
                        </div>
                        <t t-call="portal.pager" t-if="pager"/>
                    </t>
                </div>
            </div>
            <t t-call="acs_hms_nephrology_portal.portal_nephro_bottom_nav"/>
        </t>
    </template>

    <!-- Détail bilan -->
    <template id="portal_bilan_detail" name="Portail — Détail bilan">
        <t t-call="portal.portal_layout">
            <t t-set="page_name" t-value="'bilans'"/>
            <div class="o_portal_wrap">
                <div class="container py-4">
                    <a href="/my/bilans" class="btn btn-sm btn-outline-secondary mb-3">
                        ← Retour aux bilans
                    </a>
                    <h2 class="mb-1">
                        Bilan du <t t-esc="bilan.exam_date and bilan.exam_date.strftime('%d/%m/%Y')"/>
                    </h2>

                    <div class="nephro-card mt-3">
                        <h5>Hématologie</h5>
                        <dl class="row">
                            <dt class="col-7">Hémoglobine</dt>
                            <dd class="col-5"><t t-esc="'%.1f g/dL' % (bilan.hemoglobin or 0)"/></dd>
                            <dt class="col-7">Ferritine</dt>
                            <dd class="col-5"><t t-esc="'%.1f µg/L' % (bilan.ferritin or 0)"/></dd>
                        </dl>
                    </div>

                    <div class="nephro-card mt-3">
                        <h5>Biochimie</h5>
                        <dl class="row">
                            <dt class="col-7">Potassium</dt>
                            <dd class="col-5"><t t-esc="'%.2f mmol/L' % (bilan.potassium or 0)"/></dd>
                            <dt class="col-7">Phosphore</dt>
                            <dd class="col-5"><t t-esc="'%.2f mmol/L' % (bilan.phosphorus or 0)"/></dd>
                            <dt class="col-7">Calcium</dt>
                            <dd class="col-5"><t t-esc="'%.2f mmol/L' % (bilan.calcium or 0)"/></dd>
                        </dl>
                    </div>

                    <t t-if="bilan.notes">
                        <div class="nephro-card mt-3">
                            <h5>Notes</h5>
                            <p><t t-esc="bilan.notes"/></p>
                        </div>
                    </t>
                </div>
            </div>
            <t t-call="acs_hms_nephrology_portal.portal_nephro_bottom_nav"/>
        </t>
    </template>
</odoo>
```

- [ ] **Step 2 : Valider le XML**

```bash
python3 -c "
import xml.etree.ElementTree as ET
ET.parse('acs_hms_nephrology_portal/templates/portal_bilans.xml')
print('OK')
"
```

Expected: `OK`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_portal/templates/portal_bilans.xml
git commit -m "feat(portal): add bilans templates with Chart.js evolution graphs"
```

---

## Task 12 : Templates — RDV + dialog annulation

**Files:**
- Create: `acs_hms_nephrology_portal/templates/portal_rdv.xml`

- [ ] **Step 1 : Créer `templates/portal_rdv.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <template id="portal_rdv" name="Portail — Mes RDV">
        <t t-call="portal.portal_layout">
            <t t-set="page_name" t-value="'rdv'"/>
            <div class="o_portal_wrap">
                <div class="container py-4">
                    <h2 class="mb-3">Mes prochains RDV</h2>

                    <!-- Flash annulation confirmée -->
                    <t t-if="cancelled_flash">
                        <div class="alert alert-success alert-dismissible fade show" role="alert">
                            Votre annulation a bien été transmise à la clinique.
                            <button type="button" class="btn-close" data-bs-dismiss="alert"/>
                        </div>
                    </t>

                    <t t-if="not appointments">
                        <p class="text-muted">Aucun RDV à venir.</p>
                    </t>

                    <t t-foreach="appointments" t-as="appt">
                        <div class="nephro-card mb-3">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <strong>
                                        <t t-esc="appt.date and appt.date.strftime('%A %d %B %Y — %H:%M')"/>
                                    </strong>
                                    <div class="text-muted small" t-if="appt.physician_id">
                                        Dr <t t-esc="appt.physician_id.name"/>
                                    </div>
                                </div>
                                <t t-if="not appt.patient_cancelled">
                                    <button class="btn btn-sm btn-outline-danger"
                                            onclick="document.getElementById('cancelDialog-' + this.dataset.id).showModal()"
                                            t-att-data-id="appt.id">
                                        Je ne pourrai pas venir
                                    </button>
                                </t>
                                <t t-else="">
                                    <span class="badge bg-secondary">Annulé</span>
                                </t>
                            </div>

                            <!-- Dialog annulation (HTML natif, pas de JS framework) -->
                            <t t-if="not appt.patient_cancelled">
                                <dialog t-attf-id="cancelDialog-#{appt.id}" class="nephro-dialog">
                                    <form t-attf-action="/my/rdv/#{appt.id}/cancel" method="post">
                                        <input type="hidden" name="csrf_token"
                                               t-att-value="request.csrf_token()"/>
                                        <h5 class="mb-3">Confirmer l'annulation</h5>
                                        <p class="text-muted small">
                                            Séance du
                                            <strong>
                                                <t t-esc="appt.date and appt.date.strftime('%d/%m/%Y à %H:%M')"/>
                                            </strong>
                                        </p>
                                        <div class="mb-3">
                                            <label class="form-label">Motif (optionnel)</label>
                                            <textarea name="cancel_reason" class="form-control"
                                                      rows="3" maxlength="500"
                                                      placeholder="Ex : indisposé, déplacement..."/>
                                        </div>
                                        <div class="d-flex gap-2">
                                            <button type="submit" class="btn btn-danger">
                                                Confirmer l'annulation
                                            </button>
                                            <button type="button" class="btn btn-outline-secondary"
                                                    onclick="this.closest('dialog').close()">
                                                Annuler
                                            </button>
                                        </div>
                                    </form>
                                </dialog>
                            </t>
                        </div>
                    </t>
                </div>
            </div>
            <t t-call="acs_hms_nephrology_portal.portal_nephro_bottom_nav"/>
        </t>
    </template>
</odoo>
```

- [ ] **Step 2 : Valider le XML**

```bash
python3 -c "
import xml.etree.ElementTree as ET
ET.parse('acs_hms_nephrology_portal/templates/portal_rdv.xml')
print('OK')
"
```

Expected: `OK`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_portal/templates/portal_rdv.xml
git commit -m "feat(portal): add RDV template with native HTML dialog for cancellation"
```

---

## Task 13 : Templates — ordonnances + factures

**Files:**
- Create: `acs_hms_nephrology_portal/templates/portal_ordonnances.xml`
- Create: `acs_hms_nephrology_portal/templates/portal_factures.xml`

- [ ] **Step 1 : Créer `templates/portal_ordonnances.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <template id="portal_ordonnances" name="Portail — Mes ordonnances">
        <t t-call="portal.portal_layout">
            <t t-set="page_name" t-value="'ordonnances'"/>
            <div class="o_portal_wrap">
                <div class="container py-4">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h2 class="mb-0">Mes ordonnances</h2>
                        <div class="btn-group btn-group-sm">
                            <a t-attf-href="/my/ordonnances"
                               t-attf-class="btn btn-outline-secondary #{'active' if not show_all else ''}">
                                En cours
                            </a>
                            <a t-attf-href="/my/ordonnances?show_all=1"
                               t-attf-class="btn btn-outline-secondary #{'active' if show_all else ''}">
                                Toutes
                            </a>
                        </div>
                    </div>

                    <t t-if="not prescriptions">
                        <p class="text-muted">Aucune ordonnance.</p>
                    </t>

                    <t t-foreach="prescriptions" t-as="rx">
                        <div class="nephro-card mb-3">
                            <div class="d-flex justify-content-between align-items-start">
                                <div>
                                    <strong><t t-esc="rx.name"/></strong>
                                    <div class="text-muted small">
                                        <t t-esc="rx.prescription_date and rx.prescription_date.strftime('%d/%m/%Y')"/>
                                        <t t-if="rx.physician_id">
                                            — Dr <t t-esc="rx.physician_id.name"/>
                                        </t>
                                    </div>
                                    <t t-if="rx.prescription_line_ids">
                                        <ul class="mb-0 mt-1 small">
                                            <t t-foreach="rx.prescription_line_ids[:4]" t-as="line">
                                                <li>
                                                    <t t-esc="line.product_id.name if line.product_id else ''"/>
                                                    <t t-if="line.dosage_id">
                                                        — <t t-esc="line.dosage_id.name"/>
                                                    </t>
                                                </li>
                                            </t>
                                        </ul>
                                    </t>
                                </div>
                                <a t-attf-href="/report/pdf/acs_hms.action_prescription_report/#{rx.id}"
                                   class="btn btn-sm btn-outline-primary ms-2" target="_blank">
                                    <i class="fa fa-download"/>
                                </a>
                            </div>
                        </div>
                    </t>
                </div>
            </div>
            <t t-call="acs_hms_nephrology_portal.portal_nephro_bottom_nav"/>
        </t>
    </template>
</odoo>
```

- [ ] **Step 2 : Créer `templates/portal_factures.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!--
        /my/factures redirige vers /my/invoices (portal account natif Odoo).
        Ce template est un placeholder de sécurité au cas où la redirection
        échoue (ne devrait jamais s'afficher).
    -->
    <template id="portal_factures" name="Portail — Mes factures">
        <t t-call="portal.portal_layout">
            <t t-set="page_name" t-value="'factures'"/>
            <div class="container py-4 text-center">
                <p>Redirection en cours...</p>
                <a href="/my/invoices" class="btn btn-primary">Voir mes factures</a>
            </div>
        </t>
    </template>
</odoo>
```

- [ ] **Step 3 : Valider le XML**

```bash
python3 -c "
import xml.etree.ElementTree as ET
for f in ['acs_hms_nephrology_portal/templates/portal_ordonnances.xml',
          'acs_hms_nephrology_portal/templates/portal_factures.xml']:
    ET.parse(f)
    print(f'OK: {f}')
"
```

Expected: 2 lignes `OK: ...`

- [ ] **Step 4 : Commit**

```bash
git add acs_hms_nephrology_portal/templates/portal_ordonnances.xml \
        acs_hms_nephrology_portal/templates/portal_factures.xml
git commit -m "feat(portal): add ordonnances and factures templates"
```

---

## Task 14 : CSS mobile-first

**Files:**
- Create: `acs_hms_nephrology_portal/static/src/css/portal_nephro.css`

- [ ] **Step 1 : Créer `static/src/css/portal_nephro.css`**

```css
/* ============================================================
   ACS Nephrology Portal — CSS mobile-first
   Bootstrap 5 overrides (Odoo 19 natif)
   ============================================================ */

/* Cartes */
.nephro-card {
    background: #fff;
    border-radius: 12px;
    padding: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(0, 0, 0, 0.05);
}

/* Badges KDIGO */
.badge-kdigo-normal { background-color: #28a745; color: #fff; }
.badge-kdigo-cible  { background-color: #007bff; color: #fff; }
.badge-kdigo-alert  { background-color: #fd7e14; color: #fff; }
.badge-kdigo-crit   { background-color: #dc3545; color: #fff; }

/* Navigation bottom fixe — mobile only */
.nephro-bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    background: #fff;
    border-top: 1px solid #dee2e6;
    display: flex;
    justify-content: space-around;
    padding: 0.4rem 0 0.6rem;
    z-index: 1030;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
}

.nephro-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: 0.7rem;
    color: #6c757d;
    text-decoration: none;
    padding: 0.2rem 0.5rem;
    min-width: 50px;
}

.nephro-nav-item i {
    font-size: 1.2rem;
    margin-bottom: 0.1rem;
}

.nephro-nav-item.active {
    color: #007bff;
}

/* Espace bas de page pour la nav bottom */
@media (max-width: 767.98px) {
    .o_portal_wrap {
        padding-bottom: 72px;
    }
}

/* Tableaux responsive → cartes sur mobile */
@media (max-width: 767.98px) {
    .nephro-table-responsive thead {
        display: none;
    }

    .nephro-table-responsive tr {
        display: block;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        margin-bottom: 0.75rem;
        padding: 0.5rem 0.75rem;
    }

    .nephro-table-responsive td {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.3rem 0;
        border: none;
        font-size: 0.875rem;
    }

    .nephro-table-responsive td::before {
        content: attr(data-label);
        font-weight: 600;
        color: #495057;
        margin-right: 0.5rem;
        white-space: nowrap;
    }
}

/* Desktop — masquer nav bottom */
@media (min-width: 768px) {
    .nephro-bottom-nav {
        display: none !important;
    }
}

/* Dialog annulation */
.nephro-dialog {
    border: none;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: 420px;
    width: 90%;
}

.nephro-dialog::backdrop {
    background: rgba(0, 0, 0, 0.5);
}
```

- [ ] **Step 2 : Commit**

```bash
git add acs_hms_nephrology_portal/static/src/css/portal_nephro.css
git commit -m "feat(portal): add mobile-first CSS with bottom nav and responsive tables"
```

---

## Task 15 : Rapport QWeb CR séance simplifié

**Files:**
- Create: `acs_hms_nephrology_portal/report/report_seance_portal.xml`

- [ ] **Step 1 : Créer `report/report_seance_portal.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Action rapport -->
    <record id="action_report_seance_portal" model="ir.actions.report">
        <field name="name">Compte-rendu séance (patient)</field>
        <field name="model">acs.patient.procedure</field>
        <field name="report_type">qweb-pdf</field>
        <field name="report_name">acs_hms_nephrology_portal.report_seance_portal_document</field>
        <field name="report_file">acs_hms_nephrology_portal.report_seance_portal_document</field>
        <field name="print_report_name">'CR_Seance_%s' % (object.name or object.id)</field>
        <field name="binding_model_id" ref="acs_hms.model_acs_patient_procedure"/>
        <field name="binding_type">report</field>
    </record>

    <!-- Template document -->
    <template id="report_seance_portal_document">
        <t t-call="web.html_container">
            <t t-foreach="docs" t-as="o">
                <t t-call="web.external_layout">
                    <div class="page">
                        <h2>Compte-rendu de séance de dialyse</h2>
                        <hr/>

                        <div class="row mt-3">
                            <div class="col-6">
                                <strong>Patient :</strong>
                                <t t-esc="o.patient_id.name"/>
                            </div>
                            <div class="col-6">
                                <strong>Date :</strong>
                                <t t-esc="o.date and o.date.strftime('%d/%m/%Y %H:%M')"/>
                            </div>
                        </div>

                        <table class="table table-bordered mt-4">
                            <thead class="table-light">
                                <tr>
                                    <th>Paramètre</th>
                                    <th>Valeur</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Durée effective</td>
                                    <td>
                                        <t t-esc="'%.1f h' % (o.actual_duration or 0)"/>
                                    </td>
                                </tr>
                                <tr>
                                    <td>UF retirée</td>
                                    <td>
                                        <t t-esc="'%.0f ml' % (o.actual_uf or 0)"/>
                                    </td>
                                </tr>
                                <tr>
                                    <td>Efficacité de la séance</td>
                                    <td>
                                        <t t-if="o.ktv_status == 'adequate'">✓ Séance efficace</t>
                                        <t t-elif="o.ktv_status == 'insufficient'">⚠ Séance insuffisante</t>
                                        <t t-else="">—</t>
                                    </td>
                                </tr>
                                <tr>
                                    <td>Tolérance</td>
                                    <td>
                                        <t t-if="o.global_tolerance == 'good'">Bonne</t>
                                        <t t-elif="o.global_tolerance == 'average'">Moyenne</t>
                                        <t t-elif="o.global_tolerance == 'poor'">Mauvaise</t>
                                        <t t-else="">—</t>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <p class="mt-4 text-muted" style="font-size: 11px;">
                            Document généré le
                            <t t-esc="context_timestamp(datetime.datetime.now()).strftime('%d/%m/%Y à %H:%M')"/>.
                            Ce document est à usage informatif uniquement.
                        </p>
                    </div>
                </t>
            </t>
        </t>
    </template>
</odoo>
```

- [ ] **Step 2 : Valider le XML**

```bash
python3 -c "
import xml.etree.ElementTree as ET
ET.parse('acs_hms_nephrology_portal/report/report_seance_portal.xml')
print('OK')
"
```

Expected: `OK`

- [ ] **Step 3 : Commit**

```bash
git add acs_hms_nephrology_portal/report/report_seance_portal.xml
git commit -m "feat(portal): add QWeb PDF report for patient-facing session summary"
```

---

## Task 16 : Vues backend — bouton invitation portail + config settings

**Files:**
- Create: `acs_hms_nephrology_portal/views/hms_patient_views.xml`
- Create: `acs_hms_nephrology_portal/views/res_config_settings_view.xml`

- [ ] **Step 1 : Créer `views/hms_patient_views.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Bouton "Inviter au portail" sur la fiche hms.patient -->
    <record id="view_hms_patient_portal_invite" model="ir.ui.view">
        <field name="name">hms.patient.portal.invite</field>
        <field name="model">hms.patient</field>
        <field name="inherit_id" ref="acs_hms_base.view_patient_form"/>
        <field name="arch" type="xml">
            <xpath expr="//div[@name='button_box']" position="inside">
                <button name="action_invite_portal"
                        type="object"
                        string="Inviter au portail"
                        icon="fa-share-alt"
                        groups="acs_hms_base.group_hms_manager,acs_hms.group_hms_receptionist"
                        class="oe_stat_button"/>
            </xpath>
        </field>
    </record>
</odoo>
```

- [ ] **Step 2 : Ajouter la méthode `action_invite_portal` dans `models/hms_appointment.py`**

Ajouter une nouvelle classe dans le même fichier (ou créer un fichier séparé `models/hms_patient.py`) :

```python
class HmsPatientPortal(models.Model):
    _inherit = 'hms.patient'

    def action_invite_portal(self):
        """Ouvre le wizard Odoo natif portal.wizard pré-rempli."""
        self.ensure_one()
        wizard = self.env['portal.wizard'].create({
            'user_ids': [(0, 0, {
                'partner_id': self.partner_id.id,
                'email': self.partner_id.email or '',
            })]
        })
        # WhatsApp optionnel
        if 'acs_hms_whatsapp' in self.env.registry:
            self._send_portal_invite_whatsapp()
        return wizard._action_open_modal()

    def _send_portal_invite_whatsapp(self):
        """Envoie un message WhatsApp d'invitation au portail. Optionnel."""
        try:
            company = self.env.company
            msg = (
                f"Bonjour {self.name},\n"
                f"Votre accès au portail patient de {company.name} est prêt.\n"
                f"Connectez-vous sur : {self.env['ir.config_parameter'].sudo().get_param('web.base.url')}/web/login"
            )
            self.env['acs.whatsapp'].sudo().send_whatsapp_message(
                partner_id=self.partner_id.id,
                message=msg,
            )
        except Exception:
            pass  # Ne bloque jamais l'invitation
```

Modifier `models/__init__.py` pour ajouter l'import :

```python
# -*- coding: utf-8 -*-
from . import res_company
from . import res_config_settings
from . import hms_appointment
```

Note : `HmsPatientPortal` est dans `hms_appointment.py`. Si tu préfères le séparer, crée `models/hms_patient.py` et importe-le.

- [ ] **Step 3 : Créer `views/res_config_settings_view.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="view_res_config_settings_nephro_portal" model="ir.ui.view">
        <field name="name">res.config.settings.nephro.portal</field>
        <field name="model">res.config.settings</field>
        <field name="inherit_id" ref="base_setup.action_general_configuration"/>
        <field name="arch" type="xml">
            <xpath expr="//div[@id='hospital_settings']" position="after">
                <div class="app_settings_block">
                    <h2>Portail patient</h2>
                    <div class="row mt16 o_settings_container">
                        <div class="col-12 col-lg-6 o_setting_box">
                            <div class="o_setting_left_pane">
                                <field name="portal_simplified_language"/>
                            </div>
                            <div class="o_setting_right_pane">
                                <label for="portal_simplified_language"/>
                                <div class="text-muted">
                                    Affiche "Séance efficace / insuffisante" au lieu de la valeur KT/V brute
                                </div>
                            </div>
                        </div>
                        <div class="col-12 col-lg-6 o_setting_box"
                             attrs="{'invisible': [('portal_simplified_language', '=', False)]}">
                            <div class="o_setting_left_pane">
                                <field name="portal_show_raw_values"/>
                            </div>
                            <div class="o_setting_right_pane">
                                <label for="portal_show_raw_values"/>
                                <div class="text-muted">
                                    Montre aussi le chiffre KT/V en plus du texte simplifié
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </xpath>
        </field>
    </record>
</odoo>
```

- [ ] **Step 4 : Valider les XML**

```bash
python3 -c "
import xml.etree.ElementTree as ET
for f in ['acs_hms_nephrology_portal/views/hms_patient_views.xml',
          'acs_hms_nephrology_portal/views/res_config_settings_view.xml']:
    ET.parse(f)
    print(f'OK: {f}')
"
```

Expected: 2 lignes `OK: ...`

- [ ] **Step 5 : Vérifier la syntaxe Python**

```bash
python3 -c "import ast; ast.parse(open('acs_hms_nephrology_portal/models/hms_appointment.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 6 : Créer `data/mail_template.xml` et l'ajouter au manifest**

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <record id="mail_template_rdv_cancel" model="mail.template">
        <field name="name">Annulation RDV patient (portail)</field>
        <field name="model_id" ref="acs_hms.model_hms_appointment"/>
        <field name="subject">Annulation séance — {{ object.patient_id.name }}</field>
        <field name="body_html"><![CDATA[
            <p>Bonjour,</p>
            <p>Le patient <strong>{{ object.patient_id.name }}</strong>
            a annulé sa séance prévue le
            <strong>{{ object.date.strftime('%d/%m/%Y à %H:%M') if object.date else '—' }}</strong>.
            </p>
            <p>Motif : {{ object.cancel_reason or '(non précisé)' }}</p>
            <p>Merci de mettre à jour le planning.</p>
        ]]></field>
        <field name="email_to">{{ (object.user_id.email or '') }}</field>
        <field name="auto_delete" eval="True"/>
    </record>
</odoo>
```

Ajouter dans `__manifest__.py` la ligne `'data/mail_template.xml'` avant `'security/portal_rules.xml'`.
Créer le répertoire `data/` : `mkdir -p acs_hms_nephrology_portal/data`.

- [ ] **Step 7 : Commit final**

```bash
git add acs_hms_nephrology_portal/
git commit -m "feat(portal): add portal invite button, mail template, config settings, complete module"
```

---

## Checklist de vérification post-installation

Après installation du module dans Odoo 19 (`docker exec ... odoo -d <db> -i acs_hms_nephrology_portal`), vérifier :

- [ ] Le module s'installe sans erreur (log Odoo propre)
- [ ] Un utilisateur portal lié à un `hms.patient` voit `/my/nephro` avec ses données
- [ ] Un utilisateur portal sans patient lié voit le message "Dossier non lié"
- [ ] `/my/seances` liste les procédures paginées, badges tolérance colorés
- [ ] `/my/seances/<id>` affiche le détail, lien PDF fonctionne
- [ ] `/my/bilans` affiche les 3 graphiques Chart.js sur mobile
- [ ] `/my/rdv` liste les RDV, bouton annulation ouvre le dialog HTML natif
- [ ] POST `/my/rdv/<id>/cancel` avec CSRF écrit les 3 champs et redirige avec flash
- [ ] Un user portal ne voit pas les données d'un autre patient (tester avec 2 comptes)
- [ ] `/my/factures` redirige vers `/my/invoices`
- [ ] Sur mobile (320px) la nav bottom est visible, les tableaux s'affichent en cartes
- [ ] Bouton "Inviter au portail" visible sur la fiche patient pour secrétaire/manager
- [ ] Paramètres société visibles dans Configuration > Paramètres > Portail patient
