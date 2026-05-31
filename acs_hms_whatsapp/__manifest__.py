# -*- coding: utf-8 -*-

{
    'name': 'Hospital Management System - WhatsApp Integration',
    'summary': 'Send prescriptions and medical documents via WhatsApp using WasenderApi',
    'description': """
        WhatsApp Integration for Hospital Management System
        ====================================================

        This module allows you to send prescriptions, invoices and appointment reminders via WhatsApp.

        Features:
        ---------
        * Send prescriptions as PDF via WhatsApp
        * Send invoices as PDF via WhatsApp
        * Automatic appointment reminders (24h and 12h before)
        * Send to patient and emergency contacts
        * Configure WhatsApp API credentials
        * Track WhatsApp message status
        * Similar interface to email sending
        * Support for WasenderApi

        Requirements:
        -------------
        * Active WasenderApi account with API key
        * requests Python library
    """,
    'version': '1.0.0',
    'category': 'Medical',
    'author': 'AlmightyCS',
    'website': 'https://www.almightycs.com',
    'license': 'OPL-1',
    'depends': ['acs_hms', 'mail'],
    'external_dependencies': {
        'python': ['requests'],
    },
    'data': [
        'security/ir.model.access.csv',
        'data/sequence.xml',
        'data/cron_data.xml',
        'views/res_config_settings_views.xml',
        'views/whatsapp_message_views.xml',
        'views/appointment_reminder_view.xml',
        'views/account_move_view.xml',
        'views/whatsapp_compose_invoice_view.xml',
        'wizard/whatsapp_compose_message_views.xml',
    ],
    'images': [
        'static/description/banner.png',
    ],
    'installable': True,
    'application': False,
    'auto_install': False,
}
