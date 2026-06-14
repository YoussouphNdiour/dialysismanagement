# -*- coding: utf-8 -*-
from odoo import api, fields, models
import logging
_logger = logging.getLogger(__name__)


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
        ('predialysis', 'Pré-dialyse'),
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

    @api.model
    def _get_overdue_patients(self, days=30):
        """Retourne les patients néphro sans bilan depuis X jours"""
        from datetime import timedelta
        cutoff = fields.Datetime.now() - timedelta(days=days)

        # Patients néphro actifs
        nephro_patients = self.env['hms.patient'].search([
            ('nephrology_care', '=', True),
            ('active', '=', True),
        ])

        overdue_patients = self.env['hms.patient']
        for patient in nephro_patients:
            last_bilan = self.search([
                ('patient_id', '=', patient.id),
            ], order='exam_date desc', limit=1)

            if not last_bilan or last_bilan.exam_date < cutoff:
                overdue_patients |= patient

        return overdue_patients

    @api.model
    def action_check_overdue_bilans(self):
        """Cron : crée des activités mail pour les bilans en retard"""
        overdue = self._get_overdue_patients(days=30)
        for patient in overdue:
            patient.activity_schedule(
                'mail.mail_activity_data_todo',
                summary='Bilan biologique en retard (> 30 jours)',
                note=f'Le patient {patient.name} n\'a pas eu de bilan depuis plus de 30 jours.',
                user_id=patient.primary_physician_id.user_id.id if patient.primary_physician_id else self.env.uid,
            )

    @api.model
    def action_alert_low_hemoglobin(self):
        """Cron hebdomadaire : détecte les patients avec Hb < 10 g/dL sur
        les 2 derniers bilans consécutifs et notifie le médecin référent."""
        nephro_patients = self.env['hms.patient'].search([
            ('nephrology_care', '=', True),
            ('active', '=', True),
        ])

        template = self.env.ref(
            'acs_hms_nephrology_bilans.mail_template_alert_low_hemoglobin',
            raise_if_not_found=False,
        )

        alerted_count = 0
        for patient in nephro_patients:
            last_two = self.search(
                [('patient_id', '=', patient.id), ('hemoglobin', '>', 0)],
                order='exam_date desc',
                limit=2,
            )
            if len(last_two) < 2:
                continue
            if all(b.hemoglobin_status == 'low' for b in last_two):
                # Éviter les doublons : pas d'activité "Alerte Hb" ouverte
                existing = patient.activity_ids.filtered(
                    lambda a: 'Alerte Hb' in (a.summary or '')
                )
                if existing:
                    continue

                physician_user_id = (
                    patient.primary_physician_id.user_id.id
                    if patient.primary_physician_id and patient.primary_physician_id.user_id
                    else self.env.uid
                )
                hb_values = ', '.join(
                    f'{b.hemoglobin:.1f} g/dL ({b.exam_date.strftime("%d/%m/%Y")})'
                    for b in last_two
                )
                note = (
                    f'⚠️ Alerte anémie : {patient.name} présente une Hb basse '
                    f'sur ses 2 derniers bilans : {hb_values}. '
                    f'Cible KDIGO : 10-12 g/dL.'
                )
                patient.activity_schedule(
                    'mail.mail_activity_data_warning',
                    summary='Alerte Hb basse (< 10 g/dL — 2 bilans consécutifs)',
                    note=note,
                    user_id=physician_user_id,
                )
                if template:
                    template.with_context(
                        hb_values=hb_values,
                        patient_name=patient.name,
                    ).send_mail(patient.id, force_send=True, raise_exception=False)
                alerted_count += 1

        return alerted_count

    @api.model
    def _cron_alert_hb_consecutive(self):
        """
        Cron hebdomadaire : détecte les patients avec Hb bas sur les 2 derniers
        bilans consécutifs et envoie un email au médecin référent (hms.patient.physician_id).
        """
        template = self.env.ref(
            'acs_hms_nephrology_bilans.mail_template_hb_alert_consecutive',
            raise_if_not_found=False,
        )
        if not template:
            _logger.warning('_cron_alert_hb_consecutive : template email introuvable')
            return

        nephro_patients = self.env['hms.patient'].search([('active', '=', True)])

        for patient in nephro_patients:
            last_two = self.search(
                [('patient_id', '=', patient.id), ('hemoglobin', '>', 0)],
                order='exam_date desc',
                limit=2,
            )
            if len(last_two) < 2:
                continue
            if not all(b.hemoglobin_status == 'low' for b in last_two):
                continue
            physician = patient.primary_physician_id
            if not physician or not physician.partner_id.email:
                continue
            try:
                bilan_recent = last_two[0]
                bilan_prev = last_two[1]
                template.with_context(
                    patient_name=patient.name,
                    bilan_recent_name=bilan_recent.name,
                    bilan_recent_date=bilan_recent.exam_date.strftime('%d/%m/%Y') if bilan_recent.exam_date else '',
                    bilan_recent_hb=bilan_recent.hemoglobin,
                    bilan_prev_name=bilan_prev.name,
                    bilan_prev_date=bilan_prev.exam_date.strftime('%d/%m/%Y') if bilan_prev.exam_date else '',
                    bilan_prev_hb=bilan_prev.hemoglobin,
                ).send_mail(physician.partner_id.id, force_send=True)
            except Exception as e:
                _logger.warning(
                    'Alerte Hb : échec envoi email pour patient %s — %s',
                    patient.name, str(e)
                )


class ACSPatientBilanRelation(models.Model):
    _inherit = 'hms.patient'

    bilan_ids = fields.One2many(
        'acs.nephro.bilan', 'patient_id', string='Bilans Biologiques'
    )
    bilan_count = fields.Integer(compute='_compute_bilan_count', string='# Bilans')

    def _compute_bilan_count(self):
        for rec in self:
            rec.bilan_count = len(rec.bilan_ids)

    def action_open_bilans(self):
        action = self.env['ir.actions.actions']._for_xml_id(
            'acs_hms_nephrology_bilans.action_acs_nephro_bilan'
        )
        action['domain'] = [('patient_id', '=', self.id)]
        action['context'] = {'default_patient_id': self.id}
        return action
