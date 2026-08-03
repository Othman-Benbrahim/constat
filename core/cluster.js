// cluster.js — regroupement des sources d'un dossier.
//
// Réécriture du cluster.js de Sentinelle, pas une reprise. Sentinelle ne
// dispose que des titres RSS et regroupe donc sur les titres. Ici on verse des
// pages complètes : la preuve de reprise est dans le corps, pas dans le titre.
// Une dépêche reprise par neuf éditeurs qui réécrivent tous le titre n'est
// détectable que par le texte.
//
// Ce qui EST repris de Sentinelle, verbatim dans l'esprit et dans les chiffres :
// la mesure de corroboration min(éditeurs, formulations) et son principe —
// un regroupement ne confirme rien, il mesure l'écart entre volume apparent et
// comptes rendus réellement distincts.
//
// Déterminisme : les sources sont traitées dans l'ordre de leur identifiant,
// jamais dans l'ordre de versement. Un relevé rejoué sur le même ensemble de
// sources et la même version d'outil donne le même résultat (décision D1).

import { normalizeTitle, titleSimilarity } from './normalize.js';
import {
  empreinteExacte, empreinteFloue, motsPourSimhash, shinglesTexte,
  recouvrement, mediane,
} from './empreinte.js';

/**
 * Part des séquences de 4 mots que deux textes doivent partager pour être dits
 * dérivés l'un de l'autre.
 *
 * 0,60 est un point de départ, pas une constante établie. Mesuré sur textes
 * synthétiques : une reprise modifiée à 10 % tombe à 0,67, un texte sans
 * rapport à 0,00. Sur de la vraie presse le plancher ne sera pas 0,00 — les
 * formules de métier (« selon nos informations », « contacté par ») créent du
 * recouvrement résiduel. La valeur définitive sort du dossier réel de quatre
 * semaines, pas d'ici. Elle est publiée dans releve.parametres : un
 * regroupement dont on ignore le seuil n'est pas interprétable six mois plus
 * tard.
 */
export const SEUIL_RECOUVREMENT = 0.60;

/** Nombre minimal de shingles pour que le recouvrement soit calculé.
 *  En deçà, un texte trop court produirait des taux instables. */
export const MIN_SHINGLES = 30;

/** Repli sur le titre, uniquement quand le corps manque ou est trop court.
 *  Valeur reprise de Sentinelle. */
export const SEUIL_TITRE = 0.58;

export const PARAMETRES = { SEUIL_RECOUVREMENT, MIN_SHINGLES, SEUIL_TITRE };

/**
 * Calcule les deux empreintes de chaque source. Seule étape asynchrone.
 * @param {Array<object>} sources
 * @returns {Promise<Array<object>>}
 */
export async function preparer(sources) {
  return Promise.all(sources.map(async (s) => {
    const texte = s.texte || '';
    return {
      ...s,
      _norm: normalizeTitle(s.titre),
      _exact: texte ? await empreinteExacte(texte) : null,
      _floue: texte ? empreinteFloue(texte) : null,
      _sh: texte ? shinglesTexte(motsPourSimhash(texte)) : new Set(),
    };
  }));
}

/**
 * Cascade de liaison, du plus certain au moins certain. La première qui répond
 * l'emporte : une preuve de texte prime toujours sur une ressemblance de titre.
 * @returns {{type:string, bits:number|null, score:number|null}|null}
 */
export function lier(item, centroide) {
  if (item._exact && centroide._exact && item._exact === centroide._exact) {
    return { type: 'hash-identique', taux: 1, sens: 'identique', score: null };
  }
  if (item._sh.size >= MIN_SHINGLES && centroide._sh.size >= MIN_SHINGLES) {
    const r = recouvrement(item._sh, centroide._sh);
    if (r.max >= SEUIL_RECOUVREMENT) {
      return { type: 'recouvrement', taux: r.max, sens: r.aDansB >= r.bDansA ? 'derive' : 'source', score: null };
    }
    // Corps exploitable des deux côtés et recouvrement insuffisant : la
    // question est tranchée. On ne repêche pas sur le titre — deux articles
    // distincts sur un même sujet ont souvent un titre proche, c'est
    // exactement l'erreur que ce module doit éviter.
    return null;
  }
  const score = titleSimilarity(item._norm, centroide._norm);
  if (score >= SEUIL_TITRE) {
    return { type: 'titre', taux: null, score: Number(score.toFixed(3)) };
  }
  return null;
}

/** Rang de préférence d'une liaison. Plus petit = plus certain. */
function rang(l) {
  return l.type === 'hash-identique' ? 0 : l.type === 'recouvrement' ? 1 : 2;
}

function meilleure(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (rang(a) !== rang(b)) return rang(a) < rang(b) ? a : b;
  if (a.type === 'recouvrement') return a.taux >= b.taux ? a : b;
  if (a.type === 'titre') return a.score >= b.score ? a : b;
  return a;
}

/**
 * Le centroïde d'une grappe est son texte le plus long — c'est la version la
 * moins tronquée, donc celle dont l'empreinte est la plus fiable. À défaut de
 * texte, le titre le plus long. Liaison au centroïde et non au plus proche
 * voisin, pour éviter les chaînes qui agglomèrent des sujets distincts.
 */
function choisirCentroide(membres) {
  let best = membres[0];
  for (const m of membres) {
    const lm = (m.texte || '').length || (m.titre || '').length / 1000;
    const lb = (best.texte || '').length || (best.titre || '').length / 1000;
    if (lm > lb) best = m;
  }
  return best;
}

/**
 * Regroupe les sources préparées.
 * @param {Array<object>} sources sortie de preparer()
 * @returns {Array<object>} grappes mesurées, triées
 */
export function regrouper(sources) {
  const tries = [...sources].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const groupes = [];

  for (const item of tries) {
    let cible = -1;
    let retenue = null;

    for (let i = 0; i < groupes.length; i++) {
      const l = lier(item, groupes[i].centroide);
      if (!l) continue;
      const m = meilleure(retenue, l);
      if (m === l) { retenue = l; cible = i; }
    }

    if (cible >= 0) {
      const g = groupes[cible];
      g.membres.push(item);
      g.liaisons.set(item.id, retenue);
      g.centroide = choisirCentroide(g.membres);
    } else {
      groupes.push({
        centroide: item,
        membres: [item],
        liaisons: new Map([[item.id, { type: 'origine', taux: null, score: null }]]),
      });
    }
  }

  return groupes.map(mesurer).sort(comparer)
    .map((g, i) => ({ ...g, id: `g${String(i + 1).padStart(3, '0')}` }));
}

/**
 * Mesure d'une grappe.
 *
 * Repris de Sentinelle sans changement :
 *   volume · editeurs · formulations · corroboration = min(editeurs, formulations)
 *
 * Ajouté ici, parce qu'on dispose du corps :
 *   empreintesIdentiques — plus grand nombre de membres au SHA-256 identique.
 *                          Régime CONSTATÉ.
 *   recouvrementMedian   — part médiane de séquences de 4 mots partagées avec
 *                          le centroïde. Régime MESURÉ. Ne dit pas « identiques ».
 *   sansTexte            — membres sans corps exploitable. Déclarés, jamais
 *                          comptés comme des textes différents par défaut.
 */
export function mesurer(groupe) {
  const membres = [...groupe.membres].sort((a, b) => {
    const da = a.datePubliee || '';
    const db = b.datePubliee || '';
    if (da && db) return da < db ? -1 : da > db ? 1 : 0;
    if (da) return -1;
    if (db) return 1;
    return String(a.id).localeCompare(String(b.id));
  });

  const editeurs = new Set(membres.map((m) => m.editeur || 'inconnu'));
  const formulations = new Set(membres.map((m) => m._norm).filter(Boolean));

  const parExact = new Map();
  for (const m of membres) {
    if (!m._exact) continue;
    parExact.set(m._exact, (parExact.get(m._exact) || 0) + 1);
  }
  const empreintesIdentiques = parExact.size ? Math.max(...parExact.values()) : 0;
  const editeursIdentiques = (() => {
    if (empreintesIdentiques < 2) return 0;
    const [hash] = [...parExact.entries()].find(([, n]) => n === empreintesIdentiques);
    return new Set(membres.filter((m) => m._exact === hash).map((m) => m.editeur)).size;
  })();

  const c = groupe.centroide;
  const taux = membres
    .filter((m) => m !== c && m._sh.size >= MIN_SHINGLES && c._sh.size >= MIN_SHINGLES)
    .map((m) => recouvrement(m._sh, c._sh).max);

  const tauxMedian = taux.length
    ? Number((mediane(taux.map((t) => Math.round(t * 1000))) / 1000).toFixed(3))
    : null;

  const volume = membres.length;
  const nbEditeurs = editeurs.size;
  const nbFormulations = formulations.size || 1;

  return {
    id: null,
    titre: membres.find((m) => m === c)?.titre || membres[0].titre || '(sans titre)',
    volume,
    editeurs: nbEditeurs,
    formulations: nbFormulations,
    corroboration: Math.min(nbEditeurs, nbFormulations),
    empreintesIdentiques,
    editeursIdentiques,
    recouvrementMedian: tauxMedian,
    recouvrementsCompares: taux.length,
    sansTexte: membres.filter((m) => m._sh.size < MIN_SHINGLES).length,
    verdict: verdictPour({
      volume, editeurs: nbEditeurs, formulations: nbFormulations,
      empreintesIdentiques, editeursIdentiques,
      recouvrementMedian: tauxMedian,
    }),
    centroide: c.id,
    fenetre: (() => {
      const d = membres.map((m) => m.datePubliee).filter(Boolean);
      return d.length >= 2 ? { debut: d[0], fin: d[d.length - 1] } : null;
    })(),
    membres: membres.map((m) => ({
      id: m.id,
      titre: m.titre,
      url: m.canonical || m.url,
      editeur: m.editeur || 'inconnu',
      publie: m.datePubliee || null,
      empreinte: m._floue?.hash || null,
      empreinteFiable: !!m._floue?.fiable,
      texteHash: m._exact,
      // Pourquoi ce membre est dans cette grappe. Affichable, contestable.
      liaison: groupe.liaisons.get(m.id) || null,
    })),
  };
}

/**
 * Verdict. Volontairement prudent : on ne prétend pas mesurer l'indépendance
 * éditoriale, seulement la divergence observable. « reprise-litterale » est le
 * seul verdict de régime constaté — il exige des SHA-256 égaux chez au moins
 * deux éditeurs.
 */
export function verdictPour({
  volume, editeurs, formulations, empreintesIdentiques, editeursIdentiques, recouvrementMedian,
}) {
  // Régime CONSTATÉ : mêmes octets, chez au moins deux éditeurs.
  if (empreintesIdentiques >= 2 && editeursIdentiques >= 2) return 'reprise-litterale';
  // Régime MESURÉ : pas les mêmes octets, mais un recouvrement de séquences
  // que deux rédactions indépendantes ne produisent pas. Sans ce palier, une
  // grappe liée à 0,85 de recouvrement ressortirait « couverture partielle »,
  // c'est-à-dire l'inverse de ce que le corps montre.
  if (recouvrementMedian !== null && recouvrementMedian !== undefined
      && recouvrementMedian >= SEUIL_RECOUVREMENT && editeurs >= 2) return 'reprise-mesuree';
  if (volume === 1) return 'isole';
  if (editeurs === 1) return 'source-unique';
  if (formulations === 1) return 'reprise-verbatim';
  if (formulations / volume < 0.5) return 'reprise-probable';
  if (editeurs >= 3 && formulations / volume >= 0.8) return 'couverture-convergente';
  return 'couverture-partielle';
}

export const VERDICTS = {
  'reprise-litterale': 'reprise à l’identique (texte)',
  'reprise-mesuree': 'reprise probable (recouvrement de texte)',
  'isole': 'isolé',
  'source-unique': 'source unique',
  'reprise-verbatim': 'titres identiques',
  'reprise-probable': 'reprise probable',
  'couverture-partielle': 'couverture partielle',
  'couverture-convergente': 'couverture convergente',
};

/** Tri par écart entre volume et corroboration : ce qui a l'air le plus
 *  confirmé sans l'être passe en premier. Pas par popularité. */
export function comparer(a, b) {
  const ea = a.volume - a.corroboration;
  const eb = b.volume - b.corroboration;
  if (eb !== ea) return eb - ea;
  if (b.volume !== a.volume) return b.volume - a.volume;
  return String(a.titre).localeCompare(String(b.titre));
}
