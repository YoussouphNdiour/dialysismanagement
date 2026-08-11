// @ts-check
/**
 * 98 — Génération de données réalistes pour les captures d'écran
 *
 * Ce script crée/met à jour des données variées dans Odoo pour que les
 * screenshots de documentation montrent des écrans remplis et réalistes.
 *
 * Données créées :
 *  - RDV de consultation (confirmed, done)
 *  - Séances passées avec données cliniques (done)
 *  - Séances en cours (running) avec vitaux partiels
 *  - Séances futures (scheduled)
 *  - Ordonnances prescrites
 */

const { test } = require('@playwright/test');
const {
  loginApi, rpcCall, apiCreate, apiWrite, apiSearchRead,
} = require('../helpers/api');

test.describe('98 — Seed data for documentation', () => {
  test.describe.configure({ timeout: 180000 });

  test('Enrichir les données existantes', async ({ request }) => {
    await loginApi(request, 'admin', 'admin');

    // ═══════════════════════════════════════════════════════════════
    // 1. Récupérer les IDs nécessaires
    // ═══════════════════════════════════════════════════════════════
    const patients = await apiSearchRead(request, 'hms.patient', [], ['id', 'name'], 15);
    const physicians = await apiSearchRead(request, 'hms.physician', [], ['id', 'name'], 5);
    const schedules = await apiSearchRead(request, 'acs.nephrology.schedule', [], ['id', 'name'], 5);
    const dialyzers = await apiSearchRead(request, 'acs.dialyzer', [], ['id', 'name'], 5);
    const dialysates = await apiSearchRead(request, 'acs.dialysate', [], ['id', 'name'], 5);

    const physicianId = physicians[0]?.id || 1;
    const scheduleId = schedules[0]?.id;
    const dialyzerId = dialyzers[0]?.id;
    const dialysateId = dialysates[0]?.id;

    console.log(`Patients: ${patients.length}, Physician: ${physicianId}`);
    console.log(`Schedule: ${scheduleId}, Dialyzer: ${dialyzerId}, Dialysate: ${dialysateId}`);

    // Trouver les patients clés
    const moussa = patients.find(p => /moussa/i.test(p.name));
    const seynabou = patients.find(p => /seynabou/i.test(p.name));
    const ibrahim = patients.find(p => /ibrahim/i.test(p.name));

    // ═══════════════════════════════════════════════════════════════
    // 2. Mettre à jour les RDV existants (variété d'états)
    // ═══════════════════════════════════════════════════════════════
    console.log('\n--- Mise à jour des RDV existants ---');

    // Confirmer quelques RDV existants qui sont en draft
    const draftRdvs = await apiSearchRead(
      request, 'hms.appointment',
      [['state', '=', 'draft']],
      ['id', 'date'], 20,
    );
    // Confirmer les RDV du passé → done, ceux du futur → confirmed
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 19).replace('T', ' ');
    let confirmed = 0, done = 0;
    for (const rdv of draftRdvs) {
      try {
        if (rdv.date < nowStr) {
          await apiWrite(request, 'hms.appointment', [rdv.id], { state: 'done' });
          done++;
        } else if (confirmed < 5) {
          await apiWrite(request, 'hms.appointment', [rdv.id], { state: 'confirmed' });
          confirmed++;
        }
      } catch (e) {
        // ignore
      }
    }
    console.log(`  RDV mis à jour: ${done} → done, ${confirmed} → confirmed`);

    // ═══════════════════════════════════════════════════════════════
    // 3. Remplir les séances passées avec données cliniques
    // ═══════════════════════════════════════════════════════════════
    console.log('\n--- Enrichissement séances passées ---');

    const allProcs = await apiSearchRead(
      request, 'acs.patient.procedure',
      [['state', '=', 'scheduled']],
      ['id', 'name', 'date', 'patient_id'], 50,
    );

    // Séances passées → done avec données cliniques
    const pastProcs = allProcs.filter(p => p.date && p.date < nowStr);
    // Séance d'aujourd'hui → running
    const todayStr = now.toISOString().slice(0, 10);
    const todayProcs = allProcs.filter(p => p.date && p.date.startsWith(todayStr));
    // Séances futures → garder scheduled
    const futureProcs = allProcs.filter(p => p.date && p.date > nowStr && !p.date.startsWith(todayStr));

    console.log(`  Passées: ${pastProcs.length}, Aujourd'hui: ${todayProcs.length}, Futures: ${futureProcs.length}`);

    // Données cliniques variées pour les séances terminées
    const clinicalData = [
      { arrival_weight: 72.5, departure_weight: 70.0, dry_weight: 69.5, blood_flow: 300, dialysis_fluid_flow: 500, pre_dialysis_bp: '140/85', pre_dialysis_temp: 36.7, uf_habituelle: 800, temperature_bain: 36.0 },
      { arrival_weight: 68.2, departure_weight: 66.0, dry_weight: 65.5, blood_flow: 280, dialysis_fluid_flow: 500, pre_dialysis_bp: '135/80', pre_dialysis_temp: 36.5, uf_habituelle: 750, temperature_bain: 36.5 },
      { arrival_weight: 75.0, departure_weight: 72.8, dry_weight: 72.0, blood_flow: 320, dialysis_fluid_flow: 500, pre_dialysis_bp: '150/90', pre_dialysis_temp: 36.8, uf_habituelle: 850, temperature_bain: 36.0 },
      { arrival_weight: 65.3, departure_weight: 63.5, dry_weight: 63.0, blood_flow: 260, dialysis_fluid_flow: 500, pre_dialysis_bp: '128/78', pre_dialysis_temp: 36.6, uf_habituelle: 700, temperature_bain: 36.5 },
      { arrival_weight: 70.1, departure_weight: 68.0, dry_weight: 67.5, blood_flow: 300, dialysis_fluid_flow: 500, pre_dialysis_bp: '142/88', pre_dialysis_temp: 36.9, uf_habituelle: 780, temperature_bain: 36.0 },
    ];

    let doneCount = 0;
    for (let i = 0; i < pastProcs.length && i < 15; i++) {
      const proc = pastProcs[i];
      const data = clinicalData[i % clinicalData.length];
      const updateData = { ...data };
      if (dialyzerId) updateData.dialyzer_type = dialyzerId;
      if (dialysateId) updateData.type_of_dialysate = dialysateId;
      updateData.dialysis_number = i + 1;

      try {
        await apiWrite(request, 'acs.patient.procedure', [proc.id], updateData);
        await apiWrite(request, 'acs.patient.procedure', [proc.id], { state: 'done' });
        doneCount++;
      } catch (e) {
        console.log(`  ⚠ Séance ${proc.id} non mise à jour: ${e.message}`);
      }
    }
    console.log(`  ${doneCount} séances → done avec données cliniques`);

    // Séances d'aujourd'hui → running avec données partielles
    let runningCount = 0;
    for (const proc of todayProcs) {
      try {
        await apiWrite(request, 'acs.patient.procedure', [proc.id], {
          arrival_weight: 71.0,
          dry_weight: 69.0,
          blood_flow: 290,
          dialysis_fluid_flow: 500,
          pre_dialysis_bp: '138/82',
          pre_dialysis_temp: 36.7,
          temperature_bain: 36.0,
          state: 'running',
        });
        runningCount++;
      } catch (e) {
        console.log(`  ⚠ Séance ${proc.id} non mise en running: ${e.message}`);
      }
    }
    console.log(`  ${runningCount} séances → running`);

    // ═══════════════════════════════════════════════════════════════
    // 4. Enrichir les ordonnances
    // ═══════════════════════════════════════════════════════════════
    console.log('\n--- Enrichissement ordonnances ---');

    const draftOrds = await apiSearchRead(
      request, 'prescription.order',
      [['state', '=', 'draft']],
      ['id', 'name'], 10,
    );
    let prescribedCount = 0;
    for (const ord of draftOrds) {
      try {
        await apiWrite(request, 'prescription.order', [ord.id], { state: 'prescription' });
        prescribedCount++;
      } catch (e) {
        // certaines ne peuvent pas être prescrites si incomplètes
      }
    }
    console.log(`  ${prescribedCount} ordonnances → prescribed`);

    // ═══════════════════════════════════════════════════════════════
    // 5. S'assurer que les RDV liés aux séances done sont aussi done
    // ═══════════════════════════════════════════════════════════════
    console.log('\n--- Sync RDV liés aux séances done ---');
    const doneProcs = await apiSearchRead(
      request, 'acs.patient.procedure',
      [['state', '=', 'done'], ['appointment_id', '!=', false]],
      ['id', 'appointment_id'], 50,
    );
    let rdvSynced = 0;
    for (const proc of doneProcs) {
      const rdvId = Array.isArray(proc.appointment_id) ? proc.appointment_id[0] : proc.appointment_id;
      if (rdvId) {
        try {
          await apiWrite(request, 'hms.appointment', [rdvId], { state: 'done' });
          rdvSynced++;
        } catch (e) {}
      }
    }
    console.log(`  ${rdvSynced} RDV liés → done`);

    // ═══════════════════════════════════════════════════════════════
    // Résumé final
    // ═══════════════════════════════════════════════════════════════
    console.log('\n=== RÉSUMÉ DONNÉES ===');
    const finalProcs = await apiSearchRead(request, 'acs.patient.procedure', [], ['state'], 200);
    const procStates = {};
    for (const p of finalProcs) { procStates[p.state] = (procStates[p.state] || 0) + 1; }
    console.log('Séances:', JSON.stringify(procStates));

    const finalRdvs = await apiSearchRead(request, 'hms.appointment', [], ['state'], 200);
    const rdvStates = {};
    for (const r of finalRdvs) { rdvStates[r.state] = (rdvStates[r.state] || 0) + 1; }
    console.log('RDV:', JSON.stringify(rdvStates));

    const finalOrds = await apiSearchRead(request, 'prescription.order', [], ['state'], 50);
    const ordStates = {};
    for (const o of finalOrds) { ordStates[o.state] = (ordStates[o.state] || 0) + 1; }
    console.log('Ordonnances:', JSON.stringify(ordStates));
  });
});
