// Script classique MV3, chargé avant index.js. Routes et destination fermées :
// une clé d'agent n'est jamais réutilisée par le relais générique des modèles.
(() => {
  const ROUTES = { '/api/v1/ping': 'GET', '/api/v1/types': 'GET', '/api/v1/proposer': 'POST' };
  globalThis.constatPrismeRelayer = async (msg) => {
    let u;
    try {
      u = new URL(msg.base);
      if (u.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(u.hostname)
          || u.username || u.password || u.search || u.hash || u.pathname !== '/') throw new Error();
      if (!Object.hasOwn(ROUTES, msg.route)) throw new Error();
      if (typeof msg.cle !== 'string' || !/^prisme-[A-Za-z0-9_-]{20,100}$/.test(msg.cle)) throw new Error();
      if (msg.route === '/api/v1/proposer' && (msg.corps?.type !== 'prediction' || JSON.stringify(msg.corps).length > 40000)) throw new Error();
    } catch {
      return { erreur: 'Adresse, clé ou opération PRISME invalide' };
    }
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15000);
    try {
      const r = await fetch(u.origin + msg.route, {
        method: ROUTES[msg.route], headers: { 'X-Prisme-Cle': msg.cle, 'Content-Type': 'application/json' },
        ...(ROUTES[msg.route] === 'POST' ? { body: JSON.stringify(msg.corps) } : {}),
        redirect: 'error', credentials: 'omit', cache: 'no-store', signal: abort.signal,
      });
      const texte = await r.text();
      if (texte.length > 1000000) return { erreur: 'Réponse PRISME trop volumineuse' };
      let data;
      try { data = JSON.parse(texte); } catch { return { erreur: 'Réponse PRISME non JSON' }; }
      return { ok: r.ok, status: r.status, data };
    } catch {
      // Ne jamais recopier une URL, une clé ou un corps dans la trace d'erreur.
      return { erreur: 'PRISME injoignable ou redirection refusée. Vérifiez que PRISME est lancé et l’accès local autorisé. Aucun renvoi automatique.' };
    } finally { clearTimeout(timer); }
  };
})();
