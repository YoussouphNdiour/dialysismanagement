# Part of Odoo. See LICENSE file for full copyright and licensing details.

# The codes of the payment methods to activate when Wave is activated.
DEFAULT_PAYMENT_METHOD_CODES = {
    # Primary payment methods.
    'wave_mobile',
}

# Wave API endpoints
WAVE_API_VERSION = 'v1'
WAVE_API_URL_PROD = f'https://api.wave.com/{WAVE_API_VERSION}'
WAVE_API_URL_TEST = f'https://api.wave.com/{WAVE_API_VERSION}'  # Wave doesn't have a separate sandbox

# Checkout session endpoints
ENDPOINT_CHECKOUT_CREATE = 'checkout/sessions'
ENDPOINT_CHECKOUT_RETRIEVE = 'checkout/sessions/{session_id}'
ENDPOINT_CHECKOUT_EXPIRE = 'checkout/sessions/{session_id}/expire'
ENDPOINT_CHECKOUT_REFUND = 'checkout/sessions/{session_id}/refund'
ENDPOINT_CHECKOUT_SEARCH = 'checkout/sessions/search'

# Payout endpoints
ENDPOINT_PAYOUT_CREATE = 'payout'
ENDPOINT_PAYOUT_RETRIEVE = 'payout/{payout_id}'
ENDPOINT_PAYOUT_SEARCH = 'payouts/search'

# Mapping of checkout session statuses to Odoo transaction states
CHECKOUT_STATUS_MAPPING = {
    'open': 'pending',
    'complete': 'done',
    'expired': 'cancel',
}

# Mapping of payment statuses
PAYMENT_STATUS_MAPPING = {
    'processing': 'pending',
    'succeeded': 'done',
    'cancelled': 'cancel',
}

# Webhook event types
WEBHOOK_EVENT_CHECKOUT_COMPLETED = 'checkout.session.completed'
WEBHOOK_EVENT_CHECKOUT_FAILED = 'checkout.session.payment_failed'
WEBHOOK_EVENT_MERCHANT_PAYMENT = 'merchant.payment_received'

# Supported currency for Wave (West African Franc)
SUPPORTED_CURRENCIES = ['XOF']

# Payment error codes
ERROR_CODES = {
    'insufficient-funds': 'Insufficient funds in customer wallet',
    'blocked-account': 'Customer account is blocked',
    'payer-mobile-mismatch': 'Payment attempted from wrong mobile number',
    'payment-failure': 'Technical error during payment processing',
    'kyb-limits-exceeded': 'Business account limits exceeded',
    'customer-age-restricted': 'Customer age restricted for this payment',
    'cross-border-payment-not-allowed': 'Cross-border payments not allowed',
}

# Developer fee configuration
WAVE_DEVELOPER_FEE = 200              # Fixed developer fee in XOF per transaction
WAVE_DEVELOPER_MOBILE = '+221777671661'  # Wave mobile number for developer fee payouts
