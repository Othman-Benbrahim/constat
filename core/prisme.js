// Contrat de versement, sans navigateur ni réseau. Aucun calcul de calibration.
const ligne = (v, nom, max = 4000) => {
  if (typeof v !== 'string') throw new Error(`${nom} : texte attendu`);
  const s = v.replace(/\s+/g, ' ').trim();
  if (!s || s.length > max) throw new Error(`${nom} : 1 à ${max} caractères attendus`);
  return s;
};
export function adressePrisme(brute) {
  let u;
  try { u = new URL(brute); } catch { throw new Error('Adresse PRISME invalide'); }
  if (u.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(u.hostname)
      || u.username || u.password || u.search || u.hash || !['', '/'].includes(u.pathname)) {
    throw new Error('PRISME doit être local : http://127.0.0.1:5000 ou http://localhost:5000, sans chemin ni identifiants');
  }
  return { base: u.origin, permission: `http://${u.hostname}/*` };
}
export function probabilite(v) {
  if (typeof v !== 'number' && typeof v !== 'string') throw new Error('Probabilité requise');
  if (typeof v === 'string' && !/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/.test(v.trim())) {
    throw new Error('Probabilité entre 0 et 1, avec un point décimal');
  }
  const p = Number(v);
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error('Probabilité entre 0 et 1');
  return p;
}
export function datePrisme(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('Date butoir requise : AAAA-MM-JJ');
  const d = new Date(`${v}T00:00:00Z`);
  if (v.startsWith('0000-') || !Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw new Error('Date butoir impossible');
  return v;
}
export function preparerPrediction({ dossier, etape, hypotheseId, saisie }) {
  if (!dossier?.id || etape?.numero !== 5 || !etape.validee || !etape.complet) {
    throw new Error('Une étape ACH complète et validée est requise');
  }
  const h = etape.sortie?.hypotheses?.find(x => x.id === hypotheseId);
  if (!h) throw new Error('Hypothèse introuvable dans cette révision ACH');
  const champs = {
    enonce: ligne(saisie.enonce, 'Énoncé'),
    probabilite: probabilite(saisie.probabilite),
    echeance: datePrisme(saisie.echeance),
    critere_resolution: ligne(saisie.critere_resolution, 'Condition de résolution'),
    hypothese: ligne(`constat:${dossier.id}:${etape.ts}:${h.id}`, 'Référence ACH'),
    statut: 'ouverte',
  };
  if (saisie.domaine?.trim()) champs.domaine = ligne(saisie.domaine, 'Domaine');
  const preuves = etape.sortie.preuves || [];
  const sources = [...new Set(preuves.flatMap(p => p.sources || []))];
  const motif = ligne(`Constat — dossier ${dossier.id} ; question : ${dossier.question} ; ACH ${etape.ts} validée le ${etape.valideeLe}; corpus ${etape.releveRef}; hypothèse ${h.id} (${h.role}) : ${h.enonce} ; confirmerait : ${h.confirmerait} ; réfuterait : ${h.demolirait} ; sources du dossier : ${sources.join(', ')}. Probabilité, date butoir et condition de résolution saisies par l’auteur.`, 'Contexte ACH');
  return { type: 'prediction', titre: ligne(saisie.titre, 'Titre', 200), champs, motif };
}
export function verifierContrat(ping, catalogue) {
  if (ping?.prisme !== true || !ping.droits?.includes('proposition') || !ping.droits?.includes('lecture')) {
    throw new Error('Clé PRISME avec droits lecture et proposition requise');
  }
  const noms = new Set((catalogue?.types?.prediction?.champs || []).map(c => c.nom));
  if (catalogue?.schema !== 1 || !['enonce', 'probabilite', 'echeance', 'critere_resolution', 'hypothese'].every(n => noms.has(n))) {
    throw new Error('PRISME doit disposer du contrat Prédiction E11 (schéma 1)');
  }
}
export function erreurPrisme(status) {
  if (status === 401 || status === 403) return 'Clé absente, révoquée ou droits insuffisants. Vérifiez la clé dans PRISME.';
  if (status === 409) return 'Proposition déjà en file, rejet mémorisé ou plafond atteint. Vérifiez la file dans PRISME ; aucun succès nouveau n’est confirmé.';
  if (status === 404) return 'Route PRISME introuvable : vérifiez E11 et l’adresse locale.';
  return `PRISME a refusé la requête (HTTP ${status}). Vérifiez la fiche et l’application.`;
}
