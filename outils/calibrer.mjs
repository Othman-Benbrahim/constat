#!/usr/bin/env node
// calibrer.mjs — mesure la distribution des recouvrements sur un corpus réel.
//
// SEUIL_RECOUVREMENT vaut 0,60 par défaut. Cette valeur vient de textes
// synthétiques ; elle n'est pas établie. Cet outil sert à la remplacer par une
// valeur mesurée sur le dossier réel des quatre semaines (§11 du handoff).
//
//   node outils/calibrer.mjs corpus/
//
// où corpus/ contient un .txt par article. Sortie : histogramme des
// recouvrements deux à deux, et les dix paires les plus fortes, à inspecter
// à la main. C'est l'inspection manuelle qui fixe le seuil, pas l'histogramme.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { motsPourSimhash, shinglesTexte, recouvrement } from '../core/empreinte.js';

const dossier = process.argv[2];
if (!dossier) {
  console.error('usage : node outils/calibrer.mjs <dossier de .txt>');
  process.exit(1);
}

const fichiers = readdirSync(dossier).filter((f) => f.endsWith('.txt')).sort();
const docs = fichiers.map((f) => {
  const texte = readFileSync(join(dossier, f), 'utf8');
  return { nom: f, sh: shinglesTexte(motsPourSimhash(texte)) };
});

const trop_court = docs.filter((d) => d.sh.size < 30);
const utiles = docs.filter((d) => d.sh.size >= 30);

const paires = [];
for (let i = 0; i < utiles.length; i++) {
  for (let j = i + 1; j < utiles.length; j++) {
    paires.push({
      a: utiles[i].nom, b: utiles[j].nom,
      taux: recouvrement(utiles[i].sh, utiles[j].sh).max,
    });
  }
}

const paliers = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.01];
console.log(`${docs.length} articles · ${trop_court.length} trop courts, écartés · ${paires.length} paires\n`);
console.log('recouvrement   paires');
for (let p = 0; p < paliers.length - 1; p++) {
  const n = paires.filter((x) => x.taux >= paliers[p] && x.taux < paliers[p + 1]).length;
  const barre = '#'.repeat(Math.min(50, Math.round(n / Math.max(1, paires.length / 200))));
  console.log(
    `${paliers[p].toFixed(1)} – ${Math.min(1, paliers[p + 1]).toFixed(1)}   ${String(n).padStart(6)}  ${barre}`,
  );
}

console.log('\nLes 10 paires les plus fortes — à ouvrir et à juger à la main :');
for (const x of paires.sort((u, v) => v.taux - u.taux).slice(0, 10)) {
  console.log(`  ${x.taux.toFixed(3)}   ${x.a}  ↔  ${x.b}`);
}

console.log(`
Le seuil correct est la valeur qui sépare les paires que vous jugez dérivées de
celles que vous jugez indépendantes. Si les deux populations ne se séparent pas,
c'est le seuil qui n'existe pas — et il faut le dire dans le relevé plutôt que
d'en choisir un.`);
