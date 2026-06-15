/** @odoo-module **/

import paymentForm from '@payment/js/payment_form';

paymentForm.include({
    /**
     * Redirect to Wave launch URL when Wave is selected
     *
     * @override method from @payment/js/payment_form
     * @private
     * @param {string} provider - The provider code
     * @param {number} paymentOptionId - The payment option id
     * @param {string} flow - The payment flow
     * @return {Promise}
     */
    async _processRedirectPayment(provider, paymentOptionId, flow) {
        if (provider !== 'wave') {
            return this._super(...arguments);
        }

        // For Wave, we need to redirect the user to the Wave launch URL
        // The URL will be provided in the processing values
        return this._super(...arguments);
    },
});
