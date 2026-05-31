# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class PrescriptionOrder(models.Model):
    _inherit = 'prescription.order'

    whatsapp_message_ids = fields.One2many(
        'whatsapp.message',
        compute='_compute_whatsapp_message_ids',
        string='WhatsApp Messages'
    )
    whatsapp_message_count = fields.Integer(
        compute='_compute_whatsapp_message_ids',
        string='WhatsApp Messages Count'
    )

    def _compute_whatsapp_message_ids(self):
        """Compute WhatsApp messages related to this prescription"""
        for record in self:
            messages = self.env['whatsapp.message'].search([
                ('model', '=', self._name),
                ('res_id', '=', record.id)
            ])
            record.whatsapp_message_ids = messages
            record.whatsapp_message_count = len(messages)

    def action_send_whatsapp(self):
        """Open wizard to send prescription via WhatsApp"""
        self.ensure_one()

        # Check if patient has a phone number
        if not self.patient_id.phone:
            raise UserError(_('Patient does not have a phone number. Please add one to send WhatsApp messages.'))

        return {
            'name': _('Send via WhatsApp'),
            'type': 'ir.actions.act_window',
            'res_model': 'whatsapp.compose.message',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_prescription_id': self.id,
                'default_patient_id': self.patient_id.id,
                'default_phone': self.patient_id.phone,
            }
        }

    def action_view_whatsapp_messages(self):
        """View WhatsApp messages sent for this prescription"""
        self.ensure_one()
        return {
            'name': _('WhatsApp Messages'),
            'type': 'ir.actions.act_window',
            'res_model': 'whatsapp.message',
            'view_mode': 'tree,form',
            'domain': [('model', '=', self._name), ('res_id', '=', self.id)],
            'context': {'create': False}
        }
