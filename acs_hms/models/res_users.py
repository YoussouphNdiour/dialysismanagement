# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.

from odoo import api, models, fields, _, SUPERUSER_ID

ACS_HMS_FIELDS = [
    'physician_id',
    'acs_signature',
    'acs_medical_license',
    'acs_appointment_duration',
    'acs_evaluation_color',
    'department_ids', 
    'physician_count', 
    'physician_ids', 
    'patient_count'
]

class ResUsers(models.Model):
    _inherit = 'res.users'

    @api.depends('physician_ids')
    def _compute_physician_count(self):
        for user in self.with_context(active_test=False):
            user.physician_count = len(user.sudo().physician_ids)

    def _compute_patient_count(self):
        Patient = self.env['hms.patient'].sudo()
        for user in self.with_context(active_test=False):
            user.patient_count = Patient.search_count([('partner_id','=', user.partner_id.id)])

    department_ids = fields.Many2many('hr.department', 'user_department_rel', 'user_id','department_id', 
        domain=[('patient_department', '=', True)], string='Departments')
    physician_count = fields.Integer(string="#Physician", compute="_compute_physician_count")
    physician_ids = fields.One2many('hms.physician', 'user_id', string='Related Physician')
    patient_count = fields.Integer(string="#Patient", compute="_compute_patient_count")
    acs_evaluation_color = fields.Char(string='HMS Evaluation Color', default="#985184")

    physician_id = fields.Many2one('hms.physician', string="Company Physician",
        compute='_compute_company_physician', search='_search_company_physician', store=False)
    acs_signature = fields.Binary(related='physician_id.signature', string="Acs Signature", readonly=False, related_sudo=False)
    acs_medical_license = fields.Char(related='physician_id.medical_license', string="Acs Medical License,", readonly=False, related_sudo=False)
    acs_appointment_duration = fields.Float(related="physician_id.appointment_duration", string="Acs Appointment Duration",readonly=False, related_sudo=False)

    #ACS NOTE: On changing the department clearing the cache for the access rights and record rules
    def write(self, values):
        if 'department_ids' in values:
            self.env['ir.model.access'].call_cache_clearing_methods()
            #self.env['ir.rule'].clear_caches()
            #self.has_group.clear_cache(self)
        return super(ResUsers, self).write(values)

    def action_create_physician(self):
        self.ensure_one()
        portal_user = self.share
        physician = self.env['hms.physician'].create({
            'user_id': self.id,
            'name': self.name,
        })
        if portal_user:
            physician.is_portal_user = True

    def action_create_patient(self):
        self.ensure_one()
        self.env['hms.patient'].create({
            'partner_id': self.partner_id.id,
            'name': self.name,
        })

    @api.depends('physician_ids')
    @api.depends_context('company')
    def _compute_company_physician(self):
        physician_per_user = {
            physician.user_id: physician
            for physician in self.env['hms.physician'].search([('user_id', 'in', self.ids), ('company_id', '=', self.env.company.id)])
        }
        for user in self:
            user.physician_id = physician_per_user.get(user)

    def _search_company_physician(self, operator, value):
        return [('physician_ids', operator, value)]

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ACS_HMS_FIELDS

    @property
    def SELF_WRITEABLE_FIELDS(self):
        return super().SELF_WRITEABLE_FIELDS + ACS_HMS_FIELDS