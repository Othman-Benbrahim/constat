// rapport.js — étape 6, production analytique.
//
// Cette étape n'appelle aucun modèle, et c'est un choix.
//
// L'étape 6 du skill consiste à choisir un format de livrable et à y ranger ce
// que les étapes précédentes ont produit. Ranger n'est pas analyser. Confier
// l'assemblage à un modèle l'inviterait à réécrire au passage — à lisser une
// divergence, à arrondir un niveau de risque, à produire un BLUF plus net que
// les éléments qui le fondent. Tout ce que ce module écrit est déjà quelque
// part dans le dossier.
//
// Le BLUF lui-même est dérivé : hypothèse la moins réfutée par la matrice ACH,
// scénario au risque le plus élevé, et le conditionnement qui l'accompagne. Si
// ces éléments manquent, il n'y a pas de BLUF — et le rapport le dit.

/** Volumes du skill (étape 2). Le format n'est pas choisi par goût : il découle
 *  du nombre de sources distinctes, et un corpus trop mince interdit les
 *  formats longs plutôt que de les remplir de vide. */
export const FORMATS = [
  { id: 'insuffisant', min: 0, nom: 'Corpus insuffisant', attendu: '3 sources minimum' },
  { id: 'note-express', min: 3, nom: 'Note tactique express', attendu: '3 à 5 sources distinctes' },
  { id: 'analyse-complete', min: 8, nom: 'Analyse complète', attendu: '8 à 15 sources' },
  { id: 'evaluation-strategique', min: 15, nom: 'Évaluation stratégique', attendu: '15 à 30 sources' },
];

export function formatRecommande(comptesRendusDistincts) {
  return [...FORMATS].reverse().find((f) => comptesRendusDistincts >= f.min) || FORMATS[0];
}

/** Ce qu'attend chaque format, dans l'ordre du pipeline. */
const EXIGENCES = {
  'insuffisant': [],
  'note-express': [5],
  'analyse-complete': [4, 5, 7, 10, 11],
  'evaluation-strategique': [4, 5, 7, 8, 9, 10, 11],
};

const NIVEAUX_ORDRE = ['tres-faible', 'faible', 'modere', 'eleve', 'critique'];

/**
 * Assemble le bilan du dossier.
 *
 * @param {object} a
 * @param {object} a.releve       relevé déterministe courant
 * @param {object} a.cotation     sortie de cotation.distribution()
 * @param {Array}  a.etapes       entrées `etape` du journal, dernière par numéro
 * @returns {{format, bluf, presentes, manquantes, nonValidees, reserves}}
 */
export function assembler({ releve, cotation, etapes = [] }) {
  const parNumero = new Map(etapes.map((e) => [e.numero, e]));
  const format = formatRecommande(releve.corroboration.comptesRendusDistincts);
  const attendues = EXIGENCES[format.id] || [];

  const validees = attendues.filter((n) => parNumero.get(n)?.validee);
  const nonValidees = attendues.filter((n) => parNumero.has(n) && !parNumero.get(n).validee);
  const manquantes = attendues.filter((n) => !parNumero.has(n));

  return {
    format,
    complet: !manquantes.length && !nonValidees.length,
    presentes: validees,
    nonValidees,
    manquantes,
    bluf: bluf(parNumero),
    reserves: reserves({ releve, cotation, parNumero }),
  };
}

/**
 * Bottom Line Up Front, dérivé et non rédigé.
 *
 * Il ne dit que ce que les étapes validées permettent de dire, et refuse de
 * conclure quand elles manquent. Un BLUF fabriqué sur un dossier incomplet est
 * exactement la « fausse précision » que le skill nomme comme piège.
 */
export function bluf(parNumero) {
  const ach = parNumero.get(5);
  const risque = parNumero.get(8);
  const scenarios = parNumero.get(7);

  if (!ach?.validee) {
    return { possible: false, raison: 'aucune étape 5 validée : pas d’hypothèse à mettre en tête' };
  }

  const tete = ach.sortie.classement?.[0];
  const h = ach.sortie.hypotheses.find((x) => x.id === tete?.id);
  if (!h) return { possible: false, raison: 'classement ACH vide' };

  const phrase = [
    `Hypothèse la moins réfutée par le corpus : ${h.enonce} (${h.id}, rôle ${h.role}, `
    + `${tete.incompatibles} preuve(s) incompatible(s) sur ${Object.keys(ach.sortie.matrice || {}).length}).`,
    `Elle serait démolie par : ${h.demolirait}`,
  ];

  let pire = null;
  if (risque?.validee && risque.sortie.evaluations?.length) {
    pire = [...risque.sortie.evaluations]
      .sort((a, b) => NIVEAUX_ORDRE.indexOf(b.niveau) - NIVEAUX_ORDRE.indexOf(a.niveau))[0];
    const sc = scenarios?.sortie?.scenarios?.find((s) => s.id === pire.scenario);
    phrase.push(`Risque le plus élevé : ${pire.scenario}`
      + `${sc ? ` — ${sc.titre}` : ''}, niveau ${pire.niveau}, `
      + `et seulement si ${pire.conditions.join(' ; ')}.`);
  }

  return {
    possible: true,
    hypothese: h.id,
    incompatibles: tete.incompatibles,
    risque: pire ? { scenario: pire.scenario, niveau: pire.niveau, conditions: pire.conditions } : null,
    texte: phrase.join(' '),
  };
}

/**
 * Réserves à porter en tête du livrable. Ce sont des comptages, pas des
 * appréciations : chacune renvoie à un chiffre du dossier.
 */
export function reserves({ releve, cotation, parNumero }) {
  const out = [];
  const co = releve.corroboration;

  if (co.comptesRendusDistincts < co.sources) {
    out.push(`${co.sources} articles versés mais ${co.comptesRendusDistincts} compte(s) rendu(s) `
      + `distinct(s) : le volume n'est pas de la corroboration.`);
  }
  if (cotation && cotation.nonCotees.length) {
    out.push(`${cotation.nonCotees.length} source(s) sur ${cotation.total} non cotées : `
      + `l'étape 2 n'a pas été faite sur tout le corpus.`);
  }
  if (cotation && cotation.socle?.length === 0 && cotation.cotees > 0) {
    out.push('Aucune source à la fois fiable et confirmée (A-B × 1-2) : '
      + 'aucune affirmation ne peut s\u2019appuyer sur un socle coté.');
  }
  for (const nc of releve.silences.nonCalcules) {
    out.push(`Non calculé — ${nc.code} : ${nc.raison}.`);
  }
  const biais = parNumero.get(10);
  if (biais?.validee && biais.sortie.demolition) {
    out.push(`Équipe rouge : ${biais.sortie.demolition}`);
  }
  const retro = parNumero.get(11);
  if (retro?.validee && retro.sortie.lacunes?.length) {
    out.push(`Lacunes déclarées : ${retro.sortie.lacunes.join(' · ')}`);
  }
  return out;
}
