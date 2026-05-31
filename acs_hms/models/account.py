# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.

from odoo import api,fields,models,_


class AccountMove(models.Model):
    _inherit = 'account.move'

    ref_physician_id = fields.Many2one('res.partner', ondelete='restrict', string='Referring Physician', 
        index=True, help='Referring Physician')
    appointment_id = fields.Many2one('hms.appointment', string='Appointment')
    procedure_id = fields.Many2one('acs.patient.procedure', string='Patient Procedure')
    acs_treatment_id = fields.Many2one('hms.treatment', string='Patient Treatment')
    hospital_invoice_type = fields.Selection(selection_add=[('appointment', 'Appointment'), ('treatment','Treatment'), ('procedure','Procedure')])
