# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import math
import uuid
from datetime import timedelta
from werkzeug.urls import url_encode
from twilio.rest import Client
from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment_wave import const
_logger = logging.getLogger(__name__)


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    wave_checkout_session_id = fields.Char(
        string="Wave Checkout Session ID",
        help="The checkout session ID returned by Wave API",
        readonly=True,
    )
    wave_transaction_id = fields.Char(
        string="Wave Transaction ID",
        help="The transaction ID from Wave (visible in Wave app)",
        readonly=True,
    )
    wave_launch_url = fields.Char(
        string="Wave Launch URL",
        help="The URL to launch the Wave app for payment",
        readonly=True,
    )
    wave_margin_payout_scheduled = fields.Datetime(
        string="Margin Payout Scheduled At",
        help="The date and time when the 0.5% margin payout is scheduled",
        readonly=True,
    )
    wave_margin_payout_sent = fields.Boolean(
        string="Margin Payout Sent",
        help="Whether the 0.5% margin payout has been sent",
        default=False,
        readonly=True,
    )
    wave_margin_payout_id = fields.Char(
        string="Margin Payout ID",
        help="The payout ID returned by Wave API for the margin payout",
        readonly=True,
    )

    def init(self):
        """Add custom SQL indexes for performance optimization."""
        super(PaymentTransaction, self).init()

        # Index for optimizing margin payout cron job queries
        # This dramatically improves performance when searching for pending payouts
        # Note: We don't use WHERE clause with provider_code to avoid dependency issues
        self.env.cr.execute("""
            CREATE INDEX IF NOT EXISTS idx_payment_tx_wave_payout_pending
            ON payment_transaction (
                wave_margin_payout_scheduled,
                wave_margin_payout_sent
            )
            WHERE wave_margin_payout_sent = false
              AND wave_margin_payout_scheduled IS NOT NULL
        """)

        # Index for optimizing checkout session lookups
        self.env.cr.execute("""
            CREATE INDEX IF NOT EXISTS idx_payment_tx_wave_checkout_session
            ON payment_transaction (wave_checkout_session_id)
            WHERE wave_checkout_session_id IS NOT NULL
        """)

        # Index for optimizing transaction ID lookups
        self.env.cr.execute("""
            CREATE INDEX IF NOT EXISTS idx_payment_tx_wave_transaction_id
            ON payment_transaction (wave_transaction_id)
            WHERE wave_transaction_id IS NOT NULL
        """)

        _logger.info("Wave performance indexes created successfully")

    # === BUSINESS METHODS === #

    def _get_specific_rendering_values(self, processing_values):
        """Override of `payment` to return Wave-specific rendering values.

        :param dict processing_values: The generic and specific processing values of the transaction
        :return: The dict of provider-specific rendering values
        :rtype: dict
        """
        res = super()._get_specific_rendering_values(processing_values)
        if self.provider_code != 'wave':
            return res

        # Create a checkout session with Wave
        base_url = 'https://as-shafi.com'
        payload = self._wave_prepare_checkout_payload(base_url)

        try:
            checkout_data = self.provider_id._wave_make_request(
                endpoint=const.ENDPOINT_CHECKOUT_CREATE,
                data=payload,
                method='POST',
            )

            # Store the checkout session details
            self.wave_checkout_session_id = checkout_data.get('id')
            self.wave_launch_url = checkout_data.get('wave_launch_url')
            # === ENVOI DU MESSAGE WHATSAPP ===
            try:
                # Récupérer le client de la facture qui va payer
                phone_number = None
                customer = None
                invoice = None

                _logger.info("Recherche du customer de la facture via la référence: %s", self.reference)

                # Extraire le nom de la facture de la référence
                # Ex: "FAC/2025/00033-5" -> "FAC/2025/00033"
                invoice_name = self.reference
                if '-' in self.reference:
                    # Enlever le suffixe après le dernier tiret
                    invoice_name = self.reference.rsplit('-', 1)[0]
                    _logger.info("Référence modifiée pour recherche: %s -> %s", self.reference, invoice_name)

                # Méthode 1: Chercher la facture avec le nom extrait
                invoice = self.env['account.move'].search([
                    ('name', '=', invoice_name),
                    ('move_type', 'in', ['out_invoice', 'out_refund'])
                ], limit=1)

                if invoice:
                    customer = invoice.partner_id
                    _logger.info("✓ FACTURE TROUVÉE - ID: %s, Name: %s", invoice.id, invoice.name)
                    _logger.info("✓ CLIENT DE LA FACTURE - ID: %s, Name: %s, Phone: %s",
                                customer.id if customer else 'N/A',
                                customer.name if customer else 'N/A',
                                customer.phone if customer else 'N/A')
                else:
                    _logger.info("✗ Aucune facture trouvée avec name: %s", invoice_name)

                    # Méthode 2: Chercher avec la référence complète
                    invoice = self.env['account.move'].search([
                        ('name', '=', self.reference),
                        ('move_type', 'in', ['out_invoice', 'out_refund'])
                    ], limit=1)

                    if invoice:
                        customer = invoice.partner_id
                        _logger.info("✓ FACTURE TROUVÉE (référence complète) - ID: %s, Name: %s", invoice.id, invoice.name)
                        _logger.info("✓ CLIENT DE LA FACTURE - ID: %s, Name: %s, Phone: %s",
                                    customer.id if customer else 'N/A',
                                    customer.name if customer else 'N/A',
                                    customer.phone if customer else 'N/A')
                    else:
                        _logger.info("✗ Aucune facture trouvée avec name: %s", self.reference)

                        # Méthode 3: Chercher via payment_reference
                        invoice = self.env['account.move'].search([
                            ('payment_reference', '=', self.reference),
                            ('move_type', 'in', ['out_invoice', 'out_refund'])
                        ], limit=1)

                        if invoice:
                            customer = invoice.partner_id
                            _logger.info("✓ FACTURE TROUVÉE (payment_reference) - ID: %s, Name: %s", invoice.id, invoice.name)
                            _logger.info("✓ CLIENT DE LA FACTURE - ID: %s, Name: %s, Phone: %s",
                                        customer.id if customer else 'N/A',
                                        customer.name if customer else 'N/A',
                                        customer.phone if customer else 'N/A')
                        else:
                            _logger.warning("✗ AUCUNE FACTURE TROUVÉE avec aucune méthode!")

                # Méthode 4: Utiliser self.partner_id comme dernier recours
                if not customer and self.partner_id:
                    customer = self.partner_id
                    _logger.info("⚠ Fallback: Utilisation de self.partner_id - ID: %s, Name: %s",
                                customer.id, customer.name)

                # Récupérer le numéro de téléphone (seulement phone, pas mobile)
                if customer:
                    phone_number = customer.phone
                    _logger.info("Numéro trouvé: %s", phone_number)

                if phone_number:
                    # Formater le numéro au format international
                    formatted_phone = self._wave_format_mobile_number(phone_number)

                    if formatted_phone:
                        _logger.info("Envoi du message WhatsApp à: %s", formatted_phone)

                        import httpx
                        # Your API key for authentication
                        api_key = '21beddcd8ee58a645ea30ec3c554206a8342e7074d049c42f923676fa84f7e58'
                        # Example of sending a location message
                        response = httpx.post(
                            'https://wasenderapi.com/api/send-message',
                            json={
                                # Recipient and location data
                                'to': f'{formatted_phone}',
                                'text': f'Bonjour {customer.name},\n\nVeuillez payer votre facture de {int(self.amount)} {self.currency_id.name} à partir de ce lien:\n\n{self.wave_launch_url}\n\nRéférence: {self.reference}'
                            },
                            headers={
                                # Authorization header with Bearer token
                                'Authorization': f'Bearer {api_key}'
                            }
                        )

                        _logger.info("Message WhatsApp envoyé avec succès! SID")
                    else:
                        _logger.warning("Impossible de formater le numéro de téléphone: %s", phone_number)
                else:
                    _logger.warning("Aucun numéro de téléphone trouvé pour le customer: %s", customer.name if customer else 'N/A')
            except Exception as e:
                _logger.error("Erreur lors de l'envoi du message WhatsApp: %s", str(e), exc_info=True)

            # Return rendering values that will be used in the template
            return {
                'wave_launch_url': self.wave_launch_url,
                'wave_session_id': self.wave_checkout_session_id,
            }

        except ValidationError as e:
            _logger.exception("Failed to create Wave checkout session: %s", e)
            self._set_error(
                _("An error occurred while creating the payment session. Please try again.")
            )
            raise

    def _wave_prepare_checkout_payload(self, base_url):
        """Prepare the payload for Wave checkout session creation.

        :param str base_url: The base URL of the Odoo instance
        :return: The checkout session payload
        :rtype: dict
        """

        self.ensure_one()

        # Construire les URLs de retour avec le paramètre tx_ref
        return_url_params = url_encode({'tx_ref': self.reference})
        success_url = f'{base_url}/payment/wave/return/success?{return_url_params}'
        error_url = f'{base_url}/payment/wave/return/error?{return_url_params}'

        # Calculate fees: 1% Wave transaction fee (rounded up) + 200 XOF fixed developer fee
        base_amount = int(self.amount)
        transaction_fee = math.ceil(base_amount * 0.01)  # 1% rounded up
        margin_fee = const.WAVE_DEVELOPER_FEE  # 200 XOF fixed developer fee
        total_amount = base_amount + transaction_fee + margin_fee

        # Prepare the payload
        payload = {
            'amount': str(round(total_amount)),  # Wave expects string amount without decimals for XOF
            'currency': self.currency_id.name,
            'error_url': error_url,
            'success_url': success_url,
            'client_reference': self.reference,
        }

        _logger.info(
            "Wave checkout payload prepared - Base: %s XOF, Wave fee (1%%): %s XOF, "
            "Developer fee (fixed): %s XOF, Total: %s XOF",
            base_amount, transaction_fee, margin_fee, total_amount
        )

        return payload

    def _wave_format_mobile_number(self, mobile):
        """Format a mobile number to E.164 format.

        :param str mobile: The mobile number to format
        :return: The formatted mobile number or None if invalid
        :rtype: str|None
        """
        if not mobile:
            return None

        # Remove all non-digit characters
        digits = ''.join(c for c in mobile if c.isdigit())

        # Senegal country code is +221, phone numbers are 9 digits
        if len(digits) == 9:
            # Assume Senegal if no country code
            return f'+221{digits}'
        elif len(digits) == 12 and digits.startswith('221'):
            return f'+{digits}'
        elif mobile.startswith('+'):
            return mobile

        _logger.warning("Unable to format mobile number: %s", mobile)
        return None

    def _wave_send_payout(self, amount, mobile, name, client_reference):
        """Send a payout using Wave Payout API.

        :param float amount: The amount to payout (in base currency)
        :param str mobile: The recipient mobile number in E.164 format
        :param str name: The recipient name
        :param str client_reference: A unique reference for this payout
        :return: The payout result data
        :rtype: dict
        """
        self.ensure_one()

        # Prepare payout payload
        payload = {
            'currency': self.currency_id.name,
            'receive_amount': str(int(round(amount))),
            'mobile': mobile,
            'name': name,
            'client_reference': client_reference,
        }

        # Generate idempotency key for this payout
        idempotency_key = str(uuid.uuid4())

        try:
            # Send payout request with idempotency key
            payout_data = self.provider_id._wave_make_request(
                endpoint=const.ENDPOINT_PAYOUT_CREATE,
                data=payload,
                method='POST',
                idempotency_key=idempotency_key
            )

            _logger.info(
                "Wave payout sent successfully - ID: %s, Amount: %s, Mobile: %s",
                payout_data.get('id'), amount, mobile
            )

            return payout_data

        except Exception as e:
            _logger.error(
                "Failed to send Wave payout - Amount: %s, Mobile: %s, Error: %s",
                amount, mobile, str(e), exc_info=True
            )
            raise

    def _get_tx_from_notification_data(self, provider_code, notification_data):
        """Override of `payment` to find the transaction based on Wave data.

        :param str provider_code: The code of the provider that handled the transaction
        :param dict notification_data: The notification data sent by the provider
        :return: The transaction if found
        :rtype: payment.transaction
        """
        if provider_code != 'wave':
            return super()._get_tx_from_notification_data(provider_code, notification_data)

        # Extract reference from notification data
        client_reference = notification_data.get('data', {}).get('client_reference')
        checkout_session_id = notification_data.get('data', {}).get('id')

        # Try to find by client_reference first (most reliable)
        if client_reference:
            tx = self.search([('reference', '=', client_reference), ('provider_code', '=', 'wave')], limit=1)
            if tx:
                return tx

        # Fallback to checkout session ID
        if checkout_session_id:
            tx = self.search([
                ('wave_checkout_session_id', '=', checkout_session_id),
                ('provider_code', '=', 'wave')
            ], limit=1)
            if tx:
                return tx

        # If still not found, raise error
        raise ValidationError(
            f"Wave: No transaction found matching reference {client_reference} "
            f"or session {checkout_session_id}."
        )

    def _process_notification_data(self, notification_data):
        """Override of `payment` to process the notification data.

        :param dict notification_data: The notification data sent by the provider
        :return: None
        """
        if self.provider_code != 'wave':
            return super()._process_notification_data(notification_data)

        # Extract the event type and data
        event_type = notification_data.get('type')
        event_data = notification_data.get('data', {})

        # Store Wave transaction ID if available
        wave_tx_id = event_data.get('transaction_id')
        if wave_tx_id and not self.wave_transaction_id:
            self.wave_transaction_id = wave_tx_id

        # Process based on event type
        if event_type == const.WEBHOOK_EVENT_CHECKOUT_COMPLETED:
            self._wave_process_checkout_completed(event_data)
        elif event_type == const.WEBHOOK_EVENT_CHECKOUT_FAILED:
            self._wave_process_checkout_failed(event_data)
        else:
            _logger.info("Received Wave webhook with unhandled event type: %s", event_type)

    def _wave_process_checkout_completed(self, event_data):
        """Process a completed checkout session.

        :param dict event_data: The checkout session data from Wave
        :return: None
        """
        self.ensure_one()

        payment_status = event_data.get('payment_status')
        checkout_status = event_data.get('checkout_status')

        # Map Wave status to Odoo status
        if payment_status == 'succeeded' and checkout_status == 'complete':
            self._set_done()

            # Schedule margin payout for 2 minutes from now
            scheduled_time = fields.Datetime.now() + timedelta(minutes=2)
            self.wave_margin_payout_scheduled = scheduled_time

            _logger.info(
                "Wave payment succeeded - Margin payout scheduled for %s (Tx: %s)",
                scheduled_time, self.reference
            )

        elif payment_status == 'processing':
            self._set_pending()
        else:
            _logger.warning(
                "Unexpected status in completed checkout: payment_status=%s, checkout_status=%s",
                payment_status, checkout_status
            )

    def _wave_process_checkout_failed(self, event_data):
        """Process a failed checkout session.

        :param dict event_data: The checkout session data from Wave
        :return: None
        """
        self.ensure_one()

        # Extract error information
        error_info = event_data.get('last_payment_error', {})
        error_code = error_info.get('code', 'unknown-error')
        error_message = error_info.get('message', 'Payment failed')

        # Get human-readable error message
        readable_error = const.ERROR_CODES.get(error_code, error_message)

        self._set_canceled(state_message=f"{readable_error} ({error_code})")

    def _send_refund_request(self, amount_to_refund=None):
        """Override of `payment` to send a refund request to Wave.

        :param float amount_to_refund: The amount to refund
        :return: The refund result
        :rtype: dict
        """
        if self.provider_code != 'wave':
            return super()._send_refund_request(amount_to_refund=amount_to_refund)

        # Wave only supports full refunds
        if amount_to_refund and amount_to_refund != self.amount:
            raise ValidationError(_("Wave only supports full refunds."))

        # Call Wave refund endpoint
        endpoint = const.ENDPOINT_CHECKOUT_REFUND.format(
            session_id=self.wave_checkout_session_id
        )

        try:
            self.provider_id._wave_make_request(
                endpoint=endpoint,
                method='POST',
            )
            return {'refund_status': 'success'}
        except ValidationError as e:
            _logger.exception("Wave refund failed: %s", e)
            raise ValidationError(_("The refund request failed. Please try again or contact support."))

    def _get_sent_message(self):
        """Override of `payment` to customize the sent message."""
        message = super()._get_sent_message()
        if self.provider_code != 'wave':
            return message

        return _(
            "A payment request of %(amount)s has been sent to Wave.\n"
            "Transaction Reference: %(ref)s",
            amount=payment_utils.to_minor_currency_units(self.amount, self.currency_id),
            ref=self.reference,
        )

    @api.model
    def _cron_cleanup_old_wave_data(self):
        """Clean up old Wave transaction data to maintain performance.

        This cron job archives/cleans data older than 1 year to prevent
        database bloat and maintain optimal query performance.
        """
        # Calculate date for 1 year ago
        one_year_ago = fields.Datetime.now() - timedelta(days=365)

        # Find old completed Wave transactions
        old_transactions = self.search([
            ('provider_code', '=', 'wave'),
            ('state', 'in', ['done', 'cancel', 'error']),
            ('create_date', '<', one_year_ago),
            ('wave_margin_payout_sent', '=', True),  # Only if payout already sent
        ])

        count = len(old_transactions)
        if count == 0:
            _logger.info("No old Wave transactions to clean up")
            return

        _logger.info("Starting cleanup of %d old Wave transactions", count)

        # Clear non-essential fields to reduce storage
        # This keeps the transaction record but removes bulky data
        old_transactions.write({
            'wave_launch_url': False,  # URLs can be cleaned up
            # Keep transaction IDs and essential fields for audit trail
        })

        _logger.info("Successfully cleaned up %d old Wave transactions", count)

    def _cron_process_wave_margin_payouts(self):
        """Cron job to process pending Wave margin payouts.

        This method is called periodically to check for transactions that have
        a scheduled margin payout time in the past and sends the 0.5% payout.
        """
        # Find transactions with pending margin payouts
        now = fields.Datetime.now()
        # Only look at transactions from the last 7 days to avoid scanning old data
        seven_days_ago = now - timedelta(days=7)

        pending_payouts = self.search([
            ('provider_code', '=', 'wave'),
            ('wave_margin_payout_scheduled', '<=', now),
            ('wave_margin_payout_scheduled', '>=', seven_days_ago),  # Optimization: limit time range
            ('wave_margin_payout_sent', '=', False),
            ('state', '=', 'done'),
        ], limit=100, order='wave_margin_payout_scheduled asc')  # Process oldest first, max 100 per run

        _logger.info("Processing %s pending Wave margin payouts", len(pending_payouts))

        for tx in pending_payouts:
            try:
                # Fixed 200 XOF developer fee
                margin_amount = const.WAVE_DEVELOPER_FEE  # 200 XOF fixed

                if margin_amount <= 0:
                    _logger.warning(
                        "Developer fee is zero for transaction %s, skipping payout",
                        tx.reference
                    )
                    tx.wave_margin_payout_sent = True
                    continue

                # Send payout to developer's Wave number
                recipient_mobile = const.WAVE_DEVELOPER_MOBILE  # +221777671661
                recipient_name = 'Frais développeur'
                client_reference = f'MARGIN-{tx.reference}-{tx.id}'

                payout_data = tx._wave_send_payout(
                    amount=margin_amount,
                    mobile=recipient_mobile,
                    name=recipient_name,
                    client_reference=client_reference
                )

                # Mark as sent and store payout ID
                tx.write({
                    'wave_margin_payout_sent': True,
                    'wave_margin_payout_id': payout_data.get('id'),
                })

                _logger.info(
                    "Developer fee payout sent for transaction %s - Amount: %s XOF, "
                    "Recipient: %s, Payout ID: %s",
                    tx.reference, margin_amount, recipient_mobile, payout_data.get('id')
                )

            except Exception as e:
                _logger.error(
                    "Failed to send margin payout for transaction %s: %s",
                    tx.reference, str(e), exc_info=True
                )
                # Don't mark as sent so it will be retried in the next cron run
                continue
