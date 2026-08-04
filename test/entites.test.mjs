import test from 'node:test';
import assert from 'node:assert/strict';
import {
  entitesDuTexte, estPhrase, estSigle, similarite, fusionnerVariantes, levenshtein,
} from '../core/entites.js';

const cles = (t) => [...entitesDuTexte(t).keys()].sort();

/* --- défaut 1 : le chrome d'interface aspiré dans le corps --------------- */

test('« Modifié le » n’est pas un acteur', () => {
  const chrome = 'Publié le : 02/08/2026 - 06:20 Modifié le : 03/08/2026 - 05:59';
  assert.equal(estPhrase(chrome), false);
  const t = `Le préfet du Gard a suspendu le chantier de contournement mardi soir.\n\n${chrome}`;
  const k = cles(t);
  assert.ok(!k.includes('modifie'));
  assert.ok(!k.includes('publie'));
  assert.ok(k.includes('prefecture du gard') || k.includes('gard'));
});

test('un bloc sans ponctuation ou trop court n’est pas scanné', () => {
  assert.equal(estPhrase('EN COURS'), false);
  assert.equal(estPhrase('Moyen-Orient'), false);
  assert.equal(estPhrase('Un titre suffisamment long mais sans aucune ponctuation finale'), false);
  assert.equal(estPhrase('Une phrase assez longue pour être retenue, avec sa ponctuation.'), true);
});

/* --- défaut 2 : l’intertitre en capitales pris pour un sigle ------------- */

test('« ACCORD » en intertitre n’est pas un sigle, « AFP » et « IRNA » le sont', () => {
  assert.equal(estSigle('ACCORD', new Set()), false);
  assert.equal(estSigle('DIRECT', new Set()), false);
  assert.equal(estSigle('AFP', new Set()), true);
  assert.equal(estSigle('IRNA', new Set()), true);
  // Une graphie longue tout en capitales passe si elle existe ailleurs en
  // casse mixte : « UNESCO » vu comme « Unesco » dans un autre article.
  assert.equal(estSigle('UNESCO', new Set()), false);
  assert.equal(estSigle('UNESCO', new Set(['unesco'])), true);
  assert.equal(estSigle('Martin Dubois', new Set()), true);
});

test('un intertitre crié ne remonte pas dans les entités', () => {
  const t = 'ACCORD\n\nL’agence IRNA a rapporté que les pourparlers reprendraient lundi matin.';
  const k = cles(t);
  assert.ok(!k.includes('accord'));
  assert.ok(k.includes('irna'));
});

/* --- défaut 3 : les translittérations concurrentes ----------------------- */

test('distance et similarité', () => {
  assert.equal(levenshtein('baghaei', 'baghai'), 1);
  assert.equal(levenshtein('abc', 'abc'), 0);
  assert.equal(levenshtein('', 'abc'), 3);
  assert.ok(similarite('esmaeil baghaei', 'esmail baghai') > 0.85);
  assert.ok(similarite('donald trump', 'donald tusk') < 0.85, 'deux personnes distinctes restent distinctes');
});

test('les variantes d’un même nom fusionnent, la graphie la plus fréquente gagne', () => {
  const entites = new Map([
    ['esmaeil baghaei', { affichage: 'Esmaeil Baghaei', articles: new Set(['s-001']), occurrences: 2, variantes: [] }],
    ['esmail baghai', { affichage: 'Esmaïl Baghaï', articles: new Set(['s-002', 's-003']), occurrences: 5, variantes: [] }],
    ['donald trump', { affichage: 'Donald Trump', articles: new Set(['s-001']), occurrences: 9, variantes: [] }],
    ['donald tusk', { affichage: 'Donald Tusk', articles: new Set(['s-004']), occurrences: 1, variantes: [] }],
  ]);
  const fusions = fusionnerVariantes(entites);

  assert.equal(entites.size, 3, 'une seule fusion');
  assert.ok(entites.has('esmail baghai'), 'la graphie présente dans le plus d’articles est retenue');
  assert.ok(!entites.has('esmaeil baghaei'));
  assert.equal(entites.get('esmail baghai').articles.size, 3);
  assert.equal(entites.get('esmail baghai').occurrences, 7);
  assert.deepEqual(entites.get('esmail baghai').variantes, ['Esmaeil Baghaei']);
  assert.ok(entites.has('donald trump') && entites.has('donald tusk'));
  assert.equal(fusions.length, 1);
});

/* --- ce qui n’est pas corrigé, et qui est déclaré ----------------------- */

test('une entité d’un seul mot est comptée mais marquée non locutrice', () => {
  const e = entitesDuTexte(
    'Les frappes sur Gaza ont repris selon plusieurs sources concordantes du dossier. '
    + 'Le porte-parole Martin Dubois a confirmé cette information mardi après-midi.',
  );
  assert.equal(e.get('gaza')?.multiMots, false);
  assert.equal(e.get('martin dubois')?.multiMots, true);
});

test('une institution du lexique est reconnue même en minuscules', () => {
  const e = entitesDuTexte(
    'La préfecture du Gard a confirmé la suspension du chantier de contournement mardi.',
  );
  assert.equal(e.get('prefecture du gard')?.institution, true);
});
