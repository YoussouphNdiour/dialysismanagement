# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    nephro_auto_invoice = fields.Boolean(
        string='Facturation automatique dialyse',
        default=False,
        help='Crée automatiquement une facture brouillon à la fin de chaque séance.',
    )
    nephro_overdue_days = fields.Integer(
        string='Délai alerte impayé (jours)',
        default=30,
        help='Nombre de jours après échéance avant alerte impayé.',
    )
    nephro_alert_email = fields.Boolean(
        string='Alertes par email',
        default=True,
    )
    nephro_alert_whatsapp = fields.Boolean(
        string='Alertes par WhatsApp',
        default=False,
        help='Nécessite le module acs_hms_whatsapp.',
    )


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    nephro_auto_invoice = fields.Boolean(
        related='company_id.nephro_auto_invoice',
        string='Facturation automatique dialyse',
        readonly=False,
    )
    nephro_overdue_days = fields.Integer(
        related='company_id.nephro_overdue_days',
        string='Délai alerte impayé (jours)',
        readonly=False,
    )
    nephro_alert_email = fields.Boolean(
        related='company_id.nephro_alert_email',
        string='Alertes par email',
        readonly=False,
    )
    nephro_alert_whatsapp = fields.Boolean(
        related='company_id.nephro_alert_whatsapp',
        string='Alertes par WhatsApp',
        readonly=False,
    )
