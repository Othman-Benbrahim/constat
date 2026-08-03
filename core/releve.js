// releve.js — assemblage du relevé déterministe (§6.1 et §6.2 du handoff).
//
// Ce module n'invente rien : il assemble ce que extraction, cluster et
// silences ont déjà compté, et y ajoute la chronologie, les champs lexicaux et
// les contradictions chiffrées.
//
// Un relevé porte l'ensemble des sources qu'il a consommées, l'empreinte de cet
// ensemble, la version d'outil et les paramètres effectifs (décision D1). Sans
// eux, un relevé rejoué six mois plus tard n'est pas comparable — il est
// seulement différent.

import { detecter, compterActeurs, PARAMETRES as P_SILENCES } from './silences.js';
import { PARAMETRES as P_CLUSTER } from './cluster.js';
import { empreinteExacte } from './empreinte.js';
import { NATURES_SOURCE } from './extraction.js';
import { deaccent } from './normalize.js';

export const PARAMETRES = {
  TERMES_AFFICHES: 15,
  MIN_ARTICLES_TERME: 3,
  FENETRE_INDICATEUR: 60,
  PERIODES: 4,
};

const norm = (s) => deaccent(String(s || '').toLowerCase())
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* --------------------------------------------------------------- § 6.1 */

/**
 * Mesures de corroboration.
 *
 * `comptesRendusDistincts` est la mesure signature : 18 articles ne font pas
 * 18 confirmations. Définition retenue ici — une grappe compte comme un compte
 * rendu distinct si au moins un de ses articles apporte un matériau propre,
 * c'est-à-dire une citation entre guillemets ou un lien vers un document
 * source. Une grappe qui n'a ni l'un ni l'autre relaie sans rien ajouter de
 * vérifiable.
 *
 * C'est un choix de définition, pas une évidence : le handoff donne
 * « 12 grappes, 5 distincts » sans dire par quoi il passe. Celle-ci a
 * l'avantage d'être un comptage visible et de ne rien inférer. À contester.
 */
export function corroboration(sources, grappes) {
  const parId = new Map(sources.map((s) => [s.id, s]));
  const aDuMateriau = (id) => {
    const s = parId.get(id);
    if (!s) return false;
    return (s.citations?.length > 0)
      || (s.liens || []).some((l) => NATURES_SOURCE.includes(l.nature));
  };

  const distinctes = grappes.filter((g) => g.membres.some((m) => aDuMateriau(m.id)));
  const plusLarge = grappes.reduce((max, g) => (g.volume > (max?.volume || 0) ? g : max), null);

  return {
    sources: sources.length,
    editeurs: new Set(sources.map((s) => s.editeur || 'inconnu')).size,
    grappes: grappes.length,
    grappePlusLarge: plusLarge ? { id: plusLarge.id, volume: plusLarge.volume } : null,
    comptesRendusDistincts: distinctes.length,
    definitionDistincts: 'grappe dont au moins un article porte une citation attribuée '
      + 'ou un lien vers un document source',
    grappesSansMateriau: grappes.length - distinctes.length,
  };
}

/* --------------------------------------------------------------- § 6.2 */

export function chronologie(sources) {
  const datees = sources.filter((s) => s.datePubliee)
    .sort((a, b) => a.datePubliee.localeCompare(b.datePubliee));

  return {
    debut: datees[0]?.datePubliee || null,
    fin: datees.at(-1)?.datePubliee || null,
    articlesDates: datees.length,
    articlesSansDate: sources.filter((s) => !s.datePubliee).map((s) => s.id),
    datesIncoherentes: sources.filter((s) => s.datesIncoherentes)
      .map((s) => ({ id: s.id, publiee: s.datePubliee, modifiee: s.dateModifiee })),
    ordre: datees.map((s) => ({ id: s.id, date: s.datePubliee, editeur: s.editeur })),
  };
}

const STOP = new Set(('le la les un une des du de au aux et ou ni mais donc car que qui quoi dont '
  + 'en pour par sur sous dans avec sans vers chez entre apres avant depuis contre selon il elle '
  + 'ils elles on nous vous se sa son ses leur leurs ce cet cette ces est sont etre ete plus moins '
  + 'tres avoir fait cela tout tous toute toutes meme aussi ainsi alors deja encore leurs cette '
  + 'notre votre pas ne plusieurs autre autres').split(' '));

/**
 * Champs lexicaux et leur évolution. Le corpus est découpé en périodes de durée
 * égale ; pour chaque terme saillant, on donne le nombre d'articles qui le
 * portent dans chaque période. Pas de courbe lissée, pas de tendance : des
 * comptages par tranche, que le lecteur interprète lui-même.
 */
export function champsLexicaux(sources, { periodes = PARAMETRES.PERIODES } = {}) {
  const datees = sources.filter((s) => s.datePubliee && s.texte)
    .sort((a, b) => a.datePubliee.localeCompare(b.datePubliee));
  if (datees.length < periodes) return { periodes: [], termes: [], nonCalcule: 'trop peu d’articles datés' };

  const t0 = Date.parse(datees[0].datePubliee);
  const t1 = Date.parse(datees.at(-1).datePubliee);
  const pas = Math.max(1, (t1 - t0) / periodes);
  const indice = (s) => Math.min(periodes - 1, Math.floor((Date.parse(s.datePubliee) - t0) / pas));

  const bornes = Array.from({ length: periodes }, (_, i) => ({
    debut: new Date(t0 + i * pas).toISOString(),
    fin: new Date(t0 + (i + 1) * pas).toISOString(),
    articles: datees.filter((s) => indice(s) === i).length,
  }));

  const parTerme = new Map();
  for (const s of datees) {
    const i = indice(s);
    for (const mot of new Set(norm(s.texte).split(' ').filter((m) => m.length > 4 && !STOP.has(m)))) {
      if (!parTerme.has(mot)) parTerme.set(mot, { articles: 0, parPeriode: new Array(periodes).fill(0) });
      parTerme.get(mot).articles++;
      parTerme.get(mot).parPeriode[i]++;
    }
  }

  const termes = [...parTerme.entries()]
    .filter(([, v]) => v.articles >= PARAMETRES.MIN_ARTICLES_TERME)
    .sort((a, b) => b[1].articles - a[1].articles || a[0].localeCompare(b[0]))
    .slice(0, PARAMETRES.TERMES_AFFICHES)
    .map(([terme, v]) => ({ terme, articles: v.articles, parPeriode: v.parPeriode }));

  return { periodes: bornes, termes, nonCalcule: null };
}

const RE_MONTANT = /(\d[\d  .,]*)\s*(millions?|milliards?|%|km|kilomètres?|hectares?|euros?|€|mètres?)(\s*(?:d[’']\s*)?(euros?|€))?/gi;

/** Les mots d'unité ne sont jamais l'indicateur : « 40 millions d'euros »
 *  porte sur un investissement, pas sur des euros. Sans cette exclusion,
 *  toutes les contradictions monétaires s'agrègent sous « euros ». */
const MOTS_UNITE = new Set(('euro euros million millions milliard milliards pourcent '
  + 'hectare hectares kilometre kilometres metre metres pourcentage').split(' '));

const UNITES = {
  million: 'million', millions: 'million', milliard: 'milliard', milliards: 'milliard',
  '%': '%', km: 'km', 'kilomètre': 'km', 'kilomètres': 'km',
  hectare: 'hectare', hectares: 'hectare', euro: 'euro', euros: 'euro', '€': 'euro',
  'mètre': 'm', 'mètres': 'm',
};

/**
 * Contradictions chiffrées : deux articles qui donnent des valeurs différentes
 * pour un même indicateur nommé.
 *
 * L'indicateur est le mot signifiant le plus proche du nombre, dans une fenêtre
 * de 60 caractères. C'est grossier, et c'est pour ça que le rendu affiche les
 * extraits : on ne demande pas au lecteur de croire l'appariement, on lui donne
 * les phrases.
 */
export function contradictions(sources) {
  const parCle = new Map();

  for (const s of sources) {
    const texte = s.texte || '';
    RE_MONTANT.lastIndex = 0;
    let m;
    while ((m = RE_MONTANT.exec(texte))) {
      const valeur = Number(m[1].replace(/[  .]/g, '').replace(',', '.'));
      if (!Number.isFinite(valeur)) continue;
      let unite = UNITES[m[2].toLowerCase()] || m[2].toLowerCase();
      if (m[4]) unite = `${unite} d’euros`;

      const avant = norm(texte.slice(Math.max(0, m.index - PARAMETRES.FENETRE_INDICATEUR), m.index));
      const apres = norm(texte.slice(m.index + m[0].length, m.index + m[0].length + PARAMETRES.FENETRE_INDICATEUR));
      // Le français place le nom avant la quantité (« un investissement de 40
      // millions »). On cherche donc d'abord à gauche, du plus proche au plus
      // lointain, puis à droite.
      const candidats = [...avant.split(' ').reverse(), ...apres.split(' ')]
        .filter((w) => w.length > 4 && !STOP.has(w) && !MOTS_UNITE.has(w));
      const indicateur = candidats[0];
      if (!indicateur) continue;

      const cle = `${indicateur}|${unite}`;
      if (!parCle.has(cle)) parCle.set(cle, []);
      parCle.get(cle).push({
        source: s.id, valeur, unite, indicateur,
        extrait: texte.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, ' ').trim(),
      });
    }
  }

  const out = [];
  for (const [cle, liste] of parCle) {
    const valeurs = [...new Set(liste.map((o) => o.valeur))];
    const sourcesDistinctes = new Set(liste.map((o) => o.source));
    if (valeurs.length < 2 || sourcesDistinctes.size < 2) continue;
    out.push({
      indicateur: cle.split('|')[0],
      unite: cle.split('|')[1],
      valeurs: valeurs.sort((a, b) => a - b),
      occurrences: liste.length,
      articles: [...sourcesDistinctes].sort(),
      extraits: liste.slice(0, 6),
    });
  }
  return out.sort((a, b) => b.valeurs.length - a.valeurs.length);
}

/* ------------------------------------------------------------------ entrée */

/**
 * Assemble un relevé complet.
 * @param {object} e
 * @param {Array}  e.sources  sorties d'extraction munies d'un id
 * @param {Array}  e.grappes  sortie de cluster.regrouper()
 * @param {object} e.outil    { nom, version } — jamais codé en dur ici
 * @param {string} e.dossier
 * @param {string} [e.ts]     horodatage, injectable pour les tests
 */
export async function produire({ sources, grappes, outil, dossier, ts }) {
  const ids = sources.map((s) => s.id).sort();
  const silences = detecter({ sources, grappes });
  const { acteurs, citationsTotal, citationsAttribuees } = compterActeurs(sources);

  return {
    t: 'releve',
    dossier,
    ts: ts || new Date().toISOString(),
    outil,
    parametres: { ...P_CLUSTER, ...P_SILENCES, ...PARAMETRES },
    sourcesIds: ids,
    empreinteCorpus: (await empreinteExacte(ids.join('\n'))).slice(0, 16),
    corroboration: corroboration(sources, grappes),
    chronologie: chronologie(sources),
    acteurs: {
      total: acteurs.length,
      citationsRelevees: citationsTotal,
      citationsAttribuees,
      liste: acteurs,
    },
    lexique: champsLexicaux(sources),
    contradictions: contradictions(sources),
    grappes: grappes.map((g) => ({
      id: g.id, titre: g.titre, volume: g.volume, editeurs: g.editeurs,
      formulations: g.formulations, corroboration: g.corroboration,
      verdict: g.verdict, empreintesIdentiques: g.empreintesIdentiques,
      recouvrementMedian: g.recouvrementMedian, membres: g.membres.map((m) => m.id),
    })),
    silences,
  };
}
