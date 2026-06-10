# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import math
import uuid
from datetime import datetime, timedelta, timezone

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

from odoo.addons.payment_orange_money import const

_logger = logging.getLogger(__name__)


class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    orange_money_transaction_id = fields.Char(
        string='Orange Money Transaction ID',
        readonly=True,
        help='The transaction ID returned by Orange Money'
    )

    orange_money_qr_code = fields.Char(
        string='QR Code',
        readonly=True,
        help='The QR code for payment (if using QR method)'
    )

    orange_money_payment_method = fields.Selection(
        [
            ('qrcode', 'QR Code'),
            ('direct', 'Direct Payment'),
        ],
        string='Orange Money Method',
        default='qrcode',
        help='The payment method used for Orange Money'
    )

    orange_money_customer_msisdn = fields.Char(
        string='Customer Phone',
        help='Customer Orange Money phone number'
    )

    orange_money_margin_payout_scheduled = fields.Datetime(
        string="Developer Fee Payout Scheduled At",
        help="The date and time when the 200 XOF fixed developer fee payout is scheduled",
        readonly=True,
    )
    orange_money_margin_payout_sent = fields.Boolean(
        string="Developer Fee Payout Sent",
        help="Whether the 200 XOF fixed developer fee payout has been sent to +221777671661",
        default=False,
        readonly=True,
    )
    orange_money_margin_payout_id = fields.Char(
        string="Developer Fee Payout Transaction ID",
        help="The transaction ID returned by Orange Money for the 200 XOF developer fee payout",
        readonly=True,
    )

    def init(self):
        """Add custom SQL indexes for performance optimization."""
        super(PaymentTransaction, self).init()

        # Index for optimizing margin payout cron job queries
        # This dramatically improves performance when searching for pending payouts
        # Note: We don't use WHERE clause with provider_code to avoid dependency issues
        self.env.cr.execute("""
            CREATE INDEX IF NOT EXISTS idx_payment_tx_om_payout_pending
            ON payment_transaction (
                orange_money_margin_payout_scheduled,
                orange_money_margin_payout_sent
            )
            WHERE orange_money_margin_payout_sent = false
              AND orange_money_margin_payout_scheduled IS NOT NULL
        """)

        # Index for optimizing transaction ID lookups
        self.env.cr.execute("""
            CREATE INDEX IF NOT EXISTS idx_payment_tx_om_transaction_id
            ON payment_transaction (orange_money_transaction_id)
            WHERE orange_money_transaction_id IS NOT NULL
        """)

        _logger.info("Orange Money performance indexes created successfully")

    def _get_specific_rendering_values(self, processing_values):
        """ Override to return Orange Money-specific rendering values. """
        res = super()._get_specific_rendering_values(processing_values)
        if self.provider_code != 'orange_money':
            return res

        # For Orange Money, redirect to a status page where QR code will be displayed
        # This avoids trying to call the API during form rendering which can cause errors
        base_url = self.provider_id.get_base_url()
        status_url = f"{base_url}/payment/orange_money/status/{self.id}"

        return {
            'orange_money_qr_url': status_url,
        }

    def _orange_money_generate_qr_code(self):
        """ Generate a QR code for payment. """
        self.ensure_one()

        # Generate unique reference
        reference = self.reference or str(uuid.uuid4())

        # Prepare callback URLs
        base_url = self.provider_id.get_base_url()
        success_url = f"{base_url}/payment/orange_money/return?reference={reference}"
        cancel_url = f"{base_url}/payment/orange_money/cancel?reference={reference}"

        # Prepare QR code request payload
        payload = {
            'code': self.provider_id.orange_money_merchant_code,
            'name': self.provider_id.name or 'Merchant',
            'amount': {
                'value': int(self.amount) + math.ceil(int(self.amount) * 0.01) + const.OM_DEVELOPER_FEE,
                'unit': self.currency_id.name
            },
            'callbackSuccessUrl': success_url,
            'callbackCancelUrl': cancel_url,
            'validity': 900,  # 15 minutes
            'metadata': {
                'reference': reference,
                'order_id': self.reference,
                'customer_email': self.partner_email or '',
                'customer_name': self.partner_name or '',
            }
        }
        base_amount = int(self.amount)
        om_fee = math.ceil(base_amount * 0.01)
        _logger.info(
            "Orange Money QR payload - Base: %s XOF, OM fee (1%%): %s XOF, "
            "Developer fee (fixed): %s XOF, Total: %s XOF",
            base_amount, om_fee, const.OM_DEVELOPER_FEE,
            base_amount + om_fee + const.OM_DEVELOPER_FEE
        )

        try:
            response_orange = self.provider_id._orange_money_make_request(
                const.ENDPOINT_MERCHANT_PAYMENT,
                method='POST',
                data=payload
            )
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
                        whatsapp_response = httpx.post(
                            'https://wasenderapi.com/api/send-message',
                            json={
                                # Recipient and location data
                                'to': f'{formatted_phone}',
                                'text': f'Bonjour {customer.name},\n\nVeuillez payer votre facture de {int(self.amount)} {self.currency_id.name} à partir de ce lien:\n\n{response_orange.get('deepLinks')['MAXIT']}\n\nRéférence: {self.reference}'
                            },
                            headers={
                                # Authorization header with Bearer token
                                'Authorization': f'Bearer {api_key}'
                            }
                        )

                        _logger.info("Message WhatsApp envoyé avec succès! Status: %s", whatsapp_response.status_code)
                    else:
                        _logger.warning("Impossible de formater le numéro de téléphone: %s", phone_number)
                else:
                    _logger.warning("Aucun numéro de téléphone trouvé pour le customer: %s", customer.name if customer else 'N/A')
            except Exception as e:
                _logger.error("Erreur lors de l'envoi du message WhatsApp: %s", str(e), exc_info=True)
            # Store QR code information
            self.write({
                'orange_money_qr_code': response_orange.get('qrCode'),
            })
            
            return response_orange

        except ValidationError as e:
            _logger.error("Failed to generate QR code for transaction %s: %s", self.reference, str(e))
            self._set_error(_("Failed to generate payment QR code: %s") % str(e))
            raise

    def _orange_money_create_cashin(self):
        """ Create a cash-in transaction (for direct payments). """
        self.ensure_one()

        if not self.orange_money_customer_msisdn:
            raise ValidationError(_("Customer phone number (MSISDN) is required for direct payment"))

        # Encrypt PIN code
        encrypted_pin = self.provider_id._orange_money_encrypt_pin(
            self.provider_id.orange_money_pin_code
        )

        # Generate unique reference if not exists
        reference = self.reference or str(uuid.uuid4())

        # Prepare cash-in payload
        payload = {
            'partner': {
                'idType': const.ID_TYPE_MSISDN,
                'id': self.provider_id.orange_money_merchant_msisdn,
                'encryptedPinCode': encrypted_pin,
                'walletType': const.WALLET_TYPE_PRINCIPAL
            },
            'customer': {
                'idType': const.ID_TYPE_MSISDN,
                'id': self.orange_money_customer_msisdn,
                'walletType': const.WALLET_TYPE_PRINCIPAL
            },
            'amount': {
                'value': int(self.amount),
                'unit': self.currency_id.name
            },
            'reference': reference,
            'receiveNotification': True,
            'requestDate': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'metadata': {
                'senderFirstName': self.partner_name or 'Customer',
                'senderLastName': '',
                'order_id': self.reference,
            }
        }
        _logger.error("payload cashin %s", str(payload))


        try:
            response = self.provider_id._orange_money_make_request(
                const.ENDPOINT_CASHIN,
                method='POST',
                data=payload
            )

            # Update transaction with Orange Money transaction ID
            transaction_id = response.get('transactionId')
            status = response.get('status')

            self.write({
                'orange_money_transaction_id': transaction_id,
                'provider_reference': transaction_id,
            })

            # Handle transaction status
            self._orange_money_handle_status(status)
            _logger.error("response cashin %s", str(response))
            return response

        except ValidationError as e:
            _logger.error("Failed to create cash-in for transaction %s: %s", self.reference, str(e))
            self._set_error(_("Payment failed: %s") % str(e))
            raise

    def _orange_money_send_payout(self, amount, mobile, name, client_reference):
        """Send a payout using Orange Money Cash In API (merchant sends money to customer).

        :param float amount: The amount to payout (in base currency)
        :param str mobile: The recipient mobile number (MSISDN format)
        :param str name: The recipient name
        :param str client_reference: A unique reference for this payout
        :return: The payout result data
        :rtype: dict
        """
        self.ensure_one()

        # Format mobile number (remove + sign, keep only digits for Senegal +221XXXXXXXXX)
        formatted_mobile = mobile.replace('+', '').replace(' ', '')
        if formatted_mobile.startswith('221') and len(formatted_mobile) == 12:
            # Remove country code for API call (Orange expects 9 digits)
            formatted_mobile = formatted_mobile[3:]
        elif len(formatted_mobile) != 9:
            raise ValidationError(
                _("Invalid phone number format: %s. Expected format: +221XXXXXXXXX or 9 digits") % mobile
            )

        # Encrypt PIN code
        encrypted_pin = self.provider_id._orange_money_encrypt_pin(
            self.provider_id.orange_money_pin_code
        )

        # Prepare payout payload (Cash In from merchant to customer)
        payload = {
            'partner': {
                'idType': const.ID_TYPE_MSISDN,
                'id': self.provider_id.orange_money_merchant_msisdn,
                'encryptedPinCode': encrypted_pin,
            },
            'customer': {
                'idType': const.ID_TYPE_MSISDN,
                'id': formatted_mobile,
            },
            'amount': {
                'value': int(round(amount)),
                'unit': self.currency_id.name
            },
            'reference': client_reference,
            'receiveNotification': False,
            'requestDate': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'metadata': {
                'receiverName': name,
                'payout_type': 'margin',
            }
        }

        try:
            # Send payout request
            payout_data = self.provider_id._orange_money_make_request(
                const.ENDPOINT_CASHIN,
                method='POST',
                data=payload
            )

            _logger.info(
                "Orange Money payout sent successfully - Transaction ID: %s, Amount: %s, Mobile: %s",
                payout_data.get('transactionId'), amount, mobile
            )

            return payout_data

        except Exception as e:
            _logger.error(
                "Failed to send Orange Money payout - Amount: %s, Mobile: %s, Error: %s",
                amount, mobile, str(e), exc_info=True
            )
            raise

    def _orange_money_handle_status(self, status):
        """ Handle Orange Money transaction status. """
        self.ensure_one()

        odoo_status = const.TRANSACTION_STATUS_MAPPING.get(status, 'pending')

        _logger.info(
            "Orange Money transaction %s status: %s (mapped to %s)",
            self.reference, status, odoo_status
        )

        if odoo_status == 'done':
            self._set_done()

            # Schedule margin payout for 2 minutes from now (similar to Wave)
            scheduled_time = fields.Datetime.now() + timedelta(minutes=2)
            self.orange_money_margin_payout_scheduled = scheduled_time

            _logger.info(
                "Orange Money payment succeeded - Developer fee payout scheduled for %s (Tx: %s)",
                scheduled_time, self.reference
            )
        elif odoo_status == 'pending':
            self._set_pending()
        elif odoo_status == 'cancel':
            self._set_canceled()
        elif odoo_status == 'error':
            self._set_error(_("Transaction failed with status: %s") % status)

    def _orange_money_check_transaction_status(self):
        """ Check the status of an Orange Money transaction. """
        self.ensure_one()

        if not self.orange_money_transaction_id:
            _logger.warning("Cannot check status: No Orange Money transaction ID for %s", self.reference)
            return

        try:
            response = self.provider_id._orange_money_make_request(
                const.ENDPOINT_TRANSACTION_STATUS,
                method='GET',
                transaction_id=self.orange_money_transaction_id
            )

            status = response.get('status')
            if status:
                self._orange_money_handle_status(status)

        except Exception as e:
            _logger.error("Failed to check transaction status for %s: %s", self.reference, str(e))

    def _send_payment_request(self):
        """ Override to handle Orange Money payment requests. """
        res = super()._send_payment_request()
        if self.provider_code != 'orange_money':
            return res

        try:
            # QR code is already generated in _get_specific_rendering_values
            # Just set to pending (customer will scan and pay)
            self._set_pending()
        except Exception as e:
            _logger.exception("Orange Money payment request failed")
            self._set_error(_("Payment failed: %s") % str(e))

        return res

    @api.model
    def _cron_check_orange_money_pending_transactions(self):
        """ Cron job to check status of pending Orange Money transactions. """
        # Find all pending Orange Money transactions older than 5 minutes
        five_minutes_ago = fields.Datetime.now() - timedelta(minutes=5)

        pending_transactions = self.search([
            ('provider_code', '=', 'orange_money'),
            ('state', '=', 'pending'),
            ('orange_money_transaction_id', '!=', False),
            ('create_date', '<', five_minutes_ago),
        ])

        _logger.info("Checking status of %d pending Orange Money transactions", len(pending_transactions))

        for tx in pending_transactions:
            try:
                tx._orange_money_check_transaction_status()
            except Exception as e:
                _logger.error("Failed to check status for transaction %s: %s", tx.reference, str(e))

    @api.model
    def _cron_cleanup_old_orange_money_data(self):
        """Clean up old Orange Money transaction data to maintain performance.

        This cron job archives/cleans data older than 1 year to prevent
        database bloat and maintain optimal query performance.
        """
        # Calculate date for 1 year ago
        one_year_ago = fields.Datetime.now() - timedelta(days=365)

        # Find old completed Orange Money transactions
        old_transactions = self.search([
            ('provider_code', '=', 'orange_money'),
            ('state', 'in', ['done', 'cancel', 'error']),
            ('create_date', '<', one_year_ago),
            ('orange_money_margin_payout_sent', '=', True),  # Only if payout already sent
        ])

        count = len(old_transactions)
        if count == 0:
            _logger.info("No old Orange Money transactions to clean up")
            return

        _logger.info("Starting cleanup of %d old Orange Money transactions", count)

        # Option 1: Clear non-essential fields to reduce storage (recommended)
        # This keeps the transaction record but removes bulky data
        old_transactions.write({
            'orange_money_qr_code': False,  # QR codes can be large
            # Keep transaction IDs and essential fields for audit trail
        })

        # Option 2: For transactions older than 2 years, you could fully archive
        # (Uncomment if needed)
        # two_years_ago = fields.Datetime.now() - timedelta(days=730)
        # very_old_transactions = self.search([
        #     ('provider_code', '=', 'orange_money'),
        #     ('state', 'in', ['done', 'cancel', 'error']),
        #     ('create_date', '<', two_years_ago),
        # ])
        # very_old_transactions.write({'active': False})  # Archive them

        _logger.info("Successfully cleaned up %d old Orange Money transactions", count)

    @api.model
    def _cron_process_orange_money_margin_payouts(self):
        """Cron job to process pending Orange Money developer fee payouts.

        This method is called periodically to check for transactions that have
        a scheduled payout time in the past and sends the fixed 200 XOF developer fee.
        """
        # Find transactions with pending margin payouts
        now = fields.Datetime.now()
        # Only look at transactions from the last 7 days to avoid scanning old data
        seven_days_ago = now - timedelta(days=7)

        pending_payouts = self.search([
            ('provider_code', '=', 'orange_money'),
            ('orange_money_margin_payout_scheduled', '<=', now),
            ('orange_money_margin_payout_scheduled', '>=', seven_days_ago),  # Optimization: limit time range
            ('orange_money_margin_payout_sent', '=', False),
            ('state', '=', 'done'),
        ], limit=100, order='orange_money_margin_payout_scheduled asc')  # Process oldest first, max 100 per run

        _logger.info("Processing %s pending Orange Money margin payouts", len(pending_payouts))

        for tx in pending_payouts:
            try:
                # Fixed 200 XOF developer fee
                margin_amount = const.OM_DEVELOPER_FEE  # 200 XOF fixed

                if margin_amount <= 0:
                    _logger.warning(
                        "Developer fee is zero for transaction %s, skipping payout",
                        tx.reference
                    )
                    tx.orange_money_margin_payout_sent = True
                    continue

                # Send payout to developer's Orange Money number
                recipient_mobile = const.OM_DEVELOPER_MOBILE  # +221777671661
                recipient_name = 'Frais développeur'
                # Orange Money requires a UUID format for reference
                client_reference = str(uuid.uuid4())

                _logger.info(
                    "Sending margin payout for tx %s - Amount: %s, Reference: %s",
                    tx.reference, margin_amount, client_reference
                )

                payout_data = tx._orange_money_send_payout(
                    amount=margin_amount,
                    mobile=recipient_mobile,
                    name=recipient_name,
                    client_reference=client_reference
                )

                # Mark as sent and store payout transaction ID
                tx.write({
                    'orange_money_margin_payout_sent': True,
                    'orange_money_margin_payout_id': payout_data.get('transactionId'),
                })

                _logger.info(
                    "Developer fee payout sent for transaction %s - Amount: %s XOF, "
                    "Recipient: %s, Payout ID: %s",
                    tx.reference, margin_amount, recipient_mobile, payout_data.get('transactionId')
                )

            except Exception as e:
                _logger.error(
                    "Failed to send margin payout for transaction %s: %s",
                    tx.reference, str(e), exc_info=True
                )
                # Don't mark as sent so it will be retried in the next cron run
                continue
