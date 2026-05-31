# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from random import randint
from odoo.exceptions import UserError


class ACSPatientTag(models.Model):
    _name = "hms.patient.tag"
    _description = "Patient Tag"

    def _get_default_color(self):
        return randint(1, 11)

    name = fields.Char(string="Name")
    color = fields.Integer('Color', default=_get_default_color)


class ACSTherapeuticEffect(models.Model):
    _name = "hms.therapeutic.effect"
    _description = "Therapeutic Effect"


    code = fields.Char(string="Code")
    name = fields.Char(string="Name", required=True)


class ACSReligion(models.Model):
    _name = 'acs.religion'
    _description = "Religion"

    name = fields.Char(string="Name", required=True,translate=True)
    code = fields.Char(string='code')
    notes = fields.Char(string='Notes')

    _name_uniq = models.Constraint(
        'UNIQUE(name)',
        "Name must be unique!",
    )


class ACSPatientEmergencyContact(models.Model):
    _name = 'acs.patient.emergency.contact'
    _description= 'Emergency Contact'
    _order = "sequence, id"

    name = fields.Char(string='Name', required=True)
    phone = fields.Char(string='Phone', required=True)
    relationship = fields.Char(string='Relationship')
    sequence = fields.Integer(string='Sequence', default=10)
    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade')
    partner_id = fields.Many2one('res.partner', string='Contact',
        help='Partner-related data of the Emergency Contact', ondelete='restrict')

    @api.onchange('partner_id')
    def onchange_partner_id(self):
        """On change of partner_id, set the name and phone fields."""
        if self.partner_id:
            self.name = self.partner_id.name
            self.phone = self.partner_id.phone
    
    def acs_create_partner(self):
        """Create a partner record for the emergency contact."""
        Partner = self.env['res.partner']
        if not self.partner_id:
            existing_partner = Partner.search([('phone', '=', self.phone)], limit=1)
            if existing_partner:
                raise UserError(_('A partner with this phone number already exists: %s') % existing_partner.name)

            partner = Partner.create({
                'name': self.name,
                'phone': self.phone
            })
            self.partner_id = partner


class AcsSource(models.Model):
    _name = "acs.source"
    _description = "Source"
    _order = "sequence"

    name = fields.Char(string="Name", required=True)
    sequence = fields.Integer(string='Sequence', default=60)
    description = fields.Text(string='Description', help='Description of the source')

    _name_uniq = models.Constraint(
        'UNIQUE(name)',
        "Name must be unique!",
    )

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: