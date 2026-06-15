# KPI Dashboard Médecin — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un 4ème onglet "📈 KPIs" dans le dashboard médecin avec 4 métriques mensuelles (séances, Hb dans cible, taux complications, KT/V adéquat) filtrées par rôle.

**Architecture:** Modification de `acs_hms_nephrology_dashboard` uniquement. Nouvelle méthode `get_kpi_stats_data()` sur `acs.dialysis.station` (modèle existant), nouveau composant OWL `DoctorKpiStats`, intégration dans `DoctorDashboard`. Aucun nouveau module, aucune migration DB. Filtrage : `group_hms_manager` → tous les patients néphro ; médecin standard → ses patients via `primary_physician_id`.

**Tech Stack:** Odoo 19, Python 3, OWL (Odoo Web Library), XML templates QWeb

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `acs_hms_nephrology_dashboard/models/doctor_dashboard.py` | Modifier (append) | `get_kpi_stats_data()` + `_kpi_empty_result()` |
| `acs_hms_nephrology_dashboard/tests/__init__.py` | Modifier (append 1 ligne) | Import du nouveau module de test |
| `acs_hms_nephrology_dashboard/tests/test_doctor_dashboard_kpi.py` | Créer | 4 tests unitaires |
| `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorKpiStats.js` | Créer | Composant OWL — chargement + state |
| `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorKpiStats.xml` | Créer | Template OWL — grille 2×2 |
| `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorDashboard.js` | Modifier | Import + enregistrement de DoctorKpiStats |
| `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorDashboard.xml` | Modifier | Bouton onglet "KPIs" + bloc conditionnel |
| `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/doctor_dashboard.css` | Modifier (append) | Styles `.dd-kpi-*` |

---

## Task 1 : Méthode Python get_kpi_stats_data() + 4 tests

**Files:**
- Modify: `acs_hms_nephrology_dashboard/models/doctor_dashboard.py`
- Modify: `acs_hms_nephrology_dashboard/tests/__init__.py`
- Create: `acs_hms_nephrology_dashboard/tests/test_doctor_dashboard_kpi.py`

- [ ] **Step 1 : Écrire les tests (ils doivent échouer)**

Créer `acs_hms_nephrology_dashboard/tests/test_doctor_dashboard_kpi.py` :

```python
# -*- coding: utf-8 -*-
from datetime import datetime, date, timedelta
from odoo.tests.common import TransactionCase


class TestDoctorDashboardKpi(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        # Département néphro (chercher ou créer)
        cls.nephro_dept = cls.env['hr.department'].search(
            [('department_type', '=', 'nephrology')], limit=1)
        if not cls.nephro_dept:
            cls.nephro_dept = cls.env['hr.department'].create({
                'name': 'Néphro Test KPI',
                'department_type': 'nephrology',
            })

        # Deux médecins
        cls.physician1 = cls.env['hms.physician'].create({
            'name': 'Dr KPI Un',
            'login': 'dr_kpi_un@test.local',
            'email': 'dr_kpi_un@test.local',
        })
        cls.physician2 = cls.env['hms.physician'].create({
            'name': 'Dr KPI Deux',
            'login': 'dr_kpi_deux@test.local',
            'email': 'dr_kpi_deux@test.local',
        })

        # Deux patients
        cls.patient1 = cls.env['hms.patient'].create({
            'name': 'Patient KPI Un',
            'nephrology_care': True,
            'primary_physician_id': cls.physician1.id,
        })
        cls.patient2 = cls.env['hms.patient'].create({
            'name': 'Patient KPI Deux',
            'nephrology_care': True,
            'primary_physician_id': cls.physician2.id,
        })

        # Date dans le mois courant
        today = date.today()
        cls.this_month_dt = datetime.combine(
            today.replace(day=1), datetime.min.time()) + timedelta(days=1)

    def _make_session(self, patient, state='done'):
        """Crée une séance dialyse done dans le mois courant."""
        return self.env['acs.patient.procedure'].create({
            'patient_id': patient.id,
            'department_id': self.nephro_dept.id,
            'date': self.this_month_dt,
            'state': state,
        })

    def test_kpi_manager_sees_all(self):
        """Manager (group_hms_manager) voit toutes les séances néphro — is_manager=True."""
        self._make_session(self.patient1)
        self._make_session(self.patient2)

        manager_group = self.env.ref('acs_hms.group_hms_manager')
        self.env.user.groups_id = [(4, manager_group.id)]

        result = self.env['acs.dialysis.station'].get_kpi_stats_data()

        self.assertTrue(result['is_manager'])
        self.assertGreaterEqual(result['sessions_count'], 2)
        self.assertIn('/', result['ktv_adequate_detail'])
        self.assertIn('period_label', result)

    def test_kpi_doctor_sees_own(self):
        """Médecin standard ne voit que ses patients (primary_physician_id)."""
        self._make_session(self.patient1)
        self._make_session(self.patient2)

        # Appel en tant que physician1 (non manager)
        Station = self.env['acs.dialysis.station'].with_user(self.physician1.user_id)
        result = Station.get_kpi_stats_data()

        self.assertFalse(result['is_manager'])
        # Uniquement patient1 → 1 séance (au moins, d'autres tests n'interfèrent pas
        # car les patients sont isolés par primary_physician_id)
        self.assertEqual(result['sessions_count'], 1)

    def test_hb_in_range_no_bilan(self):
        """Patient sans bilan Hb est exclu du dénominateur hb_in_range_detail."""
        # patient3 sans aucun bilan
        self.env['hms.patient'].create({
            'name': 'Patient KPI Sans Bilan',
            'nephrology_care': True,
            'primary_physician_id': self.physician1.id,
        })

        manager_group = self.env.ref('acs_hms.group_hms_manager')
        self.env.user.groups_id = [(4, manager_group.id)]

        result = self.env['acs.dialysis.station'].get_kpi_stats_data()

        # Le dénominateur de hb_in_range_detail doit être 0
        # (aucun patient du setUp n'a de bilan créé)
        detail = result['hb_in_range_detail']   # ex: "0/0"
        _, denominator = detail.split('/')
        self.assertEqual(int(denominator), 0)

    def test_complication_rate(self):
        """2 complications sur 10 séances → complication_detail = '2/10'."""
        sessions = [self._make_session(self.patient1) for _ in range(10)]

        # Ajouter 2 complications sur les 2 premières séances
        for proc in sessions[:2]:
            self.env['acs.dialysis.complication'].create({
                'procedure_id': proc.id,
                'complication_type': 'cramps',
                'action_taken': 'Test traitement',
                'resolution': 'yes',
            })

        # Appel en tant que physician1 (voit uniquement patient1)
        Station = self.env['acs.dialysis.station'].with_user(self.physician1.user_id)
        result = Station.get_kpi_stats_data()

        comp_num, comp_den = result['complication_detail'].split('/')
        self.assertEqual(int(comp_num), 2)
        self.assertEqual(int(comp_den), 10)
        self.assertEqual(result['complication_rate'], 20.0)
```

- [ ] **Step 2 : Ajouter l'import dans tests/__init__.py**

Ajouter à la fin de `acs_hms_nephrology_dashboard/tests/__init__.py` :

```python
from . import test_doctor_dashboard_kpi
```

- [ ] **Step 3 : Lancer les tests — vérifier qu'ils échouent**

```bash
cd "/Users/yusper/Downloads/modules 19" && ./odoo19-venv/bin/python "odoo-19.0.post20260601/setup/odoo" \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 --log-level=test \
  --test-tags=acs_hms_nephrology_dashboard.TestDoctorDashboardKpi \
  --stop-after-init 2>&1 | grep -E "(FAIL|ERROR|error\(s\)|failed)" | tail -5
```

Expected : erreur `AttributeError: 'ACSDialysisStationDashboard' object has no attribute 'get_kpi_stats_data'`

- [ ] **Step 4 : Implémenter get_kpi_stats_data() dans doctor_dashboard.py**

Ajouter après la méthode `get_ktv_chart_data()` (ligne 265, avant la fin de la classe) :

```python
    @api.model
    def get_kpi_stats_data(self):
        """KPIs mensuels pour l'onglet KPIs du dashboard médecin.
        Périmètre : group_hms_manager → tous ; médecin standard → ses patients."""
        import calendar as _cal

        today = fields.Datetime.now().date()

        # Bornes du mois courant
        month_start = today.replace(day=1)
        last_day = _cal.monthrange(today.year, today.month)[1]
        month_start_dt = datetime.combine(month_start, datetime.min.time())
        month_end_dt = datetime.combine(
            today.replace(day=last_day) + timedelta(days=1), datetime.min.time())

        # Mois précédent (pour delta séances)
        if month_start.month == 1:
            prev_start = month_start.replace(year=month_start.year - 1, month=12)
        else:
            prev_start = month_start.replace(month=month_start.month - 1)
        prev_start_dt = datetime.combine(prev_start, datetime.min.time())

        # Périmètre patients
        is_manager = self.env.user.has_group('acs_hms.group_hms_manager')
        patient_domain = [('nephrology_care', '=', True), ('active', '=', True)]
        if not is_manager:
            physician = self.env['hms.physician'].search(
                [('user_id', '=', self.env.uid)], limit=1)
            if not physician:
                return self._kpi_empty_result(is_manager, today)
            patient_domain += [('primary_physician_id', '=', physician.id)]

        patients = self.env['hms.patient'].sudo().search(patient_domain)
        if not patients:
            return self._kpi_empty_result(is_manager, today)

        patient_ids = patients.ids
        Procedure = self.env['acs.patient.procedure'].sudo()
        dt = fields.Datetime.to_string

        # Séances done ce mois
        sessions = Procedure.search([
            ('patient_id', 'in', patient_ids),
            ('state', '=', 'done'),
            ('department_id.department_type', '=', 'nephrology'),
            ('date', '>=', dt(month_start_dt)),
            ('date', '<', dt(month_end_dt)),
        ])
        sessions_count = len(sessions)

        # Delta vs mois précédent
        prev_count = Procedure.search_count([
            ('patient_id', 'in', patient_ids),
            ('state', '=', 'done'),
            ('department_id.department_type', '=', 'nephrology'),
            ('date', '>=', dt(prev_start_dt)),
            ('date', '<', dt(month_start_dt)),
        ])
        sessions_delta = sessions_count - prev_count

        # % Hb dans cible — dernier bilan par patient avec hemoglobin > 0
        Bilan = self.env['acs.nephro.bilan'].sudo()
        hb_ok = hb_total = 0
        for patient in patients:
            last = Bilan.search([
                ('patient_id', '=', patient.id),
                ('hemoglobin', '>', 0),
            ], order='exam_date desc', limit=1)
            if last:
                hb_total += 1
                if last.hemoglobin_status == 'ok':
                    hb_ok += 1
        hb_pct = round(hb_ok / hb_total * 100, 1) if hb_total else 0.0

        # Taux complications
        comp_total = sum(p.complication_count for p in sessions)
        comp_rate = round(comp_total / sessions_count * 100, 1) if sessions_count else 0.0

        # % KT/V adéquat
        ktv_sessions = sessions.filtered(lambda p: p.ktv_calculated > 0)
        ktv_ok = ktv_sessions.filtered(lambda p: p.ktv_status == 'adequate')
        ktv_pct = round(len(ktv_ok) / len(ktv_sessions) * 100, 1) if ktv_sessions else 0.0

        _MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                   'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        return {
            'sessions_count': sessions_count,
            'sessions_delta': sessions_delta,
            'hb_in_range_pct': hb_pct,
            'hb_in_range_detail': f'{hb_ok}/{hb_total}',
            'complication_rate': comp_rate,
            'complication_detail': f'{comp_total}/{sessions_count}',
            'ktv_adequate_pct': ktv_pct,
            'ktv_adequate_detail': f'{len(ktv_ok)}/{len(ktv_sessions)}',
            'period_label': f'{_MONTHS[today.month - 1]} {today.year}',
            'is_manager': is_manager,
        }

    @api.model
    def _kpi_empty_result(self, is_manager, today):
        _MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                   'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
        return {
            'sessions_count': 0, 'sessions_delta': 0,
            'hb_in_range_pct': 0.0, 'hb_in_range_detail': '0/0',
            'complication_rate': 0.0, 'complication_detail': '0/0',
            'ktv_adequate_pct': 0.0, 'ktv_adequate_detail': '0/0',
            'period_label': f'{_MONTHS[today.month - 1]} {today.year}',
            'is_manager': is_manager,
        }
```

- [ ] **Step 5 : Lancer les tests — vérifier qu'ils passent**

```bash
cd "/Users/yusper/Downloads/modules 19" && ./odoo19-venv/bin/python "odoo-19.0.post20260601/setup/odoo" \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 --log-level=test \
  --test-tags=acs_hms_nephrology_dashboard.TestDoctorDashboardKpi \
  --stop-after-init 2>&1 | grep -E "(FAIL|ERROR|error\(s\)|failed|0 failed)" | tail -5
```

Expected : `0 failed, 0 error(s) of 4 tests`

- [ ] **Step 6 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/models/doctor_dashboard.py \
        acs_hms_nephrology_dashboard/tests/__init__.py \
        acs_hms_nephrology_dashboard/tests/test_doctor_dashboard_kpi.py
git commit -m "feat(dashboard): get_kpi_stats_data() + 4 tests (séances/Hb/complications/KT/V)"
```

---

## Task 2 : Composant OWL DoctorKpiStats

**Files:**
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorKpiStats.js`
- Create: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorKpiStats.xml`

- [ ] **Step 1 : Créer DoctorKpiStats.js**

```javascript
/** @odoo-module **/
import { Component, useState, onMounted } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class DoctorKpiStats extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorKpiStats";
    static props = {};

    setup() {
        this.orm = useService("orm");
        this.state = useState({ loading: true, data: null });
        onMounted(() => this._load());
    }

    async _load() {
        try {
            const data = await this.orm.call(
                "acs.dialysis.station", "get_kpi_stats_data", []
            );
            this.state.data = data;
        } catch (e) {
            console.error("KPI load error", e);
        } finally {
            this.state.loading = false;
        }
    }

    get deltaLabel() {
        const d = this.state.data && this.state.data.sessions_delta;
        if (!d) return "";
        return d > 0 ? `▲ +${d} vs mois précédent` : `▼ ${d} vs mois précédent`;
    }

    get deltaClass() {
        const d = this.state.data && this.state.data.sessions_delta;
        if (!d) return "";
        return d > 0 ? "dd-kpi-delta-up" : "dd-kpi-delta-down";
    }
}
```

- [ ] **Step 2 : Créer DoctorKpiStats.xml**

```xml
<?xml version="1.0" encoding="utf-8"?>
<templates xml:space="preserve">
  <t t-name="acs_hms_nephrology_dashboard.DoctorKpiStats">
    <div class="dd-kpi-stats">

      <t t-if="state.loading">
        <div class="dd-kpi-loading">Chargement des KPIs...</div>
      </t>

      <t t-elif="!state.data">
        <div class="dd-kpi-loading">Données non disponibles.</div>
      </t>

      <t t-else="">
        <div class="dd-kpi-header">
          <span class="dd-kpi-period" t-esc="state.data.period_label"/>
          <t t-if="state.data.is_manager">
            <span class="dd-kpi-badge">Vue globale — tous les patients</span>
          </t>
        </div>

        <div class="dd-kpi-grid">

          <div class="dd-kpi-card dd-kpi-blue">
            <div class="dd-kpi-label">Séances ce mois</div>
            <div class="dd-kpi-value" t-esc="state.data.sessions_count"/>
            <div t-if="deltaLabel" t-att-class="'dd-kpi-delta ' + deltaClass" t-esc="deltaLabel"/>
          </div>

          <div class="dd-kpi-card dd-kpi-green">
            <div class="dd-kpi-label">Hb dans cible (10–12 g/dL)</div>
            <div class="dd-kpi-value">
              <t t-esc="state.data.hb_in_range_pct.toFixed(1)"/>%
            </div>
            <div class="dd-kpi-detail" t-esc="state.data.hb_in_range_detail + ' patients'"/>
          </div>

          <div class="dd-kpi-card dd-kpi-red">
            <div class="dd-kpi-label">Taux complications</div>
            <div class="dd-kpi-value">
              <t t-esc="state.data.complication_rate.toFixed(1)"/>%
            </div>
            <div class="dd-kpi-detail" t-esc="state.data.complication_detail + ' séances'"/>
          </div>

          <div class="dd-kpi-card dd-kpi-yellow">
            <div class="dd-kpi-label">KT/V adéquat (≥ 1.2)</div>
            <div class="dd-kpi-value">
              <t t-esc="state.data.ktv_adequate_pct.toFixed(1)"/>%
            </div>
            <div class="dd-kpi-detail" t-esc="state.data.ktv_adequate_detail + ' séances'"/>
          </div>

        </div>
      </t>

    </div>
  </t>
</templates>
```

- [ ] **Step 3 : Commit**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorKpiStats.js \
        acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorKpiStats.xml
git commit -m "feat(dashboard): composant OWL DoctorKpiStats grille 2x2"
```

---

## Task 3 : Intégration dans DoctorDashboard + CSS

**Files:**
- Modify: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorDashboard.js`
- Modify: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorDashboard.xml`
- Modify: `acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/doctor_dashboard.css`

- [ ] **Step 1 : Modifier DoctorDashboard.js**

Remplacer les lignes 1–12 (imports + static components déclaration) par :

```javascript
/** @odoo-module **/
import { Component, useState, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { DoctorAlertsSidebar } from "./DoctorAlertsSidebar";
import { DoctorStationGrid } from "./DoctorStationGrid";
import { DoctorPatientPanel } from "./DoctorPatientPanel";
import { DoctorStatsChart } from "./DoctorStatsChart";
import { DoctorKpiStats } from "./DoctorKpiStats";

export class DoctorDashboard extends Component {
    static template = "acs_hms_nephrology_dashboard.DoctorDashboard";
    static components = { DoctorAlertsSidebar, DoctorStationGrid, DoctorPatientPanel, DoctorStatsChart, DoctorKpiStats };
```

- [ ] **Step 2 : Modifier DoctorDashboard.xml — ajouter le bouton onglet**

Après la ligne `<button ... data-tab="stats">📊 Stats</button>` (ligne 23), ajouter :

```xml
          <button t-att-class="'dd-tab ' + (state.tab === 'kpis' ? 'active' : '')"
                  t-on-click="setTab" data-tab="kpis">📈 KPIs</button>
```

- [ ] **Step 3 : Modifier DoctorDashboard.xml — ajouter le contenu de l'onglet**

Après le bloc `<t t-elif="state.tab === 'stats'"><DoctorStatsChart/></t>` (ligne 62–63), ajouter :

```xml
          <t t-elif="state.tab === 'kpis'">
            <DoctorKpiStats/>
          </t>
```

- [ ] **Step 4 : Ajouter les styles CSS**

Ajouter à la fin de `doctor_dashboard.css` :

```css
/* ── KPI Stats Tab ───────────────────────────────────────────── */
.dd-kpi-stats { padding: 24px; color: #e5e7eb; }

.dd-kpi-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
}
.dd-kpi-period { font-size: 1.1rem; font-weight: 600; color: #9ca3af; }
.dd-kpi-badge {
    background: #374151;
    color: #9ca3af;
    font-size: 0.75rem;
    padding: 3px 10px;
    border-radius: 12px;
}
.dd-kpi-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}
.dd-kpi-card {
    background: #1f2937;
    border-radius: 10px;
    padding: 20px 24px;
    border-left: 4px solid transparent;
}
.dd-kpi-blue   { border-left-color: #4e73df; }
.dd-kpi-green  { border-left-color: #1cc88a; }
.dd-kpi-red    { border-left-color: #e74a3b; }
.dd-kpi-yellow { border-left-color: #f6c23e; }

.dd-kpi-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    margin-bottom: 8px;
}
.dd-kpi-value {
    font-size: 2rem;
    font-weight: 700;
    color: #f3f4f6;
    line-height: 1;
    margin-bottom: 6px;
}
.dd-kpi-detail { font-size: 0.8rem; color: #6b7280; }
.dd-kpi-delta  { font-size: 0.85rem; font-weight: 600; margin-top: 4px; }
.dd-kpi-delta-up   { color: #1cc88a; }
.dd-kpi-delta-down { color: #e74a3b; }
.dd-kpi-loading {
    text-align: center;
    color: #6b7280;
    padding: 60px 0;
    font-size: 0.9rem;
}
```

- [ ] **Step 5 : Démarrer Odoo et vérifier l'onglet dans le navigateur**

```bash
cd "/Users/yusper/Downloads/modules 19"
pkill -f "odoo.*asshafi" 2>/dev/null; sleep 2
nohup ./odoo19-venv/bin/python "odoo-19.0.post20260601/setup/odoo" \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 --log-level=warn \
  >> /tmp/odoo.log 2>&1 &
echo "PID: $!"
```

Attendre ~10s, ouvrir http://localhost:8069 → Néphro → Dashboard Médecin → cliquer "📈 KPIs".

Vérifications :
- [ ] 4 cartes visibles : Séances, Hb, Complications, KT/V
- [ ] Badge "Vue globale" affiché (connecté en admin = manager)
- [ ] Spinner pendant le chargement, remplacé par les données
- [ ] Aucune erreur console JS (F12 → Console)
- [ ] Les 3 autres onglets (Grille, Liste, Stats) fonctionnent toujours

- [ ] **Step 6 : Relancer tous les tests du module dashboard**

```bash
pkill -f "odoo.*asshafi" 2>/dev/null; sleep 2
cd "/Users/yusper/Downloads/modules 19" && ./odoo19-venv/bin/python "odoo-19.0.post20260601/setup/odoo" \
  --addons-path="odoo-19.0.post20260601/odoo/addons,as shafi,ohrms_core-19.0.1.0.0,base_accounting_kit-19.0.2.3.1" \
  -d asshafi --db_host=localhost --db_port=5432 --db_user=yusper \
  --http-port=8069 --log-level=test \
  --test-tags=acs_hms_nephrology_dashboard \
  --stop-after-init 2>&1 | grep -E "(FAIL|ERROR|error\(s\)|0 failed)" | tail -5
```

Expected : `0 failed, 0 error(s) of N tests` (N ≥ 4, tous les tests du module)

- [ ] **Step 7 : Commit final**

```bash
cd "/Users/yusper/Downloads/modules 19/as shafi"
git add acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorDashboard.js \
        acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/DoctorDashboard.xml \
        acs_hms_nephrology_dashboard/static/src/components/doctor_dashboard/doctor_dashboard.css
git commit -m "feat(dashboard): onglet KPIs mensuel intégré — séances/Hb/complications/KT/V"
```

---

## Critères d'acceptance

1. L'onglet "📈 KPIs" apparaît après "📊 Stats" dans le dashboard médecin
2. Les 4 cartes affichent des valeurs pour le mois courant (peuvent être 0 si pas de données)
3. Admin/manager → badge "Vue globale" visible, `is_manager=True`
4. Médecin standard → uniquement ses patients comptés
5. Aucune erreur Python ni JS dans la console
6. Les 4 tests `TestDoctorDashboardKpi` passent : `0 failed, 0 error(s) of 4 tests`
7. Les tests des autres classes du module dashboard passent toujours
