# -*- coding: utf-8 -*-
import json
from datetime import datetime

from odoo.tests.common import TransactionCase


class TestBuildChartData(TransactionCase):
    """Vérifie que _build_chart_data génère des labels de dates réelles."""

    def setUp(self):
        super().setUp()
        self.patient = self.env['hms.patient'].create({'name': 'Patient Chart Test'})

    def _make_bilan(self, date_str, hb, k, p):
        """Crée un bilan minimal avec les valeurs clés."""
        return self.env['acs.nephro.bilan'].create({
            'patient_id': self.patient.id,
            'bilan_type': 'monthly',
            'exam_date': datetime.strptime(date_str, '%Y-%m-%d %H:%M:%S'),
            'hemoglobin': hb,
            'potassium': k,
            'phosphorus': p,
        })

    def test_chart_data_uses_real_dates_as_labels(self):
        """Les labels doivent être les dates réelles, pas des mois calendaires."""
        b1 = self._make_bilan('2026-01-15 08:00:00', 11.0, 4.5, 1.4)
        b2 = self._make_bilan('2026-02-20 08:00:00', 10.5, 5.0, 1.6)
        b3 = self._make_bilan('2026-03-10 08:00:00',  9.8, 5.2, 1.9)

        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        bilans = self.env['acs.nephro.bilan'].browse([b1.id, b2.id, b3.id])
        bilans = bilans.sorted('exam_date')

        result = json.loads(ctrl._build_chart_data(bilans))

        self.assertEqual(result['labels'], ['15/01/26', '20/02/26', '10/03/26'])
        self.assertAlmostEqual(result['hemoglobin'][0], 11.0)
        self.assertAlmostEqual(result['potassium'][1], 5.0)
        self.assertAlmostEqual(result['phosphorus'][2], 1.9)

    def test_chart_data_empty_bilans(self):
        """Avec 0 bilans, retourne des listes vides (pas d'exception)."""
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        bilans = self.env['acs.nephro.bilan'].browse([])
        result = json.loads(ctrl._build_chart_data(bilans))

        self.assertEqual(result['labels'], [])
        self.assertEqual(result['hemoglobin'], [])

    def test_chart_data_missing_values_default_to_zero(self):
        """Les champs non renseignés (0 ou False) doivent valoir 0 dans la série."""
        b = self._make_bilan('2026-04-01 08:00:00', 0.0, 0.0, 0.0)
        from odoo.addons.acs_hms_nephrology_portal.controllers.portal import NephrologyPortal
        ctrl = NephrologyPortal()

        bilans = self.env['acs.nephro.bilan'].browse([b.id])
        result = json.loads(ctrl._build_chart_data(bilans))

        self.assertEqual(result['hemoglobin'], [0.0])
        self.assertEqual(result['potassium'], [0.0])
