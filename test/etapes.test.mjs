import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  ETAPES, construirePrompt, classerHypotheses, valider,
  validerEtape5, validerEtape7, validerEtape10, POINTS_CHECKLIST,
} from '../core/etapes.js';

const META = { question: 'Le chantier sera-t-il achevé ?', perimetre: 'presse',
  horizon: 'mars', decision: 'recours ou non' };

const RELEVE = {
  corroboration: { sources: 24, editeurs: 9, grappes: 11, comptesRendusDistincts: 5 },
  acteurs: { citationsRelevees: 61, citationsAttribuees: 44 },
  silences: {
    calcules: [{ code: 'article-sans-source', constat: 20 }],
    nonCalcules: [{ code: 'trou-dossier', raison: 'trop peu d’articles datés' }],
  },
};

const H = (id, role) => ({ id, role, enonce: `Énoncé ${id}`,
  confirmerait: `Ce qui confirmerait ${id}`, demolirait: `Ce qui démolirait ${id}` });

const ACH_VALIDE = {
  hypotheses: [H('H1', 'dominante'), H('H2', 'dissidente'), H('H3', 'fractale')],
  preuves: [
    { id: 'P1', enonce: 'La préfecture ne s’exprime pas', sources: ['s-001', 's-004'] },
    { id: 'P2', enonce: 'Le recours est déposé', sources: ['s-007'] },
  ],
  matrice: { P1: { H1: 'C', H2: 'I', H3: 'N' }, P2: { H1: 'I', H2: 'C', H3: 'C' } },
};

/* ------------------------------------------------------------- références */

test('les onze références du skill sont embarquées', () => {
  const fichiers = readdirSync('references').filter((f) => f.endsWith('.md'));
  assert.equal(fichiers.length, 11);
  for (const e of Object.values(ETAPES)) {
    for (const r of e.references) {
      assert.ok(fichiers.includes(r), `référence manquante pour l’étape ${e.numero} : ${r}`);
    }
  }
});

test('chargement conditionnel : une seule référence par appel, pas les onze', () => {
  const toutes = readdirSync('references')
    .filter((f) => f.endsWith('.md'))
    .reduce((n, f) => n + readFileSync(`references/${f}`, 'utf8').length, 0);

  const ref = readFileSync(`references/${ETAPES[5].references[0]}`, 'utf8');
  const p = construirePrompt({ numero: 5, meta: META, releve: RELEVE, reference: ref });

  assert.ok(p.includes('# RÉFÉRENCE MÉTHODOLOGIQUE'));
  assert.ok(p.length < toutes * 0.25,
    `prompt de ${p.length} caractères pour ${toutes} de références — le chargement n’est pas conditionnel`);
  // Aucune autre référence ne doit avoir fui dans le prompt.
  const autre = readFileSync('references/scenarios-prospectifs.md', 'utf8').slice(200, 400);
  assert.ok(!p.includes(autre));
});

/* ---------------------------------------------------------- enchaînement */

test('une étape refuse de partir sans la sortie validée de la précédente', () => {
  assert.throws(() => construirePrompt({ numero: 7, meta: META, releve: RELEVE, reference: '' }),
    /exige la sortie validée de l’étape 5/);
  const ok = construirePrompt({ numero: 7, meta: META, releve: RELEVE, reference: '',
    precedentes: { 5: ACH_VALIDE } });
  assert.ok(ok.includes('SORTIE VALIDÉE DE L’ÉTAPE 5'));
  assert.ok(ok.includes('H2'), 'la sortie précédente est bien transmise');
});

test('le prompt transmet les non-calculés comme ignorance déclarée', () => {
  const p = construirePrompt({ numero: 5, meta: META, releve: RELEVE, reference: '' });
  assert.ok(p.includes('Points sur lesquels tu ne sais rien'));
  assert.ok(p.includes('trou-dossier'));
});

/* ----------------------------------------------------------------- ACH */

test('classement ACH : le moins d’incompatibles gagne, pas le plus de compatibles', () => {
  const hypotheses = [H('H1', 'dominante'), H('H2', 'dissidente')];
  // H1 a 3 compatibles mais 2 incompatibles ; H2 en a 1 et 0.
  const matrice = {
    P1: { H1: 'C', H2: 'N' }, P2: { H1: 'C', H2: 'N' }, P3: { H1: 'C', H2: 'C' },
    P4: { H1: 'I', H2: 'N' }, P5: { H1: 'I', H2: 'N' },
  };
  const classement = classerHypotheses(hypotheses, matrice);
  assert.equal(classement[0].id, 'H2', 'l’inversion de Heuer doit primer');
  assert.deepEqual(classement[0], { id: 'H2', role: 'dissidente', compatibles: 1, incompatibles: 0, neutres: 4 });
});

test('ACH : le classement est calculé, jamais repris du modèle', () => {
  const brut = { ...ACH_VALIDE, retenue: 'H1', classement: [{ id: 'H1', rang: 1 }] };
  const { sortie } = validerEtape5(brut);
  assert.ok(!('retenue' in sortie), 'une conclusion fournie par le modèle est ignorée');
  // Le modèle désignait H1. La matrice qu'il a lui-même remplie donne H3, seule
  // hypothèse sans preuve incompatible. C'est exactement le point : la
  // conclusion se déduit de la matrice, elle ne s'annonce pas.
  assert.equal(sortie.classement[0].id, 'H3');
  assert.equal(sortie.classement[0].incompatibles, 0);
  assert.deepEqual(sortie.classement.map((c) => c.id), ['H3', 'H1', 'H2']);
});

test('ACH : hypothèse sans indicateur de réfutation écartée', () => {
  const { sortie, ecartees } = validerEtape5({
    ...ACH_VALIDE,
    hypotheses: [...ACH_VALIDE.hypotheses, { id: 'H4', role: 'systemique', enonce: 'x', confirmerait: 'y' }],
  });
  assert.equal(sortie.hypotheses.length, 3);
  assert.ok(ecartees.some((e) => /non testable/.test(e.raison)));
});

test('ACH : rôles obligatoires manquants signalés', () => {
  const { ecartees } = validerEtape5({
    hypotheses: [H('H1', 'dominante'), H('H2', 'strategique'), H('H3', 'systemique')],
    preuves: [], matrice: {},
  });
  assert.ok(ecartees.some((e) => /dissidente, fractale/.test(e.raison)));
});

test('ACH : case manquante signalée, jamais comblée par « neutre »', () => {
  const { sortie, ecartees, cellulesManquantes } = validerEtape5({
    ...ACH_VALIDE,
    matrice: { P1: { H1: 'C' }, P2: { H1: 'I', H2: 'C', H3: 'C' } },
  });
  assert.deepEqual(cellulesManquantes, ['P1×H2', 'P1×H3']);
  assert.ok(ecartees.some((e) => /case\(s\) de matrice manquante/.test(e.raison)));
  assert.equal(sortie.matrice.P1.H2, undefined, 'aucune valeur inventée');
});

test('ACH : sources inventées détectées', () => {
  const { inventees } = validerEtape5(ACH_VALIDE, ['s-001', 's-004']);
  assert.deepEqual(inventees, ['s-007']);
});

/* ------------------------------------------------------------ scénarios */

const S = (id, role) => ({ id, role, titre: `Titre ${id}`, drivers: ['d'], conditions: ['c'],
  indicateursBascule: ['un signal observable'], impact: 'i', confiance: 'moderee', hypotheses: ['H1'] });

test('scénarios : un scénario sans indicateur de bascule est écarté', () => {
  const { sortie, ecartees } = validerEtape7({
    scenarios: [S('S1', 'optimiste'), S('S2', 'probable'),
      { ...S('S3', 'critique'), indicateursBascule: [] }],
  }, ['H1']);
  assert.equal(sortie.scenarios.length, 2);
  assert.ok(ecartees.some((e) => /sans indicateur de bascule/.test(e.raison)));
  assert.ok(ecartees.some((e) => /critique/.test(e.raison)), 'le rôle manquant est signalé aussi');
});

test('scénarios : certitude écartée', () => {
  const { ecartees } = validerEtape7({
    scenarios: [{ ...S('S1', 'probable'), impact: 'La reprise est inévitable.' }],
  }, ['H1']);
  assert.ok(ecartees.some((e) => /certitude/.test(e.raison)));
});

test('scénarios : hypothèse inconnue écartée', () => {
  const { ecartees } = validerEtape7({ scenarios: [{ ...S('S1', 'probable'), hypotheses: ['H9'] }] }, ['H1']);
  assert.ok(ecartees.some((e) => /hypothèses inconnues : H9/.test(e.raison)));
});

test('scénarios : les trois rôles obligatoires suffisent', () => {
  const { sortie, complet } = validerEtape7({
    scenarios: [S('S1', 'optimiste'), S('S2', 'probable'), S('S3', 'critique')],
  }, ['H1']);
  assert.equal(sortie.scenarios.length, 3);
  assert.equal(complet, true);
});

/* --------------------------------------------------------------- biais */

const checklistComplete = POINTS_CHECKLIST.map((point) => ({
  point, reponse: 'partiel', justification: `Justification ${point}`, vise: ['H1'],
}));

test('biais : la check-list doit être complète', () => {
  const { ecartees } = validerEtape10({
    checklist: checklistComplete.slice(0, 4), lacunes: ['x'], demolition: 'y',
  });
  assert.ok(ecartees.some((e) => /points de check-list absents/.test(e.raison)));
});

test('biais : « aucune démolition » n’est pas une réponse', () => {
  const { ecartees } = validerEtape10({
    checklist: checklistComplete, lacunes: ['x'], demolition: '',
  });
  assert.ok(ecartees.some((e) => /équipe rouge n’a pas été jouée/.test(e.raison)));
});

test('biais : lacunes obligatoires', () => {
  const { ecartees } = validerEtape10({ checklist: checklistComplete, lacunes: [], demolition: 'y' });
  assert.ok(ecartees.some((e) => /aucune lacune/.test(e.raison)));
});

test('biais : sortie complète et ordonnée selon la check-list', () => {
  const { sortie, complet } = validerEtape10({
    checklist: [...checklistComplete].reverse(), lacunes: ['une lacune'], demolition: 'une démolition',
  });
  assert.equal(complet, true);
  assert.deepEqual(sortie.checklist.map((c) => c.point), POINTS_CHECKLIST);
});

test('valider : routeur d’étapes', () => {
  assert.ok(valider(5, ACH_VALIDE).sortie.hypotheses.length);
  assert.throws(() => valider(3, {}), /étape inconnue/);
});

/* ------------------------------------------------ étape 4 — analyse triple */

test('analyse triple : une lecture symbolique sans appui factuel est rejetée', async () => {
  const { validerEtape4 } = await import('../core/etapes.js');
  const { sortie, ecartees } = validerEtape4({
    factuelle: [{ texte: 'Le chantier est suspendu', sources: ['s-001'] }],
    signaux: [{ texte: 'La préfecture ne parle plus', pourquoiNeglige: 'absence, non-événement' }],
    symbolique: [
      { texte: 'Motif du gel administratif', appui: 'suspension sans date de reprise' },
      { texte: 'Archétype du roi caché' },
    ],
    convergence: { statut: 'convergent', revele: '' },
  });
  assert.equal(sortie.symbolique.length, 1);
  assert.ok(ecartees.some((e) => /archétype plaqué/.test(e.raison)));
});

test('analyse triple : une divergence non expliquée est rejetée', async () => {
  const { validerEtape4 } = await import('../core/etapes.js');
  const base = {
    factuelle: [{ texte: 'a', sources: [] }],
    signaux: [{ texte: 'b' }],
    symbolique: [{ texte: 'c', appui: 'd' }],
  };
  const muette = validerEtape4({ ...base, convergence: { statut: 'divergent', revele: '' } });
  assert.ok(muette.ecartees.some((e) => /sans dire ce qu’elle révèle/.test(e.raison)));

  const dite = validerEtape4({ ...base, convergence: { statut: 'divergent', revele: 'Le récit officiel ne tient pas' } });
  assert.equal(dite.complet, true);
  assert.equal(dite.sortie.convergence.statut, 'divergent');
});

test('analyse triple : une couche vide est signalée', async () => {
  const { validerEtape4 } = await import('../core/etapes.js');
  const { ecartees } = validerEtape4({
    factuelle: [{ texte: 'a' }], signaux: [], symbolique: [{ texte: 'c', appui: 'd' }],
    convergence: { statut: 'partiel', revele: 'x' },
  });
  assert.ok(ecartees.some((e) => /couche « signaux » vide/.test(e.raison)));
});

/* -------------------------------------------------------- étape 8 — risque */

test('risque : le niveau est croisé par l’outil, jamais annoncé par le modèle', async () => {
  const { validerEtape8, croiser } = await import('../core/etapes.js');
  assert.equal(croiser('elevee', 'critique'), 'critique');
  assert.equal(croiser('faible', 'mineur'), 'tres-faible');
  assert.equal(croiser('moderee', 'important'), 'modere');
  assert.equal(croiser('inconnue', 'mineur'), null);

  const { sortie } = validerEtape8({
    evaluations: [{
      scenario: 'S1', probabilite: 'faible', impact: 'critique',
      dimensions: ['politique', 'inventee'], conditions: ['si les pourparlers échouent'],
      confiance: 'moderee', niveau: 'critique',
    }],
  }, ['S1']);
  assert.equal(sortie.evaluations[0].niveau, 'modere', 'le niveau annoncé par le modèle est écrasé');
  assert.deepEqual(sortie.evaluations[0].dimensions, ['politique'], 'dimension inconnue écartée');
});

test('risque : une évaluation sans condition est une prophétie, donc rejetée', async () => {
  const { validerEtape8 } = await import('../core/etapes.js');
  const { sortie, ecartees } = validerEtape8({
    evaluations: [{ scenario: 'S1', probabilite: 'elevee', impact: 'critique',
      conditions: [], confiance: 'elevee' }],
  }, ['S1']);
  assert.equal(sortie.evaluations.length, 0);
  assert.ok(ecartees.some((e) => /prophétie/.test(e.raison)));
});

test('risque : l’inflation et le nivellement sont détectés tous les deux', async () => {
  const { validerEtape8 } = await import('../core/etapes.js');
  const ev = (id, p, i) => ({ scenario: id, probabilite: p, impact: i,
    conditions: ['si x'], confiance: 'moderee', dimensions: [] });

  const inflation = validerEtape8({
    evaluations: [ev('S1', 'elevee', 'critique'), ev('S2', 'elevee', 'critique'), ev('S3', 'elevee', 'critique')],
  }, ['S1', 'S2', 'S3']);
  assert.ok(inflation.ecartees.some((e) => /inflation du risque/.test(e.raison)));

  const nivellement = validerEtape8({
    evaluations: [ev('S1', 'faible', 'mineur'), ev('S2', 'faible', 'mineur'), ev('S3', 'faible', 'mineur')],
  }, ['S1', 'S2', 'S3']);
  assert.ok(nivellement.ecartees.some((e) => /nivellement/.test(e.raison)));
});

/* ----------------------------------------------- étape 9 — recommandations */

const R = (id, o = {}) => ({ id, priorite: 'haute', terme: 'court',
  action: `Commander une contre-expertise du tracé ${id}`, ressources: 'bureau d’études, 8 k€',
  risqueInaction: 'décision prise sans élément contradictoire', reversible: true,
  scenarios: ['S1'], ...o });

test('recommandations : les formules vides du skill sont rejetées une par une', async () => {
  const { validerEtape9 } = await import('../core/etapes.js');
  for (const action of [
    'Suivre attentivement la situation',
    'Renforcer la coopération avec les riverains',
    'Agir avant qu’il ne soit trop tard',
    'Prendre les mesures nécessaires',
    'Rester vigilant sur le dossier',
  ]) {
    const { ecartees } = validerEtape9({ recommandations: [R('R1', { action }), R('R2')] }, ['S1']);
    assert.ok(ecartees.some((e) => /formule vide/.test(e.raison)), `acceptée à tort : ${action}`);
  }
});

test('recommandations : une action contre un tiers est hors périmètre', async () => {
  const { validerEtape9 } = await import('../core/etapes.js');
  const { ecartees } = validerEtape9({
    recommandations: [R('R1', { action: 'Discréditer le porte-parole de la préfecture' }), R('R2')],
  }, ['S1']);
  assert.ok(ecartees.some((e) => /action contre un tiers/.test(e.raison)));
});

test('recommandations : non ressourcée ou sans risque d’inaction, rejetée', async () => {
  const { validerEtape9 } = await import('../core/etapes.js');
  assert.ok(validerEtape9({ recommandations: [R('R1', { ressources: '' }), R('R2')] }, ['S1'])
    .ecartees.some((e) => /non ressourcée/.test(e.raison)));
  assert.ok(validerEtape9({ recommandations: [R('R1', { risqueInaction: '' }), R('R2')] }, ['S1'])
    .ecartees.some((e) => /risque d’inaction/.test(e.raison)));
});

test('recommandations : bornées à 2-4 et triées par priorité puis terme', async () => {
  const { validerEtape9 } = await import('../core/etapes.js');
  assert.ok(validerEtape9({ recommandations: [R('R1')] }, ['S1'])
    .ecartees.some((e) => /2 minimum/.test(e.raison)));
  assert.ok(validerEtape9({ recommandations: ['R1', 'R2', 'R3', 'R4', 'R5'].map((i) => R(i)) }, ['S1'])
    .ecartees.some((e) => /4 maximum/.test(e.raison)));

  const { sortie } = validerEtape9({
    recommandations: [R('R1', { priorite: 'basse' }), R('R2', { priorite: 'haute', terme: 'long' }),
      R('R3', { priorite: 'haute', terme: 'court' })],
  }, ['S1']);
  assert.deepEqual(sortie.recommandations.map((r) => r.id), ['R3', 'R2', 'R1']);
});

/* ------------------------------------------------- étape 11 — rétroaction */

test('rétroaction : les clôtures abdicatives sont rejetées', async () => {
  const { validerEtape11 } = await import('../core/etapes.js');
  const { sortie, ecartees } = validerEtape11({
    invalidants: ['La publication de l’avis complet', 'L’avenir nous le dira'],
    lacunes: ['Le contenu de l’avis environnemental'],
    signaux: ['Tout est possible', 'Reprise des travaux sur le lot 3'],
    prochainPoint: { quand: 'fin mars', declencheur: 'décision du conseil départemental' },
  });
  assert.equal(sortie.invalidants.length, 1);
  assert.equal(sortie.signaux.length, 1);
  assert.equal(ecartees.filter((e) => /abdicative/.test(e.raison)).length, 2);
});

test('rétroaction : un prochain point sans déclencheur est rejeté', async () => {
  const { validerEtape11 } = await import('../core/etapes.js');
  const { ecartees } = validerEtape11({
    invalidants: ['a'], lacunes: ['b'], signaux: ['c'],
    prochainPoint: { quand: 'fin mars', declencheur: '' },
  });
  assert.ok(ecartees.some((e) => /sans échéance ou sans déclencheur/.test(e.raison)));
});

test('les sept étapes branchées ont leur référence embarquée', async () => {
  const { ETAPES } = await import('../core/etapes.js');
  const fichiers = readdirSync('references');
  for (const e of Object.values(ETAPES)) {
    assert.ok(e.references.length, `étape ${e.numero} sans référence`);
    for (const r of e.references) assert.ok(fichiers.includes(r), `${r} absent (étape ${e.numero})`);
  }
  assert.deepEqual(Object.keys(ETAPES).map(Number).sort((a, b) => a - b), [4, 5, 7, 8, 9, 10, 11]);
});

test('la chaîne de dépendances est cohérente', async () => {
  const { ETAPES } = await import('../core/etapes.js');
  for (const e of Object.values(ETAPES)) {
    for (const n of e.requiert) {
      assert.ok(ETAPES[n], `l’étape ${e.numero} dépend de ${n}, qui n’existe pas`);
      assert.ok(n < e.numero, `dépendance non causale : ${e.numero} → ${n}`);
    }
  }
});
