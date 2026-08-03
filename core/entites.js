// entites.js — reconnaissance et nettoyage des entités nommées.
//
// Sans modèle : un lexique d'institutions et des règles de capitalisation.
// C'est approximatif par construction, et le rôle de ce module est de rendre
// l'approximation lisible plutôt que de la faire passer pour une extraction.
//
// Trois défauts constatés sur un dossier réel, trois traitements distincts :
//
//   « Modifié »          chrome d'interface aspiré dans le corps
//                        → les blocs qui ne sont pas des phrases sont écartés
//   « ACCORD »           intertitre en capitales pris pour un sigle
//                        → une graphie tout en capitales n'est un sigle que si
//                          elle est courte, ou si elle apparaît ailleurs en
//                          casse mixte
//   « Esmaeil Baghaei »  translittération concurrente de « Esmaïl Baghaï »
//   et « Esmaïl Baghaï » → fusion des variantes proches, la graphie la plus
//                          fréquente l'emporte

import { deaccent } from './normalize.js';

export const PARAMETRES = {
  LONGUEUR_SIGLE: 4,
  SIMILARITE_FUSION: 0.85,
  MAX_MOTS_ENTITE: 5,
};

const norm = (s) => deaccent(String(s || '').toLowerCase())
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Mots capitalisés qui ne sont jamais des entités : pronoms, déterminants,
 * dates, et le vocabulaire d'interface des sites de presse. « Modifié le »,
 * « Publié le », « Partager », « À lire aussi » se retrouvent dans le corps dès
 * que l'extraction attrape un bloc de chrome, et ressortent ensuite en tête de
 * la liste des acteurs.
 */
const NON_ENTITE = new Set((
  // grammaire
  'nous vous ils elles cette cet ces celui celle ceux leur leurs notre votre '
  + 'mais donc alors ainsi apres avant depuis selon pour dans il elle on que qui '
  + 'dont tout tous toute toutes plusieurs certains autre autres cela ceci '
  // temps
  + 'lundi mardi mercredi jeudi vendredi samedi dimanche janvier fevrier mars '
  + 'avril mai juin juillet aout septembre octobre novembre decembre hier '
  + 'aujourd hui demain matin soir '
  // chrome d'interface
  + 'modifie modifiee publie publiee partager partagez lire voir suivre suivez '
  + 'abonnez abonnement newsletter direct live commentaires commenter reagir '
  + 'imprimer sommaire menu accueil recherche rechercher connexion inscription '
  + 'video videos photo photos diaporama podcast replay chapitre mise jour '
  + 'temps lecture minutes source sources credits legende'
).split(' '));

const MOT_CAP = "[A-ZÀ-ÖØ-Þ][\\wÀ-ÖØ-öø-ÿ'’-]+";

/**
 * Désélision. « L'agence IRNA » forme une seule séquence capitalisée et
 * ressort comme l'entité « l agence irna ». On coupe l'élision quand elle est
 * suivie d'une minuscule — ce qui préserve « N'Diaye » et « O'Brien », suivis
 * d'une majuscule.
 */
export const deselider = (t) => String(t || '')
  .replace(/\b([A-Za-zÀ-ÿ])['’](?=[a-zà-öø-ÿ])/g, '$1 ');
const LIANT = "(?:de|du|des|d’|d'|la|le|les|et|ben|van|von)";
const RE_ENTITE = new RegExp(`${MOT_CAP}(?:\\s+(?:${LIANT}\\s+)?${MOT_CAP})*`, 'g');

export const INSTITUTIONS = ['prefecture', 'mairie', 'ministere', 'tribunal', 'syndicat',
  'gendarmerie', 'commissariat', 'parquet', 'rectorat', 'agglomeration', 'metropole',
  'departement', 'region', 'communaute de communes', 'conseil departemental',
  'conseil regional', 'chambre d agriculture', 'chambre de commerce',
  'cour des comptes', 'autorite environnementale', 'maison blanche', 'pentagone',
  'commission europeenne', 'conseil de securite', 'etat major'];

/**
 * Un bloc qui n'est pas une phrase n'est pas scanné : intertitres en capitales,
 * mentions de date, libellés d'interface. C'est là que « Modifié » et
 * « ACCORD » entraient dans la liste.
 */
export function estPhrase(bloc) {
  const t = String(bloc || '').trim();
  if (t.length < 40) return false;
  if (t === t.toUpperCase() && /[A-ZÀ-Þ]/.test(t)) return false;
  if (/^(publié|modifié|mis à jour|par |le \d|\d{1,2}\/\d{1,2})/i.test(t)) return false;
  return /[.!?…]/.test(t);
}

/**
 * Un mot tout en capitales est un sigle s'il est court, ou s'il apparaît
 * ailleurs dans le corpus en casse mixte. « AFP », « IRNA », « ONU » passent.
 * « ACCORD » et « DIRECT », intertitres, ne passent pas.
 */
export function estSigle(brut, formesMixtes) {
  const mots = brut.trim().split(/\s+/);
  if (mots.length > 1) return true; // séquence de plusieurs mots : pas un intertitre isolé
  const m = mots[0];
  if (m !== m.toUpperCase()) return true;
  return m.length <= PARAMETRES.LONGUEUR_SIGLE || formesMixtes.has(norm(m));
}

/** Distance de Levenshtein, bornée à des chaînes courtes (noms propres). */
export function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length; const n = b.length;
  if (!m || !n) return m || n;
  let prec = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cour = [i];
    for (let j = 1; j <= n; j++) {
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prec = cour;
  }
  return prec[n];
}

export const similarite = (a, b) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

/**
 * Fusionne les variantes de graphie d'un même nom. Deux entités fusionnent si
 * elles ont le même nombre de mots et une similarité supérieure au seuil.
 *
 * La contrainte du même nombre de mots évite d'absorber « Donald Trump » dans
 * « Donald Trump Junior ». Le seuil à 0,85 laisse « Donald Trump » et
 * « Donald Tusk » séparés (0,75) tout en réunissant « Baghaei » et « Baghaï ».
 */
export function fusionnerVariantes(entites) {
  const cles = [...entites.keys()].sort((a, b) => (entites.get(b).articles.size - entites.get(a).articles.size)
    || (entites.get(b).occurrences - entites.get(a).occurrences)
    || a.localeCompare(b));
  const fusions = [];

  for (let i = 0; i < cles.length; i++) {
    const a = cles[i];
    if (!entites.has(a)) continue;
    for (let j = i + 1; j < cles.length; j++) {
      const b = cles[j];
      if (!entites.has(b) || a === b) continue;
      if (a.split(' ').length !== b.split(' ').length) continue;
      if (similarite(a, b) < PARAMETRES.SIMILARITE_FUSION) continue;

      const va = entites.get(a); const vb = entites.get(b);
      for (const id of vb.articles) va.articles.add(id);
      va.occurrences += vb.occurrences;
      va.variantes.push(vb.affichage, ...vb.variantes);
      entites.delete(b);
      fusions.push({ retenue: va.affichage, absorbee: vb.affichage, similarite: Number(similarite(a, b).toFixed(3)) });
    }
  }
  return fusions;
}

/**
 * Entités d'un texte.
 * @returns {Map<string, {affichage, occurrences, multiMots, institution, variantes}>}
 */
export function entitesDuTexte(texte) {
  const out = new Map();
  const blocs = String(texte || '').split(/\n\n+/).filter(estPhrase).map(deselider);

  // Formes rencontrées en casse mixte : sert à distinguer un sigle d'un
  // intertitre crié.
  const formesMixtes = new Set();
  for (const bloc of blocs) {
    RE_ENTITE.lastIndex = 0;
    let m;
    while ((m = RE_ENTITE.exec(bloc))) {
      if (m[0] !== m[0].toUpperCase()) formesMixtes.add(norm(m[0]));
    }
  }

  const ajouter = (brut) => {
    const cle = norm(brut);
    if (cle.length < 4) return;
    if (cle.split(' ').length > PARAMETRES.MAX_MOTS_ENTITE) return;
    if (cle.split(' ').every((w) => NON_ENTITE.has(w))) return;
    if (!estSigle(brut, formesMixtes)) return;
    if (!out.has(cle)) {
      out.set(cle, {
        affichage: brut.trim(), occurrences: 0, variantes: [],
        multiMots: cle.split(' ').length > 1,
        institution: INSTITUTIONS.some((i) => cle.startsWith(i)),
      });
    }
    out.get(cle).occurrences++;
  };

  for (const bloc of blocs) {
    // Une majuscule ouvrant une phrase ou une citation n'est pas une entité.
    const phrases = bloc.split(/(?<=[.!?:])\s*[«"“]?\s*|(?<=[.!?])\s+/);
    const horsTete = new Map();
    for (const ph of phrases) {
      RE_ENTITE.lastIndex = 0;
      let m;
      while ((m = RE_ENTITE.exec(ph))) {
        if (/\s/.test(m[0])) { ajouter(m[0]); continue; }
        if (m.index !== 0) horsTete.set(m[0], (horsTete.get(m[0]) || 0) + 1);
      }
    }
    for (const [brut, n] of horsTete) for (let i = 0; i < n; i++) ajouter(brut);
  }

  const n = norm(texte);
  for (const inst of INSTITUTIONS) {
    const re = new RegExp(`${inst}(?:\\s+(?:de|du|des|d|la|le|les)\\s+[a-z0-9]+)?`, 'g');
    let m;
    while ((m = re.exec(n))) ajouter(m[0]);
  }
  return out;
}
