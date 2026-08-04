import test from 'node:test';
import assert from 'node:assert/strict';
import { corroboration, chronologie, champsLexicaux, contradictions, produire } from '../core/releve.js';
import { Dossiers, stockageMemoire } from '../core/dossier.js';
import { preparer, regrouper } from '../core/cluster.js';

const OUTIL = { nom: 'Constat', version: '0.1.0' };

const src = (id, o = {}) => ({
  id, editeur: `${id}.fr`, titre: `Titre ${id}`, texte: 'texte', url: `https://${id}.fr/a`,
  canonical: `https://${id}.fr/a`, datePubliee: null, citations: [], liens: [], ...o,
});

/* ------------------------------------------------------------------ § 6.1 */

test('corroboration : une grappe sans matériau propre ne compte pas comme distincte', () => {
  const sources = [
    src('s-001', { citations: [{ texte: 'x' }] }),
    src('s-002'), src('s-003'), src('s-004'),
    src('s-005', { liens: [{ nature: 'juridique' }] }),
  ];
  const grappes = [
    { id: 'g001', volume: 3, membres: [{ id: 's-002' }, { id: 's-003' }, { id: 's-004' }] },
    { id: 'g002', volume: 1, membres: [{ id: 's-001' }] },
    { id: 'g003', volume: 1, membres: [{ id: 's-005' }] },
  ];
  const c = corroboration(sources, grappes);

  assert.equal(c.sources, 5);
  assert.equal(c.editeurs, 5);
  assert.equal(c.grappes, 3);
  assert.equal(c.grappePlusLarge.volume, 3);
  assert.equal(c.comptesRendusDistincts, 2, 'la grappe de trois ne porte ni citation ni lien source');
  assert.equal(c.grappesSansMateriau, 1);
  assert.ok(c.definitionDistincts.length, 'la définition est affichée avec le chiffre');
});

/* ------------------------------------------------------------------ § 6.2 */

test('chronologie : les manques et les incohérences sont listés, pas corrigés', () => {
  const ch = chronologie([
    src('s-001', { datePubliee: '2026-02-14T09:00:00Z' }),
    src('s-002', { datePubliee: null }),
    src('s-003', {
      datePubliee: '2026-02-12T09:00:00Z', dateModifiee: '2026-02-11T09:00:00Z',
      datesIncoherentes: true,
    }),
  ]);
  assert.equal(ch.debut, '2026-02-12T09:00:00Z');
  assert.equal(ch.fin, '2026-02-14T09:00:00Z');
  assert.equal(ch.articlesDates, 2);
  assert.deepEqual(ch.articlesSansDate, ['s-002']);
  assert.equal(ch.datesIncoherentes.length, 1);
  assert.equal(ch.datesIncoherentes[0].id, 's-003');
  assert.deepEqual(ch.ordre.map((o) => o.id), ['s-003', 's-001']);
});

test('champs lexicaux : comptages par tranche, pas de courbe', () => {
  const sources = Array.from({ length: 8 }, (_, i) => src(`s-${i}`, {
    datePubliee: new Date(Date.UTC(2026, 1, 12 + i)).toISOString(),
    texte: i < 4
      ? 'Le moratoire divise les élus locaux du département concerné.'
      : 'Les travaux reprennent sur le tracé principal du département concerné.',
  }));
  const l = champsLexicaux(sources, { periodes: 2 });

  assert.equal(l.periodes.length, 2);
  assert.equal(l.nonCalcule, null);
  const moratoire = l.termes.find((t) => t.terme === 'moratoire');
  assert.deepEqual(moratoire.parPeriode, [4, 0]);
  const departement = l.termes.find((t) => t.terme === 'departement');
  assert.deepEqual(departement.parPeriode, [4, 4], 'un terme stable reste stable');
});

test('champs lexicaux : trop peu d’articles datés → déclaré', () => {
  const l = champsLexicaux([src('s-001', { datePubliee: '2026-02-12T09:00:00Z' })], { periodes: 4 });
  assert.equal(l.nonCalcule, 'trop peu d’articles datés');
  assert.deepEqual(l.termes, []);
});

test('contradictions : deux valeurs pour un même indicateur, avec les extraits', () => {
  const c = contradictions([
    src('s-001', { texte: 'Le chantier représente un investissement de 40 millions d’euros au total.' }),
    src('s-002', { texte: 'Le chantier représente un investissement de 52 millions d’euros selon la région.' }),
    src('s-003', { texte: 'Le chantier représente un investissement de 40 millions d’euros pour la part publique.' }),
  ]);
  const inv = c.find((x) => x.indicateur === 'investissement' || x.indicateur === 'chantier');
  assert.ok(inv, `indicateurs trouvés : ${c.map((x) => x.indicateur).join(', ')}`);
  assert.deepEqual(inv.valeurs, [40, 52]);
  assert.equal(inv.articles.length, 3);
  assert.ok(inv.extraits[0].extrait.includes('millions'));
});

test('contradictions : une même valeur répétée n’en est pas une', () => {
  const c = contradictions([
    src('s-001', { texte: 'Le budget du chantier atteint 40 millions d’euros cette année.' }),
    src('s-002', { texte: 'Le budget du chantier atteint 40 millions d’euros cette année.' }),
  ]);
  assert.deepEqual(c, []);
});

/* ------------------------------------------------------------------ relevé */

test('produire : le relevé porte ce qu’il a consommé', async () => {
  const sources = Array.from({ length: 4 }, (_, i) => src(`s-00${i + 1}`, {
    texte: `Article ${i} sur le contournement de Nîmes-Ouest et son calendrier de travaux.`,
    datePubliee: new Date(Date.UTC(2026, 1, 12 + i)).toISOString(),
  }));
  const grappes = regrouper(await preparer(sources));
  const r = await produire({ sources, grappes, outil: OUTIL, dossier: 'd-001', ts: '2026-03-04T10:00:00Z' });

  assert.equal(r.t, 'releve');
  assert.deepEqual(r.outil, OUTIL);
  assert.deepEqual(r.sourcesIds, ['s-001', 's-002', 's-003', 's-004']);
  assert.match(r.empreinteCorpus, /^[0-9a-f]{16}$/);
  assert.ok(r.parametres.SEUIL_RECOUVREMENT, 'les seuils du regroupement sont publiés');
  assert.ok(r.parametres.MIN_ARTICLES_ACTEUR, 'ceux des silences aussi');
  assert.ok(Array.isArray(r.silences.nonCalcules));
});

test('produire : deux relevés sur le même corpus sont identiques', async () => {
  const sources = Array.from({ length: 4 }, (_, i) => src(`s-00${i + 1}`, {
    texte: `Article ${i} sur le contournement de Nîmes-Ouest et son calendrier de travaux.`,
    datePubliee: new Date(Date.UTC(2026, 1, 12 + i)).toISOString(),
  }));
  const ts = '2026-03-04T10:00:00Z';
  const a = await produire({ sources, grappes: regrouper(await preparer(sources)), outil: OUTIL, dossier: 'd-001', ts });
  const b = await produire({ sources: [...sources].reverse(), grappes: regrouper(await preparer([...sources].reverse())), outil: OUTIL, dossier: 'd-001', ts });
  assert.deepEqual(a, b, 'l’ordre de versement ne change rien');
});

/* ----------------------------------------------------------------- journal */

const page = (n, texte, o = {}) => ({
  url: `https://ed${n}.fr/a${n}`, canonical: `https://ed${n}.fr/a${n}`,
  titre: `Titre ${n}`, editeur: `ed${n}.fr`, auteurs: [], texte,
  datePubliee: `2026-02-1${n}T09:00:00Z`, dateModifiee: null,
  liens: [], citations: [], diagnostic: { echec: null }, ...o,
});

const neuf = () => {
  let n = 0;
  return new Dossiers(stockageMemoire(), { horloge: () => `2026-03-04T10:00:${String(n++).padStart(2, '0')}Z` });
};

test('création : les quatre champs sont exigés', async () => {
  const d = neuf();
  await assert.rejects(() => d.creer({ id: 'd-001', question: 'q', perimetre: 'p', horizon: 'h', decision: '' }),
    /champ manquant : decision/);
  await d.creer({ id: 'd-001', question: 'q', perimetre: 'p', horizon: 'h', decision: 'd' });
  await assert.rejects(() => d.creer({ id: 'd-001', question: 'q', perimetre: 'p', horizon: 'h', decision: 'd' }),
    /déjà existant/);
  assert.deepEqual(await d.index(), ['d-001']);
});

test('versement : le corps est dédupliqué par hash, le journal reste léger', async () => {
  const d = neuf();
  await d.creer({ id: 'd-001', question: 'q', perimetre: 'p', horizon: 'h', decision: 'd' });
  const t = 'Le préfet du Gard a suspendu le chantier de contournement de Nîmes-Ouest.';
  const a = await d.verser('d-001', page(1, t));
  const b = await d.verser('d-001', page(2, t));

  assert.equal(a.texteHash, b.texteHash, 'texte identique chez deux éditeurs : même hash');
  assert.equal(a.id, 's-001');
  assert.equal(b.id, 's-002');
  assert.ok(!('texte' in a), 'le corps n’est pas dans le journal');
  const cles = await d.s.keys();
  assert.equal(cles.filter((c) => c.startsWith('txt:')).length, 1, 'un seul enregistrement de texte');
});

test('append-only : reverser la même URL ajoute une entrée, la lecture retient la dernière', async () => {
  const d = neuf();
  await d.creer({ id: 'd-001', question: 'q', perimetre: 'p', horizon: 'h', decision: 'd' });
  await d.verser('d-001', page(1, 'Première version du texte de cet article de presse.'));
  await d.verser('d-001', page(1, 'Seconde version du texte, l’article a été mis à jour.'));

  const j = await d.journal('d-001');
  assert.equal(j.filter((e) => e.t === 'source').length, 2, 'aucune entrée réécrite');
  const corpus = await d.corpus('d-001');
  assert.equal(corpus.length, 1, 'une seule source à la lecture');
  assert.match(corpus[0].texte, /Seconde version/);
});

test('rejeu : le corpus d’un relevé ancien est reconstituable', async () => {
  const d = neuf();
  await d.creer({ id: 'd-001', question: 'q', perimetre: 'p', horizon: 'h', decision: 'd' });
  await d.verser('d-001', page(1, 'Premier article versé sur le chantier de contournement.'));
  await d.verser('d-001', page(2, 'Deuxième article versé sur le calendrier des travaux.'));

  const avant = await d.corpus('d-001');
  const grappes = regrouper(await preparer(avant));
  const releve = await produire({ sources: avant, grappes, outil: OUTIL, dossier: 'd-001' });
  await d.ajouter('d-001', releve);

  // Le dossier continue de vivre.
  await d.verser('d-001', page(3, 'Troisième article versé bien après le relevé initial.'));
  assert.equal((await d.corpus('d-001')).length, 3);

  const rejoue = await d.corpusDuReleve('d-001', releve);
  assert.equal(rejoue.length, 2, 'le relevé ancien retrouve exactement ses deux sources');
  const grappesRejouees = regrouper(await preparer(rejoue));
  const r2 = await produire({
    sources: rejoue, grappes: grappesRejouees, outil: OUTIL, dossier: 'd-001', ts: releve.ts,
  });
  assert.equal(r2.empreinteCorpus, releve.empreinteCorpus);
  assert.deepEqual(r2.corroboration, releve.corroboration);
});

test('suppression : les corps non référencés ailleurs partent aussi', async () => {
  const d = neuf();
  const t = 'Un texte partagé entre deux dossiers distincts de la même enquête.';
  await d.creer({ id: 'd-001', question: 'q', perimetre: 'p', horizon: 'h', decision: 'd' });
  await d.creer({ id: 'd-002', question: 'q', perimetre: 'p', horizon: 'h', decision: 'd' });
  await d.verser('d-001', page(1, t));
  await d.verser('d-001', page(2, 'Un texte propre au premier dossier et à personne d’autre.'));
  await d.verser('d-002', page(1, t));

  const r = await d.supprimer('d-001');
  assert.equal(r.textesSupprimes, 1, 'le texte encore utilisé par d-002 est conservé');
  assert.deepEqual(await d.index(), ['d-002']);
  assert.deepEqual(await d.journal('d-001'), []);
  assert.equal((await d.corpus('d-002'))[0].texte, t);
});

test('une source sans corps reste utile : date, éditeur et liens survivent', async () => {
  // Régression : le versement refusait une page mal extraite, et le dossier
  // restait vide. La chronologie et le comptage des documents source ne
  // dépendent pas du corps — les perdre était un choix coûteux et inutile.
  const d = neuf();
  await d.creer({ id: 'd-001', question: 'q', perimetre: 'p', horizon: 'h', decision: 'd' });
  await d.verser('d-001', {
    ...page(1, ''),
    liens: [{ nature: 'juridique', href: 'https://legifrance.gouv.fr/x', ancre: 'l’arrêté' }],
    diagnostic: { echec: 'aucun bloc de texte', zone: null, caracteres: 0 },
  });

  const corpus = await d.corpus('d-001');
  assert.equal(corpus.length, 1);
  assert.equal(corpus[0].texte, '');
  assert.equal(corpus[0].texteHash, null);
  assert.equal(corpus[0].datePubliee, '2026-02-11T09:00:00Z');
  assert.equal(corpus[0].liens.length, 1);
  assert.equal(corpus[0].diagnostic.echec, 'aucun bloc de texte');

  // Le relevé compte ce qu'il peut et ne prétend rien de plus.
  const grappes = regrouper(await preparer(corpus));
  const r = await produire({ sources: corpus, grappes, outil: OUTIL, dossier: 'd-001' });
  assert.equal(r.corroboration.sources, 1);
  assert.equal(r.chronologie.articlesDates, 1);
  assert.equal(grappes[0].sansTexte, 1, 'l’absence de corps est comptée, pas masquée');
});

test('corpus mixte : les silences sont calculés par provenance', async () => {
  const art = (id, provenance, i) => ({
    id, provenance, editeur: `ed${i % 3}.fr`, titre: `Titre ${id}`,
    url: `https://ed${i % 3}.fr/${id}`, canonical: `https://ed${i % 3}.fr/${id}`,
    datePubliee: new Date(Date.UTC(2026, 6, 10 + i)).toISOString(),
    texte: `Le président Martin Dubois a déclaré mardi que les pourparlers reprendraient. `
      + `« Nous avançons malgré les blocages persistants du dossier ${i}. » La préfecture du Gard `
      + `n'a pas commenté cette annonce faite depuis le palais présidentiel hier soir.`,
    citations: [{ texte: `Nous avançons malgré les blocages persistants du dossier ${i}.`,
      marqueur: '«»', debut: 78, fin: 140 }],
    liens: i % 2 ? [{ nature: 'officiel' }] : [],
  });

  const sources = [
    ...Array.from({ length: 6 }, (_, i) => art(`s-l${i}`, 'lecture', i)),
    ...Array.from({ length: 6 }, (_, i) => art(`s-r${i}`, 'recherche', i + 6)),
  ];
  const grappes = regrouper(await preparer(sources));
  const r = await produire({ sources, grappes, outil: OUTIL, dossier: 'd-001' });

  assert.equal(r.populations.lecture, 6);
  assert.equal(r.populations.recherche, 6);
  assert.equal(r.populations.mixte, true);
  assert.match(r.populations.avertissement, /Corpus mixte/);

  assert.ok(r.silencesParProvenance.lecture);
  assert.ok(r.silencesParProvenance.recherche);
  // Chaque population a ses propres comptages, pas une part du total.
  const total = r.silences.calcules.find((c) => c.code === 'article-sans-source');
  const l = r.silencesParProvenance.lecture.calcules.find((c) => c.code === 'article-sans-source');
  const rr = r.silencesParProvenance.recherche.calcules.find((c) => c.code === 'article-sans-source');
  assert.equal(l.justification.total, 6);
  assert.equal(rr.justification.total, 6);
  assert.equal(total.justification.total, 12);
});

test('corpus d’une seule provenance : pas de colonnes inutiles', async () => {
  const sources = Array.from({ length: 3 }, (_, i) => ({
    id: `s-00${i}`, editeur: 'a.fr', titre: `T${i}`, url: `https://a.fr/${i}`,
    canonical: `https://a.fr/${i}`, datePubliee: `2026-07-1${i}T09:00:00Z`,
    texte: `Article ${i} sur le contournement et son calendrier de travaux publics.`,
    citations: [], liens: [],
  }));
  const r = await produire({
    sources, grappes: regrouper(await preparer(sources)), outil: OUTIL, dossier: 'd-001',
  });
  assert.equal(r.populations.mixte, false);
  assert.equal(r.populations.avertissement, null);
  assert.equal(r.silencesParProvenance, null);
});
