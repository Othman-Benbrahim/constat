// Une tentative, via un port dédié. Une réponse perdue ne déclenche jamais un
// second POST à l'insu de l'auteur ; il vérifiera la file PRISME avant de réessayer.
import { erreurPrisme } from '../core/prisme.js';
export function appelPrisme(api, msg, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    let port, termine = false;
    const finir = (erreur, valeur) => {
      if (termine) return; termine = true; clearTimeout(timer);
      try { port?.disconnect(); } catch { /* déjà fermé */ }
      if (erreur) reject(new Error(erreur)); else resolve(valeur);
    };
    const timer = setTimeout(() => finir('Réponse PRISME non reçue. Vérifiez sa file avant de réessayer.'), timeoutMs);
    try {
      port = api.runtime.connect({ name: 'constat-prisme' });
      port.onMessage.addListener(r => {
        if (r?.erreur) finir(r.erreur);
        else if (!r?.ok) finir(erreurPrisme(r?.status));
        else finir(null, r.data);
      });
      port.onDisconnect.addListener(() => finir('Relais PRISME interrompu. Vérifiez sa file avant de réessayer.'));
      port.postMessage({ ...msg, type: 'appel-prisme' });
    } catch { finir('Impossible de joindre l’arrière-plan de Constat. Rechargez l’extension.'); }
  });
}
