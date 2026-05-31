# -*- coding: utf-8 -*-

import logging
from datetime import datetime, timedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)


class ACSTreatment(models.Model):
    """Hériter hms.treatment pour créer automatiquement les rendez-vous lors de get_procedure_group_data"""
    _inherit = 'hms.treatment'

    def get_procedure_group_data(self):
        """Surcharge pour créer automatiquement les rendez-vous pour les procédures avec planning néphrologie"""
        # Capturer les procédures existantes avant la création
        existing_procedures = self.patient_procedure_ids.ids

        # Appeler la méthode originale pour créer les procédures
        result = super(ACSTreatment, self).get_procedure_group_data()

        # Trouver les nouvelles procédures créées
        new_procedures = self.patient_procedure_ids.filtered(lambda p: p.id not in existing_procedures)

        # Pour chaque nouvelle procédure avec planning néphrologie, créer un rendez-vous automatiquement
        for procedure in new_procedures:
            if procedure.nephrology_schedule_ids:
                try:
                    # Utiliser la méthode existante pour créer le rendez-vous
                    procedure.action_create_appointment_from_schedule()
                    _logger.info(f"✅ Rendez-vous automatiquement créé pour la procédure {procedure.name}")
                except Exception as e:
                    # Ne pas bloquer si la création du rendez-vous échoue
                    _logger.warning(f"⚠️ Impossible de créer le rendez-vous pour {procedure.name}: {str(e)}")

        return result


class AcsPatientProcedure(models.Model):
    _inherit = 'acs.patient.procedure'

    # Lien vers le rendez-vous
    appointment_id = fields.Many2one('hms.appointment', string='Rendez-vous lié', ondelete='set null',
        help="Rendez-vous créé automatiquement pour cette hémodialyse")

    # Compteur de rendez-vous générés
    generated_appointments_count = fields.Integer(compute='_compute_generated_appointments_count',
        string='Rendez-vous générés')

    def _compute_generated_appointments_count(self):
        for rec in self:
            rec.generated_appointments_count = self.env['hms.appointment'].search_count([
                ('procedure_id', '=', rec.id)
            ])

    def action_create_appointment_from_schedule(self):
        """Créer automatiquement un rendez-vous basé sur le planning de néphrologie"""
        self.ensure_one()

        if not self.nephrology_schedule_ids:
            raise UserError(_('Veuillez d\'abord sélectionner un planning de néphrologie pour cette procédure.'))

        if self.appointment_id:
            raise UserError(_('Un rendez-vous est déjà lié à cette procédure.'))

        # Utiliser la date de la procédure (déjà calculée selon le planning)
        # La procédure a déjà été créée avec la bonne date via get_line_data()
        if not self.date:
            raise UserError(_('La procédure n\'a pas de date définie.'))

        appointment_date = self.date

        # Créer le rendez-vous
        appointment = self.env['hms.appointment'].create({
            'patient_id': self.patient_id.id,
            'physician_id': self.physician_id.id if self.physician_id else False,
            'date': appointment_date,
            'product_id': self.product_id.id if self.product_id else self._get_default_nephrology_service().id,
            'department_id': self.department_id.id if self.department_id else False,
            'notes': f'Rendez-vous automatique pour hémodialyse - {self.name}',
        })

        # Lier le rendez-vous à la procédure
        self.appointment_id = appointment.id

        _logger.info(f"Rendez-vous créé automatiquement: {appointment.name} pour la procédure {self.name} à la date {appointment_date}")

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Succès'),
                'message': _('Rendez-vous créé avec succès pour le %s') % appointment_date.strftime('%d/%m/%Y à %H:%M'),
                'type': 'success',
                'sticky': False,
            }
        }

    def _get_default_nephrology_service(self):
        """Obtenir le service de néphrologie par défaut"""
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1)

        if not product:
            # Essayer de trouver un service de consultation
            product = self.env['product.product'].search([
                ('hospital_product_type', '=', 'consultation')
            ], limit=1)

        return product

    def action_generate_recurring_appointments(self):
        """Générer plusieurs rendez-vous récurrents selon le planning"""
        self.ensure_one()

        if not self.nephrology_schedule_ids:
            raise UserError(_('Veuillez d\'abord sélectionner un planning de néphrologie pour cette procédure.'))

        # Ouvrir un wizard pour configurer la génération
        return {
            'name': _('Générer des rendez-vous récurrents'),
            'type': 'ir.actions.act_window',
            'res_model': 'nephrology.appointment.generator',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_procedure_id': self.id,
                'default_patient_id': self.patient_id.id,
                'default_schedule_id': self.nephrology_schedule_ids[0].id if self.nephrology_schedule_ids else False,
            }
        }

    def action_view_appointments(self):
        """Voir les rendez-vous liés à cette procédure"""
        self.ensure_one()

        appointments = self.env['hms.appointment'].search([
            ('procedure_id', '=', self.id)
        ])

        return {
            'name': _('Rendez-vous d\'hémodialyse'),
            'type': 'ir.actions.act_window',
            'res_model': 'hms.appointment',
            'view_mode': 'list,form,calendar',
            'domain': [('id', 'in', appointments.ids)],
            'context': {
                'default_patient_id': self.patient_id.id,
                'default_procedure_id': self.id,
            }
        }


class HmsAppointment(models.Model):
    _inherit = 'hms.appointment'

    procedure_id = fields.Many2one('acs.patient.procedure', string='Procédure d\'hémodialyse',
        ondelete='set null',
        help="Procédure d'hémodialyse liée à ce rendez-vous")


class NephrologyAppointmentGenerator(models.TransientModel):
    _name = 'nephrology.appointment.generator'
    _description = 'Générateur de rendez-vous de néphrologie'

    procedure_id = fields.Many2one('acs.patient.procedure', string='Procédure', required=True)
    patient_id = fields.Many2one('hms.patient', string='Patient', required=True)
    schedule_id = fields.Many2one('acs.nephrology.schedule', string='Planning', required=True)

    start_date = fields.Date(string='Date de début', required=True, default=fields.Date.today)
    end_date = fields.Date(string='Date de fin', required=True)

    physician_id = fields.Many2one('hms.physician', string='Médecin')
    department_id = fields.Many2one('hr.department', string='Département')
    product_id = fields.Many2one('product.product', string='Service',
        domain=[('hospital_product_type', 'in', ['consultation', 'nephrology_procedure'])])

    appointment_count_preview = fields.Integer(compute='_compute_appointment_count_preview',
        string='Nombre de rendez-vous qui seront créés')

    @api.depends('start_date', 'end_date', 'schedule_id')
    def _compute_appointment_count_preview(self):
        for rec in self:
            if rec.start_date and rec.end_date and rec.schedule_id:
                count = rec._calculate_appointment_dates()
                rec.appointment_count_preview = len(count)
            else:
                rec.appointment_count_preview = 0

    def _calculate_appointment_dates(self):
        """Calculer toutes les dates de rendez-vous selon le planning"""
        self.ensure_one()

        if not self.schedule_id:
            return []

        dates = []
        weekdays = self.schedule_id.get_weekdays()

        if not weekdays:
            return []

        current_date = self.start_date
        end_date = self.end_date

        while current_date <= end_date:
            if current_date.weekday() in weekdays:
                # Construire la datetime avec l'heure du planning
                hour = int(self.schedule_id.start_time)
                minute = int((self.schedule_id.start_time - hour) * 60)

                appointment_datetime = datetime.combine(current_date, datetime.min.time()).replace(
                    hour=hour,
                    minute=minute,
                    second=0,
                    microsecond=0
                )

                dates.append(appointment_datetime)

            current_date += timedelta(days=1)

        return dates

    def action_generate_appointments(self):
        """Générer tous les rendez-vous"""
        self.ensure_one()

        appointment_dates = self._calculate_appointment_dates()

        if not appointment_dates:
            raise UserError(_('Aucun rendez-vous à générer avec les paramètres sélectionnés.'))

        created_appointments = []

        for appointment_date in appointment_dates:
            # Vérifier si un rendez-vous existe déjà à cette date
            existing = self.env['hms.appointment'].search([
                ('patient_id', '=', self.patient_id.id),
                ('date', '=', appointment_date),
            ], limit=1)

            if existing:
                _logger.warning(f"Rendez-vous déjà existant pour {self.patient_id.name} le {appointment_date}")
                continue

            # Créer le rendez-vous
            appointment = self.env['hms.appointment'].create({
                'patient_id': self.patient_id.id,
                'physician_id': self.physician_id.id if self.physician_id else False,
                'date': appointment_date,
                'product_id': self.product_id.id if self.product_id else self._get_default_service().id,
                'department_id': self.department_id.id if self.department_id else False,
                'procedure_id': self.procedure_id.id,
                'notes': f'Rendez-vous automatique pour hémodialyse - {self.procedure_id.name or ""}',
            })

            created_appointments.append(appointment)
            _logger.info(f"Rendez-vous créé: {appointment.name} pour le {appointment_date}")

        if created_appointments:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Succès'),
                    'message': _('%d rendez-vous créés avec succès') % len(created_appointments),
                    'type': 'success',
                    'sticky': True,
                    'next': {
                        'type': 'ir.actions.act_window',
                        'res_model': 'hms.appointment',
                        'view_mode': 'list,form,calendar',
                        'domain': [('id', 'in', [a.id for a in created_appointments])],
                    }
                }
            }
        else:
            raise UserError(_('Aucun nouveau rendez-vous créé. Des rendez-vous existent peut-être déjà à ces dates.'))

    def _get_default_service(self):
        """Obtenir le service par défaut"""
        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1)

        if not product:
            product = self.env['product.product'].search([
                ('hospital_product_type', '=', 'consultation')
            ], limit=1)

        return product
