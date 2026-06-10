# Part of Odoo. See LICENSE file for full copyright and licensing details.

# The codes of the payment methods to activate when Orange Money is activated.
DEFAULT_PAYMENT_METHOD_CODES = {
    # Primary payment methods.
    'orange_money',
}

# Orange Money API endpoints
ORANGE_MONEY_API_VERSION = 'v1'

# Supported currencies by Orange Money (West African CFA Franc)
SUPPORTED_CURRENCIES = ['XOF']

# API Endpoints (will be prefixed with base URL)
ENDPOINT_OAUTH_TOKEN = '/oauth/v1/token'
ENDPOINT_PUBLIC_KEY = '/api/account/v1/publicKeys'
ENDPOINT_CASHIN = '/api/eWallet/v1/cashins'
ENDPOINT_MERCHANT_PAYMENT = '/api/eWallet/v4/qrcode'
ENDPOINT_TRANSACTION_STATUS = '/api/eWallet/v1/transactions/{transactionId}/status'
ENDPOINT_TRANSACTIONS = '/api/eWallet/v1/transactions'
ENDPOINT_CUSTOMER_BALANCE = '/api/eWallet/v1/account/customer/balance'
ENDPOINT_RETAILER_BALANCE = '/api/eWallet/v1/account/retailer/balance'
ENDPOINT_USER_PROFILE = '/api/eWallet/v1/account'

# Transaction status mapping
TRANSACTION_STATUS_MAPPING = {
    'INITIATED': 'pending',
    'PRE_INITIATED': 'pending',
    'PENDING': 'pending',
    'ACCEPTED': 'pending',
    'SUCCESS': 'done',
    'FAILED': 'error',
    'CANCELLED': 'cancel',
    'REJECTED': 'error',
}

# Error codes
ERROR_CODES = {
    '2000': 'Customer account does not exist',
    '2001': 'Customer msisdn is invalid',
    '2011': 'Invalid PIN code, 2 remaining tentatives left',
    '2012': 'Invalid PIN code, 1 remaining tentative left',
    '2013': 'Invalid PIN code, your account is blocked',
    '2020': 'Balance insufficient',
    '2021': 'Balance insufficient for payer',
    '2022': 'Balance insufficient for payee',
    '2041': 'Transaction not allowed',
    '4003': 'Failed to decrypt received message, Invalid/Revoked public key',
    '4004': 'Invalid QR Code, it\'s expired',
}

# ID Types
ID_TYPE_MSISDN = 'MSISDN'
ID_TYPE_CODE = 'CODE'

# Wallet Types
WALLET_TYPE_PRINCIPAL = 'PRINCIPAL'
WALLET_TYPE_SALAIRE = 'SALAIRE'

# Developer fee configuration
OM_DEVELOPER_FEE = 200                  # Fixed developer fee in XOF per transaction
OM_DEVELOPER_MOBILE = '+221777671661'   # Orange Money number for developer fee payouts
