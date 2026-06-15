# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from twilio.rest import Client

from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)


class AccountMoveInherit(models.Model):
    _inherit = 'account.move'

    wave_payment_link_sent = fields.Boolean(
        string="Lien Wave Envoyé",
        default=False,
        help="Indique si le lien de paiement Wave a été envoyé au client par WhatsApp",
    )
    wave_payment_link_sent_date = fields.Datetime(
        string="Date Envoi Lien Wave",
        readonly=True,
        help="Date à laquelle le lien de paiement Wave a été envoyé",
    )

    def action_send_wave_payment_link_whatsapp(self):
        """
        Crée une transaction de paiement Wave et envoie le lien par WhatsApp au client.

        Cette méthode peut être appelée depuis :
        - La page portail des factures client (/my/invoices)
        - Le formulaire de facture dans le backend
        - Un bouton personnalisé
        """
        self.ensure_one()

        # Vérifications préalables
        if self.move_type not in ('out_invoice', 'out_refund'):
            raise UserError(_("Vous ne pouvez envoyer un lien de paiement Wave que pour les factures client."))

        if self.state != 'posted':
            raise UserError(_("La facture doit être validée (comptabilisée) avant d'envoyer un lien de paiement."))

        if self.payment_state in ('paid', 'in_payment', 'reversed'):
            raise UserError(_("Cette facture est déjà payée ou en cours de paiement."))

        # Récupérer le client
        customer = self.partner_id
        if not customer:
            raise UserError(_("Aucun client associé à cette facture."))

        # Récupérer le numéro de téléphone
        customer_phone = customer.phone
        if not customer_phone:
            raise UserError(
                _("Le client %s n'a pas de numéro de téléphone.\n"
                  "Veuillez renseigner le champ 'Mobile' ou 'Téléphone' sur sa fiche contact.") % customer.name
            )

        # Formater le numéro de téléphone
        formatted_phone = self._wave_format_phone_number(customer_phone)
        if not formatted_phone:
            raise UserError(
                _("Le numéro de téléphone du client (%s) n'est pas valide.\n"
                  "Veuillez le corriger sur sa fiche contact.") % customer_phone
            )

        # Vérifier qu'un fournisseur Wave est configuré
        wave_provider = self.env['payment.provider'].search([
            ('code', '=', 'wave'),
            ('state', 'in', ['enabled', 'test']),
        ], limit=1)

        if not wave_provider:
            raise UserError(
                _("Aucun fournisseur de paiement Wave n'est configuré.\n"
                  "Veuillez activer le module Wave dans Comptabilité > Configuration > Fournisseurs de paiement.")
            )

        # Créer une transaction de paiement Wave
        try:
            payment_transaction = self._create_wave_payment_transaction(wave_provider)

            # Le lien Wave est généré automatiquement par la transaction
            wave_link = payment_transaction.wave_launch_url

            if not wave_link:
                raise UserError(_("Impossible de générer le lien de paiement Wave. Vérifiez la configuration du fournisseur."))

            # Envoyer le WhatsApp
            success = self._send_whatsapp_payment_link(
                phone=formatted_phone,
                customer_name=customer.name,
                invoice_ref=self.name,
                amount=int(self.amount_residual),
                currency=self.currency_id.name,
                payment_link=wave_link,
            )

            if success:
                # Marquer comme envoyé
                self.write({
                    'wave_payment_link_sent': True,
                    'wave_payment_link_sent_date': fields.Datetime.now(),
                })

                return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': _('WhatsApp Envoyé !'),
                        'message': _('Le lien de paiement Wave a été envoyé à %s (%s)') % (customer.name, formatted_phone),
                        'type': 'success',
                        'sticky': False,
                    }
                }
            else:
                raise UserError(_("Échec de l'envoi du message WhatsApp. Vérifiez les logs pour plus de détails."))

        except Exception as e:
            _logger.exception("Erreur lors de l'envoi du lien Wave par WhatsApp : %s", e)
            raise UserError(
                _("Erreur lors de l'envoi du lien de paiement :\n%s") % str(e)
            )

    def _create_wave_payment_transaction(self, provider):
        """
        Crée une transaction de paiement Wave pour cette facture.

        :param provider: Le fournisseur de paiement Wave
        :return: La transaction créée
        """
        self.ensure_one()

        # Vérifier si une transaction Wave existe déjà pour cette facture
        existing_tx = self.env['payment.transaction'].search([
            ('reference', '=', self.name),
            ('provider_code', '=', 'wave'),
            ('state', 'in', ['draft', 'pending']),
        ], limit=1)

        if existing_tx:
            _logger.info("Transaction Wave existante trouvée pour %s : %s", self.name, existing_tx.reference)
            return existing_tx

        # Créer une nouvelle transaction
        transaction_values = {
            'provider_id': provider.id,
            'reference': self.name,  # Utiliser le numéro de facture comme référence
            'amount': self.amount_residual,  # Montant restant à payer
            'currency_id': self.currency_id.id,
            'partner_id': self.partner_id.id,
            'operation': 'online_direct',
            'invoice_ids': [(6, 0, [self.id])],
        }

        transaction = self.env['payment.transaction'].create(transaction_values)

        # Forcer la génération du lien Wave
        # Cela va appeler _get_specific_rendering_values qui crée la session Wave
        transaction._get_processing_values()

        _logger.info("Transaction Wave créée pour la facture %s : TX ref %s", self.name, transaction.reference)

        return transaction

    def _send_whatsapp_payment_link(self, phone, customer_name, invoice_ref, amount, currency, payment_link):
        """
        Envoie le lien de paiement par WhatsApp via Twilio.

        :param str phone: Numéro de téléphone formaté (E.164)
        :param str customer_name: Nom du client
        :param str invoice_ref: Référence de la facture
        :param float amount: Montant à payer
        :param str currency: Code de la devise
        :param str payment_link: Lien de paiement Wave
        :return: True si envoyé, False sinon
        """
        try:
            # Credentials Twilio (à déplacer en configuration si besoin)
            account_sid = 'AC2ce48d80dc709de15d513212b53f5c1d'
            auth_token = '2801d879333be2de9c7a1074a05c493a'

            client = Client(account_sid, auth_token)

            # Préparer le message
            message_body = (
                f"Bonjour {customer_name},\n\n"
                f"Votre facture {invoice_ref} d'un montant de {amount} {currency} est prête.\n\n"
                f"Cliquez sur ce lien pour payer avec Wave:\n"
                f"{payment_link}\n\n"
                f"Merci!"
            )

            # Envoyer le message
            message = client.messages.create(
                from_='whatsapp:+14155238886',  # Twilio WhatsApp Sandbox
                to=f'whatsapp:{phone}',
                body=message_body
            )

            _logger.info(
                "WhatsApp payment link sent for invoice %s to %s (%s) - Message SID: %s",
                invoice_ref, customer_name, phone, message.sid
            )

            return True

        except Exception as e:
            _logger.error("Failed to send WhatsApp message for invoice %s: %s", invoice_ref, e)
            return False

    def _wave_format_phone_number(self, phone):
        """
        Formate un numéro de téléphone au format E.164 (international).

        :param str phone: Numéro de téléphone brut
        :return: Numéro formaté ou None si invalide
        """
        if not phone:
            return None

        # Nettoyer le numéro (garder seulement les chiffres et le +)
        clean_phone = ''.join(c for c in phone if c.isdigit() or c == '+')

        # Ajouter le code pays si manquant (assume Sénégal +221)
        if not clean_phone.startswith('+'):
            if len(clean_phone) == 9:  # Numéro sénégalais sans code pays
                clean_phone = f'+221{clean_phone}'
            elif len(clean_phone) == 12 and clean_phone.startswith('221'):
                clean_phone = f'+{clean_phone}'
            else:
                clean_phone = f'+{clean_phone}'

        return clean_phone

    def _get_invoice_portal_extra_values(self, custom_amount=None):
        """
        Override pour ajouter des informations Wave dans le portail.
        """
        values = super()._get_invoice_portal_extra_values(custom_amount=custom_amount)

        # Ajouter l'information si le lien Wave a été envoyé
        values.update({
            'wave_payment_link_sent': self.wave_payment_link_sent,
            'wave_payment_link_sent_date': self.wave_payment_link_sent_date,
        })

        return values
