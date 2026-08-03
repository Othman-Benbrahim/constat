// stockage.js — adaptateur browser.storage.local pour core/dossier.js.
//
// Même interface que stockageMemoire() : get, set, remove, keys. Aucun autre
// module du noyau ne connaît l'API du navigateur.
//
// storage.local n'est pas chiffré (décision D2). L'interface le dit à
// l'utilisateur ; ce module n'en fait pas semblant.

const api = globalThis.browser ?? globalThis.chrome;

export function stockageNavigateur() {
  return {
    async get(cle) {
      const o = await api.storage.local.get(cle);
      return Object.prototype.hasOwnProperty.call(o, cle) ? o[cle] : null;
    },
    async set(cle, valeur) { await api.storage.local.set({ [cle]: valeur }); },
    async remove(cle) { await api.storage.local.remove(cle); },
    async keys() { return Object.keys(await api.storage.local.get(null)); },
  };
}
