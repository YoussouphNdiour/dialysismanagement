# -*- coding: utf-8 -*-

from odoo import models, _


class AccountMove(models.Model):
    _inherit = 'account.move'

    def action_send_whatsapp_invoice(self):
        """Open wizard to send invoice via WhatsApp"""
        self.ensure_one()

        # Find patient from invoice
        patient_id = False
        if hasattr(self, 'patient_id') and self.patient_id:
            patient_id = self.patient_id.id
        elif self.partner_id:
            # Try to find patient from partner
            patient = self.env['hms.patient'].search([('partner_id', '=', self.partner_id.id)], limit=1)
            if patient:
                patient_id = patient.id

        return {
            'name': _('Send Invoice via WhatsApp'),
            'type': 'ir.actions.act_window',
            'res_model': 'whatsapp.compose.invoice',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_invoice_id': self.id,
                'default_patient_id': patient_id,
                'default_phone': self.partner_id.phone if self.partner_id else '',
            }
        }
