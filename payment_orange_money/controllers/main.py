# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import pprint

from odoo import http
from odoo.http import request
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class OrangeMoneyController(http.Controller):
    _return_url = '/payment/orange_money/return'
    _cancel_url = '/payment/orange_money/cancel'
    _status_url = '/payment/orange_money/status/<int:tx_id>'

    @http.route(_return_url, type='http', auth='public', methods=['GET', 'POST'], csrf=False, save_session=False)
    def orange_money_return(self, **data):
        """ Handle return from Orange Money payment (success).

        This is called when the customer is redirected back after successful payment.
        We mark the transaction as successful immediately.
        """
        _logger.info("Orange Money return (SUCCESS) with data:\n%s", pprint.pformat(data))

        reference = data.get('reference')
        if not reference:
            _logger.warning("Orange Money return: No reference provided")
            return request.redirect('/payment/status')

        try:
            # Find transaction - try exact match first
            tx_sudo = request.env['payment.transaction'].sudo().search([
                ('reference', '=', reference),
                ('provider_code', '=', 'orange_money')
            ], limit=1)

            # If not found, try with suffix pattern (handles FAC/2025/00043 -> FAC/2025/00043-1)
            if not tx_sudo:
                tx_sudo = request.env['payment.transaction'].sudo().search([
                    ('reference', 'like', reference + '-%'),
                    ('provider_code', '=', 'orange_money')
                ], order='id desc', limit=1)

                if tx_sudo:
                    _logger.info(
                        "Orange Money return: Found transaction by pattern - %s matched %s",
                        reference, tx_sudo.reference
                    )

            if not tx_sudo:
                _logger.warning("Orange Money return: Transaction not found for reference %s", reference)
                return request.redirect('/payment/status')

            _logger.info(
                "Orange Money SUCCESS callback received for tx %s (current state: %s)",
                tx_sudo.reference, tx_sudo.state
            )

            # Orange Money redirects to success_url only when payment is successful
            # So we can mark the transaction as done immediately
            if tx_sudo.state not in ['done', 'cancel']:
                _logger.info("Marking transaction %s as DONE (via success_url)", tx_sudo.reference)
                # Use _orange_money_handle_status to schedule margin payout
                tx_sudo._orange_money_handle_status('SUCCESS')
                _logger.info("Transaction %s successfully marked as done and payout scheduled", tx_sudo.reference)
            else:
                _logger.info("Transaction %s already in final state: %s", tx_sudo.reference, tx_sudo.state)

            # Redirect to payment status page with transaction reference
            return request.redirect('/payment/status?tx_ref=%s' % tx_sudo.reference)

        except Exception:
            _logger.exception("Error processing Orange Money return")
            return request.redirect('/payment/status')

    @http.route(_cancel_url, type='http', auth='public', methods=['GET', 'POST'], csrf=False, save_session=False)
    def orange_money_cancel(self, **data):
        """ Handle cancellation from Orange Money payment.

        This is called when the customer cancels the payment.
        We mark the transaction as cancelled immediately.
        """
        _logger.info("Orange Money CANCEL callback with data:\n%s", pprint.pformat(data))

        reference = data.get('reference')
        if not reference:
            _logger.warning("Orange Money cancel: No reference provided")
            return request.redirect('/payment/status')

        try:
            # Find transaction - try exact match first
            tx_sudo = request.env['payment.transaction'].sudo().search([
                ('reference', '=', reference),
                ('provider_code', '=', 'orange_money')
            ], limit=1)

            # If not found, try with suffix pattern (handles FAC/2025/00043 -> FAC/2025/00043-1)
            if not tx_sudo:
                tx_sudo = request.env['payment.transaction'].sudo().search([
                    ('reference', 'like', reference + '-%'),
                    ('provider_code', '=', 'orange_money')
                ], order='id desc', limit=1)

                if tx_sudo:
                    _logger.info(
                        "Orange Money cancel: Found transaction by pattern - %s matched %s",
                        reference, tx_sudo.reference
                    )

            if tx_sudo:
                _logger.info(
                    "Orange Money CANCEL callback received for tx %s (current state: %s)",
                    tx_sudo.reference, tx_sudo.state
                )

                # Orange Money redirects to cancel_url when payment is cancelled
                # Mark the transaction as cancelled immediately
                if tx_sudo.state not in ['done', 'cancel']:
                    _logger.info("Marking transaction %s as CANCELLED (via cancel_url)", tx_sudo.reference)
                    tx_sudo._set_canceled("Payment was cancelled by the customer")
                    _logger.info("Transaction %s successfully marked as cancelled", tx_sudo.reference)
                else:
                    _logger.info("Transaction %s already in final state: %s", tx_sudo.reference, tx_sudo.state)
            else:
                _logger.warning("Orange Money cancel: Transaction not found for reference %s", reference)

            # Redirect to payment status page with actual transaction reference
            tx_ref = tx_sudo.reference if tx_sudo else reference
            return request.redirect('/payment/status?tx_ref=%s' % tx_ref)

        except Exception:
            _logger.exception("Error processing Orange Money cancellation")
            return request.redirect('/payment/status')

    @http.route(_status_url, type='http', auth='public', methods=['GET'], csrf=False)
    def orange_money_status(self, tx_id, **_kwargs):
        """ Display Orange Money payment status page with QR code. """
        try:
            # Find transaction
            tx_sudo = request.env['payment.transaction'].sudo().browse(tx_id)

            if not tx_sudo.exists() or tx_sudo.provider_code != 'orange_money':
                _logger.warning("Orange Money status: Transaction %s not found or invalid", tx_id)
                return request.redirect('/payment/status')

            # Generate QR code if not already done
            qr_code = None
            if tx_sudo.state in ['draft', 'pending']:
                try:
                    qr_data = tx_sudo._orange_money_generate_qr_code()
                    qr_code = qr_data.get('qrCode')
                except Exception:
                    _logger.exception("Failed to generate QR code for tx %s", tx_id)

            # Render status page
            return request.render('payment_orange_money.orange_money_payment_status', {
                'tx': tx_sudo,
                'qr_code': qr_code,
            })

        except Exception:
            _logger.exception("Error displaying Orange Money status page")
            return request.redirect('/payment/status')
