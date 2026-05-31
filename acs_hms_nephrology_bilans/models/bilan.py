# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ACSNephroBilan(models.Model):
    _name = 'acs.nephro.bilan'
    _description = 'Bilan Biologique Dialyse'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'exam_date desc'

    name = fields.Char(string='Référence', required=True,
                       default='Nouveau', copy=False, readonly=True)
    patient_id = fields.Many2one('hms.patient', string='Patient',
                                  required=True, ondelete='cascade', tracking=True)
    exam_date = fields.Datetime(string='Date du bilan',
                                 default=fields.Datetime.now, required=True, tracking=True)
    physician_id = fields.Many2one('hms.physician', string='Médecin prescripteur')
    bilan_type = fields.Selection([
        ('monthly', 'Mensuel'),
        ('quarterly', 'Trimestriel'),
        ('biannual', 'Semestriel'),
        ('annual', 'Annuel'),
        ('punctual', 'Ponctuel'),
    ], string='Type de bilan', required=True, default='monthly')
    attachment_ids = fields.Many2many(
        'ir.attachment', 'nephro_bilan_attachment_rel',
        'bilan_id', 'attachment_id',
        string='PDF Laboratoire'
    )
    notes = fields.Text(string='Notes')

    # ===== HÉMATOLOGIE =====
    hemoglobin = fields.Float(string='Hémoglobine (g/dL)', digits=(5, 2))
    hematocrit = fields.Float(string='Hématocrite (%)', digits=(5, 1))
    white_blood_cells = fields.Float(string='Globules blancs (G/L)', digits=(5, 2))
    platelets = fields.Float(string='Plaquettes (G/L)', digits=(6, 0))
    ferritin = fields.Float(string='Ferritine (µg/L)', digits=(7, 1))
    transferrin_saturation = fields.Float(string='Saturation transferrine (%)', digits=(5, 1))

    # ===== BIOCHIMIE RÉNALE =====
    creatinine = fields.Float(string='Créatinine (µmol/L)', digits=(7, 1))
    urea_pre = fields.Float(string='Urée pré-dialyse (mmol/L)', digits=(6, 2))
    urea_post = fields.Float(string='Urée post-dialyse (mmol/L)', digits=(6, 2))
    uric_acid = fields.Float(string='Acide urique (µmol/L)', digits=(7, 1))
    urr_calculated = fields.Float(
        string='URR (%)', compute='_compute_urr', store=True, digits=(5, 1))

    # ===== ÉLECTROLYTES =====
    sodium = fields.Float(string='Sodium Na (mmol/L)', digits=(5, 1))
    potassium = fields.Float(string='Potassium K (mmol/L)', digits=(5, 2))
    calcium = fields.Float(string='Calcium Ca (mmol/L)', digits=(5, 2))
    phosphorus = fields.Float(string='Phosphore P (mmol/L)', digits=(5, 2))
    bicarbonate = fields.Float(string='Bicarbonate HCO3 (mmol/L)', digits=(5, 1))
    caxp_product = fields.Float(
        string='Produit CaxP', compute='_compute_caxp', store=True, digits=(5, 2),
        help='Calcium × Phosphore. Alerte si > 4.4 mmol²/L²')

    # ===== MINÉRAUX - OS =====
    pth = fields.Float(string='PTH (pg/mL)', digits=(7, 1))
    vitamin_d = fields.Float(string='Vitamine D (ng/mL)', digits=(6, 1))
    alkaline_phosphatase = fields.Float(string='PAL (UI/L)', digits=(6, 1))

    # ===== NUTRITION & INFLAMMATION =====
    albumin = fields.Float(string='Albumine (g/L)', digits=(5, 1))
    total_proteins = fields.Float(string='Protéines totales (g/L)', digits=(5, 1))
    crp = fields.Float(string='CRP (mg/L)', digits=(6, 1))
    prealbumin = fields.Float(string='Pré-albumine (mg/L)', digits=(6, 1))

    # ===== SÉROLOGIES =====
    hbs_ag = fields.Selection([
        ('positive', 'Positif'), ('negative', 'Négatif'), ('not_done', 'Non fait'),
    ], string='HBs Ag', default='not_done')
    anti_hbs = fields.Selection([
        ('positive', 'Positif (immunisé)'), ('negative', 'Négatif (non immunisé)'), ('not_done', 'Non fait'),
    ], string='Anti-HBs', default='not_done')
    anti_hbc = fields.Selection([
        ('positive', 'Positif'), ('negative', 'Négatif'), ('not_done', 'Non fait'),
    ], string='Anti-HBc', default='not_done')
    anti_hcv = fields.Selection([
        ('positive', 'Positif'), ('negative', 'Négatif'), ('not_done', 'Non fait'),
    ], string='Anti-VHC', default='not_done')
    anti_hiv = fields.Selection([
        ('positive', 'Positif'), ('negative', 'Négatif'), ('not_done', 'Non fait'),
    ], string='Anti-VIH', default='not_done')

    # ===== STATUTS CALCULÉS =====
    hemoglobin_status = fields.Selection([
        ('ok', 'OK'), ('low', 'Bas'), ('high', 'Élevé'),
    ], compute='_compute_statuses', store=True, string='Statut Hb')
    potassium_status = fields.Selection([
        ('ok', 'OK'), ('low', 'Bas'), ('high', 'Élevé'),
    ], compute='_compute_statuses', store=True, string='Statut K')
    phosphorus_status = fields.Selection([
        ('ok', 'OK'), ('low', 'Bas'), ('high', 'Élevé'),
    ], compute='_compute_statuses', store=True, string='Statut P')
    albumin_status = fields.Selection([
        ('ok', 'OK'), ('low', 'Bas'),
    ], compute='_compute_statuses', store=True, string='Statut Albumine')
    pth_status = fields.Selection([
        ('ok', 'OK'), ('low', 'Bas'), ('high', 'Élevé'),
    ], compute='_compute_statuses', store=True, string='Statut PTH')
    caxp_status = fields.Selection([
        ('ok', 'OK'), ('high', 'Élevé'),
    ], compute='_compute_statuses', store=True, string='Statut CaxP')

    @api.depends('urea_pre', 'urea_post')
    def _compute_urr(self):
        for rec in self:
            if rec.urea_pre and rec.urea_post and rec.urea_pre > 0:
                rec.urr_calculated = round((1 - rec.urea_post / rec.urea_pre) * 100, 1)
            else:
                rec.urr_calculated = 0.0

    @api.depends('calcium', 'phosphorus')
    def _compute_caxp(self):
        for rec in self:
            if rec.calcium and rec.phosphorus:
                rec.caxp_product = round(rec.calcium * rec.phosphorus, 2)
            else:
                rec.caxp_product = 0.0

    @api.depends('hemoglobin', 'potassium', 'phosphorus', 'albumin', 'pth', 'caxp_product')
    def _compute_statuses(self):
        for rec in self:
            rec.hemoglobin_status = False
            if rec.hemoglobin:
                if rec.hemoglobin < 10.0:
                    rec.hemoglobin_status = 'low'
                elif rec.hemoglobin > 12.0:
                    rec.hemoglobin_status = 'high'
                else:
                    rec.hemoglobin_status = 'ok'

            rec.potassium_status = False
            if rec.potassium:
                if rec.potassium < 3.5:
                    rec.potassium_status = 'low'
                elif rec.potassium > 5.5:
                    rec.potassium_status = 'high'
                else:
                    rec.potassium_status = 'ok'

            rec.phosphorus_status = False
            if rec.phosphorus:
                if rec.phosphorus < 1.1:
                    rec.phosphorus_status = 'low'
                elif rec.phosphorus > 1.8:
                    rec.phosphorus_status = 'high'
                else:
                    rec.phosphorus_status = 'ok'

            rec.albumin_status = False
            if rec.albumin:
                rec.albumin_status = 'ok' if rec.albumin >= 35.0 else 'low'

            rec.pth_status = False
            if rec.pth:
                if rec.pth < 150:
                    rec.pth_status = 'low'
                elif rec.pth > 300:
                    rec.pth_status = 'high'
                else:
                    rec.pth_status = 'ok'

            rec.caxp_status = False
            if rec.caxp_product:
                rec.caxp_status = 'high' if rec.caxp_product > 4.4 else 'ok'

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'Nouveau') == 'Nouveau':
                vals['name'] = (
                    self.env['ir.sequence'].next_by_code('acs.nephro.bilan') or 'Nouveau'
                )
        return super().create(vals_list)


class ACSPatientBilanRelation(models.Model):
    _inherit = 'hms.patient'

    bilan_ids = fields.One2many(
        'acs.nephro.bilan', 'patient_id', string='Bilans Biologiques'
    )
