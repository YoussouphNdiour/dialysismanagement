# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models ,_
from odoo.exceptions import UserError
from collections import defaultdict
import time
import json
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from odoo.tools import format_datetime
from odoo.tools import DEFAULT_SERVER_DATE_FORMAT as DF, DEFAULT_SERVER_DATETIME_FORMAT as DTF, format_datetime as tool_format_datetime

import logging
_logger = logging.getLogger(__name__)

class ACSPatient(models.Model):
    _inherit = 'hms.patient'

    def _rec_count(self):
        Prescription = self.env['prescription.order']
        for rec in self:
            rec.prescription_count = Prescription.search_count([('patient_id','=',rec.id)])
            rec.treatment_count = len(rec.treatment_ids)
            rec.appointment_count = len(rec.appointment_ids)
            rec.evaluation_count = len(rec.evaluation_ids)
            rec.patient_procedure_count = len(rec.patient_procedure_ids)

    def _acs_get_attachments(self):
        attachments = super()._acs_get_attachments()
        attachments += self.appointment_ids.mapped('attachment_ids')
        return attachments

    @api.model
    def _get_service_id(self):
        registration_product = False
        if self.env.company.patient_registration_product_id:
            registration_product = self.env.company.patient_registration_product_id.id
        return registration_product

    @api.depends('evaluation_ids.state')
    def _get_last_evaluation(self):
        for rec in self:
            evaluation_ids = rec.evaluation_ids.filtered(lambda x: x.state=='done')
                   
            if evaluation_ids:
                rec.last_evaluation_id = evaluation_ids[0].id if evaluation_ids else False
            else:
                rec.last_evaluation_id = False

    def acs_check_cancellation_flag(self):
        acs_flag_days = self.env.user.sudo().company_id.acs_flag_days or 365
        acs_flag_count_limit = self.env.user.sudo().company_id.acs_flag_count_limit or 1
        date_start = fields.Datetime.now() - relativedelta(days=acs_flag_days)
        date_end = fields.Datetime.now()
        for rec in self:
            show_cancellation_warning_flag = False
            cancelled_appointments = self.env['hms.appointment'].sudo().search_count([
                ('date','>=', date_start), 
                ('date','<=', date_end),
                ('patient_id','=', rec.id),
                ('state', 'in', ['cancel'])
            ])
            if cancelled_appointments >= acs_flag_count_limit:
                show_cancellation_warning_flag = True
            rec.show_cancellation_warning_flag = show_cancellation_warning_flag
            rec.acs_flag_days = acs_flag_days
            rec.acs_cancelled_appointments = cancelled_appointments

    ref_doctor_ids = fields.Many2many('res.partner', 'rel_doc_pat', 'doc_id', 
        'patient_id', 'Referring Doctors', domain=[('is_referring_doctor','=',True)])

    #Diseases
    medical_history = fields.Text(string="Past Medical History")
    patient_diseases_ids = fields.One2many('hms.patient.disease', 'patient_id', string='Diagnostic du patient')

    # Medical History Fields
    main_complaint = fields.Text(string="Plainte Principale", help="Main Complaint")
    disease_history = fields.Text(string="Histoire de la maladie", help="Disease History")

    # Personal History (Antecedants personnels)
    medical_antecedent = fields.Text(string="Médicaux", help="Medical Antecedents - Disease")
    surgical_antecedent_ids = fields.Many2many('acs.surgical.history', 'patient_surgical_rel', 'patient_id', 'surgical_id', string="Chirurgicaux", help="Surgical Antecedents")

    # GO (Gyneco-Obstetric) History
    menarche_date = fields.Date(string="Ménarche", help="Date of first menstruation")
    ddr_date = fields.Date(string="DDR", help="Date des Dernières Règles")
    grossesse = fields.Integer(string="Grossesse", help="Number of pregnancies")
    parite = fields.Integer(string="Parité", help="Number of births")
    avortement = fields.Integer(string="Avortement", help="Number of abortions")
    deces = fields.Integer(string="Décès", help="Number of deceased children")

    # Lifestyle (Mode de vie)
    lifestyle_ids = fields.Many2many('acs.lifestyle', 'patient_lifestyle_rel', 'patient_id', 'lifestyle_id', string="Mode de vie", help="Lifestyle")

    # Family History (Antecedants Familiaux)
    family_ascendant_ids = fields.One2many('hms.family.ascendant', 'patient_id', string="Ascendants")
    family_collateral_ids = fields.One2many('hms.family.collateral', 'patient_id', string="Collatéraux")
    family_descendant_ids = fields.One2many('hms.family.descendant', 'patient_id', string="Descendants")

    # Nephropathy (Néphropathie initiale)
    dialysis_start_date = fields.Date(string="Date de début de dialyse", help="Date of dialysis start")
    dialysis_start_center = fields.Char(string="Centre de début", help="Center where dialysis started")
    tunneled_catheter_date = fields.Date(string="Date de Premiere pose de cathétére tunnelisé", help="Date of first tunneled catheter placement")
    catheter_count_simple = fields.Integer(string="Nombre de cathétére Simple (fémoral, jugulaire)", help="Number of simple catheters")
    catheter_count_tunneled = fields.Integer(string="Nombre de cathétére Tunnélisé (droite ou gauche)", help="Number of tunneled catheters")
    fav_creation_date = fields.Date(string="Date de la confection de la FAV", help="Date of FAV (arteriovenous fistula) creation")
    fav_location_id = fields.Many2one('acs.fav.location', string="Localisation de la FAV", help="FAV Location")

    #Family Form Tab
    genetic_risks_ids = fields.One2many('hms.patient.genetic.risk', 'patient_id', 'Genetic Risks')
    family_history_ids = fields.One2many('hms.patient.family.diseases', 'patient_id', 'Family Diseases History')
    department_ids = fields.Many2many('hr.department', 'patint_department_rel','patient_id', 'department_id',
        domain=[('patient_department', '=', True)], string='Departments')

    medication_ids = fields.One2many('hms.patient.medication', 'patient_id', string='Medications')
    ethnic_group_id = fields.Many2one('acs.ethnicity', string='Ethnic group')
    cod_id = fields.Many2one('hms.diseases', string='Cause of Death')
    family_member_ids = fields.One2many('acs.family.member', 'patient_id', string='Family')

    prescription_count = fields.Integer(compute='_rec_count', string='# Prescriptions')
    treatment_ids = fields.One2many('hms.treatment', 'patient_id', 'Treatments')
    treatment_count = fields.Integer(compute='_rec_count', string='# Treatments')
    appointment_count = fields.Integer(compute='_rec_count', string='# Appointments')
    appointment_ids = fields.One2many('hms.appointment', 'patient_id', 'Appointments')
    medical_alert_ids = fields.Many2many('acs.medical.alert', 'patient_medical_alert_rel','patient_id', 'alert_id',
        string='Medical Alerts')
    allergy_ids = fields.Many2many('acs.medical.allergy', 'patient_allergies_rel','patient_id', 'allergies_id',
        string='Allergies')
    registration_product_id = fields.Many2one('product.product', default=_get_service_id, string="Registration Service")
    invoice_id = fields.Many2one("account.move","Registration Invoice", copy=False)

    evaluation_count = fields.Integer(compute='_rec_count', string='# Evaluations')
    evaluation_ids = fields.One2many('acs.patient.evaluation', 'patient_id', 'Evaluations')

    last_evaluation_id = fields.Many2one("acs.patient.evaluation", string="Last Evaluation", compute=_get_last_evaluation, readonly=True, store=True)
    weight = fields.Float(related="last_evaluation_id.weight", string='Weight', help="Weight in KG", readonly=True)
    height = fields.Float(related="last_evaluation_id.height", string='Height', help="Height in cm", readonly=True)
    temp = fields.Float(related="last_evaluation_id.temp", string='Temp', readonly=True)
    hr = fields.Integer(related="last_evaluation_id.hr", string='HR', help="Heart Rate", readonly=True)
    rr = fields.Integer(related="last_evaluation_id.rr", string='RR', readonly=True, help='Respiratory Rate')
    systolic_bp = fields.Integer(related="last_evaluation_id.systolic_bp", string="Systolic BP")
    diastolic_bp = fields.Integer(related="last_evaluation_id.diastolic_bp", string="Diastolic BP")
    spo2 = fields.Integer(related="last_evaluation_id.spo2", string='SpO2', readonly=True, 
        help='Oxygen Saturation, percentage of oxygen bound to hemoglobin')
    rbs = fields.Integer(related="last_evaluation_id.rbs", string='RBS', readonly=True, 
        help='Random blood sugar measures blood glucose regardless of when you last ate.')
    bmi = fields.Float(related="last_evaluation_id.bmi", string='Body Mass Index', readonly=True)
    bmi_state = fields.Selection(related="last_evaluation_id.bmi_state", string='BMI State', readonly=True)

    pain_level = fields.Selection(related="last_evaluation_id.pain_level", string="Pain Level", readonly=True)
    pain = fields.Selection(related="last_evaluation_id.pain", string="Pain", readonly=True)
    
    acs_weight_name = fields.Char(related="last_evaluation_id.acs_weight_name", string='Patient Weight unit of measure label')
    acs_height_name = fields.Char(related="last_evaluation_id.acs_height_name", string='Patient Height unit of measure label')
    acs_temp_name = fields.Char(related="last_evaluation_id.acs_temp_name", string='Patient Temp unit of measure label')
    acs_spo2_name = fields.Char(related="last_evaluation_id.acs_spo2_name", string='Patient SpO2 unit of measure label')
    acs_rbs_name = fields.Char(related="last_evaluation_id.acs_rbs_name", string='Patient RBS unit of measure label')

    patient_procedure_ids = fields.One2many('acs.patient.procedure', 'patient_id', 'Patient Procedures')
    patient_procedure_count = fields.Integer(compute='_rec_count', string='# Patient Procedures')
    show_cancellation_warning_flag = fields.Boolean(compute='acs_check_cancellation_flag', string='Show Cancellation Flag')
    acs_flag_days = fields.Integer(compute='acs_check_cancellation_flag', string='Flag Days')
    acs_cancelled_appointments = fields.Integer(compute='acs_check_cancellation_flag', string='Cancelled Appointments')

    @api.model
    def acs_get_evaluation_color(self):
        return {"acs_evaluation_color": self.env.user.acs_evaluation_color or '#985184'}

    @api.model
    def acs_get_evolution_graph_data(self, patient, field_name, unit=None, domain=[], group_by="none"):
        Evaluation = self.env['acs.patient.evaluation']
        final_domain = [('patient_id','=', patient)] + domain
        _logger.info("\n\n final_domain ----- %s", final_domain)
        
        fields_to_read = ['date', field_name, 'patient_id']
        if unit and unit in Evaluation._fields:
            fields_to_read.append(unit)

        records = Evaluation.sudo().search_read(
            domain=final_domain,
            fields=fields_to_read,
            order="date asc"
        )
        _logger.info("\n\n records ----- %s", records)
        if not records:
            return {"labels": [], "data": [], "tooltiptext": []}

        if group_by == "none":
            return self._acs_get_none_grp_evaluation(records, field_name, unit)
        else:
            return self._acs_get_with_grp_evaluation(records, field_name, unit, group_by)
        
    def _acs_get_none_grp_evaluation(self, records, field_name, unit=None):
        labels, data, tooltiptext, full_dates, units = [], [], [], [], []
        field = self._fields.get(field_name)
        field_label = field.string if field else field_name.capitalize()
        is_field_unit = unit and unit in self._fields

        for rec in records:
            date = rec.get("date")
            value = rec.get(field_name)
            patient = rec.get("patient_id")  # (id, name)

            if date and value not in (False, None):
                date_obj = fields.Datetime.from_string(date)
                labels.append(date_obj.strftime("%Y-%m-%d"))

                user_tz = self.env.user.tz or 'UTC'
                local_dt = fields.Datetime.context_timestamp(self.with_context(tz=user_tz), date_obj)
                full_dates.append(local_dt.strftime("%Y-%m-%d %I:%M:%S %p"))

                data.append(float(value))

                if is_field_unit:
                    unit_val = rec.get(unit) or ""
                else:
                    unit_val = unit or ""
                units.append(unit_val.capitalize())

                tooltiptext.append(f"{patient[1] if patient else 'Unknown'} - {field_label}")

        return {
            "labels": labels,
            "data": data,
            "tooltiptext": tooltiptext,
            "full_dates": full_dates,
            "units": units,
            "field_label": field_label,   #field string
            "field_name": field_name,     #field technical name too
        }

    def _acs_get_with_grp_evaluation(self, records, field_name, group_by, unit=None):
        grouped_data = defaultdict(list)
        grouped_units = defaultdict(list)
        field = self._fields.get(field_name)
        field_label = field.string if field else field_name.capitalize()

        is_field_unit = unit and unit in self._fields

        for rec in records:
            date = rec.get("date")
            value = rec.get(field_name)

            if date and value not in (False, None):
                date_obj = fields.Datetime.from_string(date)

                if group_by == "day":
                    key = date_obj.strftime("%d %b %Y")
                elif group_by == "week":
                    key = f"Week {date_obj.strftime('%W, %Y')}"
                elif group_by == "month":
                    key = date_obj.strftime("%b %Y")
                elif group_by == "year":
                    key = date_obj.strftime("%Y")
                else:
                    key = date_obj.strftime("%Y-%m-%d")

                grouped_data[key].append(float(value))

                if is_field_unit:
                    unit_val = rec.get(unit) or ""
                else:
                    unit_val = unit or ""

                if isinstance(unit_val, str):
                    unit_val = unit_val.capitalize()

                grouped_units[key].append(unit_val)

        aggregated = {k: (sum(v) / len(v)) for k, v in grouped_data.items()}
        #MKA: pick the last non-empty unit for each group
        aggregated_units = {k: (u[-1] if u else "") for k, u in grouped_units.items()}

        sorted_data = sorted(aggregated.items(), key=lambda x: x[0])
        labels = [x[0] for x in sorted_data]
        data = [x[1] for x in sorted_data]
        units = [aggregated_units[x[0]] for x in sorted_data]

        return {
            "labels": labels,
            "data": data,
            "units": units,
            "field_label": field_label,
            "field_name": field_name,
        }

    def action_view_patient_procedures(self):
        action = self.env["ir.actions.actions"]._for_xml_id("acs_hms.action_acs_patient_procedure")
        action['domain'] = [('id', 'in', self.patient_procedure_ids.ids)]
        action['context'] = {'default_patient_id': self.id}
        return action

    def acs_show_evaluation_chart(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'AlmightyHmsEvaluation',
            'params': {
                'active_id': self.id,
                'active_model': 'hms.patient',
                'domain': [('id', '=', self.id)],
            }
        }

    def create_invoice(self):
        product_id = self.registration_product_id or self.env.company.patient_registration_product_id
        if not product_id:
            raise UserError(_("Please Configure Registration Product in Configuration first."))

        invoice = self.acs_create_invoice(partner=self.partner_id, patient=self, product_data=[{'product_id': product_id}], inv_data={'hospital_invoice_type': 'patient'})
        self.invoice_id = invoice.id

    def action_appointment(self):
        action = self.env["ir.actions.actions"]._for_xml_id("acs_hms.action_appointment")
        action['domain'] = [('patient_id','=',self.id)]
        action['context'] = {'default_patient_id': self.id, 'default_physician_id': self.primary_physician_id.id}
        return action

    def action_prescription(self):
        action = self.env["ir.actions.actions"]._for_xml_id("acs_hms.act_open_hms_prescription_order_view")
        action['domain'] = [('patient_id','=',self.id)]
        action['context'] = {'default_patient_id': self.id, 'default_physician_id': self.primary_physician_id.id}
        return action

    def action_treatment(self):
        action = self.env["ir.actions.actions"]._for_xml_id("acs_hms.acs_action_form_hospital_treatment")
        action['domain'] = [('patient_id','=',self.id)]
        action['context'] = {'default_patient_id': self.id, 'default_physician_id': self.primary_physician_id.id}
        return action

    def action_evaluation(self):
        action = self.env["ir.actions.actions"]._for_xml_id("acs_hms.action_acs_patient_evaluation")
        action['domain'] = [('patient_id','=',self.id)]
        action['context'] = {'default_patient_id': self.id, 'default_physician_id': self.primary_physician_id.id}
        return action

    acs_patient_progress = fields.Float(string="Patient Profile Progress", compute="compute_patient_progress")
    show_patient_progress = fields.Boolean(string="Show Patient Progress", compute="compute_view_patient_progress")

    def compute_view_patient_progress(self):
        for rec in self:
            company = rec.company_id or self.env.company
            rec.show_patient_progress = company.sudo().acs_view_patient_progress

    def compute_patient_progress(self):
        for rec in self:
            company = rec.company_id or self.env.company
            acs_patient_progress = 0.0
            dynamic_fields = company.acs_patient_field_ids.filtered(lambda f: f.model == 'hms.patient').mapped('name')
            if dynamic_fields:
                total = len(dynamic_fields)
                filled = sum(1 for field_name in dynamic_fields if getattr(rec, field_name))
                acs_patient_progress = (filled / total * 100) if total else 0.0
            rec.acs_patient_progress = acs_patient_progress


class ACSFamilyMember(models.Model):
    _name = 'acs.family.member'
    _description= 'Family Member'

    related_patient_id = fields.Many2one('hms.patient', string='Family Member', help='Family Member Name', required=True)    
    patient_id = fields.Many2one('hms.patient', string='Patient')
    relation_id = fields.Many2one('acs.family.relation', string='Relation', required=True)
    inverse_relation_id = fields.Many2one("acs.family.member", string="Inverse Relation")

    @api.model_create_multi
    def create(self, vals_list):
        res = super().create(vals_list)
        for record in res:
            if not record.inverse_relation_id and record.relation_id.inverse_relation_id:
                inverse_relation_id = self.create({
                    'inverse_relation_id': record.id,
                    'relation_id': record.relation_id.inverse_relation_id.id,
                    'patient_id': record.related_patient_id.id,
                    'related_patient_id': record.patient_id.id,
                })
                record.inverse_relation_id = inverse_relation_id.id
        return res

    def unlink(self):
        inverse_relation_id = self.mapped('inverse_relation_id')
        res = super(ACSFamilyMember, self).unlink()
        if inverse_relation_id:
            inverse_relation_id.unlink()
        return res

    def write(self, values):
        res = super(ACSFamilyMember, self).write(values)
        if 'patient_id' in values or 'related_patient_id' in values :
            raise UserError(_("Please Delete Exiting relation and create new!"))

        if 'relation_id' in values:
            for rec in self:
                if rec.inverse_relation_id and rec.relation_id.inverse_relation_id and rec.relation_id.inverse_relation_id!=rec.inverse_relation_id.relation_id:
                    rec.inverse_relation_id.relation_id = rec.relation_id.inverse_relation_id.id
        return res


# Surgical History Model
class ACSSurgicalHistory(models.Model):
    _name = 'acs.surgical.history'
    _description = 'Surgical History'

    name = fields.Char(string="Surgical Procedure", required=True)
    description = fields.Text(string="Description")

    _sql_constraints = [
        ('name_uniq', 'UNIQUE(name)', 'Surgical procedure name must be unique!')
    ]


# FAV Location Model
class ACSFAVLocation(models.Model):
    _name = 'acs.fav.location'
    _description = 'FAV Location'

    name = fields.Char(string="FAV Location", required=True)
    description = fields.Text(string="Description")

    _sql_constraints = [
        ('name_uniq', 'UNIQUE(name)', 'FAV location name must be unique!')
    ]


# Lifestyle Model
class ACSLifestyle(models.Model):
    _name = 'acs.lifestyle'
    _description = 'Lifestyle'

    name = fields.Char(string="Lifestyle", required=True)
    description = fields.Text(string="Description")

    _sql_constraints = [
        ('name_uniq', 'UNIQUE(name)', 'Lifestyle name must be unique!')
    ]


# Family Relation Type Model
class ACSFamilyRelationType(models.Model):
    _name = 'acs.family.relation.type'
    _description = 'Family Relation Type'

    name = fields.Char(string="Type de Relation", required=True)
    category = fields.Selection([
        ('ascendant', 'Ascendant'),
        ('collateral', 'Collatéral'),
        ('descendant', 'Descendant'),
    ], string="Catégorie", required=True)
    description = fields.Text(string="Description")

    _sql_constraints = [
        ('name_category_uniq', 'UNIQUE(name, category)', 'This relation type already exists for this category!')
    ]


# Family Ascendant Model
class HMSFamilyAscendant(models.Model):
    _name = 'hms.family.ascendant'
    _description = 'Family Ascendant History'

    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade')
    relation_type_id = fields.Many2one('acs.family.relation.type', string="Type de relation", required=True,
                                       domain="[('category', '=', 'ascendant')]")
    disease_id = fields.Many2one('hms.diseases', string="Maladie")
    notes = fields.Text(string="Notes")


# Family Collateral Model
class HMSFamilyCollateral(models.Model):
    _name = 'hms.family.collateral'
    _description = 'Family Collateral History'

    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade')
    relation_type_id = fields.Many2one('acs.family.relation.type', string="Type de relation", required=True,
                                       domain="[('category', '=', 'collateral')]")
    disease_id = fields.Many2one('hms.diseases', string="Maladie")
    notes = fields.Text(string="Notes")


# Family Descendant Model
class HMSFamilyDescendant(models.Model):
    _name = 'hms.family.descendant'
    _description = 'Family Descendant History'

    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade')
    relation_type_id = fields.Many2one('acs.family.relation.type', string="Type de relation", required=True,
                                       domain="[('category', '=', 'descendant')]")
    disease_id = fields.Many2one('hms.diseases', string="Maladie")
    notes = fields.Text(string="Notes")


class AcsPatientBiologie(models.Model):
    _name = 'acs.patient.biologie'
    _description = "Patient Biologie (Lab Results)"
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = "date desc"

    @api.depends('patient_id', 'patient_id.birthday', 'date')
    def get_patient_age(self):
        for rec in self:
            age = ''
            if rec.patient_id.birthday:
                end_data = rec.date or fields.Datetime.now()
                delta = relativedelta(end_data, rec.patient_id.birthday)
                if delta.years <= 2:
                    age = str(delta.years) + _(" Year") + str(delta.months) + _(" Month ") + str(delta.days) + _(" Days")
                else:
                    age = str(delta.years) + _(" Year")
            rec.age = age

    name = fields.Char(readonly=True, copy=False, default='New ')
    state = fields.Selection([
        ('draft', 'Draft'),
        ('done', 'Done'),
        ('cancel', 'Cancelled'),
    ], string='Status', default='draft', required=True, copy=False, tracking=1)
    date = fields.Datetime(string='Date', default=fields.Datetime.now())

    patient_id = fields.Many2one('hms.patient', ondelete='restrict', string='Patient',
        required=True, index=True, tracking=1)
    image_128 = fields.Binary(related='patient_id.image_128', string='Image', readonly=True)
    age = fields.Char(compute="get_patient_age", string='Age', store=True,
        help="Computed patient age at the moment of the biologie test")
    physician_id = fields.Many2one('hms.physician', ondelete='restrict', string='Physician',
        index=True, tracking=1)

    # Hematology
    gb = fields.Float(string='GB (Globules Blancs)', help="White Blood Cells count")
    hb = fields.Float(string='HB (Hémoglobine)', help="Hemoglobin level")
    vgm = fields.Float(string='VGM', help="Mean Corpuscular Volume")
    ccmh = fields.Float(string='CCMH', help="Mean Corpuscular Hemoglobin Concentration")
    plt = fields.Float(string='PLT (Plaquettes)', help="Platelets count")
    leu = fields.Float(string='LEU (Leucocytes)', help="Leukocytes count")
    crp = fields.Float(string='CRP', help="C-Reactive Protein")
    uricemie = fields.Float(string='Uricémie')
    gaj = fields.Float(string='GAJ')
    hba1c = fields.Float(string='HbA1c')

    # Kidney Function
    uree = fields.Float(string='Urée', help="Urea level")
    creat = fields.Float(string='Créat (Créatinine)', help="Creatinine level")
    dfg_mdrd = fields.Float(string='DFG(MDRD)(ml/min/1,73m2)', help="Glomerular Filtration Rate - MDRD")

    # Electrolytes
    sodium = fields.Float(string='Sodium', help="Sodium level")
    potassium = fields.Float(string='Potassium', help="Potassium level")
    chlore = fields.Float(string='Chlore', help="Chloride level")
    reserve_alcaline = fields.Float(string='Réserve Alcaline')

    # Lipid Profile
    hdl = fields.Float(string='HDL', help="High-Density Lipoprotein")
    ldl = fields.Float(string='LDL', help="Low-Density Lipoprotein")
    ct = fields.Float(string='CT (Cholestérol Total)', help="Total Cholesterol")
    tg = fields.Float(string='TG (Triglycérides)', help="Triglycerides")
    albuminemie = fields.Float(string='Albuminémie')
    proteidemie = fields.Float(string='Protidémie')
    pal = fields.Float(string='PAL')
    bilirubine_t = fields.Float(string='Bilirubine T')
    bilirubine_i = fields.Float(string='Bilirubine I')
    epps = fields.Char(string='EPPS')

    # Liver Function
    alat = fields.Float(string='ALAT', help="Alanine Aminotransferase")
    asat = fields.Float(string='ASAT', help="Aspartate Aminotransferase")
    gamma_gt = fields.Float(string='γ-GT')
    ldh = fields.Float(string='LDH')
    cpk = fields.Float(string='CPK')
    haptoglobine = fields.Float(string='Haptoglobine')
    schizocytes = fields.Char(string='Schizocytes')
    rac = fields.Char(string='RAC')

    # Urine
    pu_24h = fields.Char(string='Pu 24 heures')
    eppu = fields.Char(string='EPPU')
    ecbu = fields.Char(string='ECBU')
    nau = fields.Float(string='NaU')
    ku = fields.Float(string='KU')
    rapport_na_k = fields.Float(string='Rapport Na/K')
    uree_urinaire = fields.Float(string='Urée urinaire')
    creat_urinaire = fields.Float(string='Créat urinaire')

    # PBR
    pbr_resultat = fields.Text(string='Résultat')

    # Hepatitis B Serology (Sérologie Hépatite B)
    serologie_aghbs = fields.Selection([
        ('positive', 'Positif'),
        ('negative', 'Négatif'),
        ('indeterminate', 'Indéterminé'),
    ], string='Ag HBs (Antigène de surface)', help="Hepatitis B Surface Antigen")

    serologie_ac_anti_hbs = fields.Selection([
        ('positive', 'Positif'),
        ('negative', 'Négatif'),
        ('indeterminate', 'Indéterminé'),
    ], string='Ac anti-HBs (Anticorps de surface)', help="Hepatitis B Surface Antibody")

    serologie_ac_anti_hbc = fields.Selection([
        ('positive', 'Positif'),
        ('negative', 'Négatif'),
        ('indeterminate', 'Indéterminé'),
    ], string='Ac anti-HBc (Anticorps du corps de la capside)', help="Hepatitis B Core Antibody")

    serologie_interpretation = fields.Char(string='Interprétation Clinique',
                                           compute='_compute_serologie_interpretation',
                                           store=True,
                                           help="Interprétation automatique basée sur les résultats des trois marqueurs")

    # Minerals and Vitamins
    calcium = fields.Float(string='Calcium', help="Calcium level")
    phosphore = fields.Float(string='Phosphore', help="Phosphorus level")
    pthi = fields.Float(string='PTHi', help="Parathyroid Hormone intact")
    vitamine_d = fields.Float(string='Vitamine D', help="Vitamin D level")

    # Bilan Martial
    ferritinemia = fields.Float(string='Ferritinémie', help="Ferritin level")
    cst = fields.Float(string='CST (Coefficient de Saturation de la Transferrine)', help="Transferrin Saturation Coefficient")
    serum_iron = fields.Float(string='Fer Sérique', help="Serum Iron")

    company_id = fields.Many2one('res.company', ondelete='restrict',
        string='Hospital', default=lambda self: self.env.company)

    @api.depends('serologie_aghbs', 'serologie_ac_anti_hbs', 'serologie_ac_anti_hbc')
    def _compute_serologie_interpretation(self):
        """Compute clinical interpretation based on hepatitis B serology markers"""
        for rec in self:
            ag_hbs = rec.serologie_aghbs
            ac_anti_hbs = rec.serologie_ac_anti_hbs
            ac_anti_hbc = rec.serologie_ac_anti_hbc

            # If any marker is indeterminate or missing, no interpretation
            if not all([ag_hbs, ac_anti_hbs, ac_anti_hbc]) or \
               'indeterminate' in [ag_hbs, ac_anti_hbs, ac_anti_hbc]:
                rec.serologie_interpretation = ''
                continue

            # Apply interpretation rules
            if ag_hbs == 'positive' and ac_anti_hbs == 'negative' and ac_anti_hbc == 'positive':
                rec.serologie_interpretation = 'Infection active (aiguë ou chronique)'
            elif ag_hbs == 'negative' and ac_anti_hbs == 'positive' and ac_anti_hbc == 'negative':
                rec.serologie_interpretation = 'Immunité post-vaccinale (Protection due au vaccin)'
            elif ag_hbs == 'negative' and ac_anti_hbs == 'positive' and ac_anti_hbc == 'positive':
                rec.serologie_interpretation = 'Infection guérie (Immunité acquise naturellement)'
            elif ag_hbs == 'negative' and ac_anti_hbs == 'negative' and ac_anti_hbc == 'negative':
                rec.serologie_interpretation = 'Sujet susceptible (Non protégé, nécessite la vaccination)'
            else:
                rec.serologie_interpretation = 'Profil sérologique atypique - Consultation spécialisée recommandée'

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', _("New")) == _("New"):
                seq_date = None
                if vals.get('date'):
                    seq_date = fields.Datetime.context_timestamp(self, fields.Datetime.to_datetime(vals['date']))
                vals['name'] = self.env['ir.sequence'].with_company(vals.get('company_id')).next_by_code('acs.patient.biologie', sequence_date=seq_date) or _("New")
        return super().create(vals_list)

    def unlink(self):
        for data in self:
            if data.state in ['done']:
                raise UserError(_('You cannot delete record in done state'))
        return super(AcsPatientBiologie, self).unlink()

    def action_draft(self):
        self.state = 'draft'

    def action_done(self):
        self.state = 'done'

    def action_cancel(self):
        self.state = 'cancel'


class ACSPatient(models.Model):
    _inherit = 'hms.patient'

    biologie_ids = fields.One2many('acs.patient.biologie', 'patient_id', 'Biologie (Lab Results)')
    biologie_count = fields.Integer(compute='_rec_count_biologie', string='# Biologie')
    last_biologie_id = fields.Many2one("acs.patient.biologie", string="Last Biologie", compute='_get_last_biologie', readonly=True, store=True)

    # Related fields from last biologie - Hematology
    gb = fields.Float(related="last_biologie_id.gb", string='GB', readonly=True)
    hb = fields.Float(related="last_biologie_id.hb", string='HB', readonly=True)
    vgm = fields.Float(related="last_biologie_id.vgm", string='VGM', readonly=True)
    ccmh = fields.Float(related="last_biologie_id.ccmh", string='CCMH', readonly=True)
    plt = fields.Float(related="last_biologie_id.plt", string='PLT', readonly=True)
    leu = fields.Float(related="last_biologie_id.leu", string='LEU', readonly=True)
    crp = fields.Float(related="last_biologie_id.crp", string='CRP', readonly=True)

    # Related fields from last biologie - Kidney Function
    uree = fields.Float(related="last_biologie_id.uree", string='Urée', readonly=True)
    creat = fields.Float(related="last_biologie_id.creat", string='Créat', readonly=True)
    dfg_mdrd = fields.Float(related="last_biologie_id.dfg_mdrd", string='DFG(MDRD)', readonly=True)

    # Related fields from last biologie - Electrolytes
    sodium = fields.Float(related="last_biologie_id.sodium", string='Sodium', readonly=True)
    potassium = fields.Float(related="last_biologie_id.potassium", string='Potassium', readonly=True)
    chlore = fields.Float(related="last_biologie_id.chlore", string='Chlore', readonly=True)

    # Related fields from last biologie - Lipid Profile
    hdl = fields.Float(related="last_biologie_id.hdl", string='HDL', readonly=True)
    ldl = fields.Float(related="last_biologie_id.ldl", string='LDL', readonly=True)
    ct = fields.Float(related="last_biologie_id.ct", string='CT', readonly=True)
    tg = fields.Float(related="last_biologie_id.tg", string='TG', readonly=True)

    # Related fields from last biologie - Liver Function
    alat = fields.Float(related="last_biologie_id.alat", string='ALAT', readonly=True)
    asat = fields.Float(related="last_biologie_id.asat", string='ASAT', readonly=True)

    # Related fields from last biologie - Hepatitis B Serology
    serologie_aghbs = fields.Selection(related="last_biologie_id.serologie_aghbs", string='Ag HBs (Antigène de surface)', readonly=True)
    serologie_ac_anti_hbs = fields.Selection(related="last_biologie_id.serologie_ac_anti_hbs", string='Ac anti-HBs (Anticorps de surface)', readonly=True)
    serologie_ac_anti_hbc = fields.Selection(related="last_biologie_id.serologie_ac_anti_hbc", string='Ac anti-HBc (Anticorps du corps de la capside)', readonly=True)
    serologie_interpretation = fields.Char(related="last_biologie_id.serologie_interpretation", string='Interprétation Clinique', readonly=True)

    # Related fields from last biologie - Minerals and Vitamins
    calcium = fields.Float(related="last_biologie_id.calcium", string='Calcium', readonly=True)
    phosphore = fields.Float(related="last_biologie_id.phosphore", string='Phosphore', readonly=True)
    pthi = fields.Float(related="last_biologie_id.pthi", string='PTHi', readonly=True)
    vitamine_d = fields.Float(related="last_biologie_id.vitamine_d", string='Vitamine D', readonly=True)

    # Bilan Martial
    ferritinemia = fields.Float(related="last_biologie_id.ferritinemia", string='Ferritinémie', readonly=True)
    cst = fields.Float(related="last_biologie_id.cst", string='CST', readonly=True)
    serum_iron = fields.Float(related="last_biologie_id.serum_iron", string='Fer Sérique', readonly=True)

    # Related fields from last biologie - Hematology additions
    uricemie = fields.Float(related="last_biologie_id.uricemie", string='Uricémie', readonly=True)
    gaj = fields.Float(related="last_biologie_id.gaj", string='GAJ', readonly=True)
    hba1c = fields.Float(related="last_biologie_id.hba1c", string='HbA1c', readonly=True)

    # Related fields from last biologie - Electrolytes additions
    reserve_alcaline = fields.Float(related="last_biologie_id.reserve_alcaline", string='Réserve Alcaline', readonly=True)

    # Related fields from last biologie - Lipid Profile additions
    albuminemie = fields.Float(related="last_biologie_id.albuminemie", string='Albuminémie', readonly=True)
    proteidemie = fields.Float(related="last_biologie_id.proteidemie", string='Protidémie', readonly=True)
    pal = fields.Float(related="last_biologie_id.pal", string='PAL', readonly=True)
    bilirubine_t = fields.Float(related="last_biologie_id.bilirubine_t", string='Bilirubine T', readonly=True)
    bilirubine_i = fields.Float(related="last_biologie_id.bilirubine_i", string='Bilirubine I', readonly=True)
    epps = fields.Char(related="last_biologie_id.epps", string='EPPS', readonly=True)

    # Related fields from last biologie - Liver Function additions
    gamma_gt = fields.Float(related="last_biologie_id.gamma_gt", string='γ-GT', readonly=True)
    ldh = fields.Float(related="last_biologie_id.ldh", string='LDH', readonly=True)
    cpk = fields.Float(related="last_biologie_id.cpk", string='CPK', readonly=True)
    haptoglobine = fields.Float(related="last_biologie_id.haptoglobine", string='Haptoglobine', readonly=True)
    schizocytes = fields.Char(related="last_biologie_id.schizocytes", string='Schizocytes', readonly=True)
    rac = fields.Char(related="last_biologie_id.rac", string='RAC', readonly=True)

    # Related fields from last biologie - Urine
    pu_24h = fields.Char(related="last_biologie_id.pu_24h", string='Pu 24 heures', readonly=True)
    eppu = fields.Char(related="last_biologie_id.eppu", string='EPPU', readonly=True)
    ecbu = fields.Char(related="last_biologie_id.ecbu", string='ECBU', readonly=True)
    nau = fields.Float(related="last_biologie_id.nau", string='NaU', readonly=True)
    ku = fields.Float(related="last_biologie_id.ku", string='KU', readonly=True)
    rapport_na_k = fields.Float(related="last_biologie_id.rapport_na_k", string='Rapport Na/K', readonly=True)
    uree_urinaire = fields.Float(related="last_biologie_id.uree_urinaire", string='Urée urinaire', readonly=True)
    creat_urinaire = fields.Float(related="last_biologie_id.creat_urinaire", string='Créat urinaire', readonly=True)

    # Related fields from last biologie - PBR
    pbr_resultat = fields.Text(related="last_biologie_id.pbr_resultat", string='Résultat PBR', readonly=True)

    # Related fields from last evaluation - Examens Physiques
    tete = fields.Text(related="last_evaluation_id.tete", string='Tête', readonly=True)
    cou = fields.Text(related="last_evaluation_id.cou", string='Cou', readonly=True)
    thorax = fields.Text(related="last_evaluation_id.thorax", string='Thorax', readonly=True)
    abdomen = fields.Text(related="last_evaluation_id.abdomen", string='Abdomen', readonly=True)
    msmi = fields.Text(related="last_evaluation_id.msmi", string='MSMI', readonly=True)
    oge = fields.Text(related="last_evaluation_id.oge", string='OGE', readonly=True)
    traitement = fields.Text(related="last_evaluation_id.traitement", string='Traitement', readonly=True)

    def _rec_count_biologie(self):
        for rec in self:
            rec.biologie_count = len(rec.biologie_ids)

    @api.depends('biologie_ids.state')
    def _get_last_biologie(self):
        for rec in self:
            biologie_ids = rec.biologie_ids.filtered(lambda x: x.state == 'done')
            rec.last_biologie_id = biologie_ids[0].id if biologie_ids else False

    def action_biologie(self):
        action = self.env["ir.actions.actions"]._for_xml_id("acs_hms.action_acs_patient_biologie")
        action['domain'] = [('patient_id', '=', self.id)]
        action['context'] = {'default_patient_id': self.id, 'default_physician_id': self.primary_physician_id.id}
        return action

    def acs_show_biologie_chart(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'AlmightyHmsBiologie',
            'params': {
                'active_id': self.id,
                'active_model': 'hms.patient',
                'domain': [('id', '=', self.id)],
            }
        }

    @api.model
    def acs_get_biologie_graph_data(self, patient, field_name, unit=None, domain=[], group_by="none"):
        Biologie = self.env['acs.patient.biologie']
        final_domain = [('patient_id','=', patient), ('state', '=', 'done')] + domain

        fields_to_read = ['date', field_name, 'patient_id']
        if unit and unit in Biologie._fields:
            fields_to_read.append(unit)

        records = Biologie.sudo().search_read(
            domain=final_domain,
            fields=fields_to_read,
            order="date asc"
        )

        if not records:
            return {"labels": [], "data": [], "tooltiptext": []}

        labels, data, tooltiptext, full_dates = [], [], [], []
        field = Biologie._fields.get(field_name)
        field_label = field.string if field else field_name.capitalize()

        for rec in records:
            date = rec.get("date")
            value = rec.get(field_name)
            patient_name = rec.get("patient_id")

            if date and value not in (False, None):
                date_obj = fields.Datetime.from_string(date)
                labels.append(date_obj.strftime("%Y-%m-%d"))

                user_tz = self.env.user.tz or 'UTC'
                local_dt = fields.Datetime.context_timestamp(self.with_context(tz=user_tz), date_obj)
                full_dates.append(local_dt.strftime("%Y-%m-%d %I:%M:%S %p"))

                data.append(float(value))
                tooltiptext.append(f"{patient_name[1] if patient_name else 'Unknown'} - {field_label}")

        return {
            "labels": labels,
            "data": data,
            "tooltiptext": tooltiptext,
            "full_dates": full_dates,
            "field_label": field_label,
            "field_name": field_name,
        }


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: