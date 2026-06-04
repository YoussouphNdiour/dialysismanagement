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
