# -*- coding: utf-8 -*-
from odoo import api, fields, models


class AccountMove(models.Model):
    _inherit = 'account.move'

    hospital_invoice_type = fields.Selection(
        selection_add=[
            ('dialysis_session', 'Séance dialyse unitaire'),
            ('dialysis_grouped', 'Séance dialyse groupée'),
        ],
        ondelete={
            'dialysis_session': 'set null',
            'dialysis_grouped': 'set null',
        },
    )

    @api.model
    def _cron_send_overdue_alerts(self):
        """Cron daily: sends overdue payment alerts for dialysis invoices."""
        company = self.env.company
        overdue_days = getattr(company, 'nephro_overdue_days', 30)
        alert_email = getattr(company, 'nephro_alert_email', True)
        alert_whatsapp = getattr(company, 'nephro_alert_whatsapp', False)

        from datetime import date, timedelta
        cutoff_date = date.today() - timedelta(days=overdue_days)

        overdue_moves = self.search([
            ('move_type', '=', 'out_invoice'),
            ('hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']),
            ('payment_state', 'not in', ['paid', 'reversed']),
            ('state', '=', 'posted'),
            ('invoice_date', '<=', cutoff_date),
        ])

        if not overdue_moves:
            return

        if alert_email:
            template = self.env.ref(
                'acs_hms_nephrology_billing.mail_template_nephro_overdue',
                raise_if_not_found=False,
            )
            if template:
                for move in overdue_moves:
                    template.send_mail(move.id, force_send=False)

        if alert_whatsapp and 'acs_hms_whatsapp' in self.env.registry:
            pass  # WhatsApp integration handled by acs_hms_whatsapp module
