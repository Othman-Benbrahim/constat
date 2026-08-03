// normalize.js — canonicalisation d'URL, de titre, et mesures de similarité.
// Aucune dépendance, aucune API navigateur : testable hors extension.

const TRACKING_PARAMS = [
  /^utm_/i, /^ga_/i, /^mc_/i, /^pk_/i, /^piwik_/i, /^hsa_/i, /^vero_/i,
  /^fbclid$/i, /^gclid$/i, /^dclid$/i, /^msclkid$/i, /^twclid$/i, /^igshid$/i,
  /^ref$/i, /^referrer$/i, /^source$/i, /^src$/i, /^cmp$/i, /^CMP$/,
  /^ito$/i, /^at_medium$/i, /^at_campaign$/i, /^at_custom/i, /^ns_/i,
  /^sh$/i, /^s$/i, /^smid$/i, /^partner$/i, /^spm$/i, /^amp$/i, /^outputType$/i,
];

const MULTI_LABEL_TLD = new Set([
  'co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'gouv', 'asso', 'or', 'ne',
]);

// Préfixes éditoriaux qui n'appartiennent pas au titre.
const TITLE_PREFIXES = /^(breaking|urgent|alerte|flash|exclusif|exclusive|live|direct|en direct|vidéo|video|photos?|analyse|édito|opinion|tribune|décryptage|reportage|interview|update|mise à jour)\s*[:\-–—]\s*/i;

/**
 * Canonicalise une URL : hôte minuscule sans www, paramètres de suivi retirés,
 * fragment retiré, variantes AMP ramenées à la page source.
 * Retourne null si l'entrée n'est pas une URL absolue exploitable.
 */
export function canonicalUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  u.protocol = 'https:';
  u.hash = '';
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.port = '';

  const keep = [];
  for (const [k, v] of u.searchParams) {
    if (TRACKING_PARAMS.some((re) => re.test(k))) continue;
    keep.push([k, v]);
  }
  u.search = '';
  keep.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  for (const [k, v] of keep) u.searchParams.append(k, v);

  // Variantes AMP : /amp, /amp/, .amp, ?amp
  u.pathname = u.pathname
    .replace(/\/amp\/?$/i, '/')
    .replace(/\.amp$/i, '')
    .replace(/\/{2,}/g, '/');
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/$/, '');

  return u.toString();
}

/**
 * Domaine enregistrable approximatif. Approximation volontaire : pas de liste
 * PSL embarquée. Suffisant pour distinguer deux éditeurs.
 */
export function registrableDomain(raw) {
  let host;
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
  const labels = host.split('.');
  if (labels.length <= 2) return host;
  const secondLast = labels[labels.length - 2];
  const take = MULTI_LABEL_TLD.has(secondLast) ? 3 : 2;
  return labels.slice(-take).join('.');
}

/** Retire les diacritiques sans dépendre d'une locale. */
export function deaccent(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Titre normalisé : sert de clé de comparaison textuelle, pas d'affichage.
 * Retire préfixe éditorial, suffixe d'éditeur, ponctuation, casse, accents.
 */
export function normalizeTitle(raw) {
  if (!raw) return '';
  let t = String(raw).replace(/\s+/g, ' ').trim();
  t = t.replace(TITLE_PREFIXES, '');
  // Suffixe d'éditeur : « Titre - Le Monde », « Titre | Reuters »
  t = t.replace(/\s+[|·—–\-]\s+[^|·—–\-]{2,30}$/u, '');
  t = deaccent(t).toLowerCase();
  t = t.replace(/[’'`]/g, "'");
  t = t.replace(/[^a-z0-9' ]+/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

const STOPWORDS = new Set(
  ('le la les un une des du de au aux et ou ni mais donc car que qui quoi dont en ' +
   'pour par sur sous dans avec sans vers chez entre apres avant depuis contre selon il elle ils ' +
   'elles on nous vous se sa son ses leur leurs ce cet cette ces est sont etre ete plus moins tres ' +
   'the an of to in on at for with from by and but is are was were be been has have had it its ' +
   'this that these those as not new say says said after before over into out about').split(' ')
);

/** Tokens signifiants d'un titre normalisé. */
export function tokens(normTitle) {
  return normTitle.split(' ').filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** k-shingles de mots. Retombe sur les tokens seuls si le titre est court. */
export function shingles(toks, k = 2) {
  if (toks.length < k) return new Set(toks);
  const out = new Set();
  for (let i = 0; i <= toks.length - k; i++) out.add(toks.slice(i, i + k).join(' '));
  return out;
}

export function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Recouvrement asymétrique : utile quand un titre est un préfixe de l'autre. */
export function containment(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of small) if (large.has(x)) inter++;
  return inter / small.size;
}

/**
 * Score de similarité entre deux titres déjà normalisés.
 * Combine bigrammes (ordre des mots) et recouvrement lexical (robustesse aux
 * réécritures partielles).
 */
export function titleSimilarity(normA, normB) {
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  const ta = tokens(normA);
  const tb = tokens(normB);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setA = new Set(ta);
  const setB = new Set(tb);
  const bi = jaccard(shingles(ta, 2), shingles(tb, 2));
  const lex = jaccard(setA, setB);
  const cont = containment(setA, setB);
  return Math.max(0.65 * bi + 0.35 * lex, cont >= 0.85 && Math.min(ta.length, tb.length) >= 4 ? 0.7 : 0);
}
