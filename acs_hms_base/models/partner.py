# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from dateutil.relativedelta import relativedelta
from datetime import datetime


class ResPartner(models.Model):
    _inherit= "res.partner"

    @api.depends('birthday', 'date_of_death')
    def _get_age(self):
        today = datetime.now()        
        for rec in self:
            age = ''
            today_is_birthday = False
            if rec.birthday:
                end_data = rec.date_of_death or fields.Datetime.now()
                delta = relativedelta(end_data, rec.birthday)
                if delta.years <= 2:
                    age = str(delta.years) + _(" Year") + str(delta.months) + _(" Month ") + str(delta.days) + _(" Days")
                else:
                    age = str(delta.years) + _(" Year")

                if today.strftime('%m')==rec.birthday.strftime('%m') and today.strftime('%d')==rec.birthday.strftime('%d'):
                    today_is_birthday = True

            rec.age = age
            rec.today_is_birthday = today_is_birthday

    name = fields.Char(tracking=True)
    code = fields.Char(string='Code', default='New',
        help='Identifier provided by the Health Center.', copy=False, tracking=True)
    gender = fields.Selection([
        ('male', 'Male'), 
        ('female', 'Female'), 
        ('other', 'Other')], string='Gender', default='male', tracking=True)
    birthday = fields.Date(string='Date of Birth', tracking=True)

    date_of_death = fields.Date(string='Date of Death')
    age = fields.Char(string='Age', compute='_get_age')
    today_is_birthday = fields.Boolean(string='Birthday Today', compute='_get_age')
    hospital_name = fields.Char()
    blood_group = fields.Selection([
        ('A+', 'A+'),('A-', 'A-'),
        ('B+', 'B+'),('B-', 'B-'),
        ('AB+', 'AB+'),('AB-', 'AB-'),
        ('O+', 'O+'),('O-', 'O-')], string='Blood Group')

    is_patient = fields.Boolean(compute='_is_patient', search='_patient_search',
        string='Is Patient', help="Check if customer is linked with patient.")
    acs_amount_due = fields.Monetary(compute='_compute_acs_amount_due',currency_field='currency_id')
    acs_patient_id = fields.Many2one('hms.patient', compute='_is_patient', string='Patient', readonly=True)
    acs_contact_address_complete = fields.Char(compute='get_acs_compute_complete_address', string='ACS Contact Address')

    # MKA: It was added to the acs_hms, so there's a dependency issue.
    is_referring_doctor = fields.Boolean(string="Is Referring Physician")

    @api.depends('street', 'zip', 'city', 'country_id')
    def get_acs_compute_complete_address(self):
        for record in self:
            contact_address_complete = ''
            if record.street:
                contact_address_complete += record.street + ', '
            if record.zip:
                contact_address_complete += record.zip + ' '
            if record.city:
                contact_address_complete += record.city + ', '
            if record.state_id:
                contact_address_complete += record.state_id.name + ', '
            if record.country_id:
                contact_address_complete += record.country_id.name
            record.acs_contact_address_complete = contact_address_complete.strip().strip(',')

    def _compute_acs_amount_due(self):
        MoveLine = self.env['account.move.line']
        for record in self:
            amount_due = 0
            unreconciled_aml_ids = MoveLine.sudo().search([('reconciled', '=', False),
               ('account_id.active', '=', True),
               ('account_id.account_type', '=', 'asset_receivable'),
               ('move_id.state', '=', 'posted'),
               ('partner_id', '=', record.id),
               ('company_id','=',self.env.company.id)])
            for aml in unreconciled_aml_ids:
                amount_due += aml.amount_residual
            record.acs_amount_due = amount_due

    def _is_patient(self):
        Patient = self.env['hms.patient'].sudo()
        for rec in self:
            patient = Patient.sudo().search([('partner_id', '=', rec.id)], limit=1)
            rec.acs_patient_id = patient.id if patient else False
            rec.is_patient = True if patient else False

    def _patient_search(self, operator, value):
        patients = self.env['hms.patient'].sudo().search([])
        return [('id', 'in', patients.mapped('partner_id').ids)]

    def create_patient(self):
        self.ensure_one()
        patient_id = self.env['hms.patient'].create({
            'partner_id': self.id,
            'name': self.name,
        })
        return patient_id

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: