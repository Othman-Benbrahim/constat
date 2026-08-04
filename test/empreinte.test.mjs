import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliserPourEmpreinte, empreinteExacte, motsPourSimhash, shinglesTexte,
  empreinteFloue, hamming, recouvrement, mediane, MIN_SHINGLES_FIABLE,
} from '../core/empreinte.js';

const DEPECHE = `Le préfet du Gard a annoncé mardi la suspension du chantier de
contournement, invoquant un avis défavorable de l'autorité environnementale.
La décision prend effet immédiatement et concerne l'ensemble des lots de
travaux engagés depuis janvier. Les associations riveraines demandaient cette
suspension depuis plusieurs mois, sans obtenir de réponse de la préfecture.`;

test('normalisation : espaces uniformisés, casse et accents conservés', () => {
  assert.equal(normaliserPourEmpreinte('  Le\n\npréfet   du Gard '), 'Le préfet du Gard');
  assert.notEqual(normaliserPourEmpreinte('Le Préfet'), normaliserPourEmpreinte('le préfet'));
});

test('empreinte exacte : insensible au retour à la ligne, sensible à la casse', async () => {
  const a = await empreinteExacte('Le préfet a annoncé.');
  const b = await empreinteExacte('Le préfet\n  a annoncé.');
  const c = await empreinteExacte('Le Préfet a annoncé.');
  assert.equal(a, b, 'reformatage seul → même empreinte');
  assert.notEqual(a, c, 'casse différente → texte différent, pas une reprise littérale');
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(await empreinteExacte('   '), null);
});

test('mots : les mots outils sont conservés', () => {
  const mots = motsPourSimhash('Le préfet de la région, mardi.');
  assert.deepEqual(mots, ['le', 'prefet', 'de', 'la', 'region', 'mardi']);
});

test('shingles : k mots glissants, dédoublonnés', () => {
  assert.equal(shinglesTexte(['a', 'b', 'c', 'd', 'e'], 4).size, 2);
  assert.deepEqual([...shinglesTexte(['a', 'b'], 4)], ['a b'], 'texte plus court que k');
  assert.equal(shinglesTexte([], 4).size, 0);
});

test('empreinte floue : format stable et fiabilité déclarée', () => {
  const e = empreinteFloue(DEPECHE);
  assert.match(e.hash, /^[0-9a-f]{16}$/);
  assert.ok(e.fiable);
  const court = empreinteFloue('Trois mots seulement ici.');
  assert.ok(court.shingles < MIN_SHINGLES_FIABLE);
  assert.equal(court.fiable, false, 'un texte court ne fonde aucun regroupement');
});

test('empreinte floue : déterministe', () => {
  assert.equal(empreinteFloue(DEPECHE).hash, empreinteFloue(DEPECHE).hash);
});

// Ce test encode un résultat de mesure, pas une attente : le SimHash NE sépare
// PAS une reprise réécrite d'un article distinct. C'est pourquoi le
// regroupement de cluster.js n'utilise pas le Hamming. Si un jour quelqu'un
// veut y revenir, ce test lui dit pourquoi c'est non.
test('hamming : croissant, mais distributions qui se touchent', () => {
  const base = empreinteFloue(DEPECHE).hash;
  assert.equal(hamming(base, base), 0);

  // Reprise avec chapeau ajouté et un mot changé : proche.
  const reprise = empreinteFloue(
    'INFO — ' + DEPECHE.replace('invoquant', 'en invoquant'),
  ).hash;
  const dReprise = hamming(base, reprise);

  // Article distinct sur un tout autre sujet : loin.
  const autre = empreinteFloue(`La saison des vendanges s'annonce précoce dans
  l'Hérault. Les vignerons évoquent un mois d'avance sur le calendrier habituel
  et redoutent une concentration en sucre trop élevée pour les rouges de garde.
  La chambre d'agriculture organise des réunions techniques la semaine prochaine.`).hash;
  const dAutre = hamming(base, autre);

  assert.ok(dReprise < dAutre, 'la reprise reste plus proche que le sujet distinct');
  assert.ok(dReprise > 3, `reprise à ${dReprise} bits : un seuil à 3 la manquerait`);
});

test('recouvrement : sépare franchement, et dit le sens de la dérivation', () => {
  const sh = (t) => shinglesTexte(motsPourSimhash(t), 4);
  const A = sh(DEPECHE);

  // Chapeau ajouté : tout A se retrouve dans B, B contient davantage.
  const chapeau = sh('URGENT — Mise à jour de notre dépêche. ' + DEPECHE);
  const rChapeau = recouvrement(A, chapeau);
  assert.equal(rChapeau.aDansB, 1, 'la source est intégralement contenue dans la reprise');
  assert.ok(rChapeau.bDansA < 1, 'la reprise contient plus que la source');

  // Troncature : la reprise est intégralement contenue dans la source.
  const coupe = sh(DEPECHE.split(' ').slice(0, 40).join(' '));
  assert.equal(recouvrement(coupe, A).aDansB, 1);

  // Réécriture partielle : élevé mais franchement sous 1.
  const reecrit = sh(DEPECHE
    .replace('a annoncé mardi', 'annonçait ce mardi')
    .replace('invoquant', 'au motif d’'));
  const rReecrit = recouvrement(A, reecrit).max;
  assert.ok(rReecrit > 0.6 && rReecrit < 1, `réécriture à ${rReecrit}, attendu entre 0,6 et 1`);

  // Sujet distinct : effondrement.
  const autre = sh(`La saison des vendanges s'annonce précoce dans l'Hérault. Les
  vignerons évoquent un mois d'avance sur le calendrier habituel et redoutent une
  concentration en sucre trop élevée pour les rouges de garde.`);
  assert.ok(recouvrement(A, autre).max < 0.1, 'sujet distinct : recouvrement résiduel');
});

test('recouvrement : ensembles vides', () => {
  assert.deepEqual(recouvrement(new Set(), new Set(['a'])), { aDansB: 0, bDansA: 0, max: 0 });
});

test('médiane', () => {
  assert.equal(mediane([]), null);
  assert.equal(mediane([4]), 4);
  assert.equal(mediane([1, 2, 3]), 2);
  assert.equal(mediane([1, 2, 3, 4]), 3);
});
