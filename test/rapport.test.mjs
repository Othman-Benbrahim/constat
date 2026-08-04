import test from 'node:test';
import assert from 'node:assert/strict';
import { FIABILITE, CREDIBILITE, coter, courantes, distribution, libelle, valide } from '../core/cotation.js';
import { formatRecommande, assembler, bluf, reserves } from '../core/rapport.js';

/* ------------------------------------------------------ étape 2 — cotation */

const src = (id) => ({ id });

test('échelles complètes et libellé lisible', () => {
  assert.deepEqual(Object.keys(FIABILITE), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(Object.keys(CREDIBILITE), ['1', '2', '3', '4', '5', '6']);
  assert.equal(libelle('B', 2), 'B2 — généralement fiable, probablement vraie');
  assert.equal(libelle('Z', 2), null);
  assert.equal(valide('B', '2'), true);
  assert.equal(valide('B', 7), false);
});

test('une cotation hors échelle ou sans motif est refusée', () => {
  assert.throws(() => coter({ dossier: 'd', source: 's-001', fiabilite: 'Z', credibilite: 1, motif: 'x' }),
    /hors échelle/);
  assert.throws(() => coter({ dossier: 'd', source: 's-001', fiabilite: 'B', credibilite: 2, motif: '  ' }),
    /sans motif/);
  const c = coter({ dossier: 'd', source: 's-001', fiabilite: 'B', credibilite: 2, motif: 'agence de presse établie' });
  assert.equal(c.t, 'cotation');
  assert.equal(c.credibilite, '2');
});

test('append-only : la dernière cotation d’une source gagne', () => {
  const journal = [
    { t: 'cotation', source: 's-001', fiabilite: 'C', credibilite: '3', motif: 'première lecture' },
    { t: 'source', id: 's-002' },
    { t: 'cotation', source: 's-001', fiabilite: 'B', credibilite: '2', motif: 'confirmée depuis' },
  ];
  const c = courantes(journal);
  assert.equal(c.size, 1);
  assert.equal(c.get('s-001').fiabilite, 'B');
  assert.equal(journal.filter((e) => e.t === 'cotation').length, 2, 'aucune entrée réécrite');
});

test('distribution : les non cotées sont comptées à part, jamais rangées ailleurs', () => {
  const sources = ['s-001', 's-002', 's-003', 's-004'].map(src);
  const journal = [
    { t: 'cotation', source: 's-001', fiabilite: 'A', credibilite: '1', motif: 'x' },
    { t: 'cotation', source: 's-002', fiabilite: 'B', credibilite: '2', motif: 'x' },
    { t: 'cotation', source: 's-003', fiabilite: 'F', credibilite: '6', motif: 'anonyme' },
  ];
  const d = distribution(sources, journal);

  assert.equal(d.total, 4);
  assert.equal(d.cotees, 3);
  assert.deepEqual(d.nonCotees, ['s-004']);
  assert.equal(d.nonEvaluables, 1, 'F6 est un refus d’évaluer, pas une mauvaise note');
  assert.deepEqual(d.socle, ['s-001', 's-002']);
  assert.equal(d.parFiabilite.A, 1);
  assert.equal(d.parCredibilite['6'], 1);
});

/* -------------------------------------------------------- étape 6 — rapport */

const RELEVE = (o = {}) => ({
  corroboration: { sources: 12, comptesRendusDistincts: 9, ...o.corroboration },
  silences: { calcules: [], nonCalcules: o.nonCalcules || [] },
});

const etapeACH = (validee = true) => ({
  numero: 5, validee,
  sortie: {
    hypotheses: [
      { id: 'H1', role: 'dominante', enonce: 'Le chantier reprendra', confirmerait: 'a', demolirait: 'un recours suspensif' },
      { id: 'H3', role: 'fractale', enonce: 'Le blocage est structurel', confirmerait: 'c', demolirait: 'la publication de l’avis' },
    ],
    matrice: { P1: {}, P2: {}, P3: {} },
    classement: [
      { id: 'H3', role: 'fractale', incompatibles: 0, compatibles: 2 },
      { id: 'H1', role: 'dominante', incompatibles: 2, compatibles: 3 },
    ],
  },
});

test('format déduit du nombre de comptes rendus distincts, pas du nombre d’articles', () => {
  assert.equal(formatRecommande(2).id, 'insuffisant');
  assert.equal(formatRecommande(4).id, 'note-express');
  assert.equal(formatRecommande(9).id, 'analyse-complete');
  assert.equal(formatRecommande(22).id, 'evaluation-strategique');
});

test('BLUF : dérivé de la matrice, pas rédigé', () => {
  const b = bluf(new Map([[5, etapeACH()]]));
  assert.equal(b.possible, true);
  assert.equal(b.hypothese, 'H3', 'l’hypothèse la moins réfutée, pas la mieux étayée');
  assert.equal(b.incompatibles, 0);
  assert.ok(b.texte.includes('Le blocage est structurel'));
  assert.ok(b.texte.includes('la publication de l’avis'), 'ce qui la démolirait est en tête');
  assert.equal(b.risque, null);
});

test('BLUF : refusé si l’étape 5 n’est pas validée', () => {
  assert.equal(bluf(new Map()).possible, false);
  const b = bluf(new Map([[5, etapeACH(false)]]));
  assert.equal(b.possible, false);
  assert.match(b.raison, /aucune étape 5 validée/);
});

test('BLUF : le risque le plus élevé vient avec son conditionnement', () => {
  const b = bluf(new Map([
    [5, etapeACH()],
    [7, { numero: 7, validee: true, sortie: { scenarios: [{ id: 'S2', titre: 'Recours accepté' }] } }],
    [8, {
      numero: 8, validee: true,
      sortie: {
        evaluations: [
          { scenario: 'S1', niveau: 'faible', conditions: ['si rien ne bouge'] },
          { scenario: 'S2', niveau: 'eleve', conditions: ['si le tribunal se prononce avant mars'] },
        ],
      },
    }],
  ]));
  assert.equal(b.risque.scenario, 'S2');
  assert.equal(b.risque.niveau, 'eleve');
  assert.ok(b.texte.includes('Recours accepté'));
  assert.ok(b.texte.includes('seulement si si le tribunal se prononce avant mars'));
});

test('assembler : dit ce qui manque au format visé', () => {
  const a = assembler({
    releve: RELEVE(),
    cotation: distribution([src('s-001')], []),
    etapes: [etapeACH(), { numero: 7, validee: false, sortie: { scenarios: [] } }],
  });
  assert.equal(a.format.id, 'analyse-complete');
  assert.deepEqual(a.presentes, [5]);
  assert.deepEqual(a.nonValidees, [7]);
  assert.deepEqual(a.manquantes, [4, 10, 11]);
  assert.equal(a.complet, false);
});

test('réserves : chacune renvoie à un chiffre du dossier', () => {
  const r = reserves({
    releve: RELEVE({
      corroboration: { sources: 18, comptesRendusDistincts: 4 },
      nonCalcules: [{ code: 'trou-dossier', raison: 'trop peu d’articles datés' }],
    }),
    cotation: distribution(['s-001', 's-002'].map(src),
      [{ t: 'cotation', source: 's-001', fiabilite: 'D', credibilite: '4', motif: 'x' }]),
    parNumero: new Map([[10, { validee: true, sortie: { demolition: 'le corpus ne couvre pas le volet financier' } }]]),
  });

  assert.ok(r.some((x) => /18 articles versés mais 4 compte/.test(x)));
  assert.ok(r.some((x) => /1 source\(s\) sur 2 non cotées/.test(x)));
  assert.ok(r.some((x) => /Aucune source à la fois fiable et confirmée/.test(x)));
  assert.ok(r.some((x) => /trou-dossier/.test(x)));
  assert.ok(r.some((x) => /Équipe rouge/.test(x)));
});
