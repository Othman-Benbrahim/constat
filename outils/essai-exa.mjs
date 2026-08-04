#!/usr/bin/env node
// essai-exa.mjs — banc d'essai. Décide si le versement par moteur est viable.
//
//   EXA_API_KEY=... node outils/essai-exa.mjs "contournement Nîmes-Ouest moratoire"
//   EXA_API_KEY=... node outils/essai-exa.mjs "..." --depuis 2026-02-01 --n 12
//   node outils/essai-exa.mjs --simulation        (sans clé, sur une réponse enregistrée)
//
// Ce script ne branche rien. Il répond à une question et une seule : ce que
// renvoie le moteur permet-il aux cinq détecteurs de continuer à dire quelque
// chose ? Si la réponse est non, on supprime core/recherche.js et ce fichier,
// et il ne reste aucune trace dans l'extension.

import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { extraire } from '../core/extraction.js';
import { preparer, regrouper } from '../core/cluster.js';
import { detecter } from '../core/silences.js';
import { corpsRequete, enTetes, entreeRecherche, versPage, fusionner, verdict, FOURNISSEUR } from '../core/recherche.js';

const args = process.argv.slice(2);
const opt = (nom, defaut = null) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 ? args[i + 1] : defaut;
};
const simulation = args.includes('--simulation');
// Le premier argument qui n'est ni une option ni la valeur d'une option.
const OPTIONS_A_VALEUR = ['n', 'depuis', 'jusqua'];
const query = (() => {
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) { if (OPTIONS_A_VALEUR.includes(args[i].slice(2))) i++; continue; }
    return args[i];
  }
  return null;
})();

if (!simulation && !process.env.EXA_API_KEY) {
  console.error('EXA_API_KEY manquante. Ou lancez avec --simulation.');
  process.exit(1);
}
if (!simulation && !query) {
  console.error('usage : EXA_API_KEY=... node outils/essai-exa.mjs "votre requête"');
  process.exit(1);
}

const corps = corpsRequete({
  query: query || '(simulation)',
  nombre: Number(opt('n', 10)),
  depuis: opt('depuis'),
  jusqua: opt('jusqua'),
  html: !args.includes('--sans-html'),
});

let reponse;
if (simulation) {
  reponse = JSON.parse(readFileSync(new URL('./exa-simulation.json', import.meta.url), 'utf8'));
  console.log('Mode simulation — réponse enregistrée, aucun appel réseau.\n');
} else {
  const res = await fetch(FOURNISSEUR.url, {
    method: 'POST', headers: enTetes(process.env.EXA_API_KEY), body: JSON.stringify(corps),
  });
  if (!res.ok) {
    console.error(`HTTP ${res.status} — ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  reponse = await res.json();
}

const journal = entreeRecherche({ dossier: 'essai', query: query || corps.query, corps, reponse });

console.log(`REQUÊTE  ${journal.query}`);
console.log(`${journal.resultats.length} résultat(s)`
  + (journal.cout !== null ? ` · coût ${journal.cout} $` : '')
  + (journal.echecs.length ? ` · ${journal.echecs.length} échec(s) de crawl` : ''));
for (const e of journal.echecs) console.log(`  échec ${e.url} — ${e.tag} (${e.code})`);
console.log();

// --- extraction, exactement la même que pour une page lue ------------------

const sources = [];
for (const [i, r] of (reponse.results || []).entries()) {
  const page = versPage(r, { rang: i + 1 });
  let extraite;
  if (page.html) {
    extraite = extraire(parseHTML(page.html).document, page.url, { pret: 'api' });
  } else {
    // Pas de balisage : on garde le texte, sans prétendre l'avoir structuré.
    extraite = {
      url: page.url, canonical: page.url, editeur: hote(page.url), titre: null, auteurs: [],
      datePubliee: null, dateModifiee: null, datesIncoherentes: false,
      texte: page.texteBrut || '', liens: [], citations: [],
      diagnostic: { zone: null, paragraphes: 0, caracteres: (page.texteBrut || '').length,
        liensCorps: 0, liensHorsCorps: 0, echec: 'aucun balisage renvoyé par le moteur' },
    };
  }
  sources.push({ id: `s-${String(i + 1).padStart(3, '0')}`, ...fusionner(page, extraite) });
}

function hote(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'inconnu'; } }

// --- verdict ---------------------------------------------------------------

const v = verdict(sources);
const L = (t, n) => console.log(`${t.padEnd(46)}${String(n).padStart(8)}`);

console.log('CE QUI REVIENT DU MOTEUR\n');
L('Sources', v.sources);
L('  avec balisage HTML', `${v.balisageRecu} / ${v.sources}`);
L('  corps extrait (≥ 200 car.)', `${v.corpsExtrait} / ${v.sources}`);
L('  avec au moins un lien de corps', `${v.avecLiens} / ${v.sources}`);
L('  dont un lien vers un document source', `${v.avecLienSource} / ${v.sources}`);
L('  avec citations entre guillemets', `${v.avecCitations} / ${v.sources}`);
L('  datées par la PAGE', `${v.datePage} / ${v.sources}`);
L('  datées par le MOTEUR seulement', `${v.dateFournisseurSeule} / ${v.sources}`);

console.log('\nDÉTECTEURS QUI SURVIVENT\n');
for (const [code, ok] of Object.entries(v.detecteurs)) {
  console.log(`  ${ok ? '✓' : '✗'}  ${code}`);
}
const vivants = Object.values(v.detecteurs).filter(Boolean).length;

// --- ce que ça donne réellement -------------------------------------------

const grappes = regrouper(await preparer(sources));
const s = detecter({ sources, grappes });

console.log('\nRELEVÉ SUR CE CORPUS\n');
L('Grappes', grappes.length);
L('  dont plus d’un article', grappes.filter((g) => g.volume >= 2).length);
L('Recouvrement médian le plus élevé',
  grappes.map((g) => g.recouvrementMedian).filter((x) => x !== null).sort((a, b) => b - a)[0] ?? '—');
for (const c of s.calcules) L(c.code, c.constat);
for (const n of s.nonCalcules) console.log(`  non calculé — ${n.code} : ${n.raison}`);

console.log(`
LECTURE DU RÉSULTAT

  ${vivants} détecteur(s) sur 5 restent exploitables.

  Si « avec balisage HTML » est à zéro, la piste s'arrête là : sans balisage,
  ni JSON-LD, ni guillemets situables, ni liens de corps. Les détecteurs 1 et 4
  meurent, et le corpus paraît complet alors qu'il est amputé.

  Si « datées par le MOTEUR seulement » est élevé, la chronologie ne repose plus
  sur ce que les pages déclarent mais sur ce qu'un tiers infère. Les détecteurs
  2 et 3 deviennent des mesures sur le moteur, pas sur la presse.

  Si « recouvrement médian le plus élevé » dépasse 0,60 sur des articles que
  vous jugez indépendants, c'est un artefact de sélection : la recherche
  sémantique retourne des textes proches par construction, et le détecteur 5
  se déclenche sur la requête plutôt que sur la reprise de dépêche.

  Et rappelez-vous ce que ce corpus ne peut pas mesurer : un terme présent dans
  votre requête ne peut pas s'effondrer, puisqu'il conditionne l'appartenance
  au corpus.
`);
