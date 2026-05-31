# -*- coding: utf-8 -*-

from odoo import api, fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    whatsapp_api_url = fields.Char(
        string='WhatsApp API URL',
        default='https://www.wasenderapi.com/api/send-message',
        config_parameter='acs_hms_whatsapp.api_url',
        help='WasenderApi endpoint URL'
    )
    whatsapp_api_key = fields.Char(
        string='WhatsApp API Key',
        config_parameter='acs_hms_whatsapp.api_key',
        help='Your WasenderApi Bearer token'
    )
    whatsapp_enabled = fields.Boolean(
        string='Enable WhatsApp Integration',
        config_parameter='acs_hms_whatsapp.enabled',
        help='Enable sending messages via WhatsApp'
    )
    whatsapp_default_message = fields.Char(
        string='Default Prescription Message',
        config_parameter='acs_hms_whatsapp.default_message',
        default='Bonjour, veuillez trouver ci-joint votre ordonnance.',
        size=500,
        help='Default message to send with prescriptions'
    )
    whatsapp_default_invoice_message = fields.Char(
        string='Default Invoice Message',
        config_parameter='acs_hms_whatsapp.default_invoice_message',
        default='Bonjour, veuillez trouver ci-joint votre facture.',
        size=500,
        help='Default message to send with invoices'
    )
    whatsapp_default_appointment_reminder_message = fields.Char(
        string='Default Appointment Reminder Message',
        config_parameter='acs_hms_whatsapp.default_appointment_reminder_message',
        default='Bonjour, ceci est un rappel pour votre rendez-vous.',
        size=500,
        help='Default message for appointment reminders'
    )
