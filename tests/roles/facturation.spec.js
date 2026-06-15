// @ts-check
/**
 * RÔLE : RESPONSABLE FACTURATION
 * Responsabilités dans le processus :
 *  12. Créer facture, valider, enregistrer paiement
 * Prérequis : Séance terminée (procedure state = done)
 *
 * Ce fichier est STANDALONE : il peut être lancé seul si state.json contient
 * procedure_id (séance terminée) et patient_id.
 * La création de facture passe par la méthode ORM action_create_nephro_invoice.
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { loginUI }      = require('../helpers/auth');
const { snap }         = require('../helpers/screenshot');
const { readState, updateState } = require('../helpers/state');
const {
  loginApi,
  rpcCall,
  apiSearchRead,
  apiRead,
} = require('../helpers/api');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const BILLING_LOGIN = 'facturation@nephro.test';
const BILLING_PASS  = 'Nephro2024!';
const ADMIN_LOGIN   = 'admin';
const ADMIN_PASS    = 'admin';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigue vers la facture identifiée par son ID.
 * Essaie d'abord /odoo/accounting/customers/invoices/{id}, puis via la liste.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} invoiceId
 */
async function navigateToInvoice(page, invoiceId) {
  // Essai 1 : URL directe Odoo 19
  try {
    await page.goto(`/odoo/accounting/customers/invoices/${invoiceId}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('domcontentloaded');
    const form = page.locator('.o_form_view').first();
    if (await form.isVisible({ timeout: 5000 })) return;
  } catch {
    // ignore
  }

  // Essai 2 : URL générique /odoo/invoices/{id}
  try {
    await page.goto(`/odoo/invoices/${invoiceId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    const form = page.locator('.o_form_view').first();
    if (await form.isVisible({ timeout: 5000 })) return;
  } catch {
    // ignore
  }

  // Essai 3 : via l'action accounting
  await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');

  // Chercher le module Comptabilité
  const accountingApp = page.locator(
    '.o_app:has-text("Comptabilité"), .o_app:has-text("Accounting"), a:has-text("Comptabilité")'
  ).first();
  if (await accountingApp.isVisible({ timeout: 5000 })) {
    await accountingApp.click();
    await page.waitForLoadState('domcontentloaded');
  }

  // Menu Clients → Factures
  const customerInvoicesMenu = page.locator(
    '.o_menu_sections a:has-text("Factures clients"), a:has-text("Factures")'
  ).first();
  if (await customerInvoicesMenu.isVisible({ timeout: 5000 })) {
    await customerInvoicesMenu.click();
    await page.waitForLoadState('domcontentloaded');
    // Chercher la facture dans la liste
    const searchInput = page.locator('.o_searchview_input').first();
    if (await searchInput.isVisible({ timeout: 3000 })) {
      await searchInput.fill(String(invoiceId));
      await page.keyboard.press('Enter');
      await page.waitForLoadState('domcontentloaded');
    }
    const firstRow = page.locator('.o_data_row').first();
    if (await firstRow.isVisible({ timeout: 5000 })) {
      // Dismiss any open dropdown/overlay before clicking the row
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      await firstRow.click();
      await page.waitForLoadState('domcontentloaded');
    }
  }
}

// ---------------------------------------------------------------------------
// Suite de tests
// ---------------------------------------------------------------------------

test.describe('Rôle Facturation — Parcours complet', () => {

  // --------------------------------------------------------------------------
  // TEST 1/3 — Création facture dialyse
  // --------------------------------------------------------------------------
  test('1/3 — Création facture dialyse', async ({ page, request }) => {
    const state = readState();

    // Vérifier les prérequis
    if (!state.procedure_id) {
      test.skip(true, 'procedure_id absent du state.json — impossible de créer la facture');
    }

    if (!state.patient_id) {
      test.skip(true, 'patient_id absent du state.json');
    }

    // --- Connexion billing ---
    await loginApi(request, BILLING_LOGIN, BILLING_PASS);
    await loginUI(page, BILLING_LOGIN, BILLING_PASS);

    // --- Vérifier si une facture existe déjà pour cette séance ---
    if (state.invoice_id) {
      const exists = await apiSearchRead(
        request,
        'account.move',
        [['id', '=', state.invoice_id]],
        ['id', 'state', 'payment_state', 'amount_total'],
        1
      );
      if (exists && exists.length > 0) {
        console.log(
          `[facturation] Facture existante : id=${state.invoice_id}, état=${exists[0].state}, ` +
          `paiement=${exists[0].payment_state}, montant=${exists[0].amount_total}`
        );
        await navigateToInvoice(page, state.invoice_id);
        await snap(page, '12a_facturation_brouillon');
        return;
      }
    }

    // --- Vérifier l'état de la séance ---
    let procedureState = null;
    try {
      const procRec = await apiRead(
        request, 'acs.patient.procedure', [state.procedure_id], ['id', 'state', 'billing_state']
      );
      if (procRec && procRec.length > 0) {
        procedureState = procRec[0].state;
        console.log(
          `[facturation] Séance ${state.procedure_id} — état=${procedureState}, ` +
          `facturation=${procRec[0].billing_state}`
        );

        // Si déjà facturée, rechercher la facture existante
        if (procRec[0].billing_state !== 'not_invoiced') {
          const invoices = await apiSearchRead(
            request,
            'account.move',
            [['patient_id', '=', state.patient_id], ['move_type', '=', 'out_invoice']],
            ['id', 'state', 'payment_state', 'amount_total'],
            1
          );
          if (invoices && invoices.length > 0) {
            updateState({ invoice_id: invoices[0].id });
            console.log(`[facturation] Facture retrouvée : id=${invoices[0].id}`);
            await navigateToInvoice(page, invoices[0].id);
            await snap(page, '12a_facturation_brouillon');
            return;
          }
        }
      }
    } catch (err) {
      console.warn(`[facturation] Lecture séance impossible : ${err.message}`);
    }

    // --- Créer la facture via l'action ORM ---
    // La méthode action_create_nephro_invoice nécessite que la séance soit 'done'
    // et qu'une règle tarifaire soit résolue.
    let invoiceId = null;

    // Essai avec les droits de l'utilisateur billing
    try {
      await rpcCall(
        request,
        'acs.patient.procedure',
        'action_create_nephro_invoice',
        [[state.procedure_id]]
      );
      console.log('[facturation] action_create_nephro_invoice appelée avec succès');
    } catch (err) {
      console.warn(`[facturation] action_create_nephro_invoice échouée : ${err.message}`);
      // Peut échouer si la règle tarifaire n'est pas résolue ou si la séance
      // n'est pas encore 'done'. On continue pour prendre un screenshot.
    }

    // --- Rechercher la facture créée ---
    await page.waitForTimeout(1500);
    try {
      const invoices = await apiSearchRead(
        request,
        'account.move',
        [
          ['patient_id', '=', state.patient_id],
          ['move_type', '=', 'out_invoice'],
          ['state', '=', 'draft'],
        ],
        ['id', 'amount_total', 'state'],
        1
      );
      if (invoices && invoices.length > 0) {
        invoiceId = invoices[0].id;
        updateState({ invoice_id: invoiceId });
        console.log(
          `[facturation] Facture créée : id=${invoiceId}, montant=${invoices[0].amount_total}`
        );
      } else {
        // Chercher sans filtre sur l'état (peut-être déjà confirmée)
        const allInvoices = await apiSearchRead(
          request,
          'account.move',
          [
            ['patient_id', '=', state.patient_id],
            ['move_type', '=', 'out_invoice'],
          ],
          ['id', 'amount_total', 'state'],
          1
        );
        if (allInvoices && allInvoices.length > 0) {
          invoiceId = allInvoices[0].id;
          updateState({ invoice_id: invoiceId });
          console.log(`[facturation] Facture trouvée (état=${allInvoices[0].state}) : id=${invoiceId}`);
        }
      }
    } catch (err) {
      console.warn(`[facturation] Recherche facture échouée : ${err.message}`);
    }

    // --- Naviguer vers la facture ---
    if (invoiceId) {
      await navigateToInvoice(page, invoiceId);
    } else {
      // Si pas de facture créée, naviguer vers la liste des factures brouillon
      await page.goto('/odoo', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      console.warn('[facturation] Aucune facture créée — screenshot de la page courante');
    }

    await snap(page, '12a_facturation_brouillon');
  });

  // --------------------------------------------------------------------------
  // TEST 2/3 — Validation facture
  // --------------------------------------------------------------------------
  test('2/3 — Validation facture', async ({ page, request }) => {
    const state = readState();

    if (!state.invoice_id) {
      test.skip(true, 'invoice_id absent du state.json — exécuter le test 1/3 en premier');
    }

    await loginApi(request, BILLING_LOGIN, BILLING_PASS);

    // --- Vérifier l'état de la facture ---
    let invoiceState = null;
    try {
      const invRec = await apiRead(
        request, 'account.move', [state.invoice_id], ['id', 'state', 'payment_state']
      );
      if (invRec && invRec.length > 0) {
        invoiceState = invRec[0].state;
        console.log(`[facturation] Facture ${state.invoice_id} — état=${invoiceState}`);
      }
    } catch (err) {
      console.warn(`[facturation] Lecture facture impossible : ${err.message}`);
    }

    await loginUI(page, BILLING_LOGIN, BILLING_PASS);
    await navigateToInvoice(page, state.invoice_id);

    // Si déjà confirmée, juste screenshot
    if (invoiceState === 'posted' || invoiceState === 'cancel') {
      console.log(`[facturation] Facture déjà en état "${invoiceState}"`);
      await snap(page, '12b_facturation_validee');
      return;
    }

    // --- Clic sur le bouton Confirmer ---
    const confirmBtn = page.locator(
      'button:has-text("Confirmer"), button:has-text("Valider"), button[name="action_post"]'
    ).first();

    if (await confirmBtn.isVisible({ timeout: 10000 })) {
      await confirmBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      console.log('[facturation] Facture confirmée (action_post)');
    } else {
      console.warn('[facturation] Bouton Confirmer non trouvé — facture peut-être déjà validée');
    }

    // Vérifier que la facture est maintenant en état 'posted'
    await page.waitForTimeout(1000);
    const stateTag = page.locator(
      '.o_statusbar_status button.o_arrow_button:has-text("Comptabilisé"), ' +
      '.o_field_statusbar .btn:has-text("Comptabilisé"), ' +
      '.o_statusbar_status [aria-label="Comptabilisé"]'
    ).first();
    if (await stateTag.isVisible({ timeout: 5000 })) {
      console.log('[facturation] Statut "Comptabilisé" confirmé dans la barre de statut');
    }

    await snap(page, '12b_facturation_validee');
  });

  // --------------------------------------------------------------------------
  // TEST 3/3 — Paiement
  // --------------------------------------------------------------------------
  test('3/3 — Paiement', async ({ page, request }) => {
    const state = readState();

    if (!state.invoice_id) {
      test.skip(true, 'invoice_id absent du state.json — exécuter les tests 1/3 et 2/3 en premier');
    }

    await loginApi(request, BILLING_LOGIN, BILLING_PASS);

    // --- Vérifier si la facture est déjà payée ---
    let paymentState = null;
    let invoiceState = null;
    try {
      const invRec = await apiRead(
        request, 'account.move', [state.invoice_id], ['id', 'state', 'payment_state']
      );
      if (invRec && invRec.length > 0) {
        invoiceState  = invRec[0].state;
        paymentState  = invRec[0].payment_state;
        console.log(
          `[facturation] Facture ${state.invoice_id} — état=${invoiceState}, paiement=${paymentState}`
        );
      }
    } catch (err) {
      console.warn(`[facturation] Lecture facture impossible : ${err.message}`);
    }

    await loginUI(page, BILLING_LOGIN, BILLING_PASS);
    await navigateToInvoice(page, state.invoice_id);

    // Si déjà payée, juste screenshot
    if (paymentState === 'paid' || paymentState === 'in_payment') {
      console.log('[facturation] Facture payée ✅');
      await snap(page, '12c_facturation_paye');
      return;
    }

    // Si pas encore confirmée, confirmer d'abord
    if (invoiceState === 'draft') {
      console.log('[facturation] Facture encore en brouillon — confirmation avant paiement');
      const confirmBtn = page.locator(
        'button:has-text("Confirmer"), button:has-text("Valider"), button[name="action_post"]'
      ).first();
      if (await confirmBtn.isVisible({ timeout: 5000 })) {
        await confirmBtn.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1000);
      }
    }

    // --- Clic sur "Enregistrer un paiement" ---
    const registerPaymentBtn = page.locator(
      'button:has-text("Enregistrer un paiement"), ' +
      'button:has-text("Paiement"), ' +
      'button[name="action_register_payment"]'
    ).first();

    if (await registerPaymentBtn.isVisible({ timeout: 10000 })) {
      await registerPaymentBtn.click();
      await page.waitForTimeout(1000);
      console.log('[facturation] Dialog de paiement ouvert');

      // Attendre le dialog de paiement
      const paymentDialog = page.locator(
        '.modal, .o_dialog, dialog'
      ).first();
      if (await paymentDialog.isVisible({ timeout: 8000 })) {
        // Le dialog est pré-rempli avec le montant et la date — on peut valider directement
        // Vérifier que le montant est pré-rempli
        const amountField = paymentDialog.locator('input[name="amount"]').first();
        if (await amountField.isVisible({ timeout: 3000 })) {
          const currentAmount = await amountField.inputValue();
          console.log(`[facturation] Montant dans le dialog : ${currentAmount}`);
        }

        // Bouton valider le paiement (dans le dialog)
        const confirmPayBtn = paymentDialog.locator(
          'button:has-text("Valider"), button:has-text("Payer"), button.btn-primary'
        ).first();
        if (await confirmPayBtn.isVisible({ timeout: 5000 })) {
          await confirmPayBtn.click();
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(2000);
          console.log('[facturation] Paiement confirmé');
        } else {
          console.warn('[facturation] Bouton de confirmation du paiement non trouvé');
          // Fermer le dialog et continuer
          await page.keyboard.press('Escape');
        }
      } else {
        console.warn('[facturation] Dialog de paiement non détecté');
      }
    } else {
      console.warn('[facturation] Bouton "Enregistrer un paiement" non trouvé');
      console.warn('[facturation] La facture est peut-être déjà payée ou pas encore confirmée');
    }

    await snap(page, '12c_facturation_paye');

    // --- Vérification finale du paiement via API ---
    await page.waitForTimeout(1500);
    try {
      const finalRec = await apiRead(
        request, 'account.move', [state.invoice_id], ['id', 'state', 'payment_state']
      );
      if (finalRec && finalRec.length > 0) {
        const finalPayState = finalRec[0].payment_state;
        console.log(`[facturation] État paiement final : ${finalPayState}`);

        if (finalPayState === 'paid' || finalPayState === 'in_payment') {
          console.log('[facturation] Facture payée ✅');
        } else {
          console.warn(`[facturation] Paiement non confirmé — état: ${finalPayState}`);
        }

        // Enregistrer le payment_id si possible
        if (!state.payment_id) {
          try {
            const payments = await apiSearchRead(
              request,
              'account.payment',
              [['move_id', '=', state.invoice_id]],
              ['id', 'state'],
              1
            );
            if (payments && payments.length > 0) {
              updateState({ payment_id: payments[0].id });
              console.log(`[facturation] Paiement enregistré : payment_id=${payments[0].id}`);
            }
          } catch {
            // Parfois le lien invoice→payment est indirect
          }
        }
      }
    } catch (err) {
      console.warn(`[facturation] Vérification paiement échouée : ${err.message}`);
    }
  });

}); // fin describe
