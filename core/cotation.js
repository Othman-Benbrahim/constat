// cotation.js — étape 2, évaluation des sources.
//
// Cotation OTAN dite « Admiralty » : une lettre pour la fiabilité de la source,
// un chiffre pour la crédibilité de l'information. B2 se lit « source
// généralement fiable, information probablement vraie ».
//
// SAISIE À LA MAIN, JAMAIS DÉDUITE. Un modèle qui cote une source produit un
// jugement déguisé en mesure : rien dans le texte d'un article ne dit si son
// éditeur est fiable. Une source non cotée reste non cotée et s'affiche comme
// telle — c'est une information, pas un trou à combler.
//
// Le module est purement déterministe : il compte des cotations saisies.

export const FIABILITE = {
  A: 'complètement fiable',
  B: 'généralement fiable',
  C: 'assez fiable',
  D: 'pas habituellement fiable',
  E: 'non fiable',
  F: 'fiabilité non évaluable',
};

export const CREDIBILITE = {
  1: 'confirmée par d’autres sources',
  2: 'probablement vraie',
  3: 'possiblement vraie',
  4: 'douteuse',
  5: 'improbable',
  6: 'véracité non évaluable',
};

/** F et 6 ne sont pas de mauvaises notes : ce sont des refus d'évaluer. Les
 *  compter avec les autres ferait passer une abstention pour un jugement. */
export const NON_EVALUABLE = { fiabilite: 'F', credibilite: '6' };

export function valide(fiabilite, credibilite) {
  return Object.prototype.hasOwnProperty.call(FIABILITE, fiabilite)
    && Object.prototype.hasOwnProperty.call(CREDIBILITE, String(credibilite));
}

export function libelle(fiabilite, credibilite) {
  if (!valide(fiabilite, credibilite)) return null;
  return `${fiabilite}${credibilite} — ${FIABILITE[fiabilite]}, ${CREDIBILITE[String(credibilite)]}`;
}

/**
 * Construit une entrée de journal. Le motif est exigé : une cotation sans
 * raison n'est pas contestable, donc pas vérifiable.
 */
export function coter({ dossier, source, fiabilite, credibilite, motif }) {
  if (!valide(fiabilite, credibilite)) {
    throw new Error(`cotation hors échelle : ${fiabilite}${credibilite}`);
  }
  if (!String(motif || '').trim()) throw new Error('cotation sans motif');
  return {
    t: 'cotation',
    dossier,
    source: String(source),
    fiabilite,
    credibilite: String(credibilite),
    motif: String(motif).trim(),
  };
}

/** La dernière cotation saisie pour chaque source. Journal append-only : une
 *  révision est une nouvelle entrée, pas une réécriture. */
export function courantes(journal) {
  const out = new Map();
  for (const e of journal) if (e.t === 'cotation') out.set(e.source, e);
  return out;
}

/**
 * Distribution des cotations sur un corpus.
 *
 * `nonCotees` n'est pas une catégorie parmi d'autres : c'est le nombre de
 * sources sur lesquelles l'étape 2 n'a pas été faite. Tant qu'il n'est pas nul,
 * toute moyenne sur les cotations porte sur un échantillon choisi par l'oubli.
 */
export function distribution(sources, journal) {
  const cotes = courantes(journal);
  const parFiabilite = Object.fromEntries(Object.keys(FIABILITE).map((k) => [k, 0]));
  const parCredibilite = Object.fromEntries(Object.keys(CREDIBILITE).map((k) => [k, 0]));
  const nonCotees = [];
  let nonEvaluables = 0;

  for (const s of sources) {
    const c = cotes.get(s.id);
    if (!c) { nonCotees.push(s.id); continue; }
    parFiabilite[c.fiabilite]++;
    parCredibilite[c.credibilite]++;
    if (c.fiabilite === NON_EVALUABLE.fiabilite || c.credibilite === NON_EVALUABLE.credibilite) {
      nonEvaluables++;
    }
  }

  return {
    total: sources.length,
    cotees: sources.length - nonCotees.length,
    nonCotees,
    nonEvaluables,
    parFiabilite,
    parCredibilite,
    // Sources à la fois fiables et confirmées : le socle sur lequel une
    // affirmation peut s'appuyer. Compté, pas moyenné — une moyenne de lettres
    // n'a pas de sens.
    socle: sources.filter((s) => {
      const c = cotes.get(s.id);
      return c && 'AB'.includes(c.fiabilite) && '12'.includes(c.credibilite);
    }).map((s) => s.id),
  };
}
