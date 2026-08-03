// empreinte.js — empreintes de texte pour la détection de reprise.
//
// TROIS instruments, trois régimes de certitude, jamais confondus :
//
//   empreinteExacte  SHA-256 sur forme normalisée → identité CONSTATÉE
//   recouvrement     % de 4-shingles partagés     → dérivation MESURÉE
//   empreinteFloue   SimHash 64 bits              → empreinte de journal, compacte
//
// Le SimHash ne décide d'aucun regroupement. Mesuré sur textes synthétiques :
// une reprise modifiée à 3 % se situe à 11-15 bits, un article sans rapport à
// 25-34 bits — les distributions se touchent, et la distance dépend de la
// longueur du texte. Le recouvrement de shingles sépare franchement (0,88 vs
// 0,00 sur les mêmes textes) et ne dépend pas de la longueur. Le SimHash reste
// stocké : 16 caractères permettent de comparer deux dossiers, ou de comparer
// après purge des textes, là où les ensembles de shingles ne sont plus là.
//
// Aucune dépendance, aucune API navigateur hors crypto.subtle — présent dans
// Firefox et dans Node 20+. Testable hors extension.

import { deaccent } from './normalize.js';

/** En deçà, le SimHash n'est pas discriminant : trop peu de shingles pour
 *  que la somme pondérée des bits ait un sens. Une empreinte non fiable ne
 *  fonde aucun regroupement — elle est déclarée, pas silencieusement utilisée. */
export const MIN_SHINGLES_FIABLE = 8;

export const TAILLE_SHINGLE = 4;

const FNV_BASE = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASQUE64 = 0xffffffffffffffffn;

/**
 * Forme normalisée pour l'empreinte exacte : espaces uniformisés, rien d'autre.
 * La casse et les accents sont conservés — « identique » doit vouloir dire
 * identique. Deux dépêches qui diffèrent par une majuscule ne sont pas une
 * reprise littérale, elles sont deux textes à comparer par le SimHash.
 */
export function normaliserPourEmpreinte(texte) {
  return String(texte ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** SHA-256 hexadécimal de la forme normalisée. */
export async function empreinteExacte(texte) {
  const net = normaliserPourEmpreinte(texte);
  if (!net) return null;
  const octets = new TextEncoder().encode(net);
  const buf = await crypto.subtle.digest('SHA-256', octets);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Mots retenus pour le SimHash. Les mots outils sont CONSERVÉS, contrairement
 * au traitement des titres : dans un corps d'article, « de la » et « selon le »
 * sont précisément ce qu'un copier-coller préserve et qu'une réécriture change.
 */
export function motsPourSimhash(texte) {
  return deaccent(String(texte ?? '').toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** k-shingles de mots. Ensemble : un shingle répété ne pèse pas double. */
export function shinglesTexte(mots, k = TAILLE_SHINGLE) {
  if (mots.length === 0) return new Set();
  if (mots.length < k) return new Set([mots.join(' ')]);
  const out = new Set();
  for (let i = 0; i <= mots.length - k; i++) out.add(mots.slice(i, i + k).join(' '));
  return out;
}

/** FNV-1a 64 bits. Rapide, sans dépendance, suffisamment uniforme ici. */
export function fnv1a64(s) {
  let h = FNV_BASE;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * FNV_PRIME) & MASQUE64;
  }
  return h;
}

/** SimHash 64 bits d'un ensemble de shingles. */
export function simhash(shingles) {
  const compteurs = new Int32Array(64);
  for (const sh of shingles) {
    const h = fnv1a64(sh);
    for (let b = 0; b < 64; b++) {
      compteurs[b] += (h >> BigInt(b)) & 1n ? 1 : -1;
    }
  }
  let out = 0n;
  for (let b = 0; b < 64; b++) if (compteurs[b] > 0) out |= 1n << BigInt(b);
  return out;
}

/** Représentation hexadécimale stable, 16 caractères, pour le journal JSON. */
export function versHex(bigint) {
  return bigint.toString(16).padStart(16, '0');
}

/**
 * Empreinte floue d'un texte.
 * @returns {{hash:string, mots:number, shingles:number, fiable:boolean}}
 */
export function empreinteFloue(texte, { k = TAILLE_SHINGLE } = {}) {
  const mots = motsPourSimhash(texte);
  const sh = shinglesTexte(mots, k);
  return {
    hash: versHex(simhash(sh)),
    mots: mots.length,
    shingles: sh.size,
    fiable: sh.size >= MIN_SHINGLES_FIABLE,
  };
}

/**
 * Recouvrement de shingles, dans les deux sens.
 *
 * `aDansB` = part des shingles de A présents dans B. Asymétrique à dessein :
 * un article tronqué à 70 % de sa source a un recouvrement de 1,00 vers elle,
 * alors que la source n'a que 0,70 vers lui. Le sens dit lequel dérive de
 * l'autre ; le taux dit à quel point.
 *
 * Affichable tel quel : « 94 % des séquences de 4 mots de cet article se
 * retrouvent dans celui du 14/02 » est un fait vérifiable par le lecteur.
 * « 4 bits sur 64 » ne l'est pas.
 */
export function recouvrement(a, b) {
  if (!a?.size || !b?.size) return { aDansB: 0, bDansA: 0, max: 0 };
  let inter = 0;
  const [petit, grand] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of petit) if (grand.has(x)) inter++;
  const aDansB = inter / a.size;
  const bDansA = inter / b.size;
  return {
    aDansB: Number(aDansB.toFixed(3)),
    bDansA: Number(bDansA.toFixed(3)),
    max: Number(Math.max(aDansB, bDansA).toFixed(3)),
  };
}

/** Distance de Hamming entre deux empreintes hexadécimales. 0 à 64.
 *  Conservée pour la comparaison inter-dossiers, pas pour le regroupement. */
export function hamming(hexA, hexB) {
  let x = (BigInt('0x' + hexA) ^ BigInt('0x' + hexB)) & MASQUE64;
  let n = 0;
  while (x) { x &= x - 1n; n++; }
  return n;
}

/** Médiane entière d'une liste de nombres. Renvoie null sur liste vide. */
export function mediane(valeurs) {
  if (!valeurs.length) return null;
  const t = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(t.length / 2);
  return t.length % 2 ? t[m] : Math.round((t[m - 1] + t[m]) / 2);
}
