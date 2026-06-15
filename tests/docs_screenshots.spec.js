// @ts-check
/**
 * CAPTURES D'ÉCRAN — GUIDES UTILISATEURS
 *
 * Produit les screenshots utilisés dans docs/guide_*.html.
 * À exécuter APRÈS la suite E2E complète (state.json peuplé).
 *
 * Nommage :
 *   sec_XX   → Secrétaire
 *   med_XX   → Médecin
 *   inf_XX   → Infirmière
 *   fac_XX   → Facturation
 *   pat_XX   → Patient portail
 *
 * Exécution :
 *   cd tests && npx playwright test docs_screenshots.spec.js --workers=1
 */

'use strict';

const path = require('path');
const fs   = require('fs');
const { test, expect } = require('@playwright/test');
const { loginUI }      = require('./helpers/auth');
const { readState, updateState } = require('./helpers/state');
const {
  loginApi,
  apiCreate,
  apiSearchRead,
  apiRead,
  apiWrite,
  rpcCall,
} = require('./helpers/api');

// ---------------------------------------------------------------------------
// Répertoire de destination
// ---------------------------------------------------------------------------
const SCREENSHOTS_DIR = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Helper capture
// ---------------------------------------------------------------------------
async function snap(page, name) {
  await page.waitForTimeout(1000);
  const filePath = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  console.log(`[snap] ${name}.png`);
  return filePath;
}

// ---------------------------------------------------------------------------
// Helper : ouvrir le menu Néphrologie, puis un item
// ---------------------------------------------------------------------------
async function openNephroMenu(page) {
  const app = page.locator(
    '.o_app[data-menu-xmlid*="nephrology"], .o_app:has-text("Néphrologie"), a.o_nav_entry:has-text("Néphrologie")'
  ).first();
  if (await app.isVisible({ timeout: 5000 }).catch(() => false)) {
    await app.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

async function clickMenuSection(page, text) {
  const item = page.locator(`.o_menu_sections a:has-text("${text}")`).first();
  if (await item.isVisible({ timeout: 5000 }).catch(() => false)) {
    await item.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(600);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helper : cliquer sur la première ligne de liste OU carte kanban
// ---------------------------------------------------------------------------
async function openFirstRow(page) {
  // Essai vue liste
  const row = page.locator('.o_data_row').first();
  if (await row.isVisible({ timeout: 4000 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await row.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    return true;
  }
  // Essai vue kanban
  const card = page.locator('.o_kanban_record:not(.o_kanban_ghost)').first();
  if (await card.isVisible({ timeout: 4000 }).catch(() => false)) {
    await card.click();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helper : nurse dashboard
// ---------------------------------------------------------------------------
async function goToNurseDashboard(page, request) {
  const actions = await apiSearchRead(
    request, 'ir.actions.client', [['tag', '=', 'acs_nurse_dashboard']], ['id'], 1
  ).catch(() => []);
  const url = actions.length > 0 ? `/odoo/action-${actions[0].id}` : '/odoo/action-588';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

// ---------------------------------------------------------------------------
// Helper : doctor dashboard — utilise l'admin pour résoudre l'action
// ---------------------------------------------------------------------------
async function goToDoctorDashboard(page, request) {
  // Chercher l'ID de l'action en tant qu'admin (le médecin peut ne pas avoir accès via son API)
  await loginApi(request, 'admin', 'admin');
  const actions = await apiSearchRead(
    request, 'ir.actions.client', [['tag', '=', 'acs_doctor_dashboard']], ['id'], 1
  ).catch(() => []);
  const url = actions.length > 0 ? `/odoo/action-${actions[0].id}` : '/odoo/action-589';
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
}

// ---------------------------------------------------------------------------
// Helper : navigate to invoice (via action Factures Dialyse = 581)
// ---------------------------------------------------------------------------
async function goToInvoice(page, invoiceId) {
  // Essayer en priorité l'action métier Factures Dialyse (accessible au rôle facturation)
  const urls = invoiceId ? [
    `/odoo/action-581/${invoiceId}`,
    `/odoo/accounting/customers/invoices/${invoiceId}`,
    `/odoo/invoices/${invoiceId}`,
  ] : ['/odoo/action-581'];
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForLoadState('domcontentloaded');
    if (await page.locator('.o_form_view, .o_list_view').isVisible({ timeout: 4000 }).catch(() => false)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Helper : créer les règles d'accès manquantes (non chargées en base)
// ---------------------------------------------------------------------------
async function ensureAccessRules(request) {
  async function getModelId(modelName) {
    const recs = await apiSearchRead(
      request, 'ir.model', [['model', '=', modelName]], ['id'], 1
    ).catch(() => []);
    return recs.length > 0 ? recs[0].id : null;
  }

  async function getGroupId(module, name) {
    const recs = await apiSearchRead(
      request, 'ir.model.data',
      [['module', '=', module], ['name', '=', name], ['model', '=', 'res.groups']],
      ['res_id'], 1
    ).catch(() => []);
    return recs.length > 0 ? recs[0].res_id : null;
  }

  async function ensureRule(name, modelName, groupModule, groupName, perms) {
    const modelId = await getModelId(modelName);
    const groupId = await getGroupId(groupModule, groupName);
    if (!modelId || !groupId) {
      console.log(`[access] Skip "${name}": model=${modelId} group=${groupId}`);
      return;
    }
    const existing = await apiSearchRead(
      request, 'ir.model.access',
      [['model_id', '=', modelId], ['group_id', '=', groupId]], ['id'], 1
    ).catch(() => []);
    if (existing.length === 0) {
      const id = await apiCreate(request, 'ir.model.access', {
        name,
        model_id: modelId,
        group_id: groupId,
        perm_read:   perms.read   || false,
        perm_write:  perms.write  || false,
        perm_create: perms.create || false,
        perm_unlink: perms.unlink || false,
      }).catch(e => { console.warn(`[access] FAILED "${name}":`, e.message); return null; });
      if (id) console.log(`[access] Created: "${name}" (id=${id})`);
    } else {
      console.log(`[access] Already exists: "${name}"`);
    }
  }

  // Règles issues de ir.model.access.csv (non chargées si module non upgradé)
  await ensureRule('nurse procedure read/write',
    'acs.patient.procedure', 'acs_hms', 'group_hms_nurse',
    { read: true, write: true });

  await ensureRule('dialysis absence receptionist',
    'acs.dialysis.absence', 'acs_hms', 'group_hms_receptionist',
    { read: true, write: true, create: true, unlink: true });

  await ensureRule('dialysis absence physician',
    'acs.dialysis.absence', 'acs_hms', 'group_hms_doctor',
    { read: true, write: true });

  await ensureRule('dialysis absence nurse',
    'acs.dialysis.absence', 'acs_hms', 'group_hms_nurse',
    { read: true });

  await ensureRule('dialysis waitlist receptionist',
    'acs.dialysis.waitlist', 'acs_hms', 'group_hms_receptionist',
    { read: true, write: true, create: true, unlink: true });

  await ensureRule('dialysis waitlist physician',
    'acs.dialysis.waitlist', 'acs_hms', 'group_hms_doctor',
    { read: true, write: true });

  await ensureRule('dialysis waitlist nurse',
    'acs.dialysis.waitlist', 'acs_hms', 'group_hms_nurse',
    { read: true });

  await ensureRule('session reschedule receptionist',
    'dialysis.session.reschedule', 'acs_hms', 'group_hms_receptionist',
    { read: true, write: true, create: true, unlink: true });

  await ensureRule('session reschedule nurse',
    'dialysis.session.reschedule', 'acs_hms', 'group_hms_nurse',
    { read: true, write: true, create: true, unlink: true });

  // Prescription order pour le médecin (group_hms_doctor)
  await ensureRule('prescription order doctor',
    'prescription.order', 'acs_hms', 'group_hms_doctor',
    { read: true, write: true, create: true, unlink: false });

  // Bilans biologiques pour le médecin
  await ensureRule('nephro bilan doctor',
    'acs.nephro.bilan', 'acs_hms', 'group_hms_doctor',
    { read: true, write: true, create: true, unlink: false });

  // Waitlist pour la secrétaire (accès complet)
  await ensureRule('nephro bilan receptionist',
    'acs.nephro.bilan', 'acs_hms', 'group_hms_receptionist',
    { read: true });
}

// ===========================================================================
// 0. SETUP — Droits d'accès + données de base + patient Moussa Konaté
// ===========================================================================
test.describe('Setup — Données et droits', () => {

  test('setup_01 — Droits d\'accès + patient Moussa Konaté + données complètes', async ({ request }) => {
    await loginApi(request, 'admin', 'admin');

    // -----------------------------------------------------------------------
    // 1. Créer les règles d'accès manquantes
    // -----------------------------------------------------------------------
    await ensureAccessRules(request);

    // -----------------------------------------------------------------------
    // 2. CORRECTIF BUG : Ajouter le département Néphro (id=3) aux utilisateurs
    //    pour que la règle "Departments Patient Procedure" laisse passer les
    //    procédures avec department_id = 3.
    // -----------------------------------------------------------------------
    await apiWrite(request, 'res.users', [12, 13, 14, 15], {
      department_ids: [[4, 3]],
    }).catch(e => console.warn('[setup] department_ids write failed:', e.message));
    console.log('[setup] department_ids (id=3) ajouté aux utilisateurs 12, 13, 14, 15');

    // -----------------------------------------------------------------------
    // 2b. CORRECTIF DISCUSS : Désactiver OdooBot + dépinner les canaux Discuss
    //     pour éviter la redirection automatique vers /odoo/discuss après login.
    // -----------------------------------------------------------------------
    const roleUsers = [
      { id: 12, key: 'secretaire', homeActionId: 489 },
      { id: 13, key: 'medecin',    homeActionId: 489 },
      { id: 14, key: 'infirmiere', homeActionId: 588 },
      { id: 15, key: 'facturation', homeActionId: 581 },
    ];

    // Récupérer le dernier message du canal "general"
    const generalCh = await apiSearchRead(
      request, 'discuss.channel', [['name', '=', 'general']], ['id'], 1
    ).catch(() => []);
    const chId = generalCh.length > 0 ? generalCh[0].id : null;
    const lastMsgs = chId ? await apiSearchRead(
      request, 'mail.message',
      [['res_id', '=', chId], ['model', '=', 'discuss.channel']],
      ['id'], 1
    ).catch(() => []) : [];
    const lastMsgId = lastMsgs.length > 0 ? lastMsgs[0].id : null;

    for (const u of roleUsers) {
      // Désactiver OdooBot
      await apiWrite(request, 'res.users', [u.id], { odoobot_state: 'disabled' }).catch(() => {});
      // Assurer l'action d'accueil
      await apiWrite(request, 'res.users', [u.id], { action_id: u.homeActionId }).catch(() => {});

      // Marquer general comme lu (évite le badge Discuss qui déclenche la redirection)
      if (chId && lastMsgId) {
        const members = await apiSearchRead(
          request, 'discuss.channel.member',
          [['channel_id', '=', chId], ['partner_id.user_ids', 'in', [u.id]]],
          ['id'], 1
        ).catch(() => []);
        if (members.length > 0) {
          await apiWrite(request, 'discuss.channel.member', [members[0].id], {
            seen_message_id: lastMsgId,
            new_message_separator: lastMsgId + 1,
          }).catch(() => {});
        }
      }

      // Dépinner les canaux Discuss (is_pinned = false via unpin_dt)
      const userRec = await apiRead(request, 'res.users', [u.id], ['partner_id']).catch(() => []);
      if (userRec.length > 0) {
        const partnerId = Array.isArray(userRec[0].partner_id) ? userRec[0].partner_id[0] : userRec[0].partner_id;
        if (partnerId) {
          const allMembers = await apiSearchRead(
            request, 'discuss.channel.member', [['partner_id', '=', partnerId]], ['id'], 20
          ).catch(() => []);
          if (allMembers.length > 0) {
            const memberIds = allMembers.map(m => m.id);
            await apiWrite(request, 'discuss.channel.member', memberIds, {
              unpin_dt: '2099-12-31 00:00:00',
            }).catch(() => {});
          }
        }
      }
      console.log(`[setup] Discuss fix appliqué pour user ${u.id} (${u.key})`);
    }

    // -----------------------------------------------------------------------
    // 3. Assigner l'infirmière au planning E2E (schedule_id = 4)
    // -----------------------------------------------------------------------
    const schedId = 4;
    const nurseUid = 14;
    await apiWrite(request, 'acs.nephrology.schedule', [schedId], {
      nurse_ids: [[4, nurseUid]],
    }).catch(e => console.warn('[setup] nurse_ids write failed:', e.message));
    console.log(`[setup] Nurse (uid=${nurseUid}) assignée au planning id=${schedId}`);

    // -----------------------------------------------------------------------
    // 4. Créer (ou trouver) le patient Moussa Konaté
    // -----------------------------------------------------------------------
    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    const yesterday = (() => {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    })();

    let patientId = null;
    let partnerId = null;

    // Vérifier si Moussa Konaté existe déjà
    const existPatient = await apiSearchRead(
      request, 'hms.patient', [['name', '=', 'Moussa Konaté']], ['id', 'partner_id'], 1
    ).catch(() => []);

    if (existPatient.length > 0) {
      patientId = existPatient[0].id;
      partnerId = Array.isArray(existPatient[0].partner_id)
        ? existPatient[0].partner_id[0] : existPatient[0].partner_id;
      console.log(`[setup] Moussa Konaté existant: patient_id=${patientId} partner_id=${partnerId}`);
    } else {
      // Créer via le modèle hms.patient (les champs partner sont gérés via le modèle)
      patientId = await apiCreate(request, 'hms.patient', {
        name: 'Moussa Konaté',
        birthday: '1975-03-15',
        gender: 'male',
        blood_group: 'A+',
        email: 'moussa.konate@example.com',
        phone: '+221771234567',
        street: 'Quartier Escale',
        city: 'Thiès',
        country_id: 204,  // Senegal
        nephrology_care: true,
      }).catch(e => { console.warn('[setup] patient create failed:', e.message); return null; });

      if (patientId) {
        const newPat = await apiSearchRead(
          request, 'hms.patient', [['id', '=', patientId]], ['id', 'partner_id'], 1
        ).catch(() => []);
        partnerId = newPat.length > 0 && Array.isArray(newPat[0].partner_id)
          ? newPat[0].partner_id[0] : null;
        console.log(`[setup] Moussa Konaté créé: patient_id=${patientId} partner_id=${partnerId}`);
      }
    }

    if (!patientId) {
      console.warn('[setup] ERREUR: impossible de créer/trouver le patient Moussa Konaté');
      return;
    }

    // -----------------------------------------------------------------------
    // 5. Procédure "hémodialyse" de référence pour Moussa
    //    (acs.patient.hemodialysis n'existe pas dans cette instance — on utilise
    //     acs.patient.procedure comme prescription de référence)
    // -----------------------------------------------------------------------
    // Le modèle acs.patient.hemodialysis n'est pas installé ; la prescription
    // de dialyse est représentée par une acs.patient.procedure de produit 15.
    // On prépare directement les procédures dans la section 7.
    const hemodialysisId = null; // placeholder — pas de modèle dédié

    // -----------------------------------------------------------------------
    // 6. Créer 3 rendez-vous (hms.appointment) pour Moussa
    // -----------------------------------------------------------------------
    let appointmentId = null;
    const existAppts = await apiSearchRead(
      request, 'hms.appointment', [['patient_id', '=', patientId]], ['id'], 3
    ).catch(() => []);

    if (existAppts.length >= 1) {
      appointmentId = existAppts[0].id;
      console.log(`[setup] ${existAppts.length} rendez-vous existant(s), premier id=${appointmentId}`);
    } else {
      // Rendez-vous passé (done)
      const apptPast = await apiCreate(request, 'hms.appointment', {
        patient_id: patientId,
        date: `${yesterday} 09:00:00`,
        date_end: `${yesterday} 10:00:00`,
        state: 'done',
        department_id: 3,
      }).catch(e => { console.warn('[setup] appt past create failed:', e.message); return null; });

      // Rendez-vous aujourd'hui (confirm)
      appointmentId = await apiCreate(request, 'hms.appointment', {
        patient_id: patientId,
        date: `${today} 10:00:00`,
        date_end: `${today} 11:00:00`,
        state: 'confirm',
        department_id: 3,
      }).catch(e => { console.warn('[setup] appt today create failed:', e.message); return null; });

      // Rendez-vous futur (draft)
      const futureDate = (() => {
        const d = new Date(now);
        d.setDate(d.getDate() + 7);
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      })();
      await apiCreate(request, 'hms.appointment', {
        patient_id: patientId,
        date: `${futureDate} 10:00:00`,
        date_end: `${futureDate} 11:00:00`,
        state: 'draft',
        department_id: 3,
      }).catch(e => { console.warn('[setup] appt future create failed:', e.message); return null; });

      console.log(`[setup] 3 rendez-vous créés, rendez-vous principal id=${appointmentId}`);
    }

    // -----------------------------------------------------------------------
    // 7. Créer 2 procédures pour Moussa (une scheduled aujourd'hui, une done hier)
    // -----------------------------------------------------------------------
    let procedureId = null;
    const existProcs = await apiSearchRead(
      request, 'acs.patient.procedure',
      [['patient_id', '=', patientId]], ['id', 'state', 'date'], 5
    ).catch(() => []);

    const hasToday = existProcs.some(p => p.date && p.date.startsWith(today));
    const hasYesterday = existProcs.some(p => p.date && p.date.startsWith(yesterday));

    // product_id=15 (Séance de dialyse E2E) est le produit procédure de dialyse
    const productId = 15;

    if (!hasToday) {
      const procTodayId = await apiCreate(request, 'acs.patient.procedure', {
        patient_id: patientId,
        product_id: productId,
        date: `${today} 08:00:00`,
        department_id: 3,
        nephrology_schedule_ids: [[4, schedId]],
      }).catch(e => { console.warn('[setup] proc today create failed:', e.message); return null; });
      if (procTodayId) {
        procedureId = procTodayId;
        console.log(`[setup] Procédure scheduled aujourd'hui créée: id=${procTodayId}`);
      }
    } else {
      procedureId = existProcs.find(p => p.date && p.date.startsWith(today))?.id;
      console.log(`[setup] Procédure aujourd'hui existante: id=${procedureId}`);
    }

    if (!hasYesterday) {
      const procYestId = await apiCreate(request, 'acs.patient.procedure', {
        patient_id: patientId,
        product_id: productId,
        date: `${yesterday} 08:00:00`,
        department_id: 3,
        nephrology_schedule_ids: [[4, schedId]],
        state: 'done',
      }).catch(e => { console.warn('[setup] proc yesterday create failed:', e.message); return null; });
      if (procYestId) console.log(`[setup] Procédure done hier créée: id=${procYestId}`);
    }

    // Procédure "done" aujourd'hui pour le bouton "Voir" dans le dashboard infirmière (inf_06)
    const hasTodayDone = existProcs.some(p => p.date && p.date.startsWith(today) && p.state === 'done');
    if (!hasTodayDone) {
      const procDoneTodayId = await apiCreate(request, 'acs.patient.procedure', {
        patient_id: patientId,
        product_id: productId,
        date: `${today} 12:00:00`,
        department_id: 3,
        nephrology_schedule_ids: [[4, schedId]],
        state: 'done',
        departure_weight: 70.0,
        global_tolerance: 'good',
      }).catch(e => { console.warn('[setup] proc done today create failed:', e.message); return null; });
      if (procDoneTodayId) console.log(`[setup] Procédure done aujourd'hui créée: id=${procDoneTodayId}`);
    }

    // Fallback: utiliser la première procédure existante
    if (!procedureId && existProcs.length > 0) {
      procedureId = existProcs[0].id;
    }

    // S'assurer que la procédure du jour a le bon schedule et le bon department
    if (procedureId) {
      await apiWrite(request, 'acs.patient.procedure', [procedureId], {
        nephrology_schedule_ids: [[4, schedId]],
        department_id: 3,
      }).catch(() => null);
    }

    // -----------------------------------------------------------------------
    // 8. Créer bilans biologiques pré et post dialyse
    // -----------------------------------------------------------------------
    let bilanPreId = null;
    let bilanPostId = null;

    const existBilans = await apiSearchRead(
      request, 'acs.nephro.bilan', [['patient_id', '=', patientId]], ['id', 'bilan_type', 'urea_post'], 4
    ).catch(() => []);

    const bilanPre = existBilans.find(b => !b.urea_post);
    const bilanPost = existBilans.find(b => b.urea_post);

    if (bilanPre) {
      bilanPreId = bilanPre.id;
    } else {
      bilanPreId = await apiCreate(request, 'acs.nephro.bilan', {
        patient_id: patientId,
        bilan_type: 'monthly',
        exam_date: `${today} 07:30:00`,
        hemoglobin: 9.5,
        creatinine: 850.0,
        urea_pre: 18.5,
      }).catch(e => { console.warn('[setup] bilan pre create failed:', e.message); return null; });
      if (bilanPreId) console.log(`[setup] Bilan pré-dialyse créé: id=${bilanPreId}`);
    }

    if (bilanPost) {
      bilanPostId = bilanPost.id;
    } else {
      bilanPostId = await apiCreate(request, 'acs.nephro.bilan', {
        patient_id: patientId,
        bilan_type: 'punctual',
        exam_date: `${yesterday} 12:00:00`,
        urea_post: 6.5,
        urea_pre: 18.5,
        creatinine: 780.0,
        hemoglobin: 9.2,
      }).catch(e => { console.warn('[setup] bilan post create failed:', e.message); return null; });
      if (bilanPostId) console.log(`[setup] Bilan post-dialyse créé: id=${bilanPostId}`);
    }

    // -----------------------------------------------------------------------
    // 9. Créer ordonnance médicamenteuse (prescription.order)
    //    Lier au médecin (user_id=13) via hms.physician pour que le médecin
    //    puisse la voir (règle "Physician's Own Prescription" + group 64).
    // -----------------------------------------------------------------------
    // Trouver ou créer le physician pour le médecin (user_id=13)
    let physicianId = null;
    const existPhysician = await apiSearchRead(
      request, 'hms.physician', [['user_id', '=', 13]], ['id'], 1
    ).catch(() => []);
    if (existPhysician.length > 0) {
      physicianId = existPhysician[0].id;
    } else {
      physicianId = await apiCreate(request, 'hms.physician', {
        name: 'Dr. Médecin Néphro E2E',
        user_id: 13,
      }).catch(e => { console.warn('[setup] physician create failed:', e.message); return null; });
      if (physicianId) console.log(`[setup] Médecin créé: physician_id=${physicianId}`);
    }

    let prescriptionId = null;
    const existPresc = await apiSearchRead(
      request, 'prescription.order', [['patient_id', '=', patientId]], ['id'], 1
    ).catch(() => []);

    if (existPresc.length > 0) {
      prescriptionId = existPresc[0].id;
      // S'assurer que le physician est bien lié pour que le médecin puisse voir
      if (physicianId) {
        await apiWrite(request, 'prescription.order', [prescriptionId], {
          physician_id: physicianId,
        }).catch(() => null);
      }
      console.log(`[setup] Ordonnance existante: id=${prescriptionId}`);
    } else {
      prescriptionId = await apiCreate(request, 'prescription.order', {
        patient_id: patientId,
        physician_id: physicianId || 1,
        prescription_date: `${today} 08:00:00`,
      }).catch(e => { console.warn('[setup] prescription create failed:', e.message); return null; });
      if (prescriptionId) console.log(`[setup] Ordonnance créée: id=${prescriptionId}`);
    }

    // Note: le groupe 65 (Doctor) implique le groupe 64 (Jr Doctor) via implied_ids.
    // Donc le médecin (user 13) hérite de la règle ir.rule "Physician's Own Prescription"
    // qui filtre sur physician_id.user_id = user.id.

    // -----------------------------------------------------------------------
    // 10. Créer entrée liste d'attente (acs.dialysis.waitlist)
    // -----------------------------------------------------------------------
    let waitingListId = null;
    const existWL = await apiSearchRead(
      request, 'acs.dialysis.waitlist', [['patient_id', '=', patientId]], ['id'], 1
    ).catch(() => []);

    if (existWL.length > 0) {
      waitingListId = existWL[0].id;
      console.log(`[setup] Liste d'attente existante: id=${waitingListId}`);
    } else {
      waitingListId = await apiCreate(request, 'acs.dialysis.waitlist', {
        patient_id: patientId,
        request_date: today,
        schedule_id: schedId,
        notes: 'Patient en attente de place — IRC stade 5, hémodialyse urgente',
      }).catch(e => { console.warn('[setup] waitlist create failed:', e.message); return null; });
      if (waitingListId) console.log(`[setup] Liste d'attente créée: id=${waitingListId}`);
    }

    // -----------------------------------------------------------------------
    // 11. Sauvegarder tous les IDs dans state.json
    // -----------------------------------------------------------------------
    updateState({
      patient_id: patientId,
      partner_id: partnerId,
      hemodialysis_id: hemodialysisId,
      appointment_id: appointmentId,
      procedure_id: procedureId,
      bilan_pre_id: bilanPreId,
      bilan_post_id: bilanPostId,
      prescription_id: prescriptionId,
      waiting_list_entry_id: waitingListId,
      moussa_patient_id: patientId,
      moussa_partner_id: partnerId,
    });

    console.log('[setup] ✓ Setup complet pour Moussa Konaté');
    console.log(`  patient_id=${patientId}, partner_id=${partnerId}`);
    console.log(`  hemodialysis_id=${hemodialysisId}`);
    console.log(`  appointment_id=${appointmentId}, procedure_id=${procedureId}`);
    console.log(`  bilan_pre_id=${bilanPreId}, bilan_post_id=${bilanPostId}`);
    console.log(`  prescription_id=${prescriptionId}, waiting_list_id=${waitingListId}`);
  });

});

// ===========================================================================
// 1. SECRÉTAIRE
// ===========================================================================
test.describe('Doc — Secrétaire', () => {

  test('sec_01 — Fiche patient (inscription)', async ({ page, request }) => {
    const state = readState();
    // Naviguer directement vers la fiche du patient en lecture
    await loginUI(page, 'secretaire@nephro.test', 'Nephro2024!');
    // loginUI → /odoo/almightyhms-patient (kanban)
    await page.waitForTimeout(1000);

    // Naviguer directement vers le formulaire patient
    await page.goto(`/odoo/almightyhms-patient/${state.patient_id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.o_form_view', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    await snap(page, 'sec_01_inscription');
  });

  test('sec_02 — Liste d\'attente néphro', async ({ page, request }) => {
    const state = readState();
    await loginApi(request, 'admin', 'admin');

    // Trouver l'action de la liste d'attente
    const wlActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.dialysis.waitlist']], ['id'], 1
    ).catch(() => []);

    await loginUI(page, 'secretaire@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(800);

    if (wlActions.length > 0 && state.waiting_list_entry_id) {
      await page.goto(
        `/odoo/action-${wlActions[0].id}/${state.waiting_list_entry_id}`,
        { waitUntil: 'domcontentloaded' }
      );
    } else if (wlActions.length > 0) {
      await page.goto(`/odoo/action-${wlActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.o_list_view, .o_form_view', { timeout: 8000 }).catch(() => {});
      await openFirstRow(page);
    } else {
      // Fallback menu
      await openNephroMenu(page);
      const found = await clickMenuSection(page, "Liste d'attente");
      if (!found) await clickMenuSection(page, 'Waitlist');
      await openFirstRow(page);
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    await snap(page, 'sec_02_liste_attente');
  });

  test('sec_03 — Rendez-vous patient', async ({ page, request }) => {
    const state = readState();
    await loginApi(request, 'admin', 'admin');

    // Trouver l'action des rendez-vous
    const apptActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'hms.appointment']], ['id'], 1
    ).catch(() => []);

    await loginUI(page, 'secretaire@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(800);

    if (apptActions.length > 0 && state.appointment_id) {
      await page.goto(
        `/odoo/action-${apptActions[0].id}/${state.appointment_id}`,
        { waitUntil: 'domcontentloaded' }
      );
      await page.waitForSelector('.o_form_view', { timeout: 8000 }).catch(() => {});
    } else if (apptActions.length > 0) {
      await page.goto(`/odoo/action-${apptActions[0].id}`, { waitUntil: 'domcontentloaded' });
      await openFirstRow(page);
    } else {
      await openNephroMenu(page);
      const found = await clickMenuSection(page, 'Rendez-vous');
      if (!found) await clickMenuSection(page, 'Appointments');
      await openFirstRow(page);
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
    await snap(page, 'sec_03_rendez_vous');
  });

});

// ===========================================================================
// 2. MÉDECIN
// ===========================================================================
test.describe('Doc — Médecin', () => {

  test('med_01 — Dossier médical patient', async ({ page, request }) => {
    const state = readState();
    await loginUI(page, 'medecin@nephro.test', 'Nephro2024!');
    // Naviguer directement vers la fiche du patient
    await page.goto(`/odoo/almightyhms-patient/${state.patient_id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.o_form_view', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);

    // Cliquer sur l'onglet Néphrologie / informations médicales
    const nephroTab = page.locator(
      '.o_notebook .nav-link:has-text("Néphro"), .o_notebook .nav-link:has-text("Médicale"), ' +
      '.o_notebook .nav-link:has-text("Medical")'
    ).first();
    if (await nephroTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nephroTab.click();
      await page.waitForTimeout(600);
    }
    await snap(page, 'med_01_dossier');
  });

  test('med_02 — Prescription hémodialyse', async ({ page, request }) => {
    const state = readState();
    await loginApi(request, 'admin', 'admin');

    // S'assurer qu'il existe au moins une procédure de dialyse pour le patient
    const procRec = await apiSearchRead(
      request, 'acs.patient.procedure', [['patient_id', '=', state.patient_id]], ['id'], 1
    ).catch(() => []);
    if (procRec.length === 0) {
      await apiCreate(request, 'acs.patient.procedure', {
        patient_id: state.patient_id,
        product_id: state.config?.product_id || 15,
        department_id: state.config?.department_id || 3,
        nephrology_schedule_ids: [[4, state.config?.schedule_id || 4]],
      }).catch(e => console.warn('[med_02] proc create failed:', e.message));
    }

    await loginUI(page, 'medecin@nephro.test', 'Nephro2024!');
    // Naviguer directement vers la fiche du patient
    await page.goto(`/odoo/almightyhms-patient/${state.patient_id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.o_form_view', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(800);

    // Onglet Hémodialyse / Dialyse / Procédures dans la fiche patient
    const hemoTab = page.locator(
      '.o_notebook .nav-link:has-text("Hémodialyse"), .o_notebook .nav-link:has-text("Dialyse"), ' +
      '.o_notebook .nav-link:has-text("Procédure"), .o_notebook .nav-link:has-text("Procedure")'
    ).first();
    if (await hemoTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await hemoTab.click();
      await page.waitForTimeout(800);
      // Ouvrir le premier enregistrement
      const hdRow = page.locator('.o_field_one2many .o_data_row').first();
      if (await hdRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await hdRow.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(800);
      }
    }
    await snap(page, 'med_02_hemodialyse');
  });

  test('med_03 — Ordonnance médicamenteuse', async ({ page, request }) => {
    const state = readState();
    await loginApi(request, 'admin', 'admin');

    // S'assurer qu'il y a une ordonnance pour Moussa
    let prescId = state.prescription_id;
    if (!prescId) {
      const prescRec = await apiSearchRead(
        request, 'prescription.order', [['patient_id', '=', state.patient_id]], ['id'], 1
      ).catch(() => []);
      prescId = prescRec.length > 0 ? prescRec[0].id : null;
    }

    // Trouver l'action des ordonnances
    const prescActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'prescription.order']], ['id'], 1
    ).catch(() => []);
    const prescActionId = prescActions.length > 0 ? prescActions[0].id : 532;

    await loginUI(page, 'medecin@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(800);

    if (prescId) {
      await page.goto(`/odoo/action-${prescActionId}/${prescId}`, { waitUntil: 'domcontentloaded' });
    } else {
      await page.goto(`/odoo/action-${prescActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.o_list_view', { timeout: 6000 }).catch(() => {});
      await openFirstRow(page);
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.o_form_view, .o_list_view', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    await snap(page, 'med_03_ordonnance');
  });

  test('med_04 — Bilan biologique pré-dialyse', async ({ page, request }) => {
    const state = readState();
    await loginApi(request, 'admin', 'admin');

    // S'assurer qu'il y a un bilan pré pour Moussa
    const bilanRec = await apiSearchRead(
      request, 'acs.nephro.bilan', [['patient_id', '=', state.patient_id]], ['id', 'bilan_type'], 2
    ).catch(() => []);

    let bilanPreId = state.bilan_pre_id;
    if (bilanRec.length === 0) {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const dt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ` +
                 `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
      bilanPreId = await apiCreate(request, 'acs.nephro.bilan', {
        patient_id: state.patient_id, bilan_type: 'monthly',
        exam_date: dt, hemoglobin: 9.5, creatinine: 850.0, urea_pre: 18.5,
      }).catch(() => null);
    } else if (!bilanPreId && bilanRec.length > 0) {
      bilanPreId = bilanRec[0].id;
    }

    // Trouver l'action Bilans Biologiques (id=573 connu, mais chercher dynamiquement)
    const bilanActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.nephro.bilan']], ['id'], 1
    ).catch(() => []);
    const bilanActionId = bilanActions.length > 0 ? bilanActions[0].id : 573;

    await loginUI(page, 'medecin@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(800);

    // Naviguer directement vers le bilan via l'action
    if (bilanPreId) {
      await page.goto(`/odoo/action-${bilanActionId}/${bilanPreId}`, { waitUntil: 'domcontentloaded' });
    } else {
      await page.goto(`/odoo/action-${bilanActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.o_list_view', { timeout: 6000 }).catch(() => {});
      await openFirstRow(page);
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.o_form_view, .o_list_view', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    await snap(page, 'med_04_bilan_pre');
  });

  test('med_05 — Dashboard médecin vue grille', async ({ page, request }) => {
    await loginApi(request, 'medecin@nephro.test', 'Nephro2024!');
    await loginUI(page, 'medecin@nephro.test', 'Nephro2024!');
    await goToDoctorDashboard(page, request);

    // Onglet Grille (premier par défaut)
    const gridTab = page.locator(
      '[data-tab="grid"], button:has-text("Grille"), .nav-link:has-text("Grille")'
    ).first();
    if (await gridTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await gridTab.click();
      await page.waitForTimeout(800);
    }
    await snap(page, 'med_05_dashboard_grille');
  });

  test('med_06 — Dashboard médecin vue liste', async ({ page, request }) => {
    await loginApi(request, 'medecin@nephro.test', 'Nephro2024!');
    await loginUI(page, 'medecin@nephro.test', 'Nephro2024!');
    await goToDoctorDashboard(page, request);

    const listTab = page.locator(
      '[data-tab="list"], button:has-text("Liste"), .nav-link:has-text("Liste")'
    ).first();
    if (await listTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await listTab.click();
      await page.waitForTimeout(800);
    }
    await snap(page, 'med_06_dashboard_liste');
  });

  test('med_07 — Dashboard médecin vue statistiques', async ({ page, request }) => {
    await loginApi(request, 'medecin@nephro.test', 'Nephro2024!');
    await loginUI(page, 'medecin@nephro.test', 'Nephro2024!');
    await goToDoctorDashboard(page, request);

    const statsTab = page.locator(
      '[data-tab="stats"], button:has-text("Stats"), .nav-link:has-text("Stats"), .nav-link:has-text("Statistiques")'
    ).first();
    if (await statsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statsTab.click();
      await page.waitForTimeout(800);
    }
    await snap(page, 'med_07_dashboard_stats');
  });

  test('med_08 — Bilan biologique post-dialyse', async ({ page, request }) => {
    const state = readState();
    await loginApi(request, 'admin', 'admin');

    // Trouver le bilan post (avec urea_post renseigné)
    const bilanRec = await apiSearchRead(
      request, 'acs.nephro.bilan',
      [['patient_id', '=', state.patient_id], ['urea_post', '!=', false]],
      ['id'], 1
    ).catch(() => []);

    let bilanPostId = state.bilan_post_id;
    if (bilanRec.length === 0 && !bilanPostId) {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const dt = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ` +
                 `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
      bilanPostId = await apiCreate(request, 'acs.nephro.bilan', {
        patient_id: state.patient_id, bilan_type: 'punctual',
        exam_date: dt, urea_post: 6.5, urea_pre: 18.5, creatinine: 780.0,
      }).catch(() => null);
    } else if (bilanRec.length > 0) {
      bilanPostId = bilanRec[0].id;
    }

    // Trouver l'action Bilans Biologiques
    const bilanActions = await apiSearchRead(
      request, 'ir.actions.act_window',
      [['res_model', '=', 'acs.nephro.bilan']], ['id'], 1
    ).catch(() => []);
    const bilanActionId = bilanActions.length > 0 ? bilanActions[0].id : 573;

    await loginUI(page, 'medecin@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(800);

    if (bilanPostId) {
      await page.goto(`/odoo/action-${bilanActionId}/${bilanPostId}`, { waitUntil: 'domcontentloaded' });
    } else {
      await page.goto(`/odoo/action-${bilanActionId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.o_list_view', { timeout: 6000 }).catch(() => {});
      await openFirstRow(page);
    }
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('.o_form_view, .o_list_view', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    await snap(page, 'med_08_bilan_post');
  });

});

// ===========================================================================
// 3. INFIRMIÈRE — toute navigation via le dashboard OWL (action 588)
// ===========================================================================
test.describe('Doc — Infirmière', () => {

  test('inf_01 — Dashboard infirmière (liste patients)', async ({ page, request }) => {
    await loginApi(request, 'infirmiere@nephro.test', 'Nephro2024!');
    await loginUI(page, 'infirmiere@nephro.test', 'Nephro2024!');
    // loginUI → /odoo/action-588 directement
    await page.waitForTimeout(2500);
    await snap(page, 'inf_01_liste_patients');
  });

  // Helper : ouvrir la session form en cliquant Démarrer / Reprendre / Voir
  async function openSessionForm(page) {
    // Priorité 1 : patient "En attente" (scheduled) → Démarrer
    const startBtn = page.locator('button:has-text("Démarrer")').first();
    if (await startBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await startBtn.click();
      await page.waitForTimeout(2000);
      return 'started';
    }
    // Priorité 2 : patient "En cours" (running) → Reprendre
    const resumeBtn = page.locator('button:has-text("Reprendre")').first();
    if (await resumeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resumeBtn.click();
      await page.waitForTimeout(2000);
      return 'resumed';
    }
    // Priorité 3 : patient terminé → Voir
    const viewBtn = page.locator('button:has-text("Voir")').first();
    if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(2000);
      return 'view';
    }
    return null;
  }

  test('inf_02 — Fiche de séance (session form)', async ({ page, request }) => {
    await loginApi(request, 'infirmiere@nephro.test', 'Nephro2024!');
    await loginUI(page, 'infirmiere@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(2500);
    await openSessionForm(page);
    await snap(page, 'inf_02_session_form');
  });

  test('inf_03 — Signes vitaux — saisie constantes', async ({ page, request }) => {
    await loginApi(request, 'infirmiere@nephro.test', 'Nephro2024!');
    await loginUI(page, 'infirmiere@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(2500);
    await openSessionForm(page);

    // Pré-remplir les champs signes vitaux pour la capture
    const taInput = page.locator('input[placeholder="120/80"]').first();
    if (await taInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taInput.fill('138/85');
      const fcInput = page.locator('input[placeholder="72"]').first();
      if (await fcInput.isVisible({ timeout: 1000 }).catch(() => false)) await fcInput.fill('82');
      const spo2Input = page.locator('input[placeholder="98"]').first();
      if (await spo2Input.isVisible({ timeout: 1000 }).catch(() => false)) await spo2Input.fill('97');
      const tempInput = page.locator('input[placeholder="37.0"]').first();
      if (await tempInput.isVisible({ timeout: 1000 }).catch(() => false)) await tempInput.fill('37.2');
    }
    await snap(page, 'inf_03_vitaux_debut');
  });

  test('inf_04 — Fin de séance — données de sortie', async ({ page, request }) => {
    await loginApi(request, 'infirmiere@nephro.test', 'Nephro2024!');
    await loginUI(page, 'infirmiere@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(2500);
    const result = await openSessionForm(page);

    if (result && result !== 'view') {
      // Cliquer "Terminer la séance →" pour afficher NurseEndSession
      const endBtn = page.locator('button:has-text("Terminer la séance")').first();
      if (await endBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await endBtn.click();
        await page.waitForTimeout(1500);
        // Pré-remplir poids sortie pour la capture
        const weightInput = page.locator('input[placeholder="ex: 70.5"]').first();
        if (await weightInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await weightInput.fill('70.0');
        }
      }
    }
    await snap(page, 'inf_04_vitaux_cours');
  });

  test('inf_05 — Complication — popup de saisie', async ({ page, request }) => {
    await loginApi(request, 'infirmiere@nephro.test', 'Nephro2024!');
    await loginUI(page, 'infirmiere@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(2500);
    await openSessionForm(page);

    // Cliquer "Signaler une complication" pour ouvrir le popup
    const compBtn = page.locator('button:has-text("Signaler une complication")').first();
    if (await compBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await compBtn.click();
      await page.waitForTimeout(1000);
    }
    await snap(page, 'inf_05_complication');
  });

  test('inf_06 — Séance terminée (vue lecture seule)', async ({ page, request }) => {
    const state = readState();
    const pad = n => String(n).padStart(2, '0');
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

    // Créer une procédure "done" pour aujourd'hui via admin API (pour avoir le bouton "Voir")
    await loginApi(request, 'admin', 'admin');
    const doneProcId = await apiCreate(request, 'acs.patient.procedure', {
      patient_id: state.patient_id || 8,
      product_id: 15,
      date: `${today} 12:00:00`,
      department_id: 3,
      nephrology_schedule_ids: [[4, 4]],
      state: 'done',
      departure_weight: 70.0,
      global_tolerance: 'good',
    }).catch(e => { console.warn('[inf_06] done proc create failed:', e.message); return null; });
    if (doneProcId) console.log(`[inf_06] Procédure done créée: id=${doneProcId}`);

    // Naviguer vers le dashboard infirmière et ouvrir la séance terminée
    await loginApi(request, 'infirmiere@nephro.test', 'Nephro2024!');
    await loginUI(page, 'infirmiere@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(2500);

    // Ouvrir la séance terminée via bouton "Voir"
    const viewBtn = page.locator('button:has-text("Voir")').first();
    if (await viewBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(2000);
    } else {
      await openSessionForm(page);
    }
    await snap(page, 'inf_06_session_terminee');
  });

});

// ===========================================================================
// 4. FACTURATION — brouillon → validée → payée
// Les factures DOIVENT avoir hospital_invoice_type IN ('dialysis_session','dialysis_grouped')
// pour être visibles dans l'action "Factures Dialyse" (action-581) du rôle facturation.
// ===========================================================================
test.describe('Doc — Facturation', () => {

  // Domaine restreint aux factures de dialyse visibles par le rôle facturation
  const DIALYSIS_DOMAIN = [
    ['hospital_invoice_type', 'in', ['dialysis_session', 'dialysis_grouped']],
    ['move_type', '=', 'out_invoice'],
  ];

  // S'assure qu'une facture de dialyse brouillon existe pour le patient Moussa Konaté
  async function ensureDialysisDraftInvoice(request, partnerId, productId) {
    // Chercher une brouillon existante pour Moussa
    const existing = await apiSearchRead(
      request, 'account.move',
      [...DIALYSIS_DOMAIN, ['state', '=', 'draft'], ['partner_id', '=', partnerId]],
      ['id'], 1
    ).catch(() => []);
    if (existing.length > 0) {
      console.log(`[fac] Facture dialyse brouillon existante pour Moussa: id=${existing[0].id}`);
      return existing[0].id;
    }
    // Créer une facture dialyse brouillon
    const newId = await apiCreate(request, 'account.move', {
      move_type: 'out_invoice',
      partner_id: partnerId,
      hospital_invoice_type: 'dialysis_session',
      invoice_line_ids: [[0, 0, { product_id: productId || 15, quantity: 1, price_unit: 15000 }]],
    }).catch(e => { console.warn('[fac] facture create failed:', e.message); return null; });
    if (newId) console.log(`[fac] Facture dialyse brouillon créée pour Moussa: id=${newId}`);
    return newId;
  }

  test('fac_01 — Facture brouillon', async ({ page, request }) => {
    const state = readState();
    await loginApi(request, 'admin', 'admin');

    // S'assurer qu'une facture dialyse brouillon existe pour Moussa Konaté
    let draftId = await ensureDialysisDraftInvoice(
      request, state.partner_id || 25, state.config?.product_id || 15
    );

    // Fallback : toute facture dialyse brouillon
    if (!draftId) {
      const drafts = await apiSearchRead(
        request, 'account.move',
        [...DIALYSIS_DOMAIN, ['state', '=', 'draft']], ['id'], 1
      ).catch(() => []);
      if (drafts.length > 0) draftId = drafts[0].id;
    }

    await loginUI(page, 'facturation@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(1500);  // laisser la page se stabiliser

    if (draftId) {
      // action-581/ID : dans le domaine des factures dialyse
      await page.goto(`/odoo/action-581/${draftId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    } else {
      await page.goto('/odoo/action-581', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await openFirstRow(page);
    }
    await page.waitForSelector('.o_form_view, .o_list_view', { timeout: 10000 }).catch(() => {});
    await snap(page, 'fac_01_brouillon');
  });

  test('fac_02 — Facture validée (comptabilisée)', async ({ page, request }) => {
    const state = readState();
    await loginApi(request, 'admin', 'admin');

    // Chercher une facture dialyse postée non payée
    let postedId = null;
    const posted = await apiSearchRead(
      request, 'account.move',
      [...DIALYSIS_DOMAIN, ['state', '=', 'posted'], ['payment_state', 'in', ['not_paid', 'partial']]],
      ['id'], 1
    ).catch(() => []);

    if (posted.length > 0) {
      postedId = posted[0].id;
      console.log(`[fac] Facture dialyse validée existante: id=${postedId}`);
    } else {
      // Valider la facture brouillon dialyse de Moussa
      const drafts = await apiSearchRead(
        request, 'account.move',
        [...DIALYSIS_DOMAIN, ['state', '=', 'draft'], ['partner_id', '=', state.partner_id || 25]],
        ['id'], 1
      ).catch(() => []);
      if (drafts.length > 0) {
        await rpcCall(request, 'account.move', 'action_post', [[drafts[0].id]]).catch(() => {});
        postedId = drafts[0].id;
        console.log(`[fac] Facture dialyse validée: id=${postedId}`);
      } else {
        // Créer et valider une facture dialyse
        const newId = await ensureDialysisDraftInvoice(
          request, state.partner_id || 25, state.config?.product_id || 15
        );
        if (newId) {
          await rpcCall(request, 'account.move', 'action_post', [[newId]]).catch(() => {});
          postedId = newId;
        }
      }
    }

    await loginUI(page, 'facturation@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(1500);

    if (postedId) {
      await page.goto(`/odoo/action-581/${postedId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    } else {
      await page.goto('/odoo/action-581', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await openFirstRow(page);
    }
    await page.waitForSelector('.o_form_view, .o_list_view', { timeout: 10000 }).catch(() => {});
    await snap(page, 'fac_02_validee');
  });

  test('fac_03 — Facture payée', async ({ page, request }) => {
    const state = readState();
    await loginApi(request, 'admin', 'admin');

    // Chercher une facture dialyse payée
    const paid = await apiSearchRead(
      request, 'account.move',
      [...DIALYSIS_DOMAIN, ['state', '=', 'posted'], ['payment_state', 'in', ['paid', 'in_payment']]],
      ['id'], 1
    ).catch(() => []);

    let paidId = paid.length > 0 ? paid[0].id : null;

    if (!paidId) {
      // Payer la première facture dialyse postée non payée via account.payment + réconciliation
      const postedInv = await apiSearchRead(
        request, 'account.move',
        [...DIALYSIS_DOMAIN, ['state', '=', 'posted'], ['payment_state', 'in', ['not_paid', 'partial']]],
        ['id', 'amount_residual', 'partner_id'], 1
      ).catch(() => []);

      if (postedInv.length > 0) {
        try {
          const now = new Date();
          const pad = n => String(n).padStart(2, '0');
          const payDate = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
          // Chercher un journal bancaire ou de caisse
          const journals = await apiSearchRead(
            request, 'account.journal',
            [['type', 'in', ['bank', 'cash']]], ['id', 'type'], 1
          ).catch(() => []);

          if (journals.length > 0) {
            const invPartnerId = Array.isArray(postedInv[0].partner_id)
              ? postedInv[0].partner_id[0] : postedInv[0].partner_id;
            const payId = await apiCreate(request, 'account.payment', {
              payment_type: 'inbound',
              partner_type: 'customer',
              partner_id: invPartnerId || (state.partner_id || 25),
              amount: postedInv[0].amount_residual,
              journal_id: journals[0].id,
              date: payDate,
            }).catch(() => null);
            if (payId) {
              await rpcCall(request, 'account.payment', 'action_post', [[payId]]).catch(() => {});

              // Réconciliation via account.move.line (méthode robuste)
              const payRec = await apiRead(request, 'account.payment', [payId], ['move_id']).catch(() => []);
              const payMoveId = payRec.length > 0
                ? (Array.isArray(payRec[0].move_id) ? payRec[0].move_id[0] : payRec[0].move_id)
                : null;
              if (payMoveId) {
                // Trouver les lignes "receivable" de la facture et du paiement
                const invLine = await apiSearchRead(
                  request, 'account.move.line',
                  [['move_id', '=', postedInv[0].id], ['account_type', '=', 'asset_receivable']],
                  ['id'], 1
                ).catch(() => []);
                const payLine = await apiSearchRead(
                  request, 'account.move.line',
                  [['move_id', '=', payMoveId], ['account_type', '=', 'asset_receivable']],
                  ['id'], 1
                ).catch(() => []);
                if (invLine.length > 0 && payLine.length > 0) {
                  await rpcCall(request, 'account.move.line', 'reconcile',
                    [[invLine[0].id, payLine[0].id]]
                  ).catch(e => console.warn('[fac] reconcile failed:', e.message));
                }
              }
              paidId = postedInv[0].id;
              console.log(`[fac] Facture dialyse payée: id=${paidId}`);
            }
          }
        } catch (e) {
          console.warn('[fac] Paiement échoué :', e.message);
          paidId = postedInv[0].id;
        }
      }
    }

    // Fallback: utiliser la facture payée du state.json
    if (!paidId && state.invoice_id) {
      paidId = state.invoice_id;
    }

    await loginUI(page, 'facturation@nephro.test', 'Nephro2024!');
    await page.waitForTimeout(1500);

    if (paidId) {
      await page.goto(`/odoo/action-581/${paidId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    } else {
      await page.goto('/odoo/action-581', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await openFirstRow(page);
    }
    await page.waitForSelector('.o_form_view, .o_list_view', { timeout: 10000 }).catch(() => {});
    await snap(page, 'fac_03_payee');
  });

});

// ===========================================================================
// 5. PATIENT PORTAIL
// ===========================================================================
test.describe('Doc — Patient Portail', () => {

  async function loginPortal(page) {
    await page.goto('/web/session/logout', { waitUntil: 'load' }).catch(() => {});
    await page.goto('/web/login', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[name="login"]', { timeout: 15000 });
    await page.fill('input[name="login"]', 'patient@nephro.test');
    await page.fill('input[name="password"]', 'Nephro2024!');
    const form = page.locator('form[action*="/web/login"]');
    await form.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(my|odoo|web)/, { timeout: 30000 });
  }

  async function goPortal(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    if (page.url().includes('/web/login')) {
      await loginPortal(page);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1500);
    }
  }

  test('pat_01 — Tableau de bord portail', async ({ page }) => {
    await loginPortal(page);
    await goPortal(page, '/my/nephro');
    await snap(page, 'pat_01_tableau_de_bord');
  });

  test('pat_02 — Mes séances de dialyse', async ({ page }) => {
    await loginPortal(page);
    await goPortal(page, '/my/seances');
    await snap(page, 'pat_02_mes_seances');
  });

  test('pat_03 — Mes bilans biologiques', async ({ page }) => {
    await loginPortal(page);
    await goPortal(page, '/my/bilans');
    await snap(page, 'pat_03_mes_bilans');
  });

  test('pat_04 — Mes ordonnances', async ({ page }) => {
    await loginPortal(page);
    await goPortal(page, '/my/ordonnances');
    await snap(page, 'pat_04_mes_ordonnances');
  });

  test('pat_05 — Mes rendez-vous', async ({ page }) => {
    await loginPortal(page);
    await goPortal(page, '/my/rdv');
    await snap(page, 'pat_05_mes_rdv');
  });

});
