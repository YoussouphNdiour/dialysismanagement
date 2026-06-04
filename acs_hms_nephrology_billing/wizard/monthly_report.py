# -*- coding: utf-8 -*-
import calendar
from datetime import date

from odoo import fields, models
from odoo.exceptions import UserError


class AcsDialysisMonthlyReportWizard(models.TransientModel):
    _name = 'acs.dialysis.monthly.report.wizard'
    _description = 'Wizard rapport mensuel facturation dialyse'

    month = fields.Selection(
        [(str(m), calendar.month_name[m]) for m in range(1, 13)],
        string='Mois',
        required=True,
        default=lambda self: str(date.today().month),
    )
    year = fields.Integer(
        string='Année',
        required=True,
        default=lambda self: date.today().year,
    )

    def _get_report_data(self):
        """Returns aggregated billing data for the selected month/year."""
        self.ensure_one()
        month = int(self.month)
        year = self.year
        _, last_day = calendar.monthrange(year, month)
        date_from = date(year, month, 1)
        date_to = date(year, month, last_day)

        invoices = self.env['account.move'].search([
            ('move_type', '=', 'out_invoice'),
            ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
            ('state', '=', 'posted'),
            ('invoice_date', '>=', date_from),
            ('invoice_date', '<=', date_to),
        ])

        total_ttc = sum(invoices.mapped('amount_total'))
        total_paid = sum(
            inv.amount_total
            for inv in invoices
            if inv.payment_state in ('paid', 'in_payment')
        )
        total_pending = total_ttc - total_paid
        total_overdue = sum(
            inv.amount_residual
            for inv in invoices
            if inv.payment_state not in ('paid', 'in_payment', 'reversed')
            and inv.invoice_date_due and inv.invoice_date_due < date.today()
        )

        # Top 20 overdue patients
        overdue_invoices = invoices.filtered(
            lambda inv: inv.payment_state not in ('paid', 'in_payment', 'reversed')
            and inv.invoice_date_due and inv.invoice_date_due < date.today()
        )
        patient_overdue = {}
        for inv in overdue_invoices:
            partner = inv.partner_id
            patient_overdue[partner] = patient_overdue.get(partner, 0) + inv.amount_residual
        top_overdue = sorted(patient_overdue.items(), key=lambda x: x[1], reverse=True)[:20]

        return {
            'month_name': calendar.month_name[month],
            'year': year,
            'total_ttc': total_ttc,
            'total_paid': total_paid,
            'total_pending': total_pending,
            'total_overdue': total_overdue,
            'invoice_count': len(invoices),
            'top_overdue': [
                {'partner': p, 'amount': a} for p, a in top_overdue
            ],
        }

    def action_print_report(self):
        """Triggers the QWeb PDF report."""
        self.ensure_one()
        return self.env.ref(
            'acs_hms_nephrology_billing.action_report_nephro_monthly'
        ).report_action(self)
