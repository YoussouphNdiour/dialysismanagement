/** @odoo-module **/

import { patch } from '@web/core/utils/patch';
import { PaymentForm } from '@payment/interactions/payment_form';

patch(PaymentForm.prototype, {

    /**
     * Validate phone number before initiating Orange Money direct payment.
     *
     * @override
     */
    async _initiatePaymentFlow(providerCode, paymentOptionId, paymentMethodCode, flow) {
        if (providerCode !== 'orange_money' || flow !== 'direct') {
            await super._initiatePaymentFlow(...arguments);
            return;
        }

        const msisdn = document.getElementById('orange_money_msisdn')?.value?.trim();
        if (!msisdn) {
            this._displayErrorDialog(
                'Orange Money',
                'Veuillez saisir votre numéro Orange Money.'
            );
            this._enableButton();
            return;
        }

        const phoneRegex = /^7[0-9]{8}$/;
        if (!phoneRegex.test(msisdn)) {
            this._displayErrorDialog(
                'Orange Money',
                'Numéro invalide (9 chiffres commençant par 7).'
            );
            this._enableButton();
            return;
        }

        await super._initiatePaymentFlow(...arguments);
    },

});
