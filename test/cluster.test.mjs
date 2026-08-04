import test from 'node:test';
import assert from 'node:assert/strict';
import { preparer, regrouper, lier, verdictPour, SEUIL_RECOUVREMENT } from '../core/cluster.js';

const DEPECHE = `Le préfet du Gard a annoncé mardi la suspension du chantier de
contournement de Nîmes-Ouest, invoquant un avis défavorable de l'autorité
environnementale rendu la semaine précédente. La décision prend effet
immédiatement et concerne l'ensemble des lots de travaux engagés depuis le mois
de janvier. Les associations riveraines réclamaient cette suspension depuis
plusieurs mois sans obtenir de réponse de la préfecture. Le conseil
départemental, maître d'ouvrage, indique étudier les voies de recours
disponibles et n'exclut pas de saisir le tribunal administratif de Nîmes dans
les prochaines semaines. Le chantier représente un investissement de quarante
millions d'euros, financé pour moitié par la région Occitanie.`;

const ENQUETE = `Trois mois d'enquête sur les marchés du contournement de
Nîmes-Ouest font apparaître une concentration inhabituelle des lots entre deux
groupements d'entreprises. Les documents que nous avons consultés montrent que
la commission d'appel d'offres a écarté quatre candidatures pour des motifs de
forme. Deux dirigeants de sociétés évincées ont accepté de témoigner à visage
découvert. Aucun élément ne permet à ce stade d'établir une irrégularité
caractérisée, et le parquet de Nîmes n'a été saisi d'aucun signalement. Le
conseil départemental n'a pas donné suite à nos sollicitations répétées depuis
le mois de février.`;

const source = (id, editeur, titre, texte, publie) => ({
  id, editeur, titre, texte, url: `https://${editeur}/a/${id}`,
  canonical: `https://${editeur}/a/${id}`, datePubliee: publie,
});

test('reprise littérale : texte identique, titres réécrits, éditeurs différents', async () => {
  const p = await preparer([
    source('s-001', 'lemonde.fr', 'Le chantier du contournement suspendu', DEPECHE, '2026-02-17T09:00:00Z'),
    source('s-002', 'midilibre.fr', 'Nîmes-Ouest : coup d’arrêt pour la rocade', DEPECHE, '2026-02-17T10:30:00Z'),
    source('s-003', 'objectifgard.com', 'La préfecture stoppe tout', DEPECHE, '2026-02-17T11:15:00Z'),
  ]);
  const g = regrouper(p);

  assert.equal(g.length, 1, 'les titres réécrits ne dispersent pas la grappe');
  assert.equal(g[0].volume, 3);
  assert.equal(g[0].editeurs, 3);
  assert.equal(g[0].formulations, 3, 'trois titres distincts');
  assert.equal(g[0].verdict, 'reprise-litterale');
  assert.equal(g[0].empreintesIdentiques, 3);
  assert.equal(g[0].editeursIdentiques, 3);

  // Le point : la corroboration de Sentinelle dirait 3, le texte dit 1 origine.
  assert.equal(g[0].corroboration, 3, 'la mesure de Sentinelle reste ce qu’elle est');
  assert.ok(g[0].empreintesIdentiques >= 2, 'et le texte la contredit — c’est ça, le silence n°5');

  const liaisons = g[0].membres.map((m) => m.liaison.type).sort();
  assert.deepEqual(liaisons, ['hash-identique', 'hash-identique', 'origine']);
});

test('deux sujets distincts ne fusionnent pas', async () => {
  const p = await preparer([
    source('s-001', 'lemonde.fr', 'Le chantier du contournement suspendu', DEPECHE, '2026-02-17T09:00:00Z'),
    source('s-002', 'mediapart.fr', 'Contournement de Nîmes : les marchés en question', ENQUETE, '2026-02-19T06:00:00Z'),
  ]);
  const g = regrouper(p);
  assert.equal(g.length, 2, 'même sujet général, faits différents');
  assert.ok(g.every((x) => x.verdict === 'isole'));
});

test('titres proches, textes différents : le corps tranche, pas le titre', async () => {
  const p = await preparer([
    source('s-001', 'lemonde.fr', 'Contournement de Nîmes-Ouest : la suspension du chantier', DEPECHE, '2026-02-17T09:00:00Z'),
    source('s-002', 'mediapart.fr', 'Contournement de Nîmes-Ouest : la suspension en question', ENQUETE, '2026-02-19T06:00:00Z'),
  ]);
  const g = regrouper(p);
  assert.equal(g.length, 2, 'le repli sur titre ne doit pas repêcher deux corps exploitables');
});

test('reprise réécrite : liaison par recouvrement, taux affiché', async () => {
  const reecrit = DEPECHE
    .replace('a annoncé mardi', 'annonçait ce mardi')
    .replace('invoquant', 'au motif d’')
    .replace(/Le chantier représente.*$/s, '');
  const p = await preparer([
    source('s-001', 'afp.com', 'Suspension du chantier', DEPECHE, '2026-02-17T09:00:00Z'),
    source('s-002', 'laprovence.com', 'La rocade à l’arrêt', reecrit, '2026-02-17T14:00:00Z'),
  ]);
  const g = regrouper(p);
  assert.equal(g.length, 1);
  assert.equal(g[0].verdict, 'reprise-mesuree', 'pas de SHA identique : régime mesuré, pas constaté');
  const l = g[0].membres.find((m) => m.liaison.type !== 'origine').liaison;
  assert.equal(l.type, 'recouvrement');
  assert.ok(l.taux >= SEUIL_RECOUVREMENT && l.taux < 1, `taux ${l.taux}`);
  assert.ok(g[0].recouvrementMedian > 0.6);
});

test('sans corps exploitable : repli sur le titre, et c’est déclaré', async () => {
  const p = await preparer([
    source('s-001', 'lemonde.fr', 'Le chantier du contournement de Nîmes-Ouest suspendu', '', '2026-02-17T09:00:00Z'),
    source('s-002', 'midilibre.fr', 'Le chantier du contournement de Nîmes-Ouest est suspendu', '', '2026-02-17T10:00:00Z'),
  ]);
  const g = regrouper(p);
  assert.equal(g.length, 1);
  assert.equal(g[0].sansTexte, 2, 'l’absence de corps est comptée, pas masquée');
  assert.equal(g[0].recouvrementMedian, null, 'aucun recouvrement calculé, donc null — pas 0');
  assert.equal(g[0].membres.find((m) => m.liaison.type !== 'origine').liaison.type, 'titre');
});

test('déterminisme : l’ordre de versement ne change pas le résultat', async () => {
  const lot = [
    source('s-001', 'a.fr', 'Alpha', DEPECHE, '2026-02-17T09:00:00Z'),
    source('s-002', 'b.fr', 'Bravo', DEPECHE, '2026-02-17T10:00:00Z'),
    source('s-003', 'c.fr', 'Charlie', ENQUETE, '2026-02-19T06:00:00Z'),
  ];
  const direct = regrouper(await preparer(lot));
  const inverse = regrouper(await preparer([...lot].reverse()));
  assert.deepEqual(
    direct.map((g) => [g.id, g.volume, g.verdict]),
    inverse.map((g) => [g.id, g.volume, g.verdict]),
  );
});

test('verdicts', () => {
  const v = (o) => verdictPour({ volume: 1, editeurs: 1, formulations: 1, empreintesIdentiques: 0, editeursIdentiques: 0, ...o });
  assert.equal(v({}), 'isole');
  assert.equal(v({ volume: 4, editeurs: 1, formulations: 4 }), 'source-unique');
  assert.equal(v({ volume: 4, editeurs: 3, formulations: 1 }), 'reprise-verbatim');
  assert.equal(v({ volume: 5, editeurs: 4, formulations: 5 }), 'couverture-convergente');
  assert.equal(
    v({ volume: 9, editeurs: 9, formulations: 9, empreintesIdentiques: 2, editeursIdentiques: 1 }),
    'couverture-convergente',
    'deux copies chez le MÊME éditeur ne font pas une reprise inter-éditeurs',
  );
});

test('lier : cascade du plus certain au moins certain', async () => {
  const [a, b] = await preparer([
    source('s-001', 'a.fr', 'Titre A', DEPECHE, null),
    source('s-002', 'b.fr', 'Titre B totalement différent', DEPECHE, null),
  ]);
  assert.equal(lier(a, b).type, 'hash-identique');
  assert.equal(lier(a, b).taux, 1);
});
