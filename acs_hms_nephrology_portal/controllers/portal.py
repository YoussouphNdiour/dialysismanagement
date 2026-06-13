# -*- coding: utf-8 -*-
import json

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
        Construit le dict Chart.js depuis une liste ordonnée de acs.nephro.bilan.
        Les labels sont les dates réelles des bilans (format dd/mm/yy).
        Retourne un JSON string.
        """
        chart_data = {
            'labels':     [b.exam_date.strftime('%d/%m/%y') for b in bilans if b.exam_date],
            'hemoglobin': [round(b.hemoglobin or 0, 2) for b in bilans if b.exam_date],
            'potassium':  [round(b.potassium or 0, 2) for b in bilans if b.exam_date],
            'phosphorus': [round(b.phosphorus or 0, 2) for b in bilans if b.exam_date],
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

    # ------------------------------------------------------------------ #
    #  /my/ordonnances                                                     #
    # ------------------------------------------------------------------ #

    @http.route('/my/ordonnances', auth='user', website=True)
    def portal_ordonnances(self, show_all='', **kw):
        patient = self._get_current_patient()
        if not patient:
            return request.redirect('/my/nephro')

        show_all = show_all == '1'
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
