# -*- coding: utf-8 -*-
from datetime import date, datetime, timedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ACSNephrologyHoliday(models.Model):
    _name = 'acs.nephrology.holiday'
    _description = 'Jour Férié Néphrologie'
    _order = 'date desc'

    name = fields.Char(string='Nom', required=True)
    date = fields.Date(string='Date', required=True)
    recurring = fields.Boolean(
        string='Récurrent (chaque année)',
        default=False,
        help="Si coché, ce jour férié s'applique chaque année à la même date (mois/jour)."
    )


class NephrologySessionGenerator(models.TransientModel):
    _name = 'nephrology.session.generator'
    _description = 'Générateur de séances — Étape 1'

    department_id = fields.Many2one(
        'hr.department',
        string='Département',
        domain=[('department_type', '=', 'nephrology')],
        help="Filtrer les patients par département de néphrologie",
    )
    schedule_id = fields.Many2one(
        'acs.nephrology.schedule',
        string='Planning de Néphrologie',
        help="Planning à utiliser pour tous les patients sélectionnés. Si vide, le planning individuel de chaque patient sera utilisé.",
    )
    patient_ids = fields.Many2many(
        'hms.patient',
        'session_gen_patient_rel', 'generator_id', 'patient_id',
        string='Patients',
        domain="[('nephrology_care', '=', True)]",
    )
    date_start = fields.Date(string='Date de début', required=True, default=fields.Date.today)
    date_end = fields.Date(string='Date de fin', required=True)
    exclude_holidays = fields.Boolean(string='Exclure jours fériés', default=True)
    preview_count = fields.Integer(
        string='Séances prévues (aperçu)',
        compute='_compute_preview_count',
        store=False,
    )
    line_ids = fields.One2many(
        'nephrology.session.generator.line',
        'generator_id',
        string='Lignes patients',
    )

    @api.depends('patient_ids', 'date_start', 'date_end', 'exclude_holidays', 'schedule_id')
    def _compute_preview_count(self):
        for rec in self:
            if not rec.date_start or not rec.date_end or not rec.patient_ids or not rec.schedule_id:
                rec.preview_count = 0
                continue
            dates = rec._get_valid_dates(rec.schedule_id, rec.date_start, rec.date_end, rec.exclude_holidays)
            rec.preview_count = len(dates) * len(rec.patient_ids)

    @api.model
    def _get_valid_dates(self, schedule, date_start, date_end, exclude_holidays=True):
        """Retourne la liste des dates valides pour un schedule sur une période."""
        weekdays = schedule.get_weekdays()
        holiday_dates = set()
        if exclude_holidays:
            for h in self.env['acs.nephrology.holiday'].search([]):
                if h.recurring:
                    for year in range(date_start.year, date_end.year + 1):
                        try:
                            holiday_dates.add(date(year, h.date.month, h.date.day))
                        except ValueError:
                            pass  # 29 fév sur année non bissextile
                else:
                    holiday_dates.add(h.date)
        result = []
        current = date_start
        while current <= date_end:
            if current.weekday() in weekdays and current not in holiday_dates:
                result.append(current)
            current += timedelta(days=1)
        return result

    def action_open_validator(self):
        """Étape 1 → 2 : calcule les lignes et ouvre Modal 2."""
        self.ensure_one()
        if not self.patient_ids:
            raise UserError(_('Sélectionnez au moins un patient.'))
        if not self.date_start or not self.date_end:
            raise UserError(_('Définissez une période.'))
        if self.date_end < self.date_start:
            raise UserError(_('La date de fin doit être après la date de début.'))
        if not self.schedule_id:
            raise UserError(_(
                'Veuillez sélectionner un Planning de Néphrologie.\n'
                'Ce planning définit les jours de dialyse (ex: Lundi-Mercredi-Vendredi 07-11h).'
            ))

        # Supprimer les lignes existantes (au cas où le wizard est réouvert)
        self.line_ids.unlink()

        skipped_patients = []
        for patient in self.patient_ids:
            schedule = self.schedule_id
            last_proc = False

            station = schedule.station_id
            # Chercher le médecin depuis la dernière procédure du patient
            last_proc = self.env['acs.patient.procedure'].search([
                ('patient_id', '=', patient.id),
            ], order='date desc', limit=1)
            if last_proc and last_proc.physician_id:
                physician = last_proc.physician_id
            else:
                physician = schedule.physician_id

            valid_dates = self._get_valid_dates(schedule, self.date_start, self.date_end, self.exclude_holidays)
            session_count = len(valid_dates)

            if session_count == 0:
                skipped_patients.append(patient.name)
                continue

            # Détection de conflits
            conflict_status, conflict_details = self._detect_conflict(patient, station)

            self.env['nephrology.session.generator.line'].create({
                'generator_id': self.id,
                'patient_id': patient.id,
                'schedule_id': schedule.id,
                'station_id': station.id if station else False,
                'physician_id': physician.id if physician else False,
                'session_count': session_count,
                'conflict_status': conflict_status,
                'conflict_details': conflict_details,
            })

        if not self.line_ids:
            msg = _('Aucune séance à créer pour la période sélectionnée.')
            if skipped_patients:
                msg += '\n' + _('Patients sans séance planifiable : %s') % ', '.join(skipped_patients)
            raise UserError(msg)

        validator = self.env['nephrology.session.validator'].create({
            'generator_id': self.id,
        })
        return {
            'type': 'ir.actions.act_window',
            'name': _('Validation des séances'),
            'res_model': 'nephrology.session.validator',
            'res_id': validator.id,
            'view_mode': 'form',
            'target': 'new',
        }

    def _detect_conflict(self, patient, station):
        """Retourne (conflict_status, conflict_details) pour un patient."""
        # Erreur bloquante : procédure existante pour ce patient sur la période demandée
        date_start_dt = datetime.combine(self.date_start, datetime.min.time())
        date_end_dt = datetime.combine(self.date_end, datetime.max.time())
        existing = self.env['acs.patient.procedure'].search([
            ('patient_id', '=', patient.id),
            ('nephrology_schedule_ids', '!=', False),
            ('date', '>=', date_start_dt),
            ('date', '<=', date_end_dt),
        ], limit=1)
        if existing:
            return ('error_duplicate',
                    _('Procédure existante sur cette période : %s') % existing.name)

        # Avertissement : poste déjà utilisé sur la période
        if station:
            station_used = self.env['acs.patient.procedure'].search([
                ('nephrology_schedule_ids.station_id', '=', station.id),
                ('date', '>=', date_start_dt),
                ('date', '<=', date_end_dt),
            ], limit=1)
            if station_used:
                return ('warning_station',
                        _('Poste %s déjà utilisé sur cette période') % station.name)

        return ('ok', '')


class NephrologySessionGeneratorLine(models.TransientModel):
    _name = 'nephrology.session.generator.line'
    _description = 'Ligne générateur de séances'

    generator_id = fields.Many2one(
        'nephrology.session.generator', required=True, ondelete='cascade')
    patient_id = fields.Many2one('hms.patient', string='Patient', required=True)
    schedule_id = fields.Many2one('acs.nephrology.schedule', string='Planning')
    station_id = fields.Many2one('acs.dialysis.station', string='Poste')
    physician_id = fields.Many2one('hms.physician', string='Médecin')
    session_count = fields.Integer(string='Nb séances', default=0)
    conflict_status = fields.Selection([
        ('ok', '✅ OK'),
        ('warning_station', '⚠️ Poste occupé'),
        ('error_duplicate', '🔴 Patient déjà planifié'),
    ], string='Statut', default='ok')
    conflict_details = fields.Char(string='Détail conflit')


class NephrologySessionValidator(models.TransientModel):
    _name = 'nephrology.session.validator'
    _description = 'Validateur de séances — Étape 2'

    generator_id = fields.Many2one(
        'nephrology.session.generator', required=True, ondelete='cascade')
    line_ids = fields.One2many(
        related='generator_id.line_ids', readonly=False,
        string='Lignes par patient',
    )

    def action_confirm(self):
        """Crée les procédures et RDVs pour toutes les lignes non bloquantes."""
        self.ensure_one()
        generator = self.generator_id

        product = self.env['product.product'].search([
            ('hospital_product_type', '=', 'nephrology_procedure')
        ], limit=1)
        if not product:
            product = self.env['product.product'].search([
                ('hospital_product_type', '=', 'consultation')
            ], limit=1)
        if not product:
            raise UserError(_('Aucun produit de type hémodialyse configuré.'))

        eligible_lines = generator.line_ids.filtered(
            lambda l: l.conflict_status != 'error_duplicate' and l.schedule_id)
        skipped_count = len(generator.line_ids) - len(eligible_lines)

        if not eligible_lines:
            raise UserError(_(
                'Aucune séance à créer.\n'
                'Tous les patients sont déjà planifiés sur cette période (%d ignorés).'
            ) % skipped_count)

        created_count = 0
        for line in eligible_lines:
            valid_dates = generator._get_valid_dates(
                line.schedule_id, generator.date_start, generator.date_end,
                generator.exclude_holidays,
            )
            for d in valid_dates:
                hour = int(line.schedule_id.start_time)
                minute = int((line.schedule_id.start_time % 1) * 60)
                dt = datetime.combine(d, datetime.min.time()).replace(
                    hour=hour, minute=minute, second=0, microsecond=0)

                procedure = self.env['acs.patient.procedure'].create({
                    'patient_id': line.patient_id.id,
                    'product_id': product.id,
                    'date': dt,
                    'physician_id': line.physician_id.id if line.physician_id else False,
                    'department_id': generator.department_id.id if generator.department_id else False,
                    'nephrology_schedule_ids': [(4, line.schedule_id.id)],
                })
                appointment = self.env['hms.appointment'].create({
                    'patient_id': line.patient_id.id,
                    'date': dt,
                    'product_id': product.id,
                    'physician_id': line.physician_id.id if line.physician_id else False,
                    'department_id': generator.department_id.id if generator.department_id else False,
                })
                procedure.write({'appointment_ids': [(4, appointment.id)]})
                created_count += 1

        msg = _('%d séances et rendez-vous créés avec succès.') % created_count
        if skipped_count:
            msg += ' ' + _('(%d patients ignorés — déjà planifiés)') % skipped_count

        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('Séances créées'),
                'message': msg,
                'type': 'success',
                'sticky': True,
            },
        }
