# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import requests
import base64
from datetime import timedelta
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

from odoo.addons.payment_orange_money import const

_logger = logging.getLogger(__name__)


class PaymentProvider(models.Model):
    _inherit = 'payment.provider'

    code = fields.Selection(
        selection_add=[('orange_money', 'Orange Money')],
        ondelete={'orange_money': 'set default'}
    )

    orange_money_client_id = fields.Char(
        string='Client ID',
        help='The Client ID provided by Orange Money',
        required_if_provider='orange_money',
        groups='base.group_system'
    )

    orange_money_client_secret = fields.Char(
        string='Client Secret',
        help='The Client Secret provided by Orange Money',
        required_if_provider='orange_money',
        groups='base.group_system'
    )

    orange_money_merchant_code = fields.Char(
        string='Merchant Code',
        help='Your Orange Money Merchant Code (6 digits)',
        required_if_provider='orange_money',
        groups='base.group_system'
    )

    orange_money_merchant_msisdn = fields.Char(
        string='Merchant MSISDN',
        help='Your Orange Money Merchant phone number',
        required_if_provider='orange_money',
        groups='base.group_system'
    )

    orange_money_pin_code = fields.Char(
        string='PIN Code',
        help='Your Orange Money PIN code (will be encrypted)',
        required_if_provider='orange_money',
        groups='base.group_system'
    )

    orange_money_api_url = fields.Char(
        string='API Base URL',
        help='Orange Money API base URL',
        default='https://api.orange-sonatel.com',
        required_if_provider='orange_money',
    )

    # OAuth token cache
    orange_money_access_token = fields.Char(
        string='Access Token',
        groups='base.group_system',
        copy=False,
        readonly=True
    )

    orange_money_token_expiry = fields.Datetime(
        string='Token Expiry',
        groups='base.group_system',
        copy=False,
        readonly=True
    )

    orange_money_public_key = fields.Text(
        string='Public Key',
        help='Orange Money public key for encrypting sensitive data',
        groups='base.group_system',
        copy=False,
        readonly=True
    )

    def _get_supported_currencies(self):
        """ Override to specify supported currencies. """
        supported_currencies = super()._get_supported_currencies()
        if self.code == 'orange_money':
            supported_currencies = supported_currencies.filtered(
                lambda c: c.name in const.SUPPORTED_CURRENCIES
            )
        return supported_currencies

    def _get_default_payment_method_codes(self):
        """ Override to specify default payment method codes. """
        default_codes = super()._get_default_payment_method_codes()
        if self.code == 'orange_money':
            return const.DEFAULT_PAYMENT_METHOD_CODES
        return default_codes

    # ========================================
    # Orange Money API Methods
    # ========================================

    def _orange_money_get_access_token(self):
        """ Get OAuth access token from Orange Money API. """
        self.ensure_one()

        # Check if we have a valid cached token
        if self.orange_money_access_token and self.orange_money_token_expiry:
            if fields.Datetime.now() < self.orange_money_token_expiry:
                return self.orange_money_access_token

        # Request new token
        url = f"{self.orange_money_api_url}{const.ENDPOINT_OAUTH_TOKEN}"

        payload = {
            'grant_type': 'client_credentials',
            'client_id': self.orange_money_client_id,
            'client_secret': self.orange_money_client_secret,
        }

        try:
            response = requests.post(
                url,
                data=payload,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()

            # Cache the token
            expiry_seconds = data.get('expires_in', 300)
            self.write({
                'orange_money_access_token': data['access_token'],
                'orange_money_token_expiry': fields.Datetime.now() + timedelta(seconds=expiry_seconds - 30)
            })
            return data['access_token']

        except requests.exceptions.RequestException as e:
            _logger.error("Orange Money: Failed to get access token: %s", str(e))
            raise ValidationError(_("Failed to authenticate with Orange Money API: %s") % str(e))

    def _orange_money_get_public_key(self, force_refresh=False):
        """ Retrieve Orange Money public key for encrypting PIN codes.

        :param bool force_refresh: If True, force refresh from API even if cached
        """
        self.ensure_one()

        # Return cached public key if available and not forcing refresh
        if self.orange_money_public_key and not force_refresh:
            return self.orange_money_public_key

        access_token = self._orange_money_get_access_token()
        url = f"{self.orange_money_api_url}{const.ENDPOINT_PUBLIC_KEY}"

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            data = response.json()

            public_key = data.get('key', '')

            _logger.info("Retrieved public key from Orange Money API (length: %d chars)", len(public_key))

            # Cache the public key
            self.write({'orange_money_public_key': public_key})

            return public_key

        except requests.exceptions.RequestException as e:
            _logger.error("Orange Money: Failed to get public key: %s", str(e))
            raise ValidationError(_("Failed to retrieve Orange Money public key: %s") % str(e))

    def _orange_money_encrypt_pin(self, pin_code):
        """ Encrypt PIN code using Orange Money public key. """
        self.ensure_one()

        public_key_pem = self._orange_money_get_public_key()

        try:
            # Format the public key if it doesn't have PEM headers
            if not public_key_pem.startswith('-----BEGIN'):
                # Remove any whitespace and newlines
                key_content = public_key_pem.strip().replace('\n', '').replace('\r', '').replace(' ', '')

                # Split into 64-character lines (PEM standard)
                key_lines = [key_content[i:i+64] for i in range(0, len(key_content), 64)]
                formatted_key = '\n'.join(key_lines)

                # Add PEM headers
                public_key_pem = f"-----BEGIN PUBLIC KEY-----\n{formatted_key}\n-----END PUBLIC KEY-----"
                _logger.info("Formatted public key with PEM headers and proper line breaks")

            # Load the public key
            public_key = serialization.load_pem_public_key(
                public_key_pem.encode('utf-8'),
                backend=default_backend()
            )

            # Encrypt the PIN
            encrypted = public_key.encrypt(
                pin_code.encode('utf-8'),
                padding.PKCS1v15()
            )

            # Return base64 encoded encrypted PIN
            return base64.b64encode(encrypted).decode('utf-8')

        except Exception as e:
            _logger.error("Orange Money: Failed to encrypt PIN: %s", str(e))
            _logger.error("Public key content (first 200 chars): %s", public_key_pem[:200] if public_key_pem else 'None')
            raise ValidationError(_("Failed to encrypt PIN code: %s") % str(e))

    def _orange_money_make_request(self, endpoint, method='POST', data=None, transaction_id=None, extra_headers=None):
        """ Make a request to Orange Money API. """
        self.ensure_one()

        access_token = self._orange_money_get_access_token()

        # Format endpoint with transaction_id if provided
        if transaction_id:
            endpoint = endpoint.format(transactionId=transaction_id)

        url = f"{self.orange_money_api_url}{endpoint}"

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json',
        }

        # Add extra headers if provided
        if extra_headers:
            headers.update(extra_headers)

        try:
            _logger.info("Making %s request to Orange Money: %s", method, url)
            if data:
                _logger.debug("Request payload: %s", data)

            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            else:
                response = requests.post(url, json=data, headers=headers, timeout=10)

            _logger.info("Orange Money API response: status=%s, content-type=%s",
                        response.status_code, response.headers.get('Content-Type', 'unknown'))
            _logger.debug("Response content: %s", response.text[:500] if response.text else '(empty)')

            response.raise_for_status()

            # Some endpoints (like webhook configuration) might return empty response or 204 No Content
            if response.status_code == 204 or not response.text:
                _logger.info("API returned empty response (204 No Content or empty body)")
                return {}

            # Try to parse JSON
            try:
                return response.json()
            except ValueError as json_error:
                _logger.warning("Response is not JSON: %s. Response text: %s", json_error, response.text[:200])
                # If response is successful but not JSON, return empty dict
                return {}

        except requests.exceptions.HTTPError as e:
            _logger.error("Orange Money API HTTP error: %s - %s", e, response.text if response else '')
            try:
                error_data = response.json()
                error_code = error_data.get('code', 'Unknown')
                error_detail = error_data.get('detail', str(e))
                raise ValidationError(_("Orange Money Error [%s]: %s") % (error_code, error_detail))
            except ValueError:
                # Response is not JSON, return the text error
                error_message = response.text if response and response.text else str(e)
                raise ValidationError(_("Orange Money API Error: %s") % error_message)
        except requests.exceptions.RequestException as e:
            _logger.error("Orange Money: Request failed: %s", str(e))
            raise ValidationError(_("Failed to communicate with Orange Money: %s") % str(e))

    def action_refresh_public_key(self):
        """ Refresh the Orange Money public key from API. """
        self.ensure_one()

        try:
            # Clear cached key and force refresh
            self.write({'orange_money_public_key': False})
            public_key = self._orange_money_get_public_key(force_refresh=True)

            if public_key:
                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': _('Public Key Refreshed'),
                        'message': _('Successfully refreshed Orange Money public key (%d chars)') % len(public_key),
                        'type': 'success',
                        'sticky': False,
                    }
                }
        except ValidationError as e:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Refresh Failed'),
                    'message': str(e),
                    'type': 'danger',
                    'sticky': True,
                }
            }

    def action_test_connection(self):
        """ Test the Orange Money API connection. """
        self.ensure_one()

        try:
            # Try to get access token
            token = self._orange_money_get_access_token()

            if token:
                # Try to get public key
                public_key = self._orange_money_get_public_key()

                if public_key:
                    return {
                        'type': 'ir.actions.client',
                        'tag': 'display_notification',
                        'params': {
                            'title': _('Connection Successful'),
                            'message': _('Successfully connected to Orange Money API'),
                            'type': 'success',
                            'sticky': False,
                        }
                    }
        except ValidationError as e:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'title': _('Connection Failed'),
                    'message': str(e),
                    'type': 'danger',
                    'sticky': True,
                }
            }
