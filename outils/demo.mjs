#!/usr/bin/env node
// demo.mjs — chaîne complète sur un corpus fabriqué, pour voir le bloc sortir.
//
//   node outils/demo.mjs
//
// Aucun réseau : les pages sont construites en mémoire et passées par le même
// extraction.js que le content script utilisera sur le DOM vivant.

import { parseHTML } from 'linkedom';
import { extraire } from '../core/extraction.js';
import { preparer, regrouper } from '../core/cluster.js';
import { detecter } from '../core/silences.js';
import { produire } from '../core/releve.js';
import { Dossiers, stockageMemoire } from '../core/dossier.js';

const DEPECHE = `Le préfet du Gard a annoncé mardi la suspension du chantier de contournement de
Nîmes-Ouest, invoquant un avis défavorable de l'autorité environnementale rendu la semaine
précédente. La décision prend effet immédiatement et concerne l'ensemble des lots de travaux
engagés depuis le mois de janvier. Les associations riveraines réclamaient cette suspension
depuis plusieurs mois sans obtenir de réponse de la préfecture du Gard. Le conseil départemental,
maître d'ouvrage, indique étudier les voies de recours disponibles.`;

const page = ({ titre, date, corps, editeur, liens = '' }) => parseHTML(`<!doctype html><html><head>
<title>${titre}</title>
<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"${date}"}</script>
</head><body><nav><a href="/sport">Sport</a></nav>
<article><h1>${titre}</h1>${corps.split('\n\n').map((p) => `<p>${p}</p>`).join('')}${liens}</article>
</body></html>`).document;

const ART = [];
const add = (id, editeur, titre, date, corps, liens) => {
  const doc = page({ titre, date, corps, editeur, liens });
  ART.push({ id, ...extraire(doc, `https://${editeur}/a/${id}`) });
};

// Une dépêche reprise à l'identique par quatre éditeurs, titres réécrits.
['lemonde.fr', 'midilibre.fr', 'objectifgard.com', 'laprovence.com'].forEach((e, i) => {
  add(`s-00${i + 1}`, e, ['Chantier suspendu', 'Coup d’arrêt pour la rocade', 'La préfecture stoppe tout', 'Nîmes-Ouest à l’arrêt'][i],
    `2026-02-17T${String(8 + i).padStart(2, '0')}:00:00Z`, DEPECHE);
});

// Cinq articles distincts avant le trou, dont deux mentionnant le moratoire.
[
  ['s-005', 'lemonde.fr', 'Le moratoire réclamé par les élus', '2026-02-12T09:00:00Z',
    `Une vingtaine d'élus locaux réclament un moratoire immédiat sur le chantier de contournement.
Le moratoire porterait sur l'ensemble des lots jusqu'à la remise du rapport d'expertise attendu.
Le conseil départemental oppose un refus de principe à ce moratoire, jugé prématuré par ses services.`],
  ['s-006', 'midilibre.fr', 'Moratoire : le département refuse', '2026-02-13T09:00:00Z',
    `Le conseil départemental a rejeté la demande de moratoire formulée par les élus riverains.
Un moratoire coûterait selon lui plusieurs millions d'euros en immobilisation de chantier.
La préfecture du Gard n'a pas pris position publiquement sur ce moratoire.`],
  ['s-007', 'objectifgard.com', 'Les riverains devant le tribunal', '2026-02-14T09:00:00Z',
    `Trois associations riveraines ont déposé un recours devant le tribunal administratif de Nîmes.
Leur avocat a déclaré : « Nous demandons la suspension immédiate de tous les travaux en cours. »
La préfecture du Gard n'a pas répondu à nos sollicitations répétées depuis deux semaines.`,
    '<p>Voir <a href="https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000">l’arrêté préfectoral</a> du 4 février.</p>'],
  ['s-008', 'laprovence.com', 'Le coût du contournement en question', '2026-02-15T09:00:00Z',
    `Le contournement de Nîmes-Ouest représente un investissement de quarante millions d'euros.
La région Occitanie finance la moitié du projet, le solde revenant au conseil départemental.
La préfecture du Gard rappelle que le calendrier initial prévoyait une livraison en 2028.`],
  ['s-009', 'lemonde.fr', 'Le moratoire encore réclamé avant l’expertise', '2026-02-16T09:00:00Z',
    `L'autorité environnementale doit rendre un avis sur le tracé retenu pour le contournement.
Martin Dubois a expliqué : « Sans moratoire, l'expertise arrivera après la coulée du béton. »
Un moratoire de trois mois permettrait selon lui d'attendre ce rapport, mais le moratoire reste
rejeté par le conseil départemental. La préfecture du Gard n'a pas tranché sur ce moratoire.`],
].forEach(([id, e, t, d, c, l]) => add(id, e, t, d, c, l));

// Cinq articles après un trou de sept jours, plus aucune mention du moratoire.
[
  ['s-010', 'midilibre.fr', 'Les travaux reprennent partiellement', '2026-02-24T09:00:00Z'],
  ['s-011', 'objectifgard.com', 'Le calendrier revu par le département', '2026-02-25T09:00:00Z'],
  ['s-012', 'lemonde.fr', 'Les entreprises réclament une indemnisation', '2026-02-26T09:00:00Z'],
  ['s-013', 'laprovence.com', 'Une réunion publique programmée', '2026-03-01T09:00:00Z'],
  ['s-014', 'midilibre.fr', 'Le tracé alternatif étudié', '2026-03-03T09:00:00Z'],
].forEach(([id, e, t, d], i) => add(id, e, t, d, [
  `Les engins ont regagné le secteur nord du tracé lundi matin sous protection de la gendarmerie.
Seuls deux des sept lots initialement prévus redémarrent, les autres restant gelés sans échéance.
La préfecture du Gard confirme la reprise mais renvoie au conseil départemental pour le détail.`,
  `Le conseil départemental a publié un calendrier révisé portant la livraison à l'automne 2029.
Ce document de onze pages ne mentionne aucune des réserves formulées par l'autorité environnementale.
La préfecture du Gard n'a pas souhaité commenter ce nouveau calendrier auprès de notre rédaction.`,
  `Les entreprises titulaires des lots gelés chiffrent leur préjudice à six millions d'euros.
Leur groupement a saisi le comité de règlement amiable des différends en matière de marchés publics.
La préfecture du Gard rappelle que l'indemnisation relève du maître d'ouvrage et non de l'État.`,
  `Une réunion publique se tiendra le 12 mars à la salle des fêtes de Saint-Gilles à dix-huit heures.
L'ordre du jour porte sur le tracé, le calendrier et les mesures compensatoires environnementales.
La préfecture du Gard y sera représentée par un chargé de mission qui ne prendra pas la parole.`,
  `Un tracé alternatif contournant la zone humide par l'est est étudié par les services techniques.
Il rallongerait le parcours de quatre kilomètres pour un surcoût estimé à douze millions d'euros.
La préfecture du Gard indique qu'aucune décision ne sera prise avant la remise du rapport final.`,
][i]));

// Passage par le journal : on verse, puis on relit — comme le fera l'extension.
const D = new Dossiers(stockageMemoire());
await D.creer({
  id: 'd-2026-004',
  question: 'Le contournement de Nîmes-Ouest sera-t-il achevé selon le calendrier annoncé ?',
  perimetre: 'presse régionale et nationale, 12 février – 3 mars 2026',
  horizon: 'décision du conseil départemental, fin mars',
  decision: 'faut-il déposer un recours avant la réunion publique du 12 mars',
});
for (const a of ART) await D.verser('d-2026-004', a);

const sources = await D.corpus('d-2026-004');
const grappes = regrouper(await preparer(sources));
const releve = await produire({
  sources, grappes, dossier: 'd-2026-004', outil: { nom: 'Constat', version: '0.1.0' },
});
await D.ajouter('d-2026-004', releve);
const s = releve.silences;

const L = (t, n) => console.log(`${t.padEnd(52)}${String(n).padStart(6)}`);

const co = releve.corroboration;
const ch = releve.chronologie;

console.log(`\nCONSTAT — « Contournement de Nîmes-Ouest »`);
console.log(`relevé ${releve.empreinteCorpus} · outil ${releve.outil.version}`);
console.log(`${co.sources} sources · ${co.editeurs} éditeurs · ${ch.debut.slice(0, 10)} – ${ch.fin.slice(0, 10)}\n`);
console.log('CORROBORATION\n');
L('Grappes', co.grappes);
L('  la plus large', `${co.grappePlusLarge.volume} articles`);
L('Comptes rendus distincts', co.comptesRendusDistincts);
console.log(`      (${co.definitionDistincts})`);
L('Acteurs nommés', releve.acteurs.total);
L('Contradictions chiffrées', releve.contradictions.length);
for (const c of releve.contradictions.slice(0, 3)) {
  console.log(`      « ${c.indicateur} » : ${c.valeurs.join(' vs ')} ${c.unite} — ${c.articles.length} articles`);
}
console.log();
console.log('ABSENCES CONSTATÉES\n');

for (const c of s.calcules) {
  if (c.code === 'acteur-non-cite') {
    L('Acteurs nommés dans 3 articles ou plus', c.justification.acteursRetenus);
    L('  dont jamais cités entre guillemets', c.constat);
    for (const d of c.details.slice(0, 5)) {
      console.log(`      ${d.entite.padEnd(30)} nommé ${String(d.nomme).padStart(2)} ×    cité 0 ×`);
    }
    console.log(`  (${c.justification.citationsAttribuees} citations attribuées sur ${c.justification.citationsRelevees} relevées)\n`);
  }
  if (c.code === 'article-sans-source') {
    L('Articles liant un document source', `${c.justification.articlesAvecDocumentSource} / ${c.justification.total}`);
    console.log(`      ${Object.entries(c.justification.parNature).map(([k, v]) => `${k} ${v}`).join(' · ')}\n`);
  }
  if (c.code === 'trou-dossier') {
    L('Trous dans le dossier', c.constat);
    for (const d of c.details) {
      console.log(`      ${d.debut.slice(0, 10)} – ${d.fin.slice(0, 10)}, ${d.jours} jours   `
        + `intervalle médian : ${c.justification.intervalleMedianHeures} h`);
    }
    console.log(`      ${c.justification.articlesDates} datés · ${c.justification.articlesSansDate} sans date, exclus\n`);
  }
  if (c.code === 'terme-effondre') {
    L('Termes en effondrement', c.constat);
    for (const d of c.details.slice(0, 3)) {
      console.log(`      « ${d.terme} »   ${d.occurrencesAvant} occurrences jusqu'au ${d.dernierArticle.slice(0, 10)}, `
        + `0 sur ${d.articlesApres} articles suivants`);
      console.log(`${' '.repeat(22)}${d.articlesTermeEtMarqueur} article contenant le terme ET un marqueur d'abandon`);
    }
    console.log();
  }
  if (c.code === 'grappe-origine-unique') {
    L('Grappes à origine unique', c.constat);
    for (const d of c.details) {
      console.log(`      ${d.grappe}   ${d.volume} articles · ${d.editeurs} éditeurs · ${d.formulations} formulations`);
      console.log(`             ${d.regime === 'constate'
        ? `empreintes de texte identiques (${d.empreintesIdentiques}) — reprise littérale`
        : `recouvrement médian de séquences de 4 mots : ${d.recouvrementMedian}`}`);
    }
    console.log();
  }
}

console.log('NON CALCULÉ');
if (!s.nonCalcules.length) console.log('      aucun');
for (const n of s.nonCalcules) console.log(`      ${n.code} : ${n.raison} — ${JSON.stringify(n.chiffre)}`);

console.log(`
Ce bloc décrit le dossier, pas la presse. Une absence ici est une absence
dans les ${co.sources} articles qui ont été versés.
`);
