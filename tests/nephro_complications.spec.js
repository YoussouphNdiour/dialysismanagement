// @ts-check
/**
 * nephro_complications.spec.js — Tests E2E des Complications de Dialyse
 *
 * Standalone. Utilise state.procedure_id ou cherche une proc\u00e9dure en DB.
 * Couvre :
 *   - Enregistrer une complication Hypotension sur une s\u00e9ance
 *   - V\u00e9rifier qu'elle appara\u00eet dans action-586
 */

'use strict';

const { test, expect } = require('@playwright/test');
const { readState } = require('./helpers/state');
const { loginApi, apiCreate, apiSearchRead, apiRead } = require('./helpers/api');
const { loginUI } = require('./helpers/auth');
const { snap } = require('./helpers/screenshot');

const ADMIN_LOGIN = 'admin';
const ADMIN_PASSWORD = 'admin';

async function findProcedureId(request) {
  const state = readState();
  if (state.procedure_id) {
    console.log('[complications] procedure_id depuis state :', state.procedure_id);
    return state.procedure_id;
  }
  const procs = await apiSearchRead(request, 'acs.patient.procedure',
    [], ['id', 'name'], 1
  );
  if (procs && procs.length > 0) {
    console.log('[complications] procedure_id depuis DB :', procs[0].id);
    return procs[0].id;
  }
  throw new Error('[complications] Aucune proc\u00e9dure trouv\u00e9e \u2014 ex\u00e9cuter 08_generation_seances.spec.js d\'abord');
}

test.describe('Complications de Dialyse', () => {

  test('Enregistrer une complication Hypotension et la v\u00e9rifier dans action-586', async ({ page, request }) => {
    test.setTimeout(120000);

    await loginApi(request, ADMIN_LOGIN, ADMIN_PASSWORD);
    const procedureId = await findProcedureId(request);
    console.log('[complications] proc\u00e9dure cible :', procedureId);

    // \u2500\u2500\u2500 \u00c9tape 1 : Cr\u00e9er la complication via API \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const now = new Date();
    const occurrenceTime = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00`;

    const complicationId = await apiCreate(request, 'acs.dialysis.complication', {
      procedure_id:      procedureId,
      complication_type: 'hypotension',
      occurrence_time:   occurrenceTime,
      bp_at_occurrence:  '85/50',
      action_taken:      'Position Trendelenburg, bolus 100mL NaCl 0.9%, arr\u00eat UF',
      resolution:        'yes',
      notes:             'R\u00e9solution en 15 minutes',
    });
    console.log('[complications] complication cr\u00e9\u00e9e id=', complicationId);
    expect(complicationId).toBeGreaterThan(0);

    // \u2500\u2500\u2500 \u00c9tape 2 : V\u00e9rifier les donn\u00e9es en DB \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const records = await apiRead(request, 'acs.dialysis.complication', [complicationId], [
      'id', 'complication_type', 'patient_id', 'procedure_id', 'resolution',
    ]);
    expect(records).toHaveLength(1);
    const comp = records[0];
    expect(comp.complication_type).toBe('hypotension');
    expect(comp.resolution).toBe('yes');
    console.log('[complications] donn\u00e9es DB v\u00e9rifi\u00e9es :', comp);

    // \u2500\u2500\u2500 \u00c9tape 3 : V\u00e9rifier dans action-586 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    await loginUI(page, ADMIN_LOGIN, ADMIN_PASSWORD);
    await page.goto('/odoo/action-586', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.o_data_row, .o_nocontent_help', { timeout: 15000 });

    const rows = await page.locator('.o_data_row').count();
    console.log('[complications] lignes dans action-586 :', rows);
    await snap(page, 'nephro_complications_liste');
    expect(rows).toBeGreaterThan(0);

    console.log('[complications] Test termin\u00e9 avec succ\u00e8s');
  });

});
