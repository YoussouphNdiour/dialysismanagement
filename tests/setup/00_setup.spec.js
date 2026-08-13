// @ts-check
/**
 * SETUP E2E — Création des utilisateurs et des données de référence
 *
 * Ce spec est le point d'entrée de toute la suite E2E. Il doit s'exécuter
 * en premier (préfixe 00_) et prépare l'état initial de la base de données :
 *
 *   1. Création/récupération des 5 comptes utilisateurs (secrétaire, médecin,
 *      infirmière, facturation, portail patient)
 *   2. Création/récupération des données de configuration néphro (postes,
 *      plannings, accès vasculaires, dialyseurs, dialysats, produits, tarifs)
 *   3. Résolution du département de néphro existant
 *
 * Idempotence : toutes les opérations utilisent apiFindOrCreate — relancer
 * le setup ne duplique pas les données.
 *
 * Tous les IDs produits sont persistés dans tests/state.json pour être
 * consommés par les specs suivants.
 *
 * Exécution : API uniquement (fixture `request`), pas de browser nécessaire.
 */

const { test, expect } = require('@playwright/test');
const {
  loginApi,
  apiGetXmlId,
  apiCreate,
  apiRead,
  apiWrite,
  apiSearchRead,
  apiFindOrCreate,
} = require('../helpers/api');
const { updateState, readState } = require('../helpers/state');

// ---------------------------------------------------------------------------
// Credentials admin pour le setup
// ---------------------------------------------------------------------------
const ADMIN_LOGIN    = 'admin';
const ADMIN_PASSWORD = 'admin';

// Mot de passe commun pour tous les utilisateurs de test
const TEST_PASSWORD = 'Nephro2024!';

// ---------------------------------------------------------------------------
// Définition des rôles utilisateurs à créer
// ---------------------------------------------------------------------------
const USER_DEFINITIONS = [
  {
    key:      'secretary',
    name:     'Secrétaire Néphro E2E',
    login:    'secretaire@nephro.test',
    // Groupes : réceptionniste HMS + utilisateur HMS base (requis pour voir le menu Patient app)
    // acs_hms_base.group_hms_user → accès à l'app Patient (requis par le menu root id=291)
    groupXmlIds: [
      'acs_hms_base.group_hms_user',
      'acs_hms.group_hms_receptionist',
      'base.group_user',
    ],
    // Action d'accueil : liste patients (évite la redirection vers Discuss au login)
    homeActionId: 489,
  },
  {
    key:      'doctor',
    name:     'Médecin Néphro E2E',
    login:    'medecin@nephro.test',
    // Groupes : docteur HMS + tous les groupes impliqués dans la chaîne
    // Odoo 19 : [6,0,ids] ne résout pas les implied_ids automatiquement,
    // il faut inclure toute la chaîne explicitement :
    // doctor → jr_doctor → nurse + receptionist
    groupXmlIds: [
      'acs_hms_base.group_hms_user',
      'acs_hms.group_hms_doctor',
      'acs_hms.group_hms_jr_doctor',
      'acs_hms.group_hms_nurse',
      'acs_hms.group_hms_receptionist',
      'base.group_user',
    ],
    // Action d'accueil : liste patients /odoo/almightyhms-patient
    // (confirmé par medecin.spec.js : "loginUI laisse le médecin sur /odoo/almightyhms-patient")
    homeActionId: 489,
  },
  {
    key:      'nurse',
    name:     'Infirmière Néphro E2E',
    login:    'infirmiere@nephro.test',
    // Groupes : infirmière HMS + réceptionniste (implied par nurse)
    // Odoo 19 : implied_ids non résolus par [6,0,ids], inclure explicitement
    groupXmlIds: [
      'acs_hms_base.group_hms_user',
      'acs_hms.group_hms_nurse',
      'acs_hms.group_hms_receptionist',
      'base.group_user',
    ],
    // Action d'accueil : Interface Infirmier (dashboard infirmière néphro)
    homeActionId: 588,
  },
  {
    key:      'billing',
    name:     'Facturation Néphro E2E',
    login:    'facturation@nephro.test',
    // Groupes : facturation dialyse + comptabilité factures + utilisateur de base
    groupXmlIds: [
      'acs_hms_base.group_hms_user',
      'acs_hms_nephrology_billing.group_nephrology_billing',
      'account.group_account_invoice',
      'base.group_user',
    ],
    // Action d'accueil : Factures Dialyse
    homeActionId: 581,
  },
  {
    key:      'patient_portal',
    name:     'Patient Portail E2E',
    login:    'patient@nephro.test',
    // Le portail utilise base.group_portal (pas group_user)
    groupXmlIds: ['base.group_portal'],
    // Pas d'action backend pour le portail
    homeActionId: null,
  },
];

// ===========================================================================
// TEST 1 — Création des utilisateurs
// ===========================================================================

test.describe('Setup — Création utilisateurs et données de base', () => {

  // =========================================================================
  test('Étape 1 — Créer ou récupérer les 5 comptes utilisateurs', async ({ request }) => {
    // Authentification en tant qu'admin pour toutes les opérations de setup
    const uid = await loginApi(request, ADMIN_LOGIN, ADMIN_PASSWORD);
    console.log(`[setup] Connecté en tant qu'admin (uid=${uid})`);

    const createdUsers = {};

    for (const userDef of USER_DEFINITIONS) {
      console.log(`\n[setup] Traitement de l'utilisateur : ${userDef.key} (${userDef.login})`);

      try {
        // ----------------------------------------------------------------
        // Résoudre les XML IDs des groupes en ids numériques
        // ----------------------------------------------------------------
        const groupIds = [];
        for (const xmlId of userDef.groupXmlIds) {
          try {
            const gid = await apiGetXmlId(request, xmlId);
            groupIds.push(gid);
            console.log(`  [setup] Groupe "${xmlId}" → id=${gid}`);
          } catch (groupErr) {
            console.warn(`  [setup] AVERTISSEMENT : groupe "${xmlId}" introuvable — ${groupErr.message}`);
            // On continue sans ce groupe plutôt que d'échouer tout le test
          }
        }

        // ----------------------------------------------------------------
        // Vérifier si l'utilisateur existe déjà (idempotence)
        // ----------------------------------------------------------------
        const existingUsers = await apiSearchRead(
          request,
          'res.users',
          [['login', '=', userDef.login]],
          ['id', 'name', 'login'],
          1
        );

        let userId;

        if (existingUsers && existingUsers.length > 0) {
          // L'utilisateur existe déjà : on récupère son id
          userId = existingUsers[0].id;
          console.log(`  [setup] Utilisateur "${userDef.login}" déjà présent (id=${userId})`);
        } else {
          // Odoo 19 : create() n'accepte PAS groups_id — on crée sans groupes d'abord
          const createVals = {
            name:     userDef.name,
            login:    userDef.login,
            password: TEST_PASSWORD,
          };
          userId = await apiCreate(request, 'res.users', createVals);
          console.log(`  [setup] Utilisateur "${userDef.login}" créé (id=${userId})`);
        }

        // Odoo 19 : le champ s'appelle group_ids (pas groups_id)
        if (groupIds.length > 0) {
          await apiWrite(request, 'res.users', [userId], {
            group_ids: [[6, 0, groupIds]],
          });
          console.log(`  [setup] Groupes assignés (group_ids) : [${groupIds.join(', ')}]`);
        }

        // Désactiver OdooBot : évite la redirection automatique vers Discuss après login
        // (odoobot_state='onboarding_emoji' force la redirection vers /odoo/discuss)
        await apiWrite(request, 'res.users', [userId], { odoobot_state: 'disabled' }).catch(() => {});
        console.log(`  [setup] OdooBot désactivé pour l'utilisateur ${userId}`);

        // Définir l'action d'accueil (home_action_id) pour éviter la redirection vers Discuss.
        // Sans cette valeur, _loadDefaultApp() sélectionne le premier menu racine (Discuss,
        // sequence=5) au lieu de l'application métier correspondant au rôle.
        if (userDef.homeActionId) {
          await apiWrite(request, 'res.users', [userId], { action_id: userDef.homeActionId }).catch((e) => {
            console.warn(`  [setup] AVERTISSEMENT action_id non définie pour ${userDef.key} : ${e.message}`);
          });
          console.log(`  [setup] Action d'accueil définie : action_id=${userDef.homeActionId} pour ${userDef.key}`);
        }

        // Marquer tous les messages du canal "general" comme lus pour cet utilisateur.
        // Contexte : message_unread_counter > 0 provoque une RPCError dans compute_patient_progress
        // (accès ir.model.fields sans sudo) → historyBack() → WEBCLIENT:LOAD_DEFAULT_APP
        // → redirection vers Discuss malgré action_id correctement configuré.
        // La vraie cause est le bug sudo() dans patient.py (corrigé), mais on marque
        // le canal comme lu de toute façon pour éviter tout badge Discuss résiduel.
        try {
          const generalCh = await apiSearchRead(
            request, 'discuss.channel', [['name', '=', 'general']], ['id'], 1
          );
          if (generalCh.length > 0) {
            const chId = generalCh[0].id;
            const lastMsgs = await apiSearchRead(
              request, 'mail.message',
              [['res_id', '=', chId], ['model', '=', 'discuss.channel']],
              ['id'], 1
            );
            if (lastMsgs.length > 0) {
              const lastMsgId = lastMsgs[0].id;
              const members = await apiSearchRead(
                request, 'discuss.channel.member',
                [['channel_id', '=', chId], ['partner_id.user_ids', 'in', [userId]]],
                ['id'], 1
              );
              if (members.length > 0) {
                await apiWrite(request, 'discuss.channel.member', [members[0].id], {
                  seen_message_id: lastMsgId,
                  new_message_separator: lastMsgId + 1,
                }).catch(() => {});
                console.log(`  [setup] Canal général marqué comme lu pour ${userDef.key}`);
              }
            }
          }
        } catch(e) {
          // Non bloquant : le bug sudo() dans patient.py est déjà corrigé
          console.warn(`  [setup] AVERTISSEMENT marquage general lu : ${e.message}`);
        }

        // Sauvegarder l'id même si l'assignation de groupes a partiellement échoué
        createdUsers[userDef.key] = userId;
        console.log(`  [setup] ✓ ${userDef.key} prêt (id=${userId})`);

      } catch (err) {
        console.error(`  [setup] ERREUR pour l'utilisateur "${userDef.key}" : ${err.message}`);
        // On note l'échec mais on continue pour créer les autres utilisateurs
        createdUsers[userDef.key] = null;
      }
    }

    // Persister tous les ids utilisateurs dans state.json
    updateState({ users: createdUsers });

    console.log('\n[setup] Utilisateurs persistés dans state.json :');
    console.log(JSON.stringify(createdUsers, null, 2));

    // ----------------------------------------------------------------
    // Dépinner TOUS les canaux discuss pour les utilisateurs de test.
    //
    // Odoo 19 : quand discuss.channel.member.is_pinned = True (ce qui
    // est le cas par défaut car unpin_dt = NULL), le client JS redirige
    // automatiquement vers /odoo/discuss ~2 s après login.
    //
    // Fix : unpin_dt = date très lointaine → is_pinned = False
    //   is_pinned = not unpin_dt or last_interest_dt >= unpin_dt or unread_counter > 0
    //   → not '2099-12-31' = False, 2026 >= 2099 = False → is_pinned = False ✓
    //
    // Note : OdooBot (partner_id=2) n'est pas trouvable via res.users
    // car il est exclu des recherches standard. On dépinne donc tous les
    // channel members de chaque utilisateur de test.
    // ----------------------------------------------------------------
    console.log('\n[setup] Dépinnage des canaux Discuss pour éviter la redirection automatique...');
    for (const [key, userId] of Object.entries(createdUsers)) {
      if (!userId) continue;
      try {
        // Partner de l'utilisateur
        const userRec = await apiRead(request, 'res.users', [userId], ['partner_id']);
        if (!userRec || !userRec.length) continue;
        const pRaw = userRec[0].partner_id;
        const userPartnerId = Array.isArray(pRaw) ? pRaw[0] : pRaw;

        // Tous les channel members de cet utilisateur
        const members = await apiSearchRead(
          request,
          'discuss.channel.member',
          [['partner_id', '=', userPartnerId]],
          ['id'],
          80
        );

        if (!members || !members.length) {
          console.log(`  [setup] Aucun channel member pour ${key} — skip`);
          continue;
        }

        // Dépinner tous les canaux en une seule écriture
        const memberIds = members.map((m) => m.id);
        await apiWrite(request, 'discuss.channel.member', memberIds, {
          unpin_dt: '2099-12-31 23:59:59',
        });
        console.log(
          `  [setup] ✓ ${memberIds.length} canal(aux) dépinné(s) pour ${key}` +
          ` (partner=${userPartnerId}, member ids: ${memberIds.join(', ')})`
        );
      } catch (uErr) {
        console.warn(`  [setup] Dépinnage canaux — erreur pour ${key} : ${uErr.message}`);
      }
    }

    // Vérification finale : au moins les utilisateurs critiques ont été créés
    expect(createdUsers.secretary, 'La secrétaire doit être créée').not.toBeNull();
    expect(createdUsers.doctor,    'Le médecin doit être créé').not.toBeNull();
    expect(createdUsers.nurse,     'L\'infirmière doit être créée').not.toBeNull();
  });

  // =========================================================================
  test('Étape 2 — Créer ou récupérer les données de configuration néphro', async ({ request }) => {
    // Ré-authentification (chaque test a son propre contexte request)
    await loginApi(request, ADMIN_LOGIN, ADMIN_PASSWORD);

    const config = {};

    // -----------------------------------------------------------------------
    // 2.1 — Accès vasculaire
    // -----------------------------------------------------------------------
    try {
      config.vascular_access_id = await apiFindOrCreate(
        request,
        'acs.vascular.access',
        [['name', '=', 'FAV (Fistule artério-veineuse)']],
        { name: 'FAV (Fistule artério-veineuse)' }
      );
      console.log(`[setup] Accès vasculaire → id=${config.vascular_access_id}`);
      expect(config.vascular_access_id).toBeGreaterThan(0);
    } catch (err) {
      console.error(`[setup] ERREUR accès vasculaire : ${err.message}`);
      config.vascular_access_id = null;
    }

    // -----------------------------------------------------------------------
    // 2.2 — Dialyseur
    // -----------------------------------------------------------------------
    try {
      config.dialyzer_id = await apiFindOrCreate(
        request,
        'acs.dialyzer',
        [['name', '=', 'Fresenius FX80']],
        { name: 'Fresenius FX80' }
      );
      console.log(`[setup] Dialyseur → id=${config.dialyzer_id}`);
      expect(config.dialyzer_id).toBeGreaterThan(0);
    } catch (err) {
      console.error(`[setup] ERREUR dialyseur : ${err.message}`);
      config.dialyzer_id = null;
    }

    // -----------------------------------------------------------------------
    // 2.3 — Dialysat
    // -----------------------------------------------------------------------
    try {
      config.dialysate_id = await apiFindOrCreate(
        request,
        'acs.dialysate',
        [['name', '=', 'Dialysat Bicarbonate Standard']],
        { name: 'Dialysat Bicarbonate Standard' }
      );
      console.log(`[setup] Dialysat → id=${config.dialysate_id}`);
      expect(config.dialysate_id).toBeGreaterThan(0);
    } catch (err) {
      console.error(`[setup] ERREUR dialysat : ${err.message}`);
      config.dialysate_id = null;
    }

    // -----------------------------------------------------------------------
    // 2.4 — Poste de dialyse
    // -----------------------------------------------------------------------
    try {
      config.station_id = await apiFindOrCreate(
        request,
        'acs.dialysis.station',
        [['name', '=', 'Poste E2E-01']],
        {
          name:         'Poste E2E-01',
          station_type: 'standard',
        }
      );
      console.log(`[setup] Poste de dialyse → id=${config.station_id}`);
      expect(config.station_id).toBeGreaterThan(0);
    } catch (err) {
      console.error(`[setup] ERREUR poste de dialyse : ${err.message}`);
      config.station_id = null;
    }

    // -----------------------------------------------------------------------
    // 2.5 — Planning de dialyse (nécessite le poste)
    // -----------------------------------------------------------------------
    try {
      config.schedule_id = await apiFindOrCreate(
        request,
        'acs.nephrology.schedule',
        [['name', '=', 'Planning E2E Lundi']],
        {
          name:       'Planning E2E Lundi',
          monday:    true,
          tuesday:   true,
          wednesday: true,
          thursday:  true,
          friday:    true,
          saturday:  true,
          sunday:    true,
          // On relie au poste uniquement s'il a été créé avec succès
          ...(config.station_id ? { station_id: config.station_id } : {}),
        }
      );
      console.log(`[setup] Planning → id=${config.schedule_id}`);
      expect(config.schedule_id).toBeGreaterThan(0);
    } catch (err) {
      console.error(`[setup] ERREUR planning : ${err.message}`);
      config.schedule_id = null;
    }

    // -----------------------------------------------------------------------
    // 2.6 — Département de néphro (doit déjà exister dans la base)
    // -----------------------------------------------------------------------
    try {
      const depts = await apiSearchRead(
        request,
        'hr.department',
        [['department_type', '=', 'nephrology']],
        ['id', 'name'],
        1
      );

      if (depts && depts.length > 0) {
        config.department_id = depts[0].id;
        console.log(`[setup] Département néphro trouvé : "${depts[0].name}" (id=${config.department_id})`);
      } else {
        // Aucun département néphro : on en crée un pour les tests
        console.warn('[setup] Aucun département néphro trouvé — création d\'un département de test');
        config.department_id = await apiFindOrCreate(
          request,
          'hr.department',
          [['name', '=', 'Néphro E2E']],
          {
            name:            'Néphro E2E',
            department_type: 'nephrology',
          }
        );
        console.log(`[setup] Département néphro créé → id=${config.department_id}`);
      }
    } catch (err) {
      console.error(`[setup] ERREUR département néphro : ${err.message}`);
      config.department_id = null;
    }

    // -----------------------------------------------------------------------
    // 2.7 — Produit "Séance de dialyse"
    // -----------------------------------------------------------------------
    try {
      config.product_id = await apiFindOrCreate(
        request,
        'product.product',
        [['name', '=', 'Séance de dialyse E2E']],
        {
          name:                  'Séance de dialyse E2E',
          type:                  'service',
          hospital_product_type: 'procedure',
        }
      );
      console.log(`[setup] Produit dialyse → id=${config.product_id}`);
      expect(config.product_id).toBeGreaterThan(0);
    } catch (err) {
      console.error(`[setup] ERREUR produit dialyse : ${err.message}`);
      config.product_id = null;
    }

    // -----------------------------------------------------------------------
    // 2.8 — Règle tarifaire
    // Nécessite le groupe "Facturation Dialyse" — on l'ajoute temporairement à admin
    // -----------------------------------------------------------------------
    try {
      // Le modèle acs.dialysis.pricing.rule nécessite le groupe "Facturation Dialyse"
      // On utilise les credentials du billing user pour cette opération
      await loginApi(request, 'facturation@nephro.test', 'Nephro2024!');
      config.pricing_rule_id = await apiFindOrCreate(
        request,
        'acs.dialysis.pricing.rule',
        [['name', '=', 'Tarif Standard E2E']],
        {
          name:       'Tarif Standard E2E',
          price_unit: 15000.0,
        }
      );
      // Re-authentification admin pour la suite
      await loginApi(request, ADMIN_LOGIN, ADMIN_PASSWORD);
      console.log(`[setup] Règle tarifaire → id=${config.pricing_rule_id}`);
      expect(config.pricing_rule_id).toBeGreaterThan(0);
    } catch (err) {
      console.error(`[setup] ERREUR règle tarifaire : ${err.message}`);
      config.pricing_rule_id = null;
    }

    // -----------------------------------------------------------------------
    // 2.9 — Type de rendez-vous (optionnel — le modèle peut ne pas exister)
    // -----------------------------------------------------------------------
    config.appointment_type_id = null;
    try {
      // Vérifier que le modèle hms.appointment.type existe dans l'instance
      const modelExists = await apiSearchRead(
        request,
        'ir.model',
        [['model', '=', 'hms.appointment.type']],
        ['id'],
        1
      );

      if (modelExists && modelExists.length > 0) {
        config.appointment_type_id = await apiFindOrCreate(
          request,
          'hms.appointment.type',
          [['name', '=', 'Consultation Néphrologie']],
          { name: 'Consultation Néphrologie' }
        );
        console.log(`[setup] Type RDV → id=${config.appointment_type_id}`);
      } else {
        console.log('[setup] Modèle hms.appointment.type absent — appointment_type_id laissé à null');
      }
    } catch (err) {
      console.warn(`[setup] AVERTISSEMENT type RDV (ignoré) : ${err.message}`);
      config.appointment_type_id = null;
    }

    // -----------------------------------------------------------------------
    // Persistance de toute la config dans state.json
    // -----------------------------------------------------------------------
    updateState({ config });

    console.log('\n[setup] Configuration persistée dans state.json :');
    console.log(JSON.stringify(config, null, 2));

    // Assertions finales sur les données critiques
    expect(config.vascular_access_id, 'L\'accès vasculaire doit être créé').not.toBeNull();
    expect(config.dialyzer_id,        'Le dialyseur doit être créé').not.toBeNull();
    expect(config.dialysate_id,       'Le dialysat doit être créé').not.toBeNull();
    expect(config.station_id,         'Le poste de dialyse doit être créé').not.toBeNull();
    expect(config.schedule_id,        'Le planning doit être créé').not.toBeNull();
    expect(config.product_id,         'Le produit dialyse doit être créé').not.toBeNull();
    expect(config.pricing_rule_id,    'La règle tarifaire doit être créée').not.toBeNull();
  });

  // =========================================================================
  test('Étape 3 — Vérification et rapport de l\'état final', async ({ request }) => {
    // Pas d'opération réseau dans ce test — lecture seule de l'état local
    const state = readState();

    console.log('\n========================================');
    console.log('RAPPORT DE SETUP E2E — ÉTAT FINAL');
    console.log('========================================');

    console.log('\n--- UTILISATEURS ---');
    for (const [role, id] of Object.entries(state.users)) {
      const status = id !== null ? `✓ id=${id}` : '✗ NON CRÉÉ';
      console.log(`  ${role.padEnd(15)} : ${status}`);
    }

    console.log('\n--- CONFIGURATION ---');
    for (const [key, id] of Object.entries(state.config)) {
      const status = id !== null ? `✓ id=${id}` : (key === 'appointment_type_id' ? '~ OPTIONNEL (null)' : '✗ NON CRÉÉ');
      console.log(`  ${key.padEnd(22)} : ${status}`);
    }

    console.log('\n--- ENTITÉS MÉTIER (vides, remplies par les specs suivants) ---');
    const metierKeys = [
      'patient_id', 'partner_id', 'appointment_id', 'waiting_list_entry_id',
      'procedure_id', 'prescription_id', 'bilan_pre_id', 'bilan_post_id',
      'complication_id', 'invoice_id', 'payment_id',
    ];
    for (const key of metierKeys) {
      console.log(`  ${key.padEnd(25)} : ${state[key] !== null ? `id=${state[key]}` : 'null (sera rempli par les specs)'}`);
    }

    console.log('\n========================================\n');

    // Vérification minimale : les utilisateurs critiques sont présents
    expect(
      state.users.secretary,
      'La secrétaire doit avoir un id valide dans state.json'
    ).not.toBeNull();

    expect(
      state.users.doctor,
      'Le médecin doit avoir un id valide dans state.json'
    ).not.toBeNull();

    expect(
      state.users.nurse,
      'L\'infirmière doit avoir un id valide dans state.json'
    ).not.toBeNull();

    expect(
      state.config.station_id,
      'Le poste de dialyse doit avoir un id valide dans state.json'
    ).not.toBeNull();

    expect(
      state.config.pricing_rule_id,
      'La règle tarifaire doit avoir un id valide dans state.json'
    ).not.toBeNull();

    console.log('[setup] Vérifications finales réussies — suite E2E prête.');
  });

});
