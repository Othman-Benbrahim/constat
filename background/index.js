// background/index.js — event page (Firefox MV3 : `scripts`, pas de service
// worker). Script classique, sans import : toute la logique de Constat vit
// dans la barre latérale, qui est une page de module.
//
// Deux rôles seulement :
//
//  1. Poser l'entrée de menu contextuel et ouvrir le panneau.
//  2. Servir de relais réseau pour les appels aux fournisseurs de modèles.
//
// Le second n'est pas un détail d'implémentation. Une page d'extension subit le
// CORS comme n'importe quelle page ; c'est l'arrière-plan qui détient les
// permissions d'hôte. Sans ce relais, l'appel échoue en « NetworkError when
// attempting to fetch resource » sans autre explication. Précédent identique
// dans pont-genealogie/src/core/reseau.js.
//
// L'arrière-plan ne demande aucune permission et ne lit aucune page : c'est le
// panneau, sur clic de l'utilisateur, qui fait les deux — permissions.request()
// exige un geste utilisateur.

const api = globalThis.browser ?? globalThis.chrome;

api.runtime.onInstalled.addListener(() => {
  api.menus.create({
    id: 'constat-verser',
    title: 'Verser cette page dans un dossier Constat',
    contexts: ['page', 'link', 'selection'],
  });
});

api.menus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'constat-verser') return;
  try { await api.sidebarAction.open(); } catch (e) { console.error('[Constat]', e); }
  // Le panneau prend la main. Il ne peut pas verser directement depuis ce
  // message : permissions.request() exige un clic DANS le panneau. Le message
  // sert donc seulement à réveiller l'affichage et à indiquer quoi faire.
  api.runtime
    .sendMessage({ type: 'verser-onglet', tabId: tab.id, url: info.pageUrl || tab.url })
    .catch(() => { /* panneau pas encore prêt : l'utilisateur cliquera */ });
});

/**
 * Relais réseau. Ne connaît ni les fournisseurs ni le contenu : il reçoit une
 * URL, des en-têtes et un corps, et rend la réponse brute. La clé API transite
 * par ce canal et n'est ni journalisée ni conservée.
 *
 * Par PORT et non par sendMessage, pour deux raisons distinctes :
 *
 *  - Réveil. Cette event page est non persistante ; après quelques dizaines de
 *    secondes d'inactivité elle est terminée, et un sendMessage échoue en
 *    « Could not establish connection. Receiving end does not exist ».
 *    L'ouverture d'un port la réveille.
 *  - Survie. Un appel à un modèle dure trente à soixante secondes. Tant que le
 *    port reste ouvert, la page n'est pas terminée — sans quoi la réponse
 *    arriverait dans le vide, après la mort de son destinataire.
 *
 * La réponse est toujours un objet, jamais une exception : une promesse rejetée
 * traverse mal la frontière des processus et arriverait illisible.
 */
async function relayer(msg) {
  try {
    const res = await fetch(msg.url, { method: 'POST', headers: msg.headers, body: msg.body });
    const texte = await res.text();
    let data = null;
    try { data = JSON.parse(texte); } catch { /* réponse non JSON : on rend le texte */ }
    return { ok: res.ok, status: res.status, data, texte: texte.slice(0, 4000) };
  } catch (e) {
    // Cause quasi certaine ici : permission d'hôte non accordée pour ce
    // fournisseur. Le message le dit, plutôt que de laisser « NetworkError »
    // seul face à l'utilisateur.
    let hote = msg.url;
    try { hote = new URL(msg.url).origin; } catch { /* URL mal formée */ }
    return { reseau: e?.message || String(e), hote };
  }
}

api.runtime.onConnect.addListener((port) => {
  if (port.name !== 'constat-llm') return;
  port.onMessage.addListener(async (msg) => {
    if (msg?.type !== 'appel-llm') return;
    const reponse = await relayer(msg);
    try { port.postMessage({ id: msg.id, ...reponse }); } catch (e) {
      console.error('[Constat] port fermé avant la réponse', e);
    }
  });
});

// Voie de secours, conservée : certaines versions réveillent mieux sur message
// que sur connexion.
api.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== 'appel-llm') return undefined;
  return relayer(msg);
});
