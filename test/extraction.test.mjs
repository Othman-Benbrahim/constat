import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { extraire, natureLien, extraireCitations } from '../core/extraction.js';

const URL_PAGE = 'https://midilibre.fr/2026/02/17/chantier-suspendu-12345.php?utm_source=x';

const page = ({ tete = '', corps }) => parseHTML(`<!doctype html><html><head>
<title>Chantier suspendu | Midi Libre</title>${tete}</head><body>
<nav><a href="/sport">Sport</a><a href="/culture">Culture</a><a href="/abonnement">S'abonner</a></nav>
<header><a href="/">Accueil</a></header>
<article><h1>Le chantier du contournement suspendu</h1>${corps}</article>
<aside class="related"><a href="/lire-aussi-1">À lire aussi</a></aside>
<footer><a href="/mentions-legales">Mentions légales</a></footer>
</body></html>`).document;

const P = (t) => `<p>${t}</p>`;
const LONG = 'Le préfet du Gard a annoncé mardi la suspension du chantier de contournement de Nîmes-Ouest.';

test('JSON-LD complet : dates ISO, auteurs, canonical normalisé', () => {
  const doc = page({
    tete: `<link rel="canonical" href="https://www.midilibre.fr/2026/02/17/chantier-suspendu-12345.php">
    <script type="application/ld+json">{"@type":"NewsArticle",
      "datePublished":"2026-02-17T09:12:00+01:00","dateModified":"2026-02-17T11:40:00+01:00",
      "author":[{"name":"Claire Vidal"},{"name":"AFP"}]}</script>`,
    corps: P(LONG) + P(LONG + ' Les associations riveraines réclamaient cette suspension.'),
  });
  const r = extraire(doc, URL_PAGE);
  assert.equal(r.canonical, 'https://midilibre.fr/2026/02/17/chantier-suspendu-12345.php');
  assert.equal(r.editeur, 'midilibre.fr');
  assert.equal(r.titre, 'Le chantier du contournement suspendu');
  assert.deepEqual(r.auteurs, ['Claire Vidal', 'AFP']);
  assert.equal(r.datePubliee, '2026-02-17T08:12:00.000Z');
  assert.equal(r.dateModifiee, '2026-02-17T10:40:00.000Z');
  assert.equal(r.datesIncoherentes, false);
  assert.equal(r.diagnostic.echec, null);
});

test('repli OpenGraph puis time[datetime]', () => {
  const og = extraire(page({
    tete: '<meta property="article:published_time" content="2026-02-17T09:12:00Z">',
    corps: P(LONG) + P(LONG),
  }), URL_PAGE);
  assert.equal(og.datePubliee, '2026-02-17T09:12:00.000Z');

  const t = extraire(page({
    corps: '<time datetime="2026-02-17">17 février</time>' + P(LONG) + P(LONG),
  }), URL_PAGE);
  assert.equal(t.datePubliee, '2026-02-17T00:00:00.000Z');
});

test('aucune date : null, jamais un repli sur la date de versement', () => {
  const r = extraire(page({ corps: P(LONG) + P(LONG) }), URL_PAGE);
  assert.equal(r.datePubliee, null);
  assert.equal(r.dateModifiee, null);
  assert.equal(r.datesIncoherentes, false);
});

test('dateModified antérieure : signalée, pas corrigée', () => {
  const r = extraire(page({
    tete: `<script type="application/ld+json">{"@type":"NewsArticle",
      "datePublished":"2026-02-17T09:00:00Z","dateModified":"2026-02-16T09:00:00Z"}</script>`,
    corps: P(LONG) + P(LONG),
  }), URL_PAGE);
  assert.equal(r.datesIncoherentes, true);
  assert.equal(r.dateModifiee, '2026-02-16T09:00:00.000Z', 'la valeur aberrante est conservée telle quelle');
});

test('navigation lourde : seuls les liens du corps sont retenus', () => {
  const r = extraire(page({
    corps: P(LONG + ' Selon <a href="https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000">l’arrêté préfectoral</a> publié mardi.')
      + P(LONG + ' Un <a href="/dossier-rocade">précédent article</a> détaillait le calendrier.'),
  }), URL_PAGE);

  assert.equal(r.liens.length, 2, 'nav, header, aside et footer exclus');
  assert.ok(r.diagnostic.liensHorsCorps >= 6);

  const [arrete, interne] = r.liens;
  assert.equal(arrete.nature, 'juridique');
  assert.equal(arrete.interne, false);
  assert.equal(arrete.ancre, 'l’arrêté préfectoral');
  assert.equal(interne.interne, true, 'lien relatif vers le même éditeur');
  assert.equal(interne.nature, 'autre');
  assert.equal(interne.href, 'https://midilibre.fr/dossier-rocade');
});

test('offsets : chaque lien est resituable dans le texte', () => {
  const r = extraire(page({
    corps: P(LONG) + P(LONG + ' Voir le <a href="https://data.gouv.fr/x.csv">jeu de données</a> publié.'),
  }), URL_PAGE);
  const l = r.liens[0];
  assert.equal(l.nature, 'donnees');
  assert.ok(r.texte.slice(l.offset).startsWith(l.ancre),
    `offset ${l.offset} : « ${r.texte.slice(l.offset, l.offset + 20)} »`);
});

test('citations : guillemets français, anglais, blockquote, offsets exacts', () => {
  const r = extraire(page({
    corps: P(`Le préfet a déclaré : « La suspension prend effet immédiatement et sans délai. »`)
      + P(`Un riverain confie : "Nous attendions cette décision depuis des mois entiers."`)
      + `<blockquote><p>Nous étudions toutes les voies de recours disponibles à ce stade.</p></blockquote>`,
  }), URL_PAGE);

  assert.equal(r.citations.length, 3);
  assert.deepEqual(r.citations.map((c) => c.marqueur), ['«»', '""', 'blockquote']);
  for (const c of r.citations) {
    assert.ok(r.texte.slice(c.debut, c.fin).includes(c.texte.slice(0, 20)),
      `citation mal située : ${c.marqueur}`);
  }
});

test('citations : un blockquote déjà couvert par des guillemets ne compte pas deux fois', () => {
  const morceaux = [{ texte: '« Une phrase citée entre guillemets ici. »', offset: 0, blockquote: true }];
  const c = extraireCitations(morceaux[0].texte, morceaux);
  assert.equal(c.length, 1);
  assert.equal(c[0].marqueur, '«»');
});

test('paywall : échec déclaré, pas un texte silencieusement court', () => {
  const r = extraire(page({ corps: P('Le préfet du Gard a annoncé la suspension du chantier mardi.') }), URL_PAGE);
  assert.match(r.diagnostic.echec, /trop court/);
  assert.ok(r.texte.length > 0, 'ce qui a été lu est conservé');
});

test('page sans article exploitable', () => {
  const doc = parseHTML('<!doctype html><html><body><div>Menu</div></body></html>').document;
  const r = extraire(doc, URL_PAGE);
  assert.equal(r.diagnostic.echec, 'aucun bloc de texte');
  assert.equal(r.texte, '');
  assert.deepEqual(r.liens, []);
});

test('le DOM vivant n’est pas modifié', () => {
  const doc = page({ corps: P(LONG) + P(LONG) });
  const avant = doc.querySelectorAll('nav,aside,footer').length;
  extraire(doc, URL_PAGE);
  assert.equal(doc.querySelectorAll('nav,aside,footer').length, avant,
    'le nettoyage doit porter sur un clone');
});

test('natureLien : liste explicite, jamais de devinette', () => {
  assert.equal(natureLien('https://www.legifrance.gouv.fr/x'), 'juridique');
  assert.equal(natureLien('https://www.data.gouv.fr/datasets/x'), 'donnees');
  assert.equal(natureLien('https://agriculture.gouv.fr/x'), 'officiel');
  assert.equal(natureLien('https://doi.org/10.1038/x'), 'scientifique');
  assert.equal(natureLien('https://exemple.fr/rapport.xlsx'), 'donnees', 'extension avant domaine');
  assert.equal(natureLien('https://lemonde.fr/x'), 'autre');
  assert.equal(natureLien('pas une url'), 'autre');
});

test('paragraphe court porteur d’un lien : le lien survit, le texte non', () => {
  // Régression : « Consulter l’arrêté » tient en moins de 40 caractères. Un
  // seuil de longueur appliqué avant la collecte des liens ferait disparaître
  // exactement ce que le détecteur 4 cherche.
  const r = extraire(page({
    corps: P(LONG) + P(LONG)
      + '<p>Voir <a href="https://www.legifrance.gouv.fr/x">l’arrêté</a>.</p>',
  }), URL_PAGE);

  assert.equal(r.liens.length, 1);
  assert.equal(r.liens[0].nature, 'juridique');
  assert.equal(r.liens[0].dansTexte, false);
  assert.equal(r.liens[0].offset, null, 'pas d’offset inventé pour un texte non retenu');
  assert.ok(!r.texte.includes('l’arrêté'), 'le paragraphe court n’entre pas dans le corps');
});

test('liens du corps : offset renseigné et dansTexte vrai', () => {
  const r = extraire(page({
    corps: P(LONG + ' Selon <a href="https://data.gouv.fr/x.csv">les données publiées</a> mardi.') + P(LONG),
  }), URL_PAGE);
  assert.equal(r.liens[0].dansTexte, true);
  assert.equal(typeof r.liens[0].offset, 'number');
});

test('gabarit sans <article> ni <p> : le texte est tout de même trouvé', () => {
  // Régression : plusieurs sites de presse français n'utilisent ni <article>
  // ni <p>. Une extraction qui rend zéro sur ces gabarits rend l'outil
  // inutilisable précisément là où il devrait servir.
  const bloc = (t) => `<div class="paragraph">${t}</div>`;
  const doc = parseHTML(`<!doctype html><html><head><title>T</title></head><body>
    <nav><a href="/a">A</a><a href="/b">B</a></nav>
    <div class="wrapper"><div class="zone-contenu">
      <h1>Un titre de dépêche</h1>
      ${bloc(LONG)}${bloc(LONG + ' Deuxième paragraphe du corps de l’article.')}
      ${bloc(LONG + ' Troisième paragraphe avec <a href="https://www.legifrance.gouv.fr/x">l’arrêté</a>.')}
    </div></div>
    <footer><a href="/m">Mentions</a></footer></body></html>`).document;

  const r = extraire(doc, URL_PAGE);
  assert.equal(r.diagnostic.echec, null, `zone retenue : ${r.diagnostic.zone}`);
  assert.ok(r.texte.length > 200);
  assert.equal(r.diagnostic.paragraphes, 3);
  assert.equal(r.liens.length, 1, 'nav et footer restent exclus');
  assert.equal(r.liens[0].nature, 'juridique');
});

test('div conteneur : le texte n’est pas compté deux fois', () => {
  const doc = parseHTML(`<!doctype html><html><body><main>
    <div class="paragraph"><div class="paragraph">${LONG} Imbriqué.</div></div>
    <p>${LONG} Un autre paragraphe distinct du premier bloc.</p>
    <p>${LONG} Encore un paragraphe pour atteindre la longueur minimale.</p>
  </main></body></html>`).document;
  const r = extraire(doc, URL_PAGE);
  const occurrences = r.texte.split('Imbriqué.').length - 1;
  assert.equal(occurrences, 1, 'le conteneur ne duplique pas son contenu');
});

test('readyState de la capture est conservé dans le diagnostic', () => {
  const doc = page({ corps: P(LONG) + P(LONG) });
  assert.equal(extraire(doc, URL_PAGE, { pret: 'loading' }).diagnostic.pret, 'loading');
  assert.equal(extraire(doc, URL_PAGE).diagnostic.pret, null);
});
