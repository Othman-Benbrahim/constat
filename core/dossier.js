// dossier.js — persistance des dossiers.
//
// Journal append-only : une entrée n'est jamais réécrite. Une correction est
// une nouvelle entrée qui remplace la précédente à la lecture. C'est ce qui
// permet de reconstruire l'état du corpus tel qu'il était au moment d'un
// relevé donné, et donc de rejouer ce relevé (décision D1).
//
// Le stockage est injecté. En test c'est une Map, dans l'extension c'est
// browser.storage.local — aucune API d'extension n'apparaît ici.
//
// Disposition des clés :
//   dossiers                    index des identifiants
//   j:<dossier>                 journal (tableau d'entrées)
//   txt:<sha256>                corps d'article, dédupliqué par hash
//
// Le corps n'est pas dans le journal : celui-ci reste léger à parcourir, et
// deux URL au même texteHash sont une reprise littérale constatée sans calcul.

import { empreinteExacte } from './empreinte.js';

/** Adaptateur de test. L'extension passera un objet équivalent adossé à
 *  browser.storage.local. */
export function stockageMemoire(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    async get(cle) { return m.has(cle) ? structuredClone(m.get(cle)) : null; },
    async set(cle, valeur) { m.set(cle, structuredClone(valeur)); },
    async remove(cle) { m.delete(cle); },
    async keys() { return [...m.keys()]; },
  };
}

const CLE_INDEX = 'dossiers';
const cleJournal = (id) => `j:${id}`;
const cleTexte = (hash) => `txt:${hash}`;

export class Dossiers {
  constructor(stockage, { horloge = () => new Date().toISOString() } = {}) {
    this.s = stockage;
    this.horloge = horloge;
  }

  async index() {
    return (await this.s.get(CLE_INDEX)) || [];
  }

  async journal(id) {
    return (await this.s.get(cleJournal(id))) || [];
  }

  /** Ajoute une entrée. Ne réécrit jamais. */
  async ajouter(id, entree) {
    const j = await this.journal(id);
    const complete = { ...entree, ts: entree.ts || this.horloge() };
    j.push(complete);
    await this.s.set(cleJournal(id), j);
    return complete;
  }

  /**
   * Crée un dossier autour d'une question d'intelligence (étape 1 du skill).
   * Les quatre champs sont exigés : un dossier sans décision sous-jacente est
   * une collection de liens, pas une instruction.
   */
  async creer({ id, question, perimetre, horizon, decision }) {
    for (const [nom, v] of Object.entries({ question, perimetre, horizon, decision })) {
      if (!String(v || '').trim()) throw new Error(`champ manquant : ${nom}`);
    }
    const idx = await this.index();
    if (idx.includes(id)) throw new Error(`dossier déjà existant : ${id}`);
    await this.s.set(CLE_INDEX, [...idx, id]);
    return this.ajouter(id, { t: 'dossier', id, question, perimetre, horizon, decision });
  }

  /**
   * Verse une page extraite. Le corps part dans son propre enregistrement,
   * indexé par son SHA-256 : deux articles au texte identique n'occupent
   * qu'une entrée, et l'égalité est constatée sans comparaison.
   *
   * Le versement d'une URL déjà présente crée une nouvelle entrée `source`
   * plutôt que d'écraser l'ancienne — c'est une seconde consultation, et le
   * texte a pu changer entre les deux. La lecture ne retient que la dernière.
   */
  async verser(id, page) {
    const texte = page.texte || '';
    const hash = texte ? await empreinteExacte(texte) : null;
    if (hash && !(await this.s.get(cleTexte(hash)))) {
      await this.s.set(cleTexte(hash), texte);
    }
    const j = await this.journal(id);
    const nSources = j.filter((e) => e.t === 'source').length;

    return this.ajouter(id, {
      t: 'source',
      dossier: id,
      id: page.id || `s-${String(nSources + 1).padStart(3, '0')}`,
      url: page.url,
      canonical: page.canonical,
      titre: page.titre,
      auteurs: page.auteurs || [],
      editeur: page.editeur,
      datePubliee: page.datePubliee,
      dateModifiee: page.dateModifiee,
      datesIncoherentes: !!page.datesIncoherentes,
      consulteeLe: this.horloge(),
      texteHash: hash,
      liens: page.liens || [],
      citations: page.citations || [],
      diagnostic: page.diagnostic || null,
    });
  }

  /**
   * Reconstitue l'état du corpus. Sans argument : état courant. Avec `jusqua`
   * (horodatage) : état tel qu'il était à ce moment — c'est ce qui rend un
   * relevé ancien rejouable à l'identique.
   */
  async corpus(id, { jusqua = null, avecTexte = true } = {}) {
    const j = await this.journal(id);
    const parCanonical = new Map();

    for (const e of j) {
      if (e.t !== 'source') continue;
      if (jusqua && e.ts > jusqua) continue;
      parCanonical.set(e.canonical || e.url, e); // la dernière consultation gagne
    }

    const sources = [...parCanonical.values()]
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));

    if (!avecTexte) return sources;
    return Promise.all(sources.map(async (s) => ({
      ...s,
      texte: s.texteHash ? ((await this.s.get(cleTexte(s.texteHash))) || '') : '',
    })));
  }

  /** Les sources exactement consommées par un relevé donné, dans leur état
   *  d'alors. C'est l'opération de rejeu. */
  async corpusDuReleve(id, releve) {
    const tous = await this.corpus(id, { jusqua: releve.ts });
    const voulus = new Set(releve.sourcesIds);
    return tous.filter((s) => voulus.has(s.id));
  }

  async relevés(id) {
    return (await this.journal(id)).filter((e) => e.t === 'releve');
  }

  async meta(id) {
    const j = await this.journal(id);
    return [...j].reverse().find((e) => e.t === 'dossier') || null;
  }

  /**
   * Supprime réellement : journal, index, et les corps qui ne sont plus
   * référencés par aucun autre dossier. Un bouton « supprimer » qui laisserait
   * les textes derrière lui serait un mensonge (décision D2).
   */
  async supprimer(id) {
    const aSupprimer = new Set(
      (await this.journal(id)).filter((e) => e.t === 'source' && e.texteHash).map((e) => e.texteHash),
    );
    const idx = (await this.index()).filter((x) => x !== id);
    await this.s.remove(cleJournal(id));
    await this.s.set(CLE_INDEX, idx);

    for (const autre of idx) {
      for (const e of await this.journal(autre)) {
        if (e.t === 'source' && e.texteHash) aSupprimer.delete(e.texteHash);
      }
    }
    for (const h of aSupprimer) await this.s.remove(cleTexte(h));
    return { textesSupprimes: aSupprimer.size };
  }
}
