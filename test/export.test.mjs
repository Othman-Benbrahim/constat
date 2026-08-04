import test from 'node:test';
import assert from 'node:assert/strict';
import { versJSON, versMarkdown, chiffrer, dechiffrer } from '../core/export.js';
import { produire } from '../core/releve.js';
import { preparer, regrouper } from '../core/cluster.js';

// btoa/atob n'existent pas partout côté Node ancien ; ils sont globaux ici.
const META = {
  question: 'Le contournement sera-t-il achevé selon le calendrier annoncé ?',
  perimetre: 'presse régionale, février 2026',
  horizon: 'fin mars 2026',
  decision: 'faut-il déposer un recours',
};

const src = (i) => ({
  id: `s-00${i}`, editeur: `ed${i}.fr`, titre: `Titre ${i}`,
  url: `https://ed${i}.fr/a`, canonical: `https://ed${i}.fr/a`,
  datePubliee: new Date(Date.UTC(2026, 1, 12 + i)).toISOString(),
  consulteeLe: '2026-03-04T10:00:00Z',
  texte: `Article ${i} sur le contournement de Nîmes-Ouest et le calendrier des travaux.`,
  citations: [], liens: [],
});

const jeu = async () => {
  const sources = [1, 2, 3, 4].map(src);
  const grappes = regrouper(await preparer(sources));
  const releve = await produire({
    sources, grappes, dossier: 'd-001',
    outil: { nom: 'Constat', version: '0.1.0' }, ts: '2026-03-04T10:00:00Z',
  });
  return { sources, releve };
};

test('JSON : enveloppe versionnée, journal intact', async () => {
  const { releve } = await jeu();
  const o = JSON.parse(versJSON({ meta: META, journal: [{ t: 'dossier' }], releve }));
  assert.equal(o.format, 'constat/dossier');
  assert.equal(o.version, 1);
  assert.equal(o.dossier.question, META.question);
  assert.equal(o.releve.empreinteCorpus, releve.empreinteCorpus);
});

test('Markdown : aucun chiffre sans sa justification', async () => {
  const { sources, releve } = await jeu();
  const md = versMarkdown({ meta: META, releve, sources });

  assert.ok(md.startsWith('# Constat — '));
  assert.ok(md.includes(releve.empreinteCorpus), 'le relevé est identifié');
  assert.ok(md.includes('Comptes rendus distincts'));
  assert.ok(md.includes('Compte rendu distinct :'), 'la définition accompagne le chiffre');
  assert.ok(md.includes('### Non calculé'), 'la section est présente même vide');
  assert.ok(md.includes('Ce document décrit un dossier, pas la presse'));

  // Chaque absence calculée porte une ligne de justification.
  for (const c of releve.silences.calcules) {
    const i = md.indexOf(`### ${c.code === 'acteur-non-cite' ? 'Acteurs nommés jamais cités' : ''}`);
    if (i < 0) continue;
    assert.ok(md.slice(i, i + 400).includes('Justification :'));
  }
});

test('Markdown : une date absente est écrite comme absente', async () => {
  const { releve } = await jeu();
  const sources = [{ ...src(1), datePubliee: null }];
  const md = versMarkdown({ meta: META, releve, sources });
  assert.ok(md.includes('_date absente_'), 'pas de date inventée dans l’export');
});

test('chiffrement : aller-retour', async () => {
  const clair = 'Dossier sensible — préfecture du Gard, sources non publiques.';
  const paquet = await chiffrer(clair, 'une passphrase correcte');
  const e = JSON.parse(paquet);

  assert.equal(e.format, 'constat/chiffre');
  assert.equal(e.chiffrement, 'AES-GCM-256');
  assert.equal(e.kdf.iterations, 600000);
  assert.ok(!paquet.includes('préfecture'), 'le clair n’apparaît nulle part');
  assert.ok(e.note.includes('irrécupérable'), 'le fichier porte son propre avertissement');

  assert.equal(await dechiffrer(paquet, 'une passphrase correcte'), clair);
});

test('chiffrement : mauvaise passphrase, message sans ambiguïté', async () => {
  const paquet = await chiffrer('secret', 'bonne');
  await assert.rejects(() => dechiffrer(paquet, 'mauvaise'), /passphrase incorrecte ou fichier altéré/);
});

test('chiffrement : sel et IV différents à chaque appel', async () => {
  const a = JSON.parse(await chiffrer('même texte', 'même passphrase'));
  const b = JSON.parse(await chiffrer('même texte', 'même passphrase'));
  assert.notEqual(a.sel, b.sel);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.donnees, b.donnees, 'deux exports du même dossier ne sont pas identiques');
});

test('chiffrement : passphrase vide refusée', async () => {
  await assert.rejects(() => chiffrer('x', ''), /passphrase requise/);
});

test('Markdown : le registre B est exporté, lectures et étapes comprises', async () => {
  const { sources, releve } = await jeu();
  const md = versMarkdown({
    meta: META, releve, sources,
    lectures: [{
      bras: 'releve', fournisseur: 'anthropic', modele: 'claude-sonnet-4-5',
      ts: '2026-03-04T11:00:00Z', releveRef: releve.empreinteCorpus,
      blocs: {
        situation: [{ registre: 'affirme', texte: 'Le chantier est suspendu.', sources: ['s-001'] }],
        analyse: [{ registre: 'infere', texte: 'La préfecture temporise.' }],
        jugement: [], surveillance: [],
      },
      ecartees: [{ bloc: 'jugement', raison: 'certitude ou probabilité de 0 ou 1' }],
      inventees: ['s-999'],
    }],
    etapes: [{
      numero: 8, nom: 'Évaluation du risque', validee: true,
      fournisseur: 'anthropic', modele: 'claude-sonnet-4-5', reference: 'matrice-risque.md',
      ts: '2026-03-04T12:00:00Z',
      sortie: { evaluations: [{ scenario: 'S1', probabilite: 'moderee', impact: 'critique',
        niveau: 'eleve', conditions: ['si les pourparlers échouent'], dimensions: ['politique'],
        confiance: 'moderee', justification: 'x' }] },
      ecartees: [],
    }],
  });

  assert.ok(md.includes('# Registre B — produit par un modèle'));
  assert.ok(md.includes('Un relevé sans modèle est un relevé complet'));
  assert.ok(md.includes('**[affirme]** Le chantier est suspendu.'));
  assert.ok(md.includes('_(s-001)_'), 'les sources de l’énoncé sont citées');
  assert.ok(md.includes('énoncé(s) écarté(s)'), 'les rejets sont exportés, pas masqués');
  assert.ok(md.includes('s-999'), 'les sources inventées sont exportées');
  assert.ok(md.includes('Étape 8 — Évaluation du risque'));
  assert.ok(md.includes('**élevé**'), 'le niveau croisé apparaît');
  assert.ok(md.includes('si les pourparlers échouent'), 'le conditionnement est exporté');
  assert.ok(md.includes('il ne conclut pas'));
});

test('Markdown : une étape non validée est signalée comme telle', async () => {
  const { sources, releve } = await jeu();
  const md = versMarkdown({
    meta: META, releve, sources,
    etapes: [{ numero: 11, nom: 'Boucle de rétroaction', validee: false,
      fournisseur: 'x', modele: 'y', reference: 'z', ts: '2026-03-04T12:00:00Z',
      sortie: { invalidants: ['a'], lacunes: ['b'], signaux: ['c'],
        prochainPoint: { quand: 'fin mars', declencheur: 'décision du conseil' } },
      ecartees: [] }],
  });
  assert.ok(md.includes('_(non validée)_'));
  assert.ok(md.includes('Prochain point de contrôle** : fin mars'));
});

test('Markdown : sans registre B, aucune section vide n’apparaît', async () => {
  const { sources, releve } = await jeu();
  const md = versMarkdown({ meta: META, releve, sources });
  assert.ok(!md.includes('Registre B'));
});

test('Markdown : chaque source est un lien cliquable', async () => {
  const { releve } = await jeu();
  const sources = [{ ...src(1), titre: 'Un titre avec [crochets]' }];
  const md = versMarkdown({ meta: META, releve, sources });

  assert.ok(md.includes('[Un titre avec \\[crochets\\]](https://ed1.fr/a)'),
    'titre échappé, URL en cible');
  assert.ok(md.includes('<https://ed1.fr/a>'), 'l’URL brute reste visible et cliquable');
});
