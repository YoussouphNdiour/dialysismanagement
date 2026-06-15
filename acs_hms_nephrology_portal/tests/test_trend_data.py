# -*- coding: utf-8 -*-
import json
from datetime import date, datetime

from odoo.tests.common import TransactionCase


class TestBuildTrendData(TransactionCase):
    """Tests TDD pour _build_hb_trend et _build_ktv_trend."""

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Trend Test'})
        self.nephro_dept = self.env['hr.department'].search(
            [('department_type', '=', 'nephrology')], limit=1
        )
        if not self.nephro_dept:
            self.nephro_dept = self.env['hr.department'].create({
                'name': 'Néphro Trend Test',
                'department_type': 'nephrology',
            })
        product = self.env['product.product'].search([('type', '=', 'service')], limit=1)
        if not product:
            product = self.env['product.product'].create({
                'name': 'Hémodialyse Trend Test',
                'type': 'service',
            })
        self.product = product

    def _make_bilan(self, date_str, hb):
        return self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'exam_date': datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S'),
            'hemoglobin': hb,
        })

    def _make_seance(self, date_str, ktv):
        return self.env['acs.patient.procedure'].create({
            'patient_id': self.patient.id,
            'product_id': self.product.id,
            'department_id': self.nephro_dept.id,
            'date': datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S'),
            'state': 'done',
            'ktv_calculated': ktv,
        })

    # ------------------------------------------------------------------ #
    #  _build_hb_trend                                                     #
    # ------------------------------------------------------------------ #

    def test_hb_trend_returns_valid_json(self):
        """3 bilans → JSON avec 3 labels et 3 values."""
        b1 = self._make_bilan('2026-01-10 08:00:00', 10.5)
        b2 = self._make_bilan('2026-02-10 08:00:00', 11.0)
        b3 = self._make_bilan('2026-03-10 08:00:00', 11.2)

        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        bilans = self.env['acs.nephro.bilan'].browse([b1.id, b2.id, b3.id]).sorted('exam_date')
        result = json.loads(ctrl._build_hb_trend(bilans))

        self.assertEqual(len(result['labels']), 3)
        self.assertEqual(len(result['values']), 3)
        self.assertAlmostEqual(result['values'][-1], 11.2)
        # labels au format dd/mm (sans année) — intentionnel, différent de _build_chart_data qui utilise %d/%m/%y
        self.assertEqual(result['labels'][0], '10/01')

    def test_hb_trend_empty_recordset_returns_empty_json(self):
        """Aucun bilan → '{}' (pas d'exception, pas de clé 'values')."""
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        bilans = self.env['acs.nephro.bilan'].browse([])
        result = ctrl._build_hb_trend(bilans)

        self.assertEqual(result, '{}')

    def test_hb_trend_passes_through_all_provided_records(self):
        """Le helper retourne autant de points que de bilans fournis — le cap (6) est géré par l'appelant."""
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        ids = []
        for i in range(6):
            b = self._make_bilan(f'2026-{(i + 1):02d}-01 08:00:00', 10.0 + i * 0.1)
            ids.append(b.id)
        bilans = self.env['acs.nephro.bilan'].browse(ids).sorted('exam_date')
        result = json.loads(ctrl._build_hb_trend(bilans))
        self.assertEqual(len(result['values']), 6)

    # ------------------------------------------------------------------ #
    #  _build_ktv_trend                                                     #
    # ------------------------------------------------------------------ #

    def test_ktv_trend_returns_valid_json(self):
        """3 séances done avec ktv > 0 → JSON avec 3 labels et 3 values."""
        s1 = self._make_seance('2026-01-05 08:00:00', 1.20)
        s2 = self._make_seance('2026-02-05 08:00:00', 1.35)
        s3 = self._make_seance('2026-03-05 08:00:00', 1.42)

        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        seances = self.env['acs.patient.procedure'].browse([s1.id, s2.id, s3.id]).sorted('date')
        result = json.loads(ctrl._build_ktv_trend(seances))

        self.assertEqual(len(result['labels']), 3)
        self.assertEqual(len(result['values']), 3)
        self.assertAlmostEqual(result['values'][-1], 1.42)
        # labels au format dd/mm (sans année) — intentionnel, différent de _build_chart_data qui utilise %d/%m/%y
        self.assertEqual(result['labels'][0], '05/01')

    def test_ktv_trend_empty_recordset_returns_empty_json(self):
        """Aucune séance → '{}' (pas d'exception)."""
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        seances = self.env['acs.patient.procedure'].browse([])
        result = ctrl._build_ktv_trend(seances)

        self.assertEqual(result, '{}')
