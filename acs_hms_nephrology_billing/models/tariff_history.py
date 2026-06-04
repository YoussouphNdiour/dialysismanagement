# -*- coding: utf-8 -*-
from odoo import api, fields, models


class AcsDialysisTariffHistory(models.Model):
    _name = 'acs.dialysis.tariff.history'
    _description = 'Historique tarifaire patient dialyse'
    _order = 'date_start desc'

    patient_id = fields.Many2one(
        'hms.patient', string='Patient', required=True, ondelete='cascade', index=True
    )
    pricing_rule_id = fields.Many2one(
        'acs.dialysis.pricing.rule', string='Règle tarifaire', required=True
    )
    date_start = fields.Date(string='Date de début', required=True)
    date_end = fields.Date(string='Date de fin')
    notes = fields.Text(string='Notes')

    _sql_constraints = [
        (
            'date_check',
            'CHECK(date_end IS NULL OR date_end >= date_start)',
            'La date de fin doit être postérieure ou égale à la date de début.',
        )
    ]

    @api.model
    def get_active_rule(self, patient_id, rule_date):
        """Retourne la règle tarifaire active pour un patient à une date donnée.

        Args:
            patient_id: ID du patient (hms.patient)
            rule_date: date (datetime.date) de la séance

        Returns:
            acs.dialysis.pricing.rule recordset (empty if not found)
        """
        record = self.search(
            [
                ('patient_id', '=', patient_id),
                ('date_start', '<=', rule_date),
                '|',
                ('date_end', '=', False),
                ('date_end', '>=', rule_date),
            ],
            limit=1,
            order='date_start desc',
        )
        return record.pricing_rule_id if record else self.env['acs.dialysis.pricing.rule']
