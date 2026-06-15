// @ts-check
/**
 * Helper JSON-RPC pour l'API Odoo 19.
 *
 * Toutes les fonctions utilisent le contexte `request` de Playwright
 * (APIRequestContext) pour émettre des requêtes HTTP vers l'instance Odoo.
 * Ce contexte gère automatiquement les cookies de session entre les appels
 * au sein d'un même test — il faut donc passer le même objet `request`
 * tout au long d'une spec.
 *
 * Protocole : JSON-RPC 2.0 via POST sur /web/dataset/call_kw
 * Authentification : POST sur /web/session/authenticate
 */

/** URL de base de l'instance Odoo */
const BASE_URL = 'http://localhost:8069';

// ---------------------------------------------------------------------------
// Utilitaire interne
// ---------------------------------------------------------------------------

/**
 * Génère un identifiant JSON-RPC aléatoire (entier 1..999999).
 * @returns {number}
 */
function rpcId() {
  return Math.floor(Math.random() * 999999) + 1;
}

// ---------------------------------------------------------------------------
// Authentification
// ---------------------------------------------------------------------------

/**
 * Authentifie un utilisateur via l'endpoint de session Odoo.
 * Après cet appel, le cookie de session est stocké dans le contexte `request`.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} login    - Identifiant Odoo (ex: 'admin')
 * @param {string} password - Mot de passe Odoo
 * @returns {Promise<number>} uid de l'utilisateur connecté
 * @throws {Error} Si l'authentification échoue
 */
async function loginApi(request, login, password) {
  const response = await request.post(`${BASE_URL}/web/session/authenticate`, {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      id: rpcId(),
      params: {
        db:       'asshafi',
        login:    login,
        password: password,
      },
    }),
  });

  if (!response.ok()) {
    throw new Error(`[api] loginApi HTTP ${response.status()} pour "${login}"`);
  }

  const body = await response.json();

  if (body.error) {
    throw new Error(`[api] loginApi RPC error : ${JSON.stringify(body.error)}`);
  }

  const uid = body.result && body.result.uid;
  if (!uid) {
    throw new Error(`[api] loginApi : authentification refusée pour "${login}" (uid absent)`);
  }

  return uid;
}

// ---------------------------------------------------------------------------
// Appel générique
// ---------------------------------------------------------------------------

/**
 * Effectue un appel JSON-RPC vers /web/dataset/call_kw.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} model   - Nom du modèle Odoo (ex: 'res.partner')
 * @param {string} method  - Méthode ORM (ex: 'create', 'write', 'search_read')
 * @param {Array}  args    - Arguments positionnels (liste)
 * @param {object} [kwargs={}] - Arguments nommés
 * @returns {Promise<any>} Le champ `result` de la réponse JSON-RPC
 * @throws {Error} Si la réponse contient une erreur JSON-RPC ou HTTP
 */
async function rpcCall(request, model, method, args = [], kwargs = {}) {
  const response = await request.post(`${BASE_URL}/web/dataset/call_kw`, {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({
      jsonrpc: '2.0',
      method:  'call',
      id:      rpcId(),
      params: {
        model:  model,
        method: method,
        args:   args,
        kwargs: {
          context: {},
          ...kwargs,
        },
      },
    }),
  });

  if (!response.ok()) {
    throw new Error(
      `[api] rpcCall HTTP ${response.status()} — ${model}.${method}()`
    );
  }

  const body = await response.json();

  if (body.error) {
    // Extraire le message d'erreur Odoo si disponible
    const odooMsg =
      body.error.data && body.error.data.message
        ? body.error.data.message
        : JSON.stringify(body.error);
    throw new Error(`[api] RPC error sur ${model}.${method}() : ${odooMsg}`);
  }

  return body.result;
}

// ---------------------------------------------------------------------------
// Opérations ORM courantes
// ---------------------------------------------------------------------------

/**
 * Crée un enregistrement et retourne son id.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} model  - Modèle cible
 * @param {object} values - Dictionnaire des valeurs à créer
 * @returns {Promise<number>} L'id du nouvel enregistrement
 */
async function apiCreate(request, model, values) {
  // Odoo 19 : create() accepte un dict ou une liste de dicts,
  // et retourne un id ou une liste d'ids selon le cas.
  const result = await rpcCall(request, model, 'create', [values]);
  return Array.isArray(result) ? result[0] : result;
}

/**
 * Met à jour des enregistrements existants.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string}   model  - Modèle cible
 * @param {number[]} ids    - Liste d'ids à mettre à jour
 * @param {object}   values - Dictionnaire des nouvelles valeurs
 * @returns {Promise<boolean>} True si succès
 */
async function apiWrite(request, model, ids, values) {
  return rpcCall(request, model, 'write', [ids, values]);
}

/**
 * Recherche et lit des enregistrements en une seule requête (search_read).
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string}   model   - Modèle cible
 * @param {Array}    domain  - Domaine de recherche Odoo (liste de triplets)
 * @param {string[]} fields  - Champs à retourner
 * @param {number}   [limit=80] - Nombre max de résultats
 * @returns {Promise<object[]>} Liste des enregistrements trouvés
 */
async function apiSearchRead(request, model, domain = [], fields = ['id', 'name'], limit = 80) {
  return rpcCall(request, model, 'search_read', [domain], { fields, limit });
}

/**
 * Lit des enregistrements par leurs ids (read).
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string}   model  - Modèle cible
 * @param {number[]} ids    - Liste d'ids à lire
 * @param {string[]} fields - Champs à retourner
 * @returns {Promise<object[]>} Liste des enregistrements lus
 */
async function apiRead(request, model, ids, fields = ['id', 'name']) {
  return rpcCall(request, model, 'read', [ids], { fields });
}

// ---------------------------------------------------------------------------
// Résolution d'XML ID
// ---------------------------------------------------------------------------

/**
 * Résout un XML ID Odoo en id numérique.
 * Utilise ir.model.data pour convertir 'module.xml_id' → res_id.
 *
 * Exemple : apiGetXmlId(request, 'base.group_portal') → 47
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} xmlId - XML ID au format 'module.name' (ex: 'base.group_user')
 * @returns {Promise<number>} L'id numérique correspondant
 * @throws {Error} Si l'XML ID n'est pas trouvé
 */
async function apiGetXmlId(request, xmlId) {
  // Séparation module / nom
  const dotIndex = xmlId.indexOf('.');
  if (dotIndex === -1) {
    throw new Error(`[api] apiGetXmlId : XML ID invalide "${xmlId}" (format attendu: 'module.name')`);
  }
  const module = xmlId.slice(0, dotIndex);
  const name   = xmlId.slice(dotIndex + 1);

  const records = await apiSearchRead(
    request,
    'ir.model.data',
    [['module', '=', module], ['name', '=', name]],
    ['res_id'],
    1
  );

  if (!records || records.length === 0) {
    throw new Error(`[api] apiGetXmlId : XML ID introuvable "${xmlId}"`);
  }

  return records[0].res_id;
}

// ---------------------------------------------------------------------------
// Trouver ou créer
// ---------------------------------------------------------------------------

/**
 * Cherche le premier enregistrement correspondant au domaine.
 * S'il existe, retourne son id. Sinon, crée l'enregistrement avec createVals.
 *
 * Cette fonction rend les scripts idempotents : relancer le setup ne duplique pas les données.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} model        - Modèle cible
 * @param {Array}  searchDomain - Domaine de recherche (ex: [['name','=','Foo']])
 * @param {object} createVals   - Valeurs pour la création si non trouvé
 * @returns {Promise<number>} L'id de l'enregistrement trouvé ou créé
 */
async function apiFindOrCreate(request, model, searchDomain, createVals) {
  // Recherche d'un enregistrement existant
  const existing = await apiSearchRead(request, model, searchDomain, ['id'], 1);

  if (existing && existing.length > 0) {
    console.log(`[api] apiFindOrCreate — ${model} trouvé (id=${existing[0].id})`);
    return existing[0].id;
  }

  // Création si absent
  const newId = await apiCreate(request, model, createVals);
  console.log(`[api] apiFindOrCreate — ${model} créé (id=${newId})`);
  return newId;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  loginApi,
  rpcCall,
  apiCreate,
  apiWrite,
  apiSearchRead,
  apiRead,
  apiGetXmlId,
  apiFindOrCreate,
};
