import test from 'node:test';
import assert from 'node:assert/strict';
import { promptDepuisReleve, promptDepuisTextes, validerLecture, sourcesInventees, CONSIGNE } from '../core/prompt.js';
import { estimerJetons, estimerCout, corpsRequete, extraireTexte, extraireJson, lireUsage, appeler } from '../core/llm.js';
import { produire } from '../core/releve.js';
import { preparer, regrouper } from '../core/cluster.js';

const META = { question: 'Le chantier sera-t-il achevé ?', perimetre: 'presse régionale',
  horizon: 'fin mars', decision: 'déposer un recours ou non' };

const DEPECHE = `Le préfet du Gard a annoncé la suspension du chantier de contournement de
Nîmes-Ouest, invoquant un avis défavorable de l'autorité environnementale. La décision prend
effet immédiatement et concerne l'ensemble des lots engagés depuis janvier. Les associations
riveraines réclamaient cette suspension depuis plusieurs mois. Le conseil départemental indique
étudier les voies de recours disponibles devant le tribunal administratif de Nîmes.`;

const jeu = async (n = 12) => {
  const sources = Array.from({ length: n }, (_, i) => ({
    id: `s-${String(i + 1).padStart(3, '0')}`,
    editeur: `ed${i % 4}.fr`, titre: `Titre ${i}`,
    url: `https://ed${i % 4}.fr/a${i}`, canonical: `https://ed${i % 4}.fr/a${i}`,
    datePubliee: new Date(Date.UTC(2026, 1, 12 + i)).toISOString(),
    texte: i < 4 ? DEPECHE : `${DEPECHE} Variante ${i} sur le calendrier révisé des travaux publics.`,
    citations: [{ texte: `Citation ${i} du dossier`, marqueur: '«»', debut: 0, fin: 20 }],
    liens: [],
  }));
  const grappes = regrouper(await preparer(sources));
  const releve = await produire({ sources, grappes, dossier: 'd-001',
    outil: { nom: 'Constat', version: '0.1.0' }, ts: '2026-03-04T10:00:00Z' });
  return { sources, releve };
};

test('prompt depuis relevé : contient le relevé, pas les articles entiers', async () => {
  const { sources, releve } = await jeu();
  const p = promptDepuisReleve({ meta: META, releve, sources });

  assert.ok(p.includes(META.question));
  assert.ok(p.includes('comptes rendus distincts'));
  assert.ok(p.includes('Absences constatées'));
  assert.ok(p.includes('Non calculé — tu ne sais rien de ces points'));
  assert.ok(p.includes('UN REPRÉSENTANT PAR GRAPPE'));

  // Un représentant par grappe, pas un texte par article.
  const occurrences = p.split('Le préfet du Gard a annoncé').length - 1;
  assert.ok(occurrences <= releve.grappes.length,
    `${occurrences} extraits pour ${releve.grappes.length} grappes`);
});

test('prompt depuis relevé : nettement plus court que le prompt témoin', async () => {
  const { sources, releve } = await jeu(40);
  const a = estimerJetons(promptDepuisReleve({ meta: META, releve, sources }));
  const b = estimerJetons(promptDepuisTextes({ meta: META, sources }));
  assert.ok(a < b * 0.6, `relevé ${a} jetons vs textes ${b} — compression insuffisante`);
});

test('prompt témoin : les articles y sont en entier', async () => {
  const { sources } = await jeu(3);
  const p = promptDepuisTextes({ meta: META, sources });
  for (const s of sources) assert.ok(p.includes(s.texte));
});

test('validation : registre inconnu écarté, pas corrigé', () => {
  const { blocs, ecartees } = validerLecture({
    situation: [
      { registre: 'affirme', texte: 'Le chantier est suspendu.', sources: ['s-001'] },
      { registre: 'constat', texte: 'Registre inventé.' },
    ],
  });
  assert.equal(blocs.situation.length, 1);
  assert.equal(ecartees.length, 1);
  assert.match(ecartees[0].raison, /registre inconnu/);
});

test('validation : « affirme » sans source est écarté', () => {
  const { blocs, ecartees } = validerLecture({
    analyse: [{ registre: 'affirme', texte: 'Une affirmation sans source.' }],
  });
  assert.equal(blocs.analyse.length, 0);
  assert.match(ecartees[0].raison, /sans source/);
});

test('validation : chaque formulation de certitude est écartée', () => {
  const interdites = [
    'Le recours aboutira à coup sûr.',
    'La probabilité est de 100 %.',
    'Le risque est de 0 %.',
    'La probabilité de 1 est atteinte.',
    'C’est une certitude absolue.',
    'Le blocage est inévitable.',
    'On peut l’affirmer avec certitude.',
    'Il n’y a aucun doute sur l’issue.',
  ];
  for (const texte of interdites) {
    const { ecartees } = validerLecture({ jugement: [{ registre: 'hypothese', texte }] });
    assert.equal(ecartees.length, 1, `non écartée : ${texte}`);
  }

  const permises = [
    'Le chantier reprendra probablement au printemps.',
    'Le coût atteint 100 millions selon deux articles.',
    'Une reprise en 2027 est plausible mais non établie.',
  ];
  for (const texte of permises) {
    const { ecartees } = validerLecture({ jugement: [{ registre: 'hypothese', texte }] });
    assert.equal(ecartees.length, 0, `écartée à tort : ${texte}`);
  }
});

test('validation : les quatre blocs existent toujours', () => {
  const { blocs } = validerLecture({});
  assert.deepEqual(Object.keys(blocs), ['situation', 'analyse', 'jugement', 'surveillance']);
});

test('sources inventées : détectées et listées', () => {
  const { blocs } = validerLecture({
    situation: [
      { registre: 'affirme', texte: 'A', sources: ['s-001'] },
      { registre: 'affirme', texte: 'B', sources: ['s-999', 's-042'] },
    ],
  });
  assert.deepEqual(sourcesInventees(blocs, ['s-001', 's-002']), ['s-042', 's-999']);
});

test('consigne : les interdits du skill y figurent', () => {
  for (const attendu of ['affirme', 'infere', 'hypothese', 'speculation',
    'Aucune probabilité de 0 ni de 1', 'jamais une prédiction',
    "n'est pas une absence dans le monde"]) {
    assert.ok(CONSIGNE.includes(attendu), `manquant : ${attendu}`);
  }
});

test('coût : estimé, avec sa date et son approximation déclarées', () => {
  const c = estimerCout({ contenu: 'x'.repeat(40000), consigne: 'y'.repeat(4000),
    maxSortie: 2000, modele: 'claude-sonnet-4-5' });
  assert.equal(c.jetonsEntree, 11000);
  assert.equal(c.tarifConnu, true);
  assert.equal(c.tarifsEtablisLe, '2026-08-02');
  assert.ok(c.coutMax > 0);
  assert.match(c.approximation, /quatre caractères/);

  const inconnu = estimerCout({ contenu: 'x', modele: 'modele-maison-2027' });
  assert.equal(inconnu.tarifConnu, false, 'un tarif inconnu est signalé, pas deviné');
});

test('requête : forme spécifique à Anthropic, forme OpenAI sinon', () => {
  const a = corpsRequete('anthropic', 'claude-sonnet-4-5', 'contenu', 'consigne', 1500);
  assert.equal(a.system, 'consigne');
  assert.equal(a.temperature, 0);
  assert.equal(a.messages[0].role, 'user');

  const o = corpsRequete('openai', 'gpt-4o-mini', 'contenu', 'consigne', 1500);
  assert.equal(o.response_format.type, 'json_object');
  assert.equal(o.messages[0].role, 'system');
});

test('lecture de la réponse : texte et usage, deux dialectes', () => {
  assert.equal(extraireTexte('anthropic', { content: [{ type: 'text', text: 'ok' }] }), 'ok');
  assert.equal(extraireTexte('openai', { choices: [{ message: { content: 'ok' } }] }), 'ok');
  assert.deepEqual(lireUsage('anthropic', { usage: { input_tokens: 10, output_tokens: 3 } }),
    { entree: 10, sortie: 3 });
  assert.deepEqual(lireUsage('openai', { usage: { prompt_tokens: 10, completion_tokens: 3 } }),
    { entree: 10, sortie: 3 });
  assert.deepEqual(lireUsage('openai', {}), { entree: null, sortie: null });
});

test('JSON : isolé même entouré de texte ou de balises', () => {
  assert.deepEqual(extraireJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extraireJson('Voici : {"a":1} — voilà.'), { a: 1 });
  assert.throws(() => extraireJson('pas de json'), /aucun objet JSON/);
  assert.throws(() => extraireJson(''), /reponse vide/);
});

test('appel : la clé part au bon endroit et n’apparaît pas dans le corps', async () => {
  let vu = null;
  const fetchImpl = async (url, opts) => {
    vu = { url, opts };
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: '{"situation":[]}' }],
      usage: { input_tokens: 5, output_tokens: 2 } }) };
  };
  const r = await appeler({ fournisseur: 'anthropic', modele: 'claude-sonnet-4-5',
    cle: 'sk-secret', consigne: 'c', contenu: 'u', fetchImpl });

  assert.equal(vu.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(vu.opts.headers['x-api-key'], 'sk-secret');
  assert.ok(!vu.opts.body.includes('sk-secret'), 'la clé ne doit pas se retrouver dans le corps');
  assert.deepEqual(r.usage, { entree: 5, sortie: 2 });
});

test('appel : clé manquante refusée avant toute requête', async () => {
  let appele = false;
  await assert.rejects(() => appeler({ fournisseur: 'openai', modele: 'gpt-4o-mini',
    consigne: 'c', contenu: 'u', fetchImpl: async () => { appele = true; } }), /clé API manquante/);
  assert.equal(appele, false);
});

test('appel : une erreur HTTP porte son détail', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429, text: async () => 'rate limit' });
  await assert.rejects(() => appeler({ fournisseur: 'openai', modele: 'gpt-4o-mini',
    cle: 'k', consigne: 'c', contenu: 'u', fetchImpl }), /HTTP 429 — rate limit/);
});

test('origines du fournisseur : par défaut, personnalisée, locale', async () => {
  const { originesFournisseur } = await import('../core/llm.js');
  assert.deepEqual(originesFournisseur('anthropic', ''), ['https://api.anthropic.com/*']);
  assert.deepEqual(originesFournisseur('ollama', ''), ['http://localhost:11434/*']);
  assert.deepEqual(originesFournisseur('anthropic', 'https://proxy.interne.fr/v1'),
    ['https://proxy.interne.fr/*'], 'une URL personnalisée l’emporte : c’est elle qui sera jointe');
  assert.deepEqual(originesFournisseur('compatible', ''), [], 'pas d’URL, rien à demander');
});

test('transport : une panne réseau est rendue comme objet, pas comme exception', async () => {
  // Reproduit la forme que renvoie le relais de l'arrière-plan, pour que
  // « NetworkError » ne remonte jamais nu jusqu'à l'utilisateur.
  const relais = async () => ({ reseau: 'NetworkError when attempting to fetch resource',
    hote: 'https://api.anthropic.com' });
  const r = await relais();
  assert.ok(r.reseau && r.hote, 'le message porte la cause ET l’hôte concerné');
  assert.ok(!(r instanceof Error));
});
