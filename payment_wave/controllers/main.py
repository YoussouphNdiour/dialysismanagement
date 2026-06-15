# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import logging
import pprint

from odoo import http
from odoo.exceptions import ValidationError
from odoo.http import request

_logger = logging.getLogger(__name__)


class WaveController(http.Controller):
    _return_url = '/payment/wave/return'
    _webhook_url = '/payment/wave/webhook'

    @http.route([
        '/payment/wave/return',
        '/payment/wave/return/success',
        '/payment/wave/return/error',
    ], type='http', auth='public', methods=['GET', 'POST'], csrf=False, save_session=False)
    def wave_return_from_checkout(self, **data):
        """Process the return from Wave checkout.

        This route is called when the customer is redirected back from Wave
        after completing or canceling the payment.

        :param dict data: The GET parameters from the return URL
        """
        _logger.info("Handling redirection from Wave with data:\n%s", pprint.pformat(data))

        # Extract transaction reference from parameters
        tx_ref = data.get('tx_ref')

        if tx_ref:
            # Try to find the transaction
            try:
                tx_sudo = request.env['payment.transaction'].sudo().search([
                    ('reference', '=', tx_ref),
                    ('provider_code', '=', 'wave')
                ], limit=1)

                if tx_sudo:
                    _logger.info("Found transaction %s for return URL", tx_ref)
                    # Redirect to payment status page with transaction reference
                    return request.redirect('/payment/status?tx_ref=%s' % tx_ref)
                else:
                    _logger.warning("Transaction %s not found for Wave return", tx_ref)
            except Exception as e:
                _logger.exception("Error finding transaction %s: %s", tx_ref, e)

        # Default redirect to payment status
        return request.redirect('/payment/status')

    @http.route(_webhook_url, type='http', auth='public', methods=['POST'], csrf=False)
    def wave_webhook(self):
        """Process webhook notifications from Wave.

        Wave sends webhooks for:
        - checkout.session.completed
        - checkout.session.payment_failed
        - merchant.payment_received

        The webhook must be registered in Wave Business Portal.
        """
        # Get the raw request data
        try:
            data = request.get_json_data()
        except (ValueError, AttributeError) as e:
            _logger.error("Failed to parse webhook data: %s", e)
            return json.dumps({'status': 'error', 'message': 'Invalid JSON'})
        _logger.info("Webhook received from Wave with data:\n%s", pprint.pformat(data))

        # Get the signature header for validation
        signature_header = request.httprequest.headers.get('Wave-Signature') or \
                          request.httprequest.headers.get('Authorization')

        if not signature_header:
            _logger.warning("Wave webhook received without signature header")
            return json.dumps({'status': 'error', 'message': 'Missing signature'})

        try:
            # Get the raw payload for signature validation
            raw_payload = request.httprequest.get_data(as_text=True)

            # Find the transaction and validate the webhook
            tx_sudo = request.env['payment.transaction'].sudo()._get_tx_from_notification_data(
                'wave', data
            )

            # Validate the webhook signature
            if not tx_sudo.provider_id._wave_validate_webhook_signature(raw_payload, signature_header):
                _logger.warning("Wave webhook signature validation failed for transaction %s", tx_sudo.reference)
                return json.dumps({'status': 'error', 'message': 'Invalid signature'})

            # Process the notification - pass the full data dict, not just transaction_data
            tx_sudo._process_notification_data(data)

            return json.dumps({'status': 'success'})

        except ValidationError as e:
            _logger.exception("Error processing Wave webhook: %s", e)
            return json.dumps({'status': 'error', 'message': str(e)})

        except Exception as e:
            _logger.exception("Unexpected error processing Wave webhook: %s", e)
            return json.dumps({'status': 'error', 'message': 'Internal server error'})
