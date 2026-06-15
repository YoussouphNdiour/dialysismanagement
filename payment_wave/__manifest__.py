# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': "Payment Provider: Wave",
    'version': '1.0',
    'category': 'Accounting/Payment Providers',
    'sequence': 350,
    'summary': "A West African payment provider supporting mobile money transactions (XOF).",
    'description': """
    Wave Payment Provider for Odoo 19

    Wave is a leading mobile money platform in West Africa, primarily operating in Senegal.
    This module enables:
    - Checkout session creation
    - Mobile money payments
    - Webhook notifications
    - Refund processing

    Supported features:
    - XOF currency (West African Franc)
    - Mobile payments via Wave app
    - Real-time payment notifications
    - Payment status tracking
    """,
    'depends': ['payment'],
    'data': [
        'views/payment_provider_views.xml',
        'views/payment_wave_templates.xml',
        'data/payment_provider_data.xml',
        'data/payment_method_data.xml',
        'data/ir_cron_data.xml',
    ],
    'assets': {
        'web.assets_frontend': [
            'payment_wave/static/src/js/payment_form.js',
            'payment_wave/static/src/scss/payment_wave.scss',
        ],
    },
    'post_init_hook': 'post_init_hook',
    'uninstall_hook': 'uninstall_hook',
    'author': 'Youssouph NDIOUR',
    'website': 'https://www.wave.com',
    'license': 'LGPL-3',
    'application': False,
    'auto_install': False,
}
