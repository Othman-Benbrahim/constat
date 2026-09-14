import test from 'node:test';
import assert from 'node:assert/strict';
import { Dossiers, stockageMemoire } from '../core/dossier.js';

const QUESTION = {
  question: 'q', perimetre: 'p', horizon: 'h', decision: 'd',
};

const page = (n, texte = `texte ${n}`) => ({
  url: `https://e${n}.fr/a`, canonical: `https://e${n}.fr/a`,
  titre: `T${n}`, editeur: `e${n}.fr`, texte,
});

/** Horloge monotone : les entrées de journal doivent s'ordonner strictement,
 *  sinon « export postérieur au relevé » n'est pas testable. */
function horloge() {
  let t = Date.parse('2026-03-01T10:00:00Z');
  return () => new Date((t += 1000)).toISOString();
}

const neuf = () => new Dossiers(stockageMemoire(), { horloge: horloge() });

/* ------------------------------------------------------------------- état */

test('un dossier neuf est actif, sans entrée d’état dans son journal', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  assert.equal(await D.etat('d-1'), 'actif');
  assert.equal((await D.journal('d-1')).filter((e) => e.t === 'etat').length, 0);
  assert.deepEqual(await D.lister(), ['d-1']);
});

test('clore sort le dossier de la liste active sans le retirer de l’index', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.creer({ id: 'd-2', ...QUESTION });
  await D.clore('d-1', { motif: 'exporté' });

  assert.equal(await D.etat('d-1'), 'corbeille');
  assert.deepEqual(await D.lister(), ['d-2']);
  assert.deepEqual(await D.lister({ etat: 'corbeille' }), ['d-1']);
  assert.deepEqual(await D.index(), ['d-1', 'd-2'], 'l’index reste complet');
});

test('l’état est reconstruit depuis le journal : clore puis restaurer laisse deux traces', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.clore('d-1');
  await D.restaurer('d-1');

  const etats = (await D.journal('d-1')).filter((e) => e.t === 'etat');
  assert.deepEqual(etats.map((e) => e.etat), ['corbeille', 'actif']);
  assert.equal(await D.etat('d-1'), 'actif');
  assert.ok(etats.every((e) => e.ts), 'chaque geste est daté');
});

test('clore deux fois, ou restaurer un dossier actif, lève', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await assert.rejects(() => D.restaurer('d-1'), /pas en corbeille/);
  await D.clore('d-1');
  await assert.rejects(() => D.clore('d-1'), /déjà en corbeille/);
});

/* ------------------------------------------------------ verrou d’écriture */

test('un dossier en corbeille refuse tout versement', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.verser('d-1', page(1));
  await D.clore('d-1');

  await assert.rejects(() => D.verser('d-1', page(2)), /en corbeille/);
  assert.equal((await D.corpus('d-1')).length, 1, 'le corpus exporté est intact');
});

test('un dossier en corbeille refuse relevé, lecture, étape et cotation', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.clore('d-1');

  for (const t of ['releve', 'lecture', 'etape', 'cotation', 'export']) {
    await assert.rejects(() => D.ajouter('d-1', { t, dossier: 'd-1' }), /en corbeille/, t);
  }
});

test('la restauration rouvre l’écriture', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.clore('d-1');
  await D.restaurer('d-1');
  await D.verser('d-1', page(1));
  assert.equal((await D.corpus('d-1')).length, 1);
});

test('un dossier en corbeille reste lisible et rejouable', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.verser('d-1', page(1));
  const r = await D.ajouter('d-1', { t: 'releve', dossier: 'd-1', sourcesIds: ['s-001'], empreinteCorpus: 'abc' });
  await D.clore('d-1');

  const corpus = await D.corpusDuReleve('d-1', r);
  assert.equal(corpus.length, 1);
  assert.equal(corpus[0].texte, 'texte 1', 'le corps est toujours là');
  assert.ok((await D.meta('d-1')).question);
});

/* ---------------------------------------------------------- état de clôture */

test('cloture : ce qui manque est énuméré, jamais deviné', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.verser('d-1', page(1));

  let c = await D.cloture('d-1');
  assert.equal(c.ok, false);
  assert.deepEqual(c.manque, ['aucun relevé établi', 'aucun export produit']);
  assert.equal(c.sources, 1);

  await D.ajouter('d-1', { t: 'releve', dossier: 'd-1', empreinteCorpus: 'abc' });
  c = await D.cloture('d-1');
  assert.equal(c.ok, false);
  assert.deepEqual(c.manque, ['aucun export produit']);

  await D.ajouter('d-1', { t: 'export', dossier: 'd-1', format: 'md', chiffre: true });
  c = await D.cloture('d-1');
  assert.equal(c.ok, true);
  assert.deepEqual(c.manque, []);
  assert.equal(c.dernierExport.format, 'md');
  assert.equal(c.dernierExport.chiffre, true);
});

test('cloture : un export antérieur au dernier relevé ne clôt rien', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.verser('d-1', page(1));
  await D.ajouter('d-1', { t: 'releve', dossier: 'd-1', empreinteCorpus: 'abc' });
  await D.ajouter('d-1', { t: 'export', dossier: 'd-1', format: 'json' });
  await D.verser('d-1', page(2));
  await D.ajouter('d-1', { t: 'releve', dossier: 'd-1', empreinteCorpus: 'def' });

  const c = await D.cloture('d-1');
  assert.equal(c.ok, false);
  assert.deepEqual(c.manque, ['le dernier export est antérieur au dernier relevé']);
  assert.equal(c.exports, 1);
});

test('cloture : les étapes validées sont comptées une fois chacune', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.ajouter('d-1', { t: 'etape', numero: 5, validee: true });
  await D.ajouter('d-1', { t: 'etape', numero: 5, validee: true });
  await D.ajouter('d-1', { t: 'etape', numero: 7, validee: false });
  await D.ajouter('d-1', { t: 'etape', numero: 10, validee: true });

  assert.deepEqual((await D.cloture('d-1')).etapesValidees, [5, 10]);
});

test('l’entrée de clôture garde le constat du moment', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.verser('d-1', page(1));
  const e = await D.clore('d-1', { motif: 'abandonné' });

  assert.equal(e.motif, 'abandonné');
  assert.equal(e.constat.sources, 1);
  assert.deepEqual(e.constat.manque, ['aucun relevé établi', 'aucun export produit']);
});

/* ------------------------------------------------------------- suppression */

test('supprimer un dossier actif ne purge pas un corps encore référencé par la corbeille', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.creer({ id: 'd-2', ...QUESTION });
  await D.verser('d-1', { ...page(1), texte: 'partagé' });
  await D.verser('d-2', { ...page(2), texte: 'partagé' });
  await D.clore('d-1');

  const { textesSupprimes } = await D.supprimer('d-2');
  assert.equal(textesSupprimes, 0, 'd-1 est en corbeille, pas hors index');
  assert.equal((await D.corpus('d-1'))[0].texte, 'partagé');
});

test('vider la corbeille supprime les clos et laisse les actifs intacts', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  await D.creer({ id: 'd-2', ...QUESTION });
  await D.creer({ id: 'd-3', ...QUESTION });
  await D.verser('d-1', page(1));
  await D.verser('d-2', page(2));
  await D.verser('d-3', page(3));
  await D.clore('d-1');
  await D.clore('d-3');

  const r = await D.viderCorbeille();
  assert.deepEqual(r.ids, ['d-1', 'd-3']);
  assert.equal(r.dossiers, 2);
  assert.equal(r.textesSupprimes, 2);
  assert.deepEqual(await D.index(), ['d-2']);
  assert.equal((await D.corpus('d-2')).length, 1);
  assert.deepEqual(await D.lister({ etat: 'corbeille' }), []);
});

test('vider une corbeille vide ne fait rien', async () => {
  const D = neuf();
  await D.creer({ id: 'd-1', ...QUESTION });
  assert.deepEqual(await D.viderCorbeille(), { dossiers: 0, ids: [], textesSupprimes: 0 });
  assert.deepEqual(await D.index(), ['d-1']);
});
