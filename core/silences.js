// silences.js — les absences du corpus.
//
// Ce module ne fait que compter. Aucune inférence, aucune interprétation,
// aucun verdict. Chaque constat expose la justification chiffrée qui le rend
// vérifiable, et chaque détecteur qui n'a pas pu tourner le déclare au lieu de
// renvoyer zéro.
//
// Un zéro et un non-calculé ne sont pas la même chose. « 0 acteur jamais cité »
// est un résultat ; « aucune citation détectée dans tout le corpus » est une
// panne. Sans le compteur de contrôle, les deux s'affichent pareil.
//
// Ce bloc décrit le dossier, pas la presse. Une absence ici est une absence
// dans les articles qui ont été versés.

import { NATURES_SOURCE } from './extraction.js';
import { entitesDuTexte, fusionnerVariantes } from './entites.js';
import { deaccent } from './normalize.js';
import { mediane } from './empreinte.js';

export const PARAMETRES = {
  MIN_ARTICLES_ACTEUR: 3,
  FENETRE_ATTRIBUTION: 120,
  MIN_OCCURRENCES_TERME: 8,
  MIN_ARTICLES_COTE: 5,
  FACTEUR_TROU: 3,
  TROU_MINIMAL_H: 48,
  MIN_ARTICLES_DATES: 10,
  MAX_PART_SANS_DATE: 0.30,
  MIN_PART_CORPS: 0.50,
};

const VERBES_ATTRIBUTION = ['declare', 'affirme', 'explique', 'selon', 'indique',
  'precise', 'estime', 'ajoute', 'souligne', 'assure', 'confie', 'annonce',
  'rappelle', 'martele', 'reconnait', 'dement'];

const MARQUEURS_ABANDON = ['retire', 'retiree', 'suspendu', 'suspendue', 'ecarte',
  'ecartee', 'abandonne', 'abandonnee', 'renonce', 'enterre', 'leve', 'levee',
  'annule', 'annulee', 'remplace', 'caduc', 'obsolete'];

const INSTITUTIONS = ['prefecture', 'mairie', 'ministere', 'tribunal', 'syndicat',
  'gendarmerie', 'commissariat', 'parquet', 'rectorat', 'agglomeration',
  'metropole', 'departement', 'region', 'communaute de communes',
  'conseil departemental', 'conseil regional', 'chambre d agriculture',
  'chambre de commerce', 'cour des comptes', 'autorite environnementale'];

/** Mots capitalisés qui ne sont jamais des acteurs : pronoms, déterminants,
 *  jours, mois. Sans cette liste, « Nous » ouvrant une citation devient une
 *  entité nommée présente dans tout le corpus. */
const CAP_NON_ENTITE = new Set(('nous vous ils elles cette cet ces celui celle ceux '
  + 'leur leurs notre votre mais donc alors ainsi apres avant depuis selon pour dans '
  + 'lundi mardi mercredi jeudi vendredi samedi dimanche janvier fevrier mars avril '
  + 'mai juin juillet aout septembre octobre novembre decembre '
  + 'il elle on que qui dont tout tous toute toutes plusieurs certains autre autres').split(' '));

const norm = (s) => deaccent(String(s || '').toLowerCase()).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/* ------------------------------------------------------------------ acteurs */

export { entitesDuTexte } from './entites.js';

/**
 * Attribution d'une citation à une entité.
 *
 * La zone d'attribution ne franchit pas la frontière de phrase : une entité
 * sujet de la phrase PRÉCÉDENTE n'est pas l'auteur de la citation. Sans cette
 * borne, une fenêtre de 120 caractères crédite tout ce qui traîne dans le
 * paragraphe — le détecteur ne trouve alors plus jamais d'acteur non cité, et
 * son zéro ne veut rien dire.
 */
export function attribuer(texte, citations, clesEntites, fenetre = PARAMETRES.FENETRE_ATTRIBUTION) {
  const attribuees = new Map();
  let total = 0;

  for (const c of citations) {
    const gauche = texte.slice(Math.max(0, c.debut - fenetre), c.debut);
    const avant = gauche.slice(gauche.search(/[^.!?]*$/));

    const droite = texte.slice(c.fin, Math.min(texte.length, c.fin + fenetre));
    // Une incise d'attribution suit la citation en minuscule ou après une
    // virgule (« … », explique le préfet / « … » selon lui). Si ce qui suit
    // commence par une majuscule, c'est une phrase nouvelle : il n'y a pas
    // d'attribution à droite, et créditer serait faux.
    const suite = droite.replace(/^[\s»"”]*/, '');
    const apres = /^[A-ZÀ-ÖØ-Þ]/.test(suite)
      ? ''
      : suite.slice(0, (suite.search(/[.!?]/) + 1) || suite.length);

    const zone = norm(avant + ' ' + apres);
    const aVerbe = VERBES_ATTRIBUTION.some((v) => zone.includes(v));

    let touchee = false;
    for (const cle of clesEntites) {
      if (!zone.includes(cle)) continue;
      const adjacent = norm(avant.slice(-60)).includes(cle) || norm(apres.slice(0, 60)).includes(cle);
      if (!adjacent && !aVerbe) continue;
      attribuees.set(cle, (attribuees.get(cle) || 0) + 1);
      touchee = true;
    }
    if (touchee) total++;
  }
  return { attribuees, total };
}

/* ------------------------------------------------------------------ termes */

const STOP = new Set(('le la les un une des du de au aux et ou ni mais donc car que qui quoi dont en '
  + 'pour par sur sous dans avec sans vers chez entre apres avant depuis contre selon il elle ils elles '
  + 'on nous vous se sa son ses leur leurs ce cet cette ces est sont etre ete plus moins tres a ai as '
  + 'ete avoir fait cela tout tous toute toutes meme aussi ainsi alors deja encore').split(' '));

function motsSignifiants(texte) {
  return norm(texte).split(' ').filter((m) => m.length > 4 && !STOP.has(m));
}

/* ------------------------------------------------------------------ helpers */

const constat = (code, valeur, justification, details = []) => ({
  code, constat: valeur, justification, details,
});

const nonCalcule = (code, raison, chiffre) => ({ code, raison, chiffre });

/* ---------------------------------------------------------------- détecteurs */

/**
 * Comptage brut des acteurs : combien d'articles nomment chacun, combien le
 * citent entre guillemets. Sert au relevé (§6.2) et au détecteur 1.
 * @returns {{acteurs:Array, citationsTotal:number, citationsAttribuees:number}}
 */
export function compterActeurs(sources) {
  const nommes = new Map();   // clé → { affichage, articles:Set }
  const cites = new Map();    // clé → Set d'articles
  let citationsAttribuees = 0;
  let citationsTotal = 0;

  for (const s of sources) {
    if (!s.texte) continue;
    const ents = entitesDuTexte(s.texte);
    for (const [cle, v] of ents) {
      if (!nommes.has(cle)) {
        nommes.set(cle, {
          affichage: v.affichage, articles: new Set(), occurrences: 0, variantes: [],
          multiMots: v.multiMots, institution: v.institution,
        });
      }
      nommes.get(cle).articles.add(s.id);
      nommes.get(cle).occurrences += v.occurrences;
    }
    citationsTotal += (s.citations || []).length;
    const { attribuees, total } = attribuer(s.texte, s.citations || [], [...ents.keys()]);
    citationsAttribuees += total;
    for (const [cle] of attribuees) {
      if (!cites.has(cle)) cites.set(cle, new Set());
      cites.get(cle).add(s.id);
    }
  }

  // Fusion des variantes de graphie : « Esmaeil Baghaei » et « Esmaïl Baghaï »
  // sont la même personne translittérée deux fois, et comptaient pour deux.
  const fusions = fusionnerVariantes(nommes);

  // Déduplication des entités imbriquées : « Gard » est absorbé par
  // « préfecture du Gard » dès lors qu'il n'apparaît dans aucun article
  // supplémentaire. Sans cela, une même institution compte plusieurs fois et
  // le nombre d'acteurs non cités est mécaniquement gonflé.
  const cles = [...nommes.keys()].sort((a, b) => b.length - a.length);
  for (const longue of cles) {
    if (!nommes.has(longue)) continue;
    for (const courte of cles) {
      if (courte === longue || !nommes.has(courte)) continue;
      if (!longue.includes(courte)) continue;
      const arts = nommes.get(courte).articles;
      const couvre = [...arts].every((id) => nommes.get(longue).articles.has(id));
      if (couvre) nommes.delete(courte);
    }
  }

  const acteurs = [...nommes.entries()]
    .map(([cle, v]) => ({
      entite: v.affichage,
      nomme: v.articles.size,
      cite: cites.get(cle)?.size || 0,
      occurrences: v.occurrences,
      // Une entité d'un seul mot est le plus souvent un lieu ou un pays :
      // « Gaza », « Brent », « Khasab ». Rien ici ne permet de la distinguer
      // d'un acteur, et deviner serait présenter une inférence comme une
      // observation. Elle est comptée dans l'inventaire, mais exclue du
      // détecteur « jamais cité » — où elle produirait un faux positif
      // certain, puisqu'un lieu ne parle jamais.
      locutrice: v.multiMots || v.institution,
      variantes: [...new Set(v.variantes)],
      sources: [...v.articles].sort(),
      _cle: cle,
    }))
    .sort((a, b) => b.nomme - a.nomme || b.occurrences - a.occurrences
      || a.entite.localeCompare(b.entite));

  return { acteurs, citationsTotal, citationsAttribuees, fusions };
}

export function acteursNonCites(sources) {
  const { acteurs, citationsTotal, citationsAttribuees, fusions } = compterActeurs(sources);
  const locutrices = acteurs.filter((a) => a.locutrice);
  const retenus = locutrices.filter((a) => a.nomme >= PARAMETRES.MIN_ARTICLES_ACTEUR);
  const jamais = retenus.filter((a) => a.cite === 0);

  return {
    citationsTotal,
    citationsAttribuees,
    acteursDetectes: acteurs.length,
    resultat: constat('acteur-non-cite', jamais.length, {
      entitesDetectees: acteurs.length,
      entitesMonoMot: acteurs.length - locutrices.length,
      variantesFusionnees: fusions.length,
      acteursRetenus: retenus.length,
      citationsRelevees: citationsTotal,
      citationsAttribuees,
      seuilArticles: PARAMETRES.MIN_ARTICLES_ACTEUR,
    }, jamais),
  };
}

export function termesEffondres(sources) {
  const dates = sources.filter((s) => s.datePubliee).sort((a, b) => a.datePubliee.localeCompare(b.datePubliee));
  const occurrences = new Map(); // terme → [{ id, date, n }]

  for (const s of dates) {
    const compte = new Map();
    for (const m of motsSignifiants(s.texte || '')) compte.set(m, (compte.get(m) || 0) + 1);
    for (const [terme, n] of compte) {
      if (!occurrences.has(terme)) occurrences.set(terme, []);
      occurrences.get(terme).push({ id: s.id, date: s.datePubliee, n });
    }
  }

  const details = [];
  for (const [terme, liste] of occurrences) {
    const total = liste.reduce((x, o) => x + o.n, 0);
    if (total < PARAMETRES.MIN_OCCURRENCES_TERME) continue;

    const derniere = liste[liste.length - 1].date;
    const avant = dates.filter((s) => s.datePubliee <= derniere);
    const apres = dates.filter((s) => s.datePubliee > derniere);
    if (avant.length < PARAMETRES.MIN_ARTICLES_COTE || apres.length < PARAMETRES.MIN_ARTICLES_COTE) continue;

    // Ce qui est comptable : combien d'articles postérieurs contiennent le
    // terme accompagné d'un marqueur d'abandon. Zéro n'est pas « personne ne
    // commente la disparition » — c'est zéro article contenant les deux.
    const commentaires = dates.filter((s) => {
      const n = norm(s.texte || '');
      return n.includes(terme) && MARQUEURS_ABANDON.some((mk) => n.includes(mk));
    }).length;

    details.push({
      terme,
      occurrencesAvant: total,
      dernierArticle: derniere,
      articlesApres: apres.length,
      articlesTermeEtMarqueur: commentaires,
      sources: liste.map((o) => o.id),
    });
  }

  details.sort((a, b) => b.occurrencesAvant - a.occurrencesAvant);
  return constat('terme-effondre', details.length, {
    articlesDates: dates.length,
    seuilOccurrences: PARAMETRES.MIN_OCCURRENCES_TERME,
    seuilArticlesCote: PARAMETRES.MIN_ARTICLES_COTE,
    marqueursAbandon: MARQUEURS_ABANDON.length,
  }, details);
}

export function trousDossier(sources) {
  const dates = sources.map((s) => s.datePubliee).filter(Boolean).sort();
  const ecarts = [];
  for (let i = 1; i < dates.length; i++) {
    ecarts.push((Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 3600000);
  }
  const med = mediane(ecarts.map((h) => Math.round(h * 100))) / 100;
  const seuil = Math.max(med * PARAMETRES.FACTEUR_TROU, PARAMETRES.TROU_MINIMAL_H);

  const details = [];
  for (let i = 1; i < dates.length; i++) {
    const h = (Date.parse(dates[i]) - Date.parse(dates[i - 1])) / 3600000;
    if (h >= seuil) {
      details.push({
        debut: dates[i - 1], fin: dates[i],
        heures: Math.round(h), jours: Math.round(h / 24 * 10) / 10,
      });
    }
  }
  return constat('trou-dossier', details.length, {
    articlesDates: dates.length,
    articlesSansDate: sources.length - dates.length,
    intervalleMedianHeures: Number(med.toFixed(1)),
    seuilHeures: Math.round(seuil),
  }, details);
}

export function articlesSansDocumentSource(sources) {
  const parNature = Object.fromEntries(NATURES_SOURCE.map((n) => [n, 0]));
  const avec = [];

  for (const s of sources) {
    const natures = new Set((s.liens || [])
      .filter((l) => NATURES_SOURCE.includes(l.nature))
      .map((l) => l.nature));
    if (natures.size) {
      avec.push({ id: s.id, natures: [...natures] });
      for (const n of natures) parNature[n]++;
    }
  }

  return constat('article-sans-source', sources.length - avec.length, {
    total: sources.length,
    articlesAvecDocumentSource: avec.length,
    parNature,
    naturesReconnues: NATURES_SOURCE,
  }, avec);
}

export function grappesOrigineUnique(grappes) {
  const details = grappes
    .filter((g) => g.volume >= 2 && (g.verdict === 'reprise-litterale' || g.verdict === 'reprise-mesuree'))
    .map((g) => ({
      grappe: g.id,
      volume: g.volume,
      editeurs: g.editeurs,
      formulations: g.formulations,
      regime: g.verdict === 'reprise-litterale' ? 'constate' : 'mesure',
      empreintesIdentiques: g.empreintesIdentiques,
      recouvrementMedian: g.recouvrementMedian,
      sources: g.membres.map((m) => m.id),
    }))
    .sort((a, b) => b.volume - a.volume);

  return constat('grappe-origine-unique', details.length, {
    grappes: grappes.length,
    grappesPlurielles: grappes.filter((g) => g.volume >= 2).length,
  }, details);
}

/* ------------------------------------------------------------------- entrée */

/**
 * @param {object} entree
 * @param {Array} entree.sources sorties d'extraction, munies d'un id
 * @param {Array} entree.grappes sorties de cluster.regrouper()
 * @returns {{calcules:Array, nonCalcules:Array, parametres:object}}
 */
export function detecter({ sources, grappes }) {
  const calcules = [];
  const nonCalcules = [];

  const total = sources.length;
  const dates = sources.filter((s) => s.datePubliee).length;
  const partSansDate = total ? (total - dates) / total : 1;
  const avecCorps = sources.filter((s) => (s.texte || '').length >= 200).length;
  const partCorps = total ? avecCorps / total : 0;

  // 1 — acteurs
  //
  // Deux motifs de non-calcul distincts, et aucun ne doit s'afficher « 0 ».
  // Un zéro dit « le corpus ne comporte aucun acteur muet ». Une population
  // vide dit « la question n'a pas été posée ». Les confondre, c'est produire
  // un résultat là où il n'y a qu'un corpus trop mince — la faute même que le
  // compteur de contrôle était censé empêcher.
  const a = acteursNonCites(sources);
  if (a.citationsAttribuees === 0) {
    nonCalcules.push(nonCalcule('acteur-non-cite', 'aucune citation attribuée dans tout le corpus', {
      citationsRelevees: a.citationsTotal, articles: total,
    }));
  } else if (a.resultat.justification.acteursRetenus === 0) {
    nonCalcules.push(nonCalcule('acteur-non-cite',
      `aucun acteur n’apparaît dans au moins ${PARAMETRES.MIN_ARTICLES_ACTEUR} articles`, {
        acteursDetectes: a.acteursDetectes, seuilArticles: PARAMETRES.MIN_ARTICLES_ACTEUR, articles: total,
      }));
  } else {
    calcules.push(a.resultat);
  }

  // 2 — termes
  const MIN_TERMES = PARAMETRES.MIN_ARTICLES_COTE * 2;
  if (partSansDate > PARAMETRES.MAX_PART_SANS_DATE) {
    nonCalcules.push(nonCalcule('terme-effondre', 'trop d’articles sans date', {
      articlesSansDate: total - dates, total, seuil: PARAMETRES.MAX_PART_SANS_DATE,
    }));
  } else if (dates < MIN_TERMES) {
    nonCalcules.push(nonCalcule('terme-effondre',
      'corpus trop court pour observer un avant et un après', {
        articlesDates: dates, seuil: MIN_TERMES, articlesParCote: PARAMETRES.MIN_ARTICLES_COTE,
      }));
  } else {
    calcules.push(termesEffondres(sources));
  }

  // 3 — trous
  if (dates < PARAMETRES.MIN_ARTICLES_DATES) {
    nonCalcules.push(nonCalcule('trou-dossier', 'trop peu d’articles datés', {
      articlesDates: dates, seuil: PARAMETRES.MIN_ARTICLES_DATES,
    }));
  } else {
    calcules.push(trousDossier(sources));
  }

  // 4 — documents source
  if (partCorps < PARAMETRES.MIN_PART_CORPS) {
    nonCalcules.push(nonCalcule('article-sans-source', 'corps extrait pour trop peu d’articles', {
      articlesAvecCorps: avecCorps, total, seuil: PARAMETRES.MIN_PART_CORPS,
    }));
  } else {
    calcules.push(articlesSansDocumentSource(sources));
  }

  // 5 — origine unique
  const plurielles = grappes.filter((g) => g.volume >= 2).length;
  if (!plurielles) {
    nonCalcules.push(nonCalcule('grappe-origine-unique',
      'aucune grappe ne compte plus d’un article', { grappes: grappes.length, articles: total }));
  } else {
    calcules.push(grappesOrigineUnique(grappes));
  }

  return { calcules, nonCalcules, parametres: { ...PARAMETRES } };
}
