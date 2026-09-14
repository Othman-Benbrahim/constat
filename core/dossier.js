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
//
// L'état d'un dossier (actif / corbeille) est lui aussi une entrée de journal,
// jamais un champ réécrit : clore puis restaurer laisse deux entrées et une
// trace datée des deux gestes. L'index `dossiers` reste complet quel que soit
// l'état — un dossier en corbeille possède encore ses textes, et les retirer
// de l'index ferait purger à tort des corps qu'il référence encore.

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

export const ETATS = ['actif', 'corbeille'];

/** L'état est la dernière entrée `etat` du journal. Un dossier qui n'en porte
 *  aucune est actif : les dossiers antérieurs à cette fonctionnalité le restent
 *  sans migration. */
function etatDuJournal(journal) {
  for (let i = journal.length - 1; i >= 0; i -= 1) {
    if (journal[i].t === 'etat') return journal[i].etat;
  }
  return 'actif';
}

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

  /**
   * Ajoute une entrée. Ne réécrit jamais.
   *
   * Un dossier en corbeille n'accepte plus que des entrées `etat` — c'est-à-dire
   * sa restauration. Le verrou est ici et non dans l'interface : un versement
   * égaré dans un dossier clos contaminerait un corpus déjà exporté, et aucun
   * comptage ultérieur ne le signalerait.
   */
  async ajouter(id, entree) {
    const j = await this.journal(id);
    if (entree.t !== 'etat' && etatDuJournal(j) === 'corbeille') {
      throw new Error(`dossier en corbeille : ${id} — restaurez-le avant d’y écrire`);
    }
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
      // Provenance : « lecture » par défaut. Un corpus assemblé par un moteur
      // n'a pas le même biais de sélection qu'un corpus assemblé par lecture,
      // et les mélanger sans le dire rend les comptages ininterprétables.
      provenance: page.provenance || 'lecture',
      rang: page.rang ?? null,
      dateFournisseur: page.dateFournisseur ?? null,
      scoreFournisseur: page.scoreFournisseur ?? null,
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

  /* ------------------------------------------------------------ corbeille */

  async etat(id) {
    return etatDuJournal(await this.journal(id));
  }

  /**
   * Identifiants filtrés par état. `index()` reste la liste brute et complète :
   * c'est elle que `supprimer()` parcourt pour savoir quels corps sont encore
   * référencés. L'interface, elle, appelle `lister()`.
   */
  async lister({ etat = 'actif' } = {}) {
    const idx = await this.index();
    if (etat === 'tous') return idx;
    const gardes = [];
    for (const id of idx) if ((await this.etat(id)) === etat) gardes.push(id);
    return gardes;
  }

  /**
   * Ce qu'on sait d'un dossier au moment d'envisager sa clôture. Que des faits
   * comptés : l'interface les affiche, elle ne les résume pas en verdict. `ok`
   * ne dit pas « clôturable », il dit « un relevé a été établi et un export a
   * été produit depuis ».
   */
  async cloture(id) {
    const j = await this.journal(id);
    const dernier = (t) => [...j].reverse().find((e) => e.t === t) || null;

    const releve = dernier('releve');
    const exports = j.filter((e) => e.t === 'export');
    const dernierExport = exports.at(-1) || null;
    const etapesValidees = new Set(
      j.filter((e) => e.t === 'etape' && e.validee).map((e) => e.numero),
    );

    // Un export antérieur au dernier relevé ne clôt rien : le corpus a bougé
    // depuis le fichier produit.
    const exportAJour = !!(releve && dernierExport && dernierExport.ts >= releve.ts);

    const manque = [];
    if (!releve) manque.push('aucun relevé établi');
    if (!dernierExport) manque.push('aucun export produit');
    else if (!exportAJour) manque.push('le dernier export est antérieur au dernier relevé');

    return {
      id,
      etat: etatDuJournal(j),
      sources: new Set(j.filter((e) => e.t === 'source').map((e) => e.canonical || e.url)).size,
      releve: releve ? { ts: releve.ts, empreinteCorpus: releve.empreinteCorpus } : null,
      exports: exports.length,
      dernierExport: dernierExport
        ? { ts: dernierExport.ts, format: dernierExport.format, chiffre: !!dernierExport.chiffre }
        : null,
      etapesValidees: [...etapesValidees].sort((a, b) => a - b),
      ok: exportAJour,
      manque,
    };
  }

  /**
   * Met le dossier en corbeille. N'exige pas que `cloture().ok` soit vrai : un
   * dossier abandonné se range aussi. C'est l'interface qui montre ce qui
   * manque avant de demander confirmation — refuser ici transformerait un
   * constat en règle.
   */
  async clore(id, { motif = '' } = {}) {
    if ((await this.etat(id)) === 'corbeille') throw new Error(`déjà en corbeille : ${id}`);
    const c = await this.cloture(id);
    return this.ajouter(id, {
      t: 'etat',
      dossier: id,
      etat: 'corbeille',
      motif,
      // Ce qu'on savait au moment du geste, pour que la corbeille se lise sans
      // recalculer et qu'une clôture prématurée reste visible.
      constat: { sources: c.sources, releve: c.releve, dernierExport: c.dernierExport, manque: c.manque },
    });
  }

  async restaurer(id) {
    if ((await this.etat(id)) !== 'corbeille') throw new Error(`pas en corbeille : ${id}`);
    return this.ajouter(id, { t: 'etat', dossier: id, etat: 'actif' });
  }

  /** Suppression définitive de tout ce qui est en corbeille. Jamais automatique,
   *  jamais différée : la corbeille ne se vide que sur un geste. */
  async viderCorbeille() {
    const ids = await this.lister({ etat: 'corbeille' });
    let textesSupprimes = 0;
    for (const id of ids) textesSupprimes += (await this.supprimer(id)).textesSupprimes;
    return { dossiers: ids.length, ids, textesSupprimes };
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
