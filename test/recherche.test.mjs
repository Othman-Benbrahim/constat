import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { corpsRequete, enTetes, entreeRecherche, versPage, fusionner, verdict } from '../core/recherche.js';
import { extraire } from '../core/extraction.js';

const REPONSE = JSON.parse(readFileSync('outils/exa-simulation.json', 'utf8'));

test('requête : balisage demandé, liens demandés, fenêtre de dates transmise', () => {
  const c = corpsRequete({ query: 'q', nombre: 12, depuis: '2026-02-01', jusqua: '2026-03-01' });
  assert.equal(c.numResults, 12);
  assert.deepEqual(c.contents.text, { includeHtmlTags: true },
    'sans balisage : ni JSON-LD, ni guillemets situables, ni liens de corps');
  assert.equal(c.contents.extras.links, 20);
  assert.equal(c.startPublishedDate, '2026-02-01');
  assert.equal(c.endPublishedDate, '2026-03-01');

  const sans = corpsRequete({ query: 'q', html: false });
  assert.equal(sans.contents.text, true);
});

test('la clé part en en-tête, jamais dans le corps', () => {
  const h = enTetes('exa-secret');
  assert.equal(h['x-api-key'], 'exa-secret');
  assert.ok(!JSON.stringify(corpsRequete({ query: 'q' })).includes('exa-secret'));
});

test('entrée de journal : la requête est rejouable et les échecs sont conservés', () => {
  const corps = corpsRequete({ query: 'contournement' });
  const e = entreeRecherche({ dossier: 'd-001', query: 'contournement', corps, reponse: REPONSE });

  assert.equal(e.t, 'recherche');
  assert.equal(e.requestId, 'simulation-0001');
  assert.equal(e.cout, 0.021);
  assert.deepEqual(e.parametres, corps, 'les paramètres exacts sont archivés');
  assert.equal(e.resultats[0].rang, 1, 'le rang est conservé : un corpus classé n’est pas un corpus neutre');
  assert.equal(e.echecs.length, 1);
  assert.equal(e.echecs[0].tag, 'SOURCE_NOT_AVAILABLE',
    'un crawl échoué est déclaré, pas silencieusement absent');
});

test('la date du moteur n’est jamais promue en date de publication', () => {
  const r = REPONSE.results[0];
  const page = versPage(r, { rang: 1 });
  assert.equal(page.dateFournisseur, r.publishedDate);
  assert.equal(page.provenance, 'recherche');

  const extraite = extraire(parseHTML(page.html).document, page.url, { pret: 'api' });
  const f = fusionner(page, extraite);

  assert.equal(f.datePubliee, extraite.datePubliee, 'la date vient du balisage de la page');
  assert.equal(f.dateFournisseur, r.publishedDate, 'celle du moteur est conservée à part');
  assert.equal(f.diagnostic.dateSelonFournisseurSeulement, false);
});

test('sans date dans la page, le repli sur le moteur est signalé, pas masqué', () => {
  const page = versPage({ url: 'https://x.fr/a', publishedDate: '2026-02-20T00:00:00.000Z',
    text: '<html><body><article><p>Un corps sans aucune date déclarée dans le balisage de la page, '
      + 'assez long pour être retenu par l’extraction courante.</p></article></body></html>' });
  const extraite = extraire(parseHTML(page.html).document, page.url);
  const f = fusionner(page, extraite);

  assert.equal(f.datePubliee, null, 'aucune date inventée');
  assert.equal(f.dateFournisseur, '2026-02-20T00:00:00.000Z');
  assert.equal(f.diagnostic.dateSelonFournisseurSeulement, true);
});

test('absence de balisage : détectée, jamais compensée', () => {
  const brut = versPage(REPONSE.results.find((r) => !/</.test(r.text)));
  assert.equal(brut.baliseur, false);
  assert.equal(brut.html, null);
  assert.ok(brut.texteBrut.length > 0, 'le texte est gardé, sans prétendre l’avoir structuré');
});

test('repli sur le titre du moteur : appliqué et tracé', () => {
  const page = versPage({ url: 'https://x.fr/a', title: 'Titre selon le moteur',
    author: 'Rédaction', text: '<html><body><article><p>Un corps de longueur suffisante pour '
      + 'être retenu, mais sans titre h1 ni balise title dans la page.</p></article></body></html>' });
  const f = fusionner(page, extraire(parseHTML(page.html).document, page.url));
  assert.equal(f.titre, 'Titre selon le moteur');
  assert.deepEqual(f.auteurs, ['Rédaction']);
  assert.deepEqual(f.diagnostic.replisFournisseur, ['titre', 'auteur']);
});

test('verdict : chaque comptage décide de la survie d’un détecteur', () => {
  const sources = REPONSE.results.map((r, i) => {
    const page = versPage(r, { rang: i + 1 });
    const extraite = page.html
      ? extraire(parseHTML(page.html).document, page.url, { pret: 'api' })
      : { texte: page.texteBrut, liens: [], citations: [], datePubliee: null,
          diagnostic: { echec: 'aucun balisage renvoyé par le moteur' } };
    return fusionner(page, extraite);
  });

  const v = verdict(sources);
  assert.equal(v.sources, 7);
  assert.equal(v.balisageRecu, 6, 'un résultat sur sept revient sans balisage');
  assert.equal(v.detecteurs['acteur-non-cite'], true);
  assert.equal(v.detecteurs['article-sans-source'], false,
    'un seul article porte un lien de corps : le détecteur 4 ne dit plus rien');
});

test('verdict : sans aucun balisage, aucun détecteur ne survit', () => {
  const nues = [1, 2, 3].map((i) => ({
    id: `s-${i}`, texte: 'x'.repeat(400), liens: [], citations: [], datePubliee: null,
    diagnostic: { balisageRecu: false },
  }));
  const v = verdict(nues);
  assert.equal(v.detecteurs['acteur-non-cite'], false);
  assert.equal(v.detecteurs['article-sans-source'], false);
  assert.equal(v.detecteurs['trou-dossier'], false);
  assert.equal(v.detecteurs['terme-effondre'], false);
  assert.equal(v.detecteurs['grappe-origine-unique'], true, 'seul le texte brut suffit à celui-là');
});

test('requête de page : GET simple, sans corps ni clé', async () => {
  const { requetePage } = await import('../core/recherche.js');
  const r = requetePage('https://apnews.com/article/x');
  assert.equal(r.methode, 'GET');
  assert.equal(r.url, 'https://apnews.com/article/x');
  assert.ok(!('body' in r), 'un GET n’a pas de corps');
  assert.match(r.headers.Accept, /text\/html/);
});

test('verdict : distingue les pages lues à la source du repli sur le moteur', async () => {
  const { verdict } = await import('../core/recherche.js');
  const s = (origine, o = {}) => ({
    texte: 'x'.repeat(400), liens: [], citations: [], datePubliee: null,
    diagnostic: { origineContenu: origine, balisageRecu: true }, ...o,
  });
  const v = verdict([s('page'), s('page'), s('moteur')]);
  assert.equal(v.pagesRecuperees, 2);
  assert.equal(v.contenuMoteur, 1);
});

test('l’origine du contenu est tracée dans le diagnostic', async () => {
  const { versPage, fusionner } = await import('../core/recherche.js');
  const page = versPage({ url: 'https://x.fr/a', text: '<p>corps</p>' });
  page.origineContenu = 'page';
  const f = fusionner(page, { diagnostic: {}, titre: 'T', auteurs: [], datePubliee: null });
  assert.equal(f.diagnostic.origineContenu, 'page');

  const sansMarque = fusionner(versPage({ url: 'https://x.fr/b', text: 'nu' }),
    { diagnostic: {}, titre: 'T', auteurs: [], datePubliee: null });
  assert.equal(sansMarque.diagnostic.origineContenu, 'moteur', 'défaut prudent');
});
