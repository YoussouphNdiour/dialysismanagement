# -*- coding: utf-8 -*-
# Part of AlmightyCS. See LICENSE file for full copyright and licensing details.

import math

from odoo import api, fields, models,_


class ACSPatient(models.Model):
    _inherit = 'hms.patient'

    nephrology_care = fields.Boolean(string="Nephrology Care")
    debugging_treatment_start_date = fields.Date(string="Debugging Treatment Start Date")
    dry_weight_history_ids = fields.One2many(
        'acs.dry.weight.history', 'patient_id',
        string='Historique Poids Sec'
    )

    # Medical History Fields for Nephrology
    nephro_main_complaint = fields.Text(string="Plainte Principale (Néphro)", help="Main Complaint")
    nephro_disease_history = fields.Text(string="Histoire de la maladie (Néphro)", help="Disease History")

    # Personal History (Antecedants personnels)
    nephro_medical_antecedent = fields.Text(string="Médicaux (Néphro)", help="Medical Antecedents - Disease")
    nephro_surgical_antecedent_ids = fields.Many2many('acs.surgical.history', 'nephro_patient_surgical_rel', 'patient_id', 'surgical_id', string="Chirurgicaux (Néphro)", help="Surgical Antecedents")

    # GO (Gyneco-Obstetric) History
    nephro_menarche_date = fields.Date(string="Ménarche (Néphro)", help="Date of first menstruation")
    nephro_ddr_date = fields.Date(string="DDR (Néphro)", help="Date des Dernières Règles")
    nephro_grossesse = fields.Integer(string="Grossesse (Néphro)", help="Number of pregnancies")
    nephro_parite = fields.Integer(string="Parité (Néphro)", help="Number of births")
    nephro_avortement = fields.Integer(string="Avortement (Néphro)", help="Number of abortions")
    nephro_deces = fields.Integer(string="Décès (Néphro)", help="Number of deceased children")

    # Lifestyle (Mode de vie)
    nephro_lifestyle_ids = fields.Many2many('acs.lifestyle', 'nephro_patient_lifestyle_rel', 'patient_id', 'lifestyle_id', string="Mode de vie (Néphro)", help="Lifestyle")

    # Family History (Antecedants Familiaux)
    nephro_family_ascendant_ids = fields.One2many('hms.nephro.family.ascendant', 'patient_id', string="Ascendants (Néphro)")
    nephro_family_collateral_ids = fields.One2many('hms.nephro.family.collateral', 'patient_id', string="Collatéraux (Néphro)")
    nephro_family_descendant_ids = fields.One2many('hms.nephro.family.descendant', 'patient_id', string="Descendants (Néphro)")

    # Nephropathy (Néphropathie initiale)
    nephro_dialysis_start_date = fields.Date(string="Date de début de dialyse (Néphro)", help="Date of dialysis start")
    nephro_dialysis_start_center = fields.Char(string="Centre de début (Néphro)", help="Center where dialysis started")
    nephro_tunneled_catheter_date = fields.Date(string="Date de Premiere pose de cathétére tunnelisé (Néphro)", help="Date of first tunneled catheter placement")
    nephro_catheter_count_simple = fields.Integer(string="Nombre de cathétére Simple (Néphro)", help="Number of simple catheters")
    nephro_catheter_count_tunneled = fields.Integer(string="Nombre de cathétére Tunnélisé (Néphro)", help="Number of tunneled catheters")
    nephro_fav_creation_date = fields.Date(string="Date de la confection de la FAV (Néphro)", help="Date of FAV (arteriovenous fistula) creation")
    nephro_fav_location_id = fields.Many2one('acs.fav.location', string="Localisation de la FAV (Néphro)", help="FAV Location")

    # Imagerie (Medical Imaging) - Relations
    echography_ids = fields.One2many('acs.nephro.echography', 'patient_id', string='Échographies')
    radio_ids = fields.One2many('acs.nephro.radio', 'patient_id', string='Radiographies')
    tdm_ids = fields.One2many('acs.nephro.tdm', 'patient_id', string='TDM')
    irm_ids = fields.One2many('acs.nephro.irm', 'patient_id', string='IRM')


class HrDepartment(models.Model): 
    _inherit = "hr.department"

    department_type = fields.Selection(selection_add=[('nephrology','Nephrology')])


class AcsPatientEvaluation(models.Model):
    _inherit = "acs.patient.evaluation"

    blood_flow = fields.Float(string="Blood Flow")
    venous_pressure = fields.Float(string="Venous Pressure")


class ACSProduct(models.Model):
    _inherit = 'product.template'

    hospital_product_type = fields.Selection(selection_add=[('nephrology_procedure','Nephrology Process')])


class Appointment(models.Model):
    _inherit = 'hms.appointment'

    blood_flow = fields.Float(related="evaluation_id.blood_flow" ,string="Blood Flow",readonly=True)
    venous_pressure = fields.Float(related="evaluation_id.venous_pressure",string="Venous Pressure",readonly=True)
    blood_group = fields.Selection(related="patient_id.blood_group", string='Blood Group')
    debugging_treatment = fields.Date(string="Debugging Treatment Start Date", related="patient_id.debugging_treatment_start_date")
    show_etiology = fields.Boolean(string="Show Etiology Of Chronic Renal Failure", default=False)
    etiology_of_chronic_renal_failure = fields.Text(string="Etiology Of Chronic Renal Failure")
    show_way_of_arrival = fields.Boolean(string="Show Way Of Arrival", default=False)
    way_of_arrival = fields.Text(string="Way Of Arrival")
    show_adverse_reactions = fields.Boolean(string="Show Adverse Reactions", default=False)
    adverse_reactions = fields.Text(string="Adverse Reactions")
    show_transplant_waiting_list = fields.Boolean(string="Show Transplant Waiting List", default=False)
    transplant_waiting_list = fields.Text('Transplant Waiting List')
    show_toxic_habits = fields.Boolean(string="Show Toxic Habits", default=False)
    toxic_habits = fields.Text(string="Toxic Habits")
    show_trauma = fields.Boolean(string="Show Trauma", default=False)
    trauma = fields.Text(string="Trauma")
    show_transfusions = fields.Boolean(string="Show Transfusions", default=False)
    transfusions = fields.Text(string="Transfusions")
    show_cesarean_operations = fields.Boolean(string="Show Cesarean Operations", default=False)
    cesarean_operations = fields.Text(string="Cesarean Operations")
    show_vaccinations = fields.Boolean(string="Show Vaccinations", default=False)
    vaccinations = fields.Text(string="Vaccinations")
    observation = fields.Text(string="Observation")


class HemodialysisVitalSign(models.Model):
    _name = 'hemodialysis.vital.sign'
    _description = 'Signes Vitaux Hémodialyse'
    _order = 'measurement_time'

    procedure_id = fields.Many2one('acs.patient.procedure', string='Hémodialyse', required=True, ondelete='cascade')
    measurement_time = fields.Datetime(string='Heure de mesure', default=fields.Datetime.now, required=True)
    blood_pressure = fields.Char(string='Tension artérielle', help='Ex: 120/80')
    heart_rate = fields.Integer(string='Fréquence cardiaque (bpm)')
    respiratory_rate = fields.Integer(string='Fréquence respiratoire (/min)')
    notes = fields.Text(string='Notes')
    spo2 = fields.Float(string='SpO2 (%)', digits=(5, 1))
    temperature = fields.Float(string='Température (°C)', digits=(4, 1))
    glycemia = fields.Float(string='Glycémie (g/L)', digits=(4, 2),
                             help='À saisir si patient diabétique')
    is_hypotension = fields.Boolean(
        string='Hypotension détectée',
        compute='_compute_is_hypotension',
        store=True,
        help='Vrai si TA systolique < 90 mmHg'
    )

    @api.depends('blood_pressure')
    def _compute_is_hypotension(self):
        for rec in self:
            rec.is_hypotension = False
            if rec.blood_pressure:
                try:
                    systolic = int(rec.blood_pressure.split('/')[0].strip())
                    rec.is_hypotension = systolic < 90
                except (ValueError, IndexError):
                    pass


class AcsPatientProcedure(models.Model):
    _inherit = 'acs.patient.procedure'

    blood_group = fields.Selection(related="patient_id.blood_group", string='Blood Group')

    # Ordre des champs comme demandé
    # 1. Poids
    dry_weight = fields.Float(string="Poids Sec")
    arrival_weight = fields.Float(string="Poids D'Arrivée")
    interdialysis_increase = fields.Float(
        string="Prise de Poids Interdialytique",
        compute='_compute_weight_fields',
        store=True,
    )
    uf_habituelle = fields.Float(string="UF habituelle /ml")
    uf_max = fields.Float(string="UF Max /ml")

    # 2. Débits
    blood_flow = fields.Float(string="Débit Sanguin")
    dialysis_fluid_flow = fields.Float(string="Débit Dialysat")
    anticoagulation = fields.Text(string="Anticoagulation")
    glc = fields.Float(string="Glc")
    restitution = fields.Char(string="Restitution")
    bicarbonate = fields.Text(string="Bicarbonate")

    # 3. Hémoculture
    blood_culture = fields.Text(string="Hémoculture")

    # 4. Vaccination (ancien "Traitement")
    vaccination = fields.Text(string="Vaccination")

    # 5. Traitement en cours
    interdialysis_medication = fields.Text(string="Traitement En Cours", help="occurring or carried out during hemodialysis")

    # Autres champs
    aiguille_arterielle = fields.Char(string="Aiguille Artérielle")
    aiguille_veineuse = fields.Char(string="Aiguille Veineuse")
    ponction = fields.Char(string="Ponction")
    allergy_ids = fields.Many2many('acs.medical.allergy', related='patient_id.allergy_ids', string='Allergies', readonly=True)

    type_of_vascular_access = fields.Many2one('acs.vascular.access', string="Type Of Vascular Access")
    dialyzer_type = fields.Many2one('acs.dialyzer', string="Rein", help="A dialyser is also known as an artificial kidney")
    nephrology_schedule_ids = fields.Many2many('acs.nephrology.schedule', 'acs_nephrology_schedule_rel', 'appointment_schedule_id', 'nephrology_schedule_id', string="Schedule")

    # Signes vitaux (6 fois pendant l'hémodialyse)
    vital_sign_ids = fields.One2many('hemodialysis.vital.sign', 'procedure_id', string='Signes Vitaux')

    last_ktv = fields.Float(string="Last KTV")
    last_ktv_sp = fields.Float(string="DERNIER KT/V sp")
    last_ktv_dp = fields.Float(string="DERNIER KT/V dp")
    last_pru_percent = fields.Float(string="DERNIER PRU %")
    type_of_dialysate = fields.Many2one('acs.dialysate', string="Type Of Dialysate")
    dialysis_number = fields.Integer(string="Dialysis #")
    potassium = fields.Char(string="K")
    sodium = fields.Char(string="Na")
    calcium = fields.Char(string="Ca")
    erythropoietin_units = fields.Char(string="Erythropoietin")
    transfusion = fields.Text(string="Transfusion")

    # --- Avant séance ---
    arrival_status = fields.Selection([
        ('normal', 'Normal'),
        ('tired', 'Fatigué'),
        ('pain', 'Douleur'),
        ('fever', 'Fièvre'),
        ('other', 'Autre'),
    ], string="Statut à l'arrivée")
    pre_dialysis_bp = fields.Char(string='TA pré-dialyse', required=True, help='Ex: 140/90')
    pre_dialysis_temp = fields.Float(string='Température pré-dialyse (°C)', digits=(4, 1))
    parameter_change_reason = fields.Text(
        string='Motif de changement de paramètres',
        help='Si les paramètres diffèrent du protocole habituel'
    )

    # --- Fin séance ---
    departure_weight = fields.Float(string='Poids sortie (kg)', digits=(5, 2))
    actual_uf = fields.Float(
        string='UF réelle (ml)',
        compute='_compute_weight_fields',
        store=True,
        digits=(7, 0),
        help='Calculé : (poids arrivée - poids sortie) × 1000'
    )
    actual_duration_override = fields.Float(
        string='Override durée (h)',
        digits=(4, 2),
        help='Rempli automatiquement si infirmier saisit manuellement la durée'
    )
    actual_duration = fields.Float(
        string='Durée effective (heures)',
        compute='_compute_actual_duration',
        inverse='_inverse_actual_duration',
        store=True,
        digits=(4, 2),
        help='Calculé automatiquement depuis heure début/fin. Saisie manuelle possible.'
    )
    global_tolerance = fields.Selection([
        ('good', 'Bonne'),
        ('average', 'Moyenne'),
        ('poor', 'Mauvaise'),
    ], string='Tolérance globale')
    end_notes = fields.Text(string='Notes de fin de séance')

    # --- Urée pour calcul KT/V ---
    urea_pre = fields.Float(string='Urée pré-dialyse (mmol/L)', digits=(6, 2))
    urea_post = fields.Float(string='Urée post-dialyse (mmol/L)', digits=(6, 2))

    # --- KT/V et URR calculés ---
    ktv_calculated = fields.Float(
        string='KT/V calculé',
        compute='_compute_ktv',
        store=True,
        digits=(4, 2),
        help='Formule Daugirdas II'
    )
    ktv_status = fields.Selection([
        ('adequate', 'Adéquat (≥ 1.2)'),
        ('insufficient', 'Insuffisant (< 1.2)'),
    ], string='Statut KT/V', compute='_compute_ktv', store=True)
    urr_calculated = fields.Float(
        string='URR (%)',
        compute='_compute_ktv',
        store=True,
        digits=(5, 1),
        help="Taux de réduction de l'urée = (1 - Cpost/Cpré) × 100"
    )

    @api.depends('arrival_weight', 'departure_weight', 'dry_weight')
    def _compute_weight_fields(self):
        for rec in self:
            # Prise interdialytique
            if rec.arrival_weight and rec.dry_weight:
                rec.interdialysis_increase = round(
                    rec.arrival_weight - rec.dry_weight, 2
                )
            else:
                rec.interdialysis_increase = 0.0
            # UF réelle en ml
            if rec.arrival_weight and rec.departure_weight:
                rec.actual_uf = round(
                    (rec.arrival_weight - rec.departure_weight) * 1000, 0
                )
            else:
                rec.actual_uf = 0.0

    @api.depends('date', 'date_stop', 'actual_duration_override')
    def _compute_actual_duration(self):
        for rec in self:
            # Note: 0.0 override is treated as "not set" (clinically, a 0-duration dialysis session
            # never occurs). If needed, add a Boolean flag field.
            if rec.actual_duration_override:
                rec.actual_duration = rec.actual_duration_override
            elif rec.date and rec.date_stop and rec.date_stop > rec.date:
                diff = rec.date_stop - rec.date
                rec.actual_duration = round(diff.total_seconds() / 3600, 2)
            else:
                rec.actual_duration = 0.0

    def _inverse_actual_duration(self):
        for rec in self:
            rec.actual_duration_override = rec.actual_duration

    @api.depends('urea_pre', 'urea_post', 'actual_duration', 'actual_uf', 'departure_weight')
    def _compute_ktv(self):
        for rec in self:
            rec.ktv_calculated = 0.0
            rec.ktv_status = False
            rec.urr_calculated = 0.0

            if not rec.urea_pre or not rec.urea_post or rec.urea_pre <= 0:
                continue

            # URR
            rec.urr_calculated = round((1 - rec.urea_post / rec.urea_pre) * 100, 1)

            # KT/V Daugirdas II
            R = rec.urea_post / rec.urea_pre
            t = rec.actual_duration or 0.0
            uf_liters = (rec.actual_uf or 0.0) / 1000.0
            W = rec.departure_weight or 0.0

            try:
                inner = R - 0.008 * t
                if inner <= 0 or W <= 0:
                    continue
                ktv = -math.log(inner) + (4 - 3.5 * R) * uf_liters / W
                rec.ktv_calculated = round(ktv, 2)
                rec.ktv_status = 'adequate' if ktv >= 1.2 else 'insufficient'
            except (ValueError, ZeroDivisionError):
                pass

    def acs_consumable_line_data(self):
        data = {} 
        for line in self.consumable_line_ids:
            category = line.product_id.categ_id
            if category not in data:
                data[category] = [line]
            else:
                data[category].append(line)
        return data


# Nephrology Family Ascendant Model
class HMSNephroFamilyAscendant(models.Model):
    _name = 'hms.nephro.family.ascendant'
    _description = 'Nephrology Family Ascendant History'

    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade')
    relation_type_id = fields.Many2one('acs.family.relation.type', string="Type de relation", required=True,
                                       domain="[('category', '=', 'ascendant')]")
    disease_id = fields.Many2one('hms.diseases', string="Maladie")
    notes = fields.Text(string="Notes")


# Nephrology Family Collateral Model
class HMSNephroFamilyCollateral(models.Model):
    _name = 'hms.nephro.family.collateral'
    _description = 'Nephrology Family Collateral History'

    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade')
    relation_type_id = fields.Many2one('acs.family.relation.type', string="Type de relation", required=True,
                                       domain="[('category', '=', 'collateral')]")
    disease_id = fields.Many2one('hms.diseases', string="Maladie")
    notes = fields.Text(string="Notes")


# Nephrology Family Descendant Model
class HMSNephroFamilyDescendant(models.Model):
    _name = 'hms.nephro.family.descendant'
    _description = 'Nephrology Family Descendant History'

    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade')
    relation_type_id = fields.Many2one('acs.family.relation.type', string="Type de relation", required=True,
                                       domain="[('category', '=', 'descendant')]")
    disease_id = fields.Many2one('hms.diseases', string="Maladie")
    notes = fields.Text(string="Notes")


# Procedure Group Line - Nephrology Extension
class ProcedureGroupLine(models.Model):
    _inherit = 'procedure.group.line'

    nephrology_schedule_id = fields.Many2one('acs.nephrology.schedule', string='Planning de Néphrologie',
        help="Planning de néphrologie pour calculer automatiquement les dates selon les jours de dialyse")


# ==================== IMAGERIE MÉDICALE ====================

# Échographie
class ACSNephroEchography(models.Model):
    _name = 'acs.nephro.echography'
    _description = 'Échographie'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'exam_date desc'

    name = fields.Char(string="Référence", required=True, default='Nouveau', copy=False)
    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade', tracking=True)
    appointment_id = fields.Many2one('hms.appointment', string='Consultation', ondelete='set null')
    invoice_id = fields.Many2one('account.move', string='Facture', ondelete='set null')

    exam_date = fields.Datetime(string="Date de l'examen", default=fields.Datetime.now, required=True, tracking=True)
    physician_id = fields.Many2one('hms.physician', string='Médecin prescripteur')
    radiologist_id = fields.Many2one('res.users', string='Radiologue')

    # Champs spécifiques Échographie
    organ = fields.Selection([
        ('rein', 'Rein'),
        ('foie', 'Foie'),
        ('abdomen', 'Abdomen'),
        ('pelvis', 'Pelvis'),
        ('vessie', 'Vessie'),
        ('prostate', 'Prostate'),
        ('uterus', 'Utérus'),
        ('ovaires', 'Ovaires'),
        ('thyroide', 'Thyroïde'),
        ('coeur', 'Cœur'),
        ('autre', 'Autre')
    ], string='Organe exploré', required=True, tracking=True)
    organ_other = fields.Char(string='Autre organe')

    laterality = fields.Selection([
        ('droite', 'Droite'),
        ('gauche', 'Gauche'),
        ('bilaterale', 'Bilatérale')
    ], string='Latéralité')

    echo_type = fields.Selection([
        ('abdominale', 'Abdominale'),
        ('obstetricale', 'Obstétricale'),
        ('doppler', 'Doppler'),
        ('pelvienne', 'Pelvienne'),
        ('renale', 'Rénale'),
        ('cardiaque', 'Cardiaque'),
        ('autre', 'Autre')
    ], string="Type d'échographie", required=True)

    measurement_size = fields.Char(string='Taille (mm)')
    measurement_volume = fields.Char(string='Volume (ml)')
    doppler_flow = fields.Char(string='Flux doppler')

    has_anomalies = fields.Boolean(string='Présence d\'anomalies', tracking=True)
    anomalies_description = fields.Text(string='Description des anomalies')
    observation = fields.Text(string='Observation')

    conclusion = fields.Text(string='Conclusion')
    attachment_ids = fields.Many2many('ir.attachment', 'nephro_echo_attachment_rel', 'echo_id', 'attachment_id',
                                       string='Pièces jointes (Images + CR)')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'Nouveau') == 'Nouveau':
                vals['name'] = self.env['ir.sequence'].next_by_code('acs.nephro.echography') or 'Nouveau'
        return super().create(vals_list)


# Radiographie
class ACSNephroRadio(models.Model):
    _name = 'acs.nephro.radio'
    _description = 'Radiographie'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'exam_date desc'

    name = fields.Char(string="Référence", required=True, default='Nouveau', copy=False)
    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade', tracking=True)
    appointment_id = fields.Many2one('hms.appointment', string='Consultation', ondelete='set null')
    invoice_id = fields.Many2one('account.move', string='Facture', ondelete='set null')

    exam_date = fields.Datetime(string="Date de l'examen", default=fields.Datetime.now, required=True, tracking=True)
    physician_id = fields.Many2one('hms.physician', string='Médecin prescripteur')
    radiologist_id = fields.Many2one('res.users', string='Radiologue')

    # Champs spécifiques Radiographie
    anatomic_region = fields.Selection([
        ('thorax', 'Thorax'),
        ('abdomen', 'Abdomen'),
        ('crane', 'Crâne'),
        ('rachis', 'Rachis'),
        ('bassin', 'Bassin'),
        ('membre_sup', 'Membre supérieur'),
        ('membre_inf', 'Membre inférieur'),
        ('autre', 'Autre')
    ], string='Région anatomique', required=True, tracking=True)
    anatomic_region_other = fields.Char(string='Autre région')

    incidence = fields.Selection([
        ('face', 'Face'),
        ('profil', 'Profil'),
        ('oblique', 'Oblique'),
        ('trois_quart', 'Trois-quarts')
    ], string='Incidence', required=True)

    patient_position = fields.Selection([
        ('debout', 'Debout'),
        ('couche', 'Couché'),
        ('assis', 'Assis'),
        ('decubitus_lateral', 'Décubitus latéral')
    ], string='Position du patient', required=True)

    contrast_used = fields.Boolean(string='Produit de contraste utilisé')
    contrast_type = fields.Char(string='Type de contraste')

    approximate_dose = fields.Char(string='Dose approximative (mGy)')

    image_quality = fields.Selection([
        ('bonne', 'Bonne'),
        ('moyenne', 'Moyenne'),
        ('mauvaise', 'Mauvaise')
    ], string="Qualité de l'image", default='bonne')

    findings = fields.Text(string='Observations')
    conclusion = fields.Text(string='Conclusion')
    attachment_ids = fields.Many2many('ir.attachment', 'nephro_radio_attachment_rel', 'radio_id', 'attachment_id',
                                       string='Pièces jointes (Images + CR)')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'Nouveau') == 'Nouveau':
                vals['name'] = self.env['ir.sequence'].next_by_code('acs.nephro.radio') or 'Nouveau'
        return super().create(vals_list)


# TDM (Tomodensitométrie)
class ACSNephroTDM(models.Model):
    _name = 'acs.nephro.tdm'
    _description = 'TDM (Tomodensitométrie)'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'exam_date desc'

    name = fields.Char(string="Référence", required=True, default='Nouveau', copy=False)
    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade', tracking=True)
    appointment_id = fields.Many2one('hms.appointment', string='Consultation', ondelete='set null')
    invoice_id = fields.Many2one('account.move', string='Facture', ondelete='set null')

    exam_date = fields.Datetime(string="Date de l'examen", default=fields.Datetime.now, required=True, tracking=True)
    physician_id = fields.Many2one('hms.physician', string='Médecin prescripteur')
    radiologist_id = fields.Many2one('res.users', string='Radiologue')

    # Champs spécifiques TDM
    explored_zone = fields.Selection([
        ('crane', 'Crâne'),
        ('thorax', 'Thorax'),
        ('abdomen', 'Abdomen'),
        ('pelvis', 'Pelvis'),
        ('abdo_pelvis', 'Abdomen-Pelvis'),
        ('thorax_abdo_pelvis', 'Thorax-Abdomen-Pelvis (TAP)'),
        ('rachis', 'Rachis'),
        ('membres', 'Membres'),
        ('autre', 'Autre')
    ], string='Zone explorée', required=True, tracking=True)
    explored_zone_other = fields.Char(string='Autre zone')

    contrast_used = fields.Boolean(string='Produit de contraste utilisé', tracking=True)
    contrast_type = fields.Selection([
        ('iode', 'Iodé'),
        ('autre', 'Autre')
    ], string='Type de contraste')
    contrast_type_other = fields.Char(string='Autre type de contraste')

    ctdi = fields.Float(string='CTDI (mGy)', help='Computed Tomography Dose Index')
    dlp = fields.Float(string='DLP (mGy.cm)', help='Dose Length Product')

    slice_count = fields.Integer(string='Nombre de coupes')
    slice_thickness = fields.Char(string='Épaisseur de coupe (mm)')

    reconstruction_axial = fields.Boolean(string='Axiale')
    reconstruction_coronal = fields.Boolean(string='Coronale')
    reconstruction_sagittal = fields.Boolean(string='Sagittale')
    reconstruction_3d = fields.Boolean(string='3D')

    has_incidents = fields.Boolean(string='Incidents / Réactions au contraste', tracking=True)
    incidents_description = fields.Text(string='Description des incidents')

    findings = fields.Text(string='Résultats')
    conclusion = fields.Text(string='Conclusion')
    attachment_ids = fields.Many2many('ir.attachment', 'nephro_tdm_attachment_rel', 'tdm_id', 'attachment_id',
                                       string='Pièces jointes (Images + CR)')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'Nouveau') == 'Nouveau':
                vals['name'] = self.env['ir.sequence'].next_by_code('acs.nephro.tdm') or 'Nouveau'
        return super().create(vals_list)


# IRM (Imagerie par Résonance Magnétique)
class ACSNephroIRM(models.Model):
    _name = 'acs.nephro.irm'
    _description = 'IRM (Imagerie par Résonance Magnétique)'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'exam_date desc'

    name = fields.Char(string="Référence", required=True, default='Nouveau', copy=False)
    patient_id = fields.Many2one('hms.patient', string='Patient', required=True, ondelete='cascade', tracking=True)
    appointment_id = fields.Many2one('hms.appointment', string='Consultation', ondelete='set null')
    invoice_id = fields.Many2one('account.move', string='Facture', ondelete='set null')

    exam_date = fields.Datetime(string="Date de l'examen", default=fields.Datetime.now, required=True, tracking=True)
    physician_id = fields.Many2one('hms.physician', string='Médecin prescripteur')
    radiologist_id = fields.Many2one('res.users', string='Radiologue')

    # Champs spécifiques IRM
    explored_zone = fields.Selection([
        ('cerebrale', 'Cérébrale'),
        ('rachis', 'Rachis'),
        ('thorax', 'Thorax'),
        ('abdomen', 'Abdomen'),
        ('pelvis', 'Pelvis'),
        ('membres', 'Membres'),
        ('cardiaque', 'Cardiaque'),
        ('vasculaire', 'Vasculaire'),
        ('autre', 'Autre')
    ], string='Zone explorée', required=True, tracking=True)
    explored_zone_other = fields.Char(string='Autre zone')

    # Séquences IRM (sélection multiple)
    sequence_t1 = fields.Boolean(string='T1')
    sequence_t2 = fields.Boolean(string='T2')
    sequence_flair = fields.Boolean(string='FLAIR')
    sequence_diffusion = fields.Boolean(string='Diffusion (DWI)')
    sequence_stir = fields.Boolean(string='STIR')
    sequence_t1_gado = fields.Boolean(string='T1 avec Gadolinium')
    sequence_angio = fields.Boolean(string='Angio-IRM')
    sequence_other = fields.Char(string='Autres séquences')

    contrast_used = fields.Boolean(string='Produit de contraste (Gadolinium)', tracking=True)
    contrast_dose = fields.Char(string='Dose de gadolinium')

    # Contre-indications vérifiées
    contraindication_checked = fields.Boolean(string='Contre-indications vérifiées', default=True)
    has_pacemaker = fields.Boolean(string='Pacemaker')
    has_metal_implant = fields.Boolean(string='Implant métallique')
    has_claustrophobia = fields.Boolean(string='Claustrophobie')
    other_contraindications = fields.Text(string='Autres contre-indications')

    exam_duration = fields.Float(string="Durée de l'examen (minutes)")

    patient_tolerance = fields.Selection([
        ('bonne', 'Bonne'),
        ('moyenne', 'Moyenne'),
        ('mauvaise', 'Mauvaise')
    ], string='Tolérance du patient', default='bonne')
    tolerance_notes = fields.Text(string='Notes sur la tolérance')

    findings = fields.Text(string='Résultats')
    conclusion = fields.Text(string='Conclusion')
    attachment_ids = fields.Many2many('ir.attachment', 'nephro_irm_attachment_rel', 'irm_id', 'attachment_id',
                                       string='Pièces jointes (Images + CR)')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'Nouveau') == 'Nouveau':
                vals['name'] = self.env['ir.sequence'].next_by_code('acs.nephro.irm') or 'Nouveau'
        return super().create(vals_list)


class ACSDryWeightHistory(models.Model):
    _name = 'acs.dry.weight.history'
    _description = 'Historique Poids Sec'
    _order = 'date desc, id desc'

    patient_id = fields.Many2one('hms.patient', string='Patient',
                                  required=True, ondelete='cascade')
    date = fields.Datetime(string='Date de modification',
                           default=fields.Datetime.now, required=True)
    weight = fields.Float(string='Poids sec (kg)', required=True, digits=(5, 2))
    changed_by = fields.Many2one('res.users', string='Modifié par',
                                  default=lambda self: self.env.user)
    reason = fields.Text(string='Motif de modification')


# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4: