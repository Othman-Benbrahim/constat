// extraction.js — ce que le content script tire de la page courante.
//
// Fonctions pures sur un Document. Aucune API d'extension, aucun réseau :
// testable avec linkedom hors navigateur.
//
// Trois écarts assumés avec l'enrich.js de Sentinelle, chacun imposé par un
// détecteur de silences.js :
//
//   1. Les liens sont conservés, avec leur offset dans le texte. enrich.js fait
//      `p.textContent` et les perd tous — le détecteur 4 (« articles ne liant
//      aucun document source ») serait alors incalculable.
//   2. Aucune troncature. enrich.js coupe à 6000 caractères ; les liens de fin
//      d'article (« Lire le rapport », « Consulter l'arrêté ») sont précisément
//      ceux qu'on cherche.
//   3. Aucun repli sur une date absente. datePubliee vaut null, jamais la date
//      de versement.

import { canonicalUrl, registrableDomain } from './normalize.js';

const BRUIT = 'script,style,noscript,nav,header,footer,aside,form,iframe,'
  + 'figure figcaption,[role="navigation"],[role="banner"],[role="complementary"],'
  + '[aria-hidden="true"],.advertisement,.ad,.ads,.newsletter,.related,.share,'
  + '.comments,.cookie,.paywall,.lire-aussi,.a-lire-aussi';

const CANDIDATS = ['article', 'main', '[itemprop="articleBody"]', '[data-testid*="article"]',
  '.article-body', '.article__body', '.article-content', '.content-article',
  '.post-content', '.entry-content', '.chapo', '#article-body', '.story-body',
  '[class*="article-text"]', '[class*="articleBody"]'];

/** Certains sites n'utilisent pas <p> du tout : le texte est dans des div ou
 *  des span de classe « paragraph ». Sans ce second jeu, l'extraction rend zéro
 *  sur ces gabarits — et l'outil devient inutilisable là-dessus. */
const PARAGRAPHES = 'p, blockquote, [class*="paragraph"], [class*="Paragraph"]';

/** Longueur minimale d'un paragraphe retenu. Reprise de Sentinelle. */
const MIN_PARAGRAPHE = 40;

/** En deçà, on considère qu'aucun corps n'a été identifié. */
const MIN_CORPS = 200;

/**
 * Classification des liens sortants par liste explicite.
 * Un domaine absent de ces listes est classé « autre » — jamais deviné.
 * Le détecteur 4 ne compte que officiel / scientifique / juridique / donnees.
 */
export const DOMAINES = {
  juridique: [
    'legifrance.gouv.fr', 'courdecassation.fr', 'conseil-etat.fr',
    'eur-lex.europa.eu', 'curia.europa.eu', 'echr.coe.int',
  ],
  donnees: [
    'data.gouv.fr', 'insee.fr', 'ec.europa.eu/eurostat', 'data.europa.eu',
    'opendata.paris.fr',
  ],
  scientifique: [
    'doi.org', 'hal.science', 'arxiv.org', 'pubmed.ncbi.nlm.nih.gov',
    'ncbi.nlm.nih.gov', 'nature.com', 'sciencedirect.com', 'cairn.info',
    'persee.fr', 'theses.fr', 'openedition.org',
  ],
  officiel: [
    'gouv.fr', 'europa.eu', 'assemblee-nationale.fr', 'senat.fr',
    'ccomptes.fr', 'defenseurdesdroits.fr', 'who.int', 'un.org',
  ],
};

/** Extensions de fichier qui font d'un lien un jeu de données, quel que soit l'hôte. */
const EXT_DONNEES = /\.(csv|tsv|xlsx?|json|geojson|parquet)(\?|$)/i;

/**
 * Nature d'un lien. L'ordre compte : les listes les plus spécifiques d'abord,
 * car les domaines juridiques et de données français sont sous .gouv.fr.
 */
export function natureLien(href) {
  if (EXT_DONNEES.test(href)) return 'donnees';
  let hote;
  try { hote = new URL(href).hostname.toLowerCase().replace(/^www\./, ''); } catch { return 'autre'; }
  for (const nature of ['juridique', 'donnees', 'scientifique', 'officiel']) {
    for (const d of DOMAINES[nature]) {
      const dom = d.split('/')[0];
      if (hote === dom || hote.endsWith('.' + dom)) return nature;
    }
  }
  if (/\.(edu|ac\.uk)$/.test(hote)) return 'scientifique';
  return 'autre';
}

/** Les quatre natures qui comptent comme document source. */
export const NATURES_SOURCE = ['officiel', 'scientifique', 'juridique', 'donnees'];

/**
 * Choisit la zone la plus dense. Renvoie un CLONE nettoyé : retirer les nœuds
 * de bruit du document réel vandaliserait la page sous les yeux de
 * l'utilisateur, puisque cette fonction tourne sur le DOM vivant.
 */
function nomDe(el) {
  if (!el?.tagName) return '?';
  const cls = String(el.className || '').split(' ').filter(Boolean)[0];
  return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
}

function scorer(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll(BRUIT).forEach((n) => n.remove());
  const paras = [...clone.querySelectorAll(PARAGRAPHES)]
    .filter((p) => p.textContent.trim().length >= MIN_PARAGRAPHE);
  const longueur = paras.reduce((n, p) => n + p.textContent.trim().length, 0);
  return { clone, paras: paras.length, score: longueur + paras.length * 20, longueur };
}

/**
 * Choisit la zone la plus dense, en trois passes de plus en plus larges.
 *
 * La troisième passe existe parce que les gabarits de presse français réels ne
 * ressemblent pas aux fixtures : pas toujours de <article>, du texte dans des
 * div, des classes générées. Une extraction qui rend zéro sur ces pages rend
 * l'outil inutilisable là où il devrait servir.
 *
 * Renvoie un CLONE nettoyé : retirer les nœuds de bruit du document réel
 * vandaliserait la page, puisque cette fonction peut tourner sur un DOM vivant.
 */
export function choisirZone(doc) {
  const essais = [
    // 1. Conteneurs d'article connus.
    () => CANDIDATS.flatMap((s) => [...doc.querySelectorAll(s)]),
    // 2. Le corps entier.
    () => [doc.body].filter(Boolean),
    // 3. N'importe quel élément qui rassemble au moins trois paragraphes.
    () => [...(doc.body?.querySelectorAll('div, section, td') || [])]
      .filter((el) => el.querySelectorAll(PARAGRAPHES).length >= 3),
  ];

  let meilleure = null;
  let selecteur = null;
  let meilleurScore = 0;

  for (const essai of essais) {
    for (const z of essai()) {
      const r = scorer(z);
      if (r.score > meilleurScore) {
        meilleurScore = r.score;
        meilleure = r.clone;
        selecteur = nomDe(z);
      }
    }
    // On ne descend à la passe suivante que si les précédentes n'ont rien donné
    // d'exploitable : les conteneurs connus restent prioritaires quand ils
    // existent.
    if (meilleurScore >= MIN_CORPS) break;
  }
  return { zone: meilleure, selecteur };
}

/**
 * Assemble le texte paragraphe par paragraphe en tenant le compte des offsets,
 * pour que chaque lien et chaque citation puisse être resitué dans l'article.
 * Sans offset, l'attribution d'une citation à un acteur (détecteur 1) est
 * impossible, et « comptage visible » devient un vœu.
 */
export function extraireCorps(zone, urlPage) {
  if (!zone) return { texte: '', liens: [], citations: [], paragraphes: 0 };

  const blocs = [...zone.querySelectorAll(PARAGRAPHES)].filter((n) => {
    // Une citation en bloc est retenue telle quelle ; ses paragraphes internes
    // ne le sont pas, sans quoi le texte compte deux fois.
    if (n.tagName === 'BLOCKQUOTE') return true;
    if (n.closest('blockquote')) return false;
    // Un conteneur qui englobe d'autres paragraphes n'est pas un paragraphe :
    // sans ce filtre son texte est compté deux fois et les offsets sautent.
    return !n.querySelector(PARAGRAPHES);
  });

  const morceaux = [];
  const liens = [];
  let offset = 0;
  let paragraphes = 0;
  const domainePage = registrableDomain(urlPage || '') || '';

  for (const bloc of blocs) {
    const t = bloc.textContent.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    // Un paragraphe court n'entre pas dans le texte, mais ses liens sont
    // conservés : « Consulter l'arrêté » ou « Lire le rapport » tiennent en
    // trente caractères et sont précisément les liens que le détecteur 4
    // cherche. Les écarter par un seuil de longueur reproduirait la perte de
    // liens de l'enrich.js de Sentinelle par une autre porte.
    const court = t.length < MIN_PARAGRAPHE && bloc.tagName !== 'BLOCKQUOTE';
    if (court && !bloc.querySelector('a[href]')) continue;

    for (const a of bloc.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href');
      if (!href || /^(#|javascript:|mailto:)/i.test(href)) continue;
      let absolu;
      try { absolu = new URL(href, urlPage || 'https://exemple.invalid').toString(); } catch { continue; }
      const ancre = a.textContent.replace(/\s+/g, ' ').trim();
      const dom = registrableDomain(absolu);
      liens.push({
        href: absolu,
        canonical: canonicalUrl(absolu) || absolu,
        ancre,
        domaine: dom || 'inconnu',
        interne: !!dom && dom === domainePage,
        nature: natureLien(absolu),
        // null quand le lien vient d'un paragraphe non retenu dans le texte :
        // il n'y a alors pas d'offset honnête à donner.
        offset: court ? null : offset + Math.max(0, t.indexOf(ancre)),
        dansTexte: !court,
      });
    }

    if (court) continue;

    if (bloc.tagName === 'BLOCKQUOTE') {
      morceaux.push({ texte: t, offset, blockquote: true });
    } else {
      morceaux.push({ texte: t, offset, blockquote: false });
      paragraphes++;
    }
    offset += t.length + 2; // séparateur \n\n
  }

  const texte = morceaux.map((m) => m.texte).join('\n\n');
  return { texte, liens, citations: extraireCitations(texte, morceaux), paragraphes };
}

/** Guillemets français, anglais, et blocs de citation. */
const RE_CITATIONS = [
  { marqueur: '«»', re: /«\s*([^«»]{15,600}?)\s*»/g },
  { marqueur: '""', re: /[“"]([^“”"]{15,600}?)[”"]/g },
];

export function extraireCitations(texte, morceaux = []) {
  const out = [];
  for (const { marqueur, re } of RE_CITATIONS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(texte))) {
      out.push({ texte: m[1], marqueur, debut: m.index, fin: m.index + m[0].length });
    }
  }
  for (const bloc of morceaux.filter((b) => b.blockquote)) {
    if (out.some((c) => c.debut >= bloc.offset && c.debut < bloc.offset + bloc.texte.length)) continue;
    out.push({ texte: bloc.texte, marqueur: 'blockquote', debut: bloc.offset, fin: bloc.offset + bloc.texte.length });
  }
  return out.sort((a, b) => a.debut - b.debut);
}

const ISO = /^\d{4}-\d{2}-\d{2}/;

/** Ne renvoie une date que si elle est analysable. Sinon null, jamais un repli. */
function versISO(brut) {
  if (!brut) return null;
  const s = String(brut).trim();
  const d = new Date(ISO.test(s) ? s : Date.parse(s));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function jsonLd(doc) {
  const out = [];
  for (const n of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(n.textContent);
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
      for (const o of out.slice()) if (Array.isArray(o?.['@graph'])) out.push(...o['@graph']);
    } catch { /* un JSON-LD cassé n'est pas une erreur d'extraction */ }
  }
  return out;
}

const meta = (doc, sel) => doc.querySelector(sel)?.getAttribute('content')?.trim() || null;

export function extraireMeta(doc, urlPage) {
  const ld = jsonLd(doc);
  const art = ld.find((o) => /Article|NewsArticle|ReportageNewsArticle|BlogPosting/.test(String(o?.['@type'])));

  const canonicalBrut = doc.querySelector('link[rel="canonical"]')?.getAttribute('href')
    || meta(doc, 'meta[property="og:url"]') || urlPage;
  let canonical = urlPage;
  try { canonical = canonicalUrl(new URL(canonicalBrut, urlPage).toString()) || urlPage; } catch { /* garde urlPage */ }

  const auteursBruts = []
    .concat(art?.author ?? [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean);
  const auteurMeta = meta(doc, 'meta[name="author"]') || doc.querySelector('[rel="author"]')?.textContent?.trim();
  const auteurs = [...new Set(auteursBruts.length ? auteursBruts : (auteurMeta ? [auteurMeta] : []))];

  const titre = doc.querySelector('h1')?.textContent?.replace(/\s+/g, ' ').trim()
    || meta(doc, 'meta[property="og:title"]')
    || doc.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim()
    || null;

  const datePubliee = versISO(art?.datePublished)
    || versISO(meta(doc, 'meta[property="article:published_time"]'))
    || versISO(doc.querySelector('time[datetime]')?.getAttribute('datetime'));

  const dateModifiee = versISO(art?.dateModified)
    || versISO(meta(doc, 'meta[property="article:modified_time"]'));

  return {
    canonical,
    editeur: registrableDomain(canonical) || 'inconnu',
    titre,
    auteurs,
    datePubliee,
    dateModifiee,
    // Anomalie constatée, pas corrigée : le relevé la signale (§6.2).
    datesIncoherentes: !!(datePubliee && dateModifiee && dateModifiee < datePubliee),
  };
}

/**
 * Point d'entrée du content script.
 * @param {Document} doc DOM vivant de l'onglet
 * @param {string} urlPage URL de l'onglet au moment du versement
 */
/**
 * @param {Document} doc DOM vivant de l'onglet
 * @param {string} urlPage URL de l'onglet au moment du versement
 * @param {object} [contexte] { pret } — readyState au moment de la capture.
 *   Une page capturée avant la fin du rendu peut n'avoir aucun corps ; c'est
 *   une cause d'échec distincte d'un gabarit non reconnu, et le diagnostic doit
 *   permettre de les distinguer.
 */
export function extraire(doc, urlPage, contexte = {}) {
  const { zone, selecteur } = choisirZone(doc);
  const corps = extraireCorps(zone, urlPage);
  const m = extraireMeta(doc, urlPage);

  const liensDocument = [...doc.querySelectorAll('a[href]')].length;
  const echec = !corps.texte ? 'aucun bloc de texte'
    : corps.texte.length < MIN_CORPS ? `corps trop court (${corps.texte.length} caractères)`
    : null;

  return {
    url: urlPage,
    ...m,
    texte: corps.texte,
    liens: corps.liens,
    citations: corps.citations,
    diagnostic: {
      zone: selecteur,
      pret: contexte.pret || null,
      paragraphes: corps.paragraphes,
      caracteres: corps.texte.length,
      liensCorps: corps.liens.length,
      liensHorsCorps: Math.max(0, liensDocument - corps.liens.length),
      echec,
    },
  };
}
