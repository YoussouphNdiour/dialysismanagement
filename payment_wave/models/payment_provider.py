# Part of Odoo. See LICENSE file for full copyright and licensing details.

import hashlib
import hmac
import logging

from odoo import _, fields, models
from odoo.exceptions import ValidationError

from odoo.addons.payment_wave import const

_logger = logging.getLogger(__name__)


class PaymentProvider(models.Model):
    _inherit = 'payment.provider'

    code = fields.Selection(
        selection_add=[('wave', "Wave")],
        ondelete={'wave': 'set default'}
    )
    wave_api_key = fields.Char(
        string="Wave API Key",
        help="The API key for authenticating with Wave API. Get this from Wave Business Portal > Developers section.",
        required_if_provider='wave',
        groups='base.group_system',
    )
    wave_webhook_secret = fields.Char(
        string="Wave Webhook Secret",
        help="The webhook secret for validating incoming webhooks from Wave.",
        required_if_provider='wave',
        groups='base.group_system',
    )
    wave_webhook_strategy = fields.Selection(
        string="Webhook Security Strategy",
        selection=[
            ('shared_secret', 'Shared Secret'),
            ('signing_secret', 'Signing Secret'),
        ],
        default='signing_secret',
        required_if_provider='wave',
        help="Choose the security strategy for webhook validation:\n"
             "- Shared Secret: Simple bearer token validation\n"
             "- Signing Secret: HMAC signature validation (recommended for better security)"
    )

    # === COMPUTE METHODS === #

    def _compute_feature_support_fields(self):
        """Override of `payment` to enable additional features."""
        super()._compute_feature_support_fields()
        self.filtered(lambda p: p.code == 'wave').update({
            'support_refund': 'full_only',
        })

    # === BUSINESS METHODS === #

    def _get_supported_currencies(self):
        """Override of `payment` to return the supported currencies."""
        supported_currencies = super()._get_supported_currencies()
        if self.code == 'wave':
            supported_currencies = supported_currencies.filtered(
                lambda c: c.name in const.SUPPORTED_CURRENCIES
            )
        return supported_currencies

    def _get_default_payment_method_codes(self):
        """Override of `payment` to return the default payment method codes."""
        if self.code != 'wave':
            return super()._get_default_payment_method_codes()
        return const.DEFAULT_PAYMENT_METHOD_CODES

    # === REQUEST HELPERS === #

    def _wave_make_request(self, endpoint, data=None, method='POST', idempotency_key=None):
        """Make a request to the Wave API.

        :param str endpoint: The API endpoint to call
        :param dict data: The payload to send
        :param str method: The HTTP method
        :param str idempotency_key: Optional idempotency key for POST requests
        :return: The API response
        :rtype: dict
        """
        self.ensure_one()

        try:
            # Pass idempotency_key through kwargs so _send_api_request can use it when building headers
            response_data = self._send_api_request(
                method=method,
                endpoint=endpoint,
                json=data,
                idempotency_key=idempotency_key,
            )
            return response_data
        except ValidationError as e:
            _logger.exception("Wave API request failed: %s", e)
            raise

    def _build_request_url(self, endpoint, **kwargs):
        """Override of `payment` to build the Wave API URL."""
        if self.code != 'wave':
            return super()._build_request_url(endpoint, **kwargs)

        api_url = self._wave_get_api_url()
        # Remove leading slash if present in endpoint
        endpoint = endpoint.lstrip('/')
        return f'{api_url}/{endpoint}'

    def _wave_get_api_url(self):
        """Return the Wave API URL based on the provider state.

        :return: The API URL
        :rtype: str
        """
        self.ensure_one()
        # Wave uses the same URL for both prod and test
        return const.WAVE_API_URL_PROD

    def _build_request_headers(self, method, endpoint, payload, **kwargs):
        """Override of `payment` to build the Wave API headers."""
        if self.code != 'wave':
            return super()._build_request_headers(method, endpoint, payload, **kwargs)

        headers = {
            'Authorization': f'Bearer {self.wave_api_key}',
            'Content-Type': 'application/json',
        }

        # Add idempotency key for POST requests
        idempotency_key = kwargs.get('idempotency_key')
        if method == 'POST' and idempotency_key:
            headers['Idempotency-Key'] = idempotency_key

        return headers

    def _parse_response_error(self, response):
        """Override of `payment` to parse Wave API error responses."""
        if self.code != 'wave':
            return super()._parse_response_error(response)

        try:
            error_data = response.json()
            error_code = error_data.get('code', 'unknown-error')
            error_message = error_data.get('message', 'Unknown error occurred')

            # Get more detailed error message if available
            if error_code in const.ERROR_CODES:
                error_message = f"{const.ERROR_CODES[error_code]}: {error_message}"

            return f"[{error_code}] {error_message}"
        except (ValueError, KeyError):
            return f"HTTP {response.status_code}: {response.text}"

    def _wave_validate_webhook_signature(self, payload, signature_header):
        """Validate the Wave webhook signature.

        :param str payload: The raw webhook payload
        :param str signature_header: The Wave-Signature header value
        :return: True if valid, False otherwise
        :rtype: bool
        """
        self.ensure_one()

        if self.wave_webhook_strategy == 'shared_secret':
            # Shared secret validation: simple bearer token comparison
            return signature_header == f"Bearer wave_sn_WHS_29h6m8f1y3vvjkfqt4wnj6khrdpwnm8zp7b66bywrm6n6vt5htx0"

        elif self.wave_webhook_strategy == 'signing_secret':
            # Signing secret validation: HMAC-SHA256 signature
            try:
                # Parse the Wave-Signature header
                # Format: t=timestamp,v1=signature1,v1=signature2
                sig_parts = {}
                for part in signature_header.split(','):
                    key, value = part.split('=', 1)
                    if key == 't':
                        sig_parts['timestamp'] = value
                    elif key == 'v1':
                        if 'signatures' not in sig_parts:
                            sig_parts['signatures'] = []
                        sig_parts['signatures'].append(value)

                # Construct the signed payload
                timestamp = sig_parts.get('timestamp')
                if not timestamp:
                    _logger.warning("Wave webhook signature missing timestamp")
                    return False

                signed_payload = f"{timestamp}{payload}"

                # Compute the expected signature
                expected_signature = hmac.new(
                    self.wave_webhook_secret.encode('utf-8'),
                    signed_payload.encode('utf-8'),
                    hashlib.sha256
                ).hexdigest()

                # Check if the expected signature matches any of the signatures in the header
                signatures = sig_parts.get('signatures', [])
                signature_valid = any(
                    hmac.compare_digest(expected_signature, sig)
                    for sig in signatures
                )

                if not signature_valid:
                    _logger.warning("Wave webhook signature validation failed")
                    return False

                # Optionally: Check timestamp to prevent replay attacks
                # You can add timestamp validation here if needed

                return True

            except (ValueError, KeyError) as e:
                _logger.exception("Error parsing Wave webhook signature: %s", e)
                return False

        return False

    def _get_reset_values(self):
        """Override of `payment` to add Wave-specific reset values."""
        res = super()._get_reset_values()
        if self.code != 'wave':
            return res

        return {
            **res,
            'wave_api_key': False,
            'wave_webhook_secret': False,
            'wave_webhook_strategy': 'signing_secret',
        }
