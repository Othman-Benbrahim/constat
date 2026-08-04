// panel.js — barre latérale. Seul endroit où le noyau rencontre le navigateur.
//
// Deux contraintes de la plateforme dictent la forme de ce fichier :
//
//  1. `prompt()`, `alert()` et `confirm()` ne fonctionnent pas dans un panneau
//     d'extension Firefox. Toute saisie passe par un formulaire de la page.
//
//  2. `permissions.request()` doit partir PENDANT que le gestionnaire de clic
//     est encore sur la pile. Un seul `await` avant l'appel consomme le geste
//     et la demande lève. D'où l'URL de l'onglet et la liste des origines déjà
//     accordées, tenues à jour en continu, pour que le gestionnaire puisse
//     décider sans attendre.

import { Dossiers } from '../core/dossier.js';
import { stockageNavigateur } from '../core/stockage.js';
import { extraire } from '../core/extraction.js';
import { preparer, regrouper } from '../core/cluster.js';
import { produire } from '../core/releve.js';
import { versJSON, versMarkdown, chiffrer } from '../core/export.js';
import { distribution, courantes, coter, FIABILITE, CREDIBILITE } from '../core/cotation.js';
import { assembler } from '../core/rapport.js';
import {
  corpsRequete, enTetes, entreeRecherche, versPage, fusionner, verdict, requetePage,
  FOURNISSEUR as MOTEUR,
} from '../core/recherche.js';
import { promptDepuisReleve, promptDepuisTextes, validerLecture, sourcesInventees, CONSIGNE } from '../core/prompt.js';
import { FOURNISSEURS, appeler, estimerCout, extraireJson, originesFournisseur } from '../core/llm.js';
import { ETAPES, construirePrompt, valider } from '../core/etapes.js';

/** Les étapes branchées, dans l'ordre du pipeline. */
const NUMEROS = Object.keys(ETAPES).map(Number).sort((a, b) => a - b);
import {
  rendreReleve, rendreSources, rendreVide, rendreLectures, rendreEtapes, rendreVerdict,
} from './rendu.js';

const api = globalThis.browser ?? globalThis.chrome;
const D = new Dossiers(stockageNavigateur());
const OUTIL = { nom: 'Constat', version: api.runtime.getManifest().version };

const $ = (id) => document.getElementById(id);

let dossierCourant = null;
let onglet = null;              // { id, url } de l'onglet actif, tenu à jour
let originesAccordees = new Set();

/**
 * Confirmation en page. window.confirm() renvoie undefined dans un panneau
 * d'extension Firefox — l'action est alors annulée sans que rien ne s'affiche.
 * Une seule confirmation à la fois : la promesse en cours est résolue à false
 * si une nouvelle est demandée.
 */
let resoudreConfirmation = null;

function confirmer(texte) {
  if (resoudreConfirmation) resoudreConfirmation(false);
  $('f-confirmer-texte').textContent = texte;
  $('form-confirmer').hidden = false;
  return new Promise((resoudre) => { resoudreConfirmation = resoudre; });
}

function fermerConfirmation(reponse) {
  $('form-confirmer').hidden = true;
  const r = resoudreConfirmation;
  resoudreConfirmation = null;
  if (r) r(reponse);
}

/**
 * Journal d'exécution. La ligne d'état ne garde qu'un message : le clic suivant
 * l'écrase, et la cause d'une panne disparaît avant d'avoir été lue. Les vingt
 * dernières opérations restent ici, horodatées.
 */
const trace = [];

const etat = (texte, erreur = false) => {
  $('etat').textContent = texte;
  $('etat').classList.toggle('erreur', erreur);

  trace.push({ h: new Date().toTimeString().slice(0, 8), texte, erreur });
  if (trace.length > 20) trace.shift();
  const ol = $('trace');
  ol.textContent = '';
  for (const t of [...trace].reverse()) {
    const li = document.createElement('li');
    if (t.erreur) li.className = 'erreur';
    li.textContent = `${t.h}  ${t.texte}`;
    ol.append(li);
  }
};

/** Une erreur non attrapée laisserait le panneau muet. Elle est dite, et
 *  recopiée dans la console pour la trace complète. */
async function garde(fn) {
  try { await fn(); } catch (e) {
    etat(e?.message || String(e), true);
    console.error('[Constat]', e);
  }
}

/* ------------------------------------------------- suivi de l'onglet actif */

const origineDe = (url) => { try { return `${new URL(url).origin}/*`; } catch { return null; } };

async function suivreOnglet() {
  const [t] = await api.tabs.query({ active: true, currentWindow: true });
  onglet = t?.url?.startsWith('http') ? { id: t.id, url: t.url } : null;

  const cible = $('cible');
  if (onglet) {
    cible.textContent = `à verser : ${new URL(onglet.url).hostname}`;
    cible.classList.remove('refusee');
  } else if (t) {
    cible.textContent = 'cette page ne peut pas être versée (ouvrez un article)';
    cible.classList.add('refusee');
  } else {
    cible.textContent = '';
  }
  majBoutons();
}

async function rafraichirPermissions() {
  const p = await api.permissions.getAll();
  originesAccordees = new Set(p.origins || []);
  accesPages = originesAccordees.has('*://*/*') || originesAccordees.has('<all_urls>');
}

/** Vrai si l'origine est couverte, y compris par une permission plus large. */
function origineCouverte(origine) {
  if (!origine) return false;
  if (originesAccordees.has(origine) || originesAccordees.has('*://*/*')
      || originesAccordees.has('<all_urls>')) return true;
  const hote = origine.replace(/^\w+:\/\/|\/\*$/g, '');
  for (const o of originesAccordees) {
    const motif = o.replace(/^\w+:\/\//, '').replace(/\/\*$/, '');
    if (motif.startsWith('*.') && hote.endsWith(motif.slice(1))) return true;
  }
  return false;
}

function majBoutons() {
  $('relever').disabled = !dossierCourant;
  $('lire').disabled = !dossierCourant;
  $('chercher').disabled = !dossierCourant;
  $('relire').disabled = !dossierCourant;
  for (const n of NUMEROS) $(`etape-${n}`).disabled = !dossierCourant;
  $('exporter').disabled = !dossierCourant;
  $('verser').disabled = !dossierCourant || !onglet;
  $('verser').title = !dossierCourant ? 'Ouvrez d’abord un dossier'
    : !onglet ? 'Ouvrez un article dans l’onglet actif' : '';
}

/* -------------------------------------------------------------- versement */

/**
 * Fonction injectée dans l'onglet. Sérialisée par `scripting.executeScript`,
 * donc sans fermeture ni référence extérieure.
 *
 * Injectée par `func` et non par `files` : la valeur de retour d'un fichier
 * injecté est celle de sa dernière expression, ce que Firefox n'expose pas de
 * façon fiable. Un `func` renvoie ce qu'il retourne.
 */
function capturerPage() {
  return {
    url: location.href,
    titre: document.title,
    pret: document.readyState,
    html: document.documentElement ? document.documentElement.outerHTML : '',
  };
}

/** Décrit ce qu'une tentative a réellement renvoyé, pour que l'échec soit
 *  lisible sans ouvrir la console. */
function decrire(r) {
  if (r === undefined || r === null) return 'aucun résultat';
  if (r.error) return `erreur d’injection : ${r.error.message || r.error}`;
  if (!('result' in r)) return `objet sans champ result (${Object.keys(r).join(', ') || 'vide'})`;
  const v = r.result;
  if (v === undefined || v === null) return 'result vide';
  if (typeof v !== 'object') return `result de type ${typeof v}`;
  if (!v.html) return `result sans html (${Object.keys(v).join(', ')})`;
  return `html de ${v.html.length} caractères`;
}

/**
 * Lit la page par la méthode qui marche, et dit laquelle a échoué et comment.
 * Le cadre principal seulement : une page d'article truffée d'iframes
 * publicitaires renverrait sinon plusieurs résultats dont le premier serait
 * une régie.
 */
async function lirePage(tabId, tracer = () => {}) {
  const cible = { tabId, frameIds: [0] };
  const tentatives = [
    ['func', () => api.scripting.executeScript({ target: cible, func: capturerPage })],
    ['files', () => api.scripting.executeScript({ target: cible, files: ['content/capture.js'] })],
  ];

  const journal = [];
  for (const [nom, appel] of tentatives) {
    tracer(`injection « ${nom} »…`);
    try {
      const res = await appel();
      const r = Array.isArray(res) ? res[0] : res;
      if (r?.result?.html) return { page: r.result, methode: nom };
      journal.push(`${nom} → ${decrire(r)}`);
    } catch (e) {
      journal.push(`${nom} → ${e.message}`);
    }
  }
  throw new Error(`Lecture impossible. ${journal.join(' ; ')}`);
}

/** Reçoit la permission déjà résolue : aucun await n'a précédé sa demande. */
async function verserAvecPermission(cible, accorde) {
  if (!accorde) {
    etat(`Sans autorisation pour ${new URL(cible.url).hostname}, la page ne peut pas être versée.`, true);
    return;
  }
  await rafraichirPermissions();

  const { page: brut, methode } = await lirePage(cible.id, (m) => etat(m));
  console.info('[Constat] page lue par', methode, '—', brut.html.length, 'caractères');
  if (!dossierCourant) {
    // Peut arriver si le dossier a été fermé pendant la lecture. Mieux vaut le
    // dire que d'échouer plus bas sur une clé de journal indéfinie.
    etat('Aucun dossier ouvert au moment du versement. Rien n’a été enregistré.', true);
    return;
  }

  // L'extraction tourne ici, dans une page d'extension, sur le HTML tel qu'il
  // était à l'écran. Pas de seconde requête réseau : ce qui est versé est ce
  // que vous avez lu.
  const doc = new DOMParser().parseFromString(brut.html, 'text/html');
  const page = extraire(doc, brut.url, { pret: brut.pret });

  // Une extraction ratée n'annule pas le versement.
  //
  // Refuser d'enregistrer, c'était perdre aussi la date, l'éditeur, l'URL
  // canonique et les liens — que l'extraction a bien récupérés — et laisser le
  // dossier vide. Or la chronologie et le détecteur « articles sans document
  // source » n'ont pas besoin du corps. La source est donc enregistrée avec son
  // échec inscrit : le relevé comptera ce qu'il peut et déclarera le reste non
  // calculé. Déclarer, ne pas refuser.
  const entree = await D.verser(dossierCourant, page);
  const resume = page.diagnostic.echec
    ? `Versé (${entree.id}) SANS CORPS — ${page.diagnostic.echec}`
      + ` (${brut.html.length} caractères lus, zone : ${page.diagnostic.zone || 'aucune'}`
      + `${brut.pret && brut.pret !== 'complete' ? `, page en cours de chargement : ${brut.pret}` : ''})`
    : `Versé (${entree.id}) — ${page.diagnostic.caracteres} caractères, `
      + `${page.liens.length} liens, ${page.citations.length} citations`;
  etat(resume, !!page.diagnostic.echec);

  // L'enregistrement a eu lieu. Si le réaffichage échoue, il ne doit pas faire
  // croire que le versement a échoué : la source est en base, seul le panneau
  // n'a pas su la redessiner. Les deux pannes appellent des corrections
  // différentes et ne doivent pas se ressembler.
  try {
    await afficher();
  } catch (e) {
    console.error('[Constat] affichage', e);
    etat(`${resume} — mais l’affichage a échoué : ${e.message}`, true);
  }
}

/* ------------------------------------------------------------------ relevé */

async function etablirReleve() {
  const sources = await D.corpus(dossierCourant);
  if (!sources.length) { etat('Aucune source versée dans ce dossier.', true); return; }

  etat(`Relevé sur ${sources.length} sources…`);
  const grappes = regrouper(await preparer(sources));
  const releve = await produire({ sources, grappes, outil: OUTIL, dossier: dossierCourant });
  await D.ajouter(dossierCourant, releve);
  etat(`Relevé ${releve.empreinteCorpus} établi.`);
  await afficher();
}

/* ------------------------------------------------- registre B — la lecture */

const CLE_REGLAGES = 'reglages';

/**
 * Transport des appels aux fournisseurs : par l'arrière-plan, jamais depuis le
 * panneau. Une page d'extension subit le CORS comme n'importe quelle page ;
 * c'est l'arrière-plan qui détient les permissions d'hôte. Même règle que
 * pont-genealogie/src/core/reseau.js.
 *
 * Rend un objet compatible avec ce qu'attend `appeler()`, pour que core/llm.js
 * reste ignorant du navigateur et testable hors extension.
 */
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Envoi par port. Ouvrir le port réveille l'event page ; le garder ouvert
 * l'empêche d'être terminée pendant l'appel, qui dure une minute.
 */
let compteurAppel = 0;

function envoyerParPort(message, timeoutMs = 120000) {
  return new Promise((resoudre, rejeter) => {
    let port;
    try { port = api.runtime.connect({ name: 'constat-llm' }); } catch (e) {
      rejeter(new Error(`Receiving end : ${e.message}`)); return;
    }
    const id = `a${++compteurAppel}`;
    const minuteur = setTimeout(() => {
      try { port.disconnect(); } catch { /* déjà fermé */ }
      rejeter(new Error(`aucune réponse de l’arrière-plan après ${Math.round(timeoutMs / 1000)} s`));
    }, timeoutMs);

    port.onMessage.addListener((r) => {
      if (r?.id !== id) return;
      clearTimeout(minuteur);
      try { port.disconnect(); } catch { /* déjà fermé */ }
      resoudre(r);
    });
    port.onDisconnect.addListener(() => {
      clearTimeout(minuteur);
      rejeter(new Error('Receiving end : arrière-plan déconnecté'));
    });

    try { port.postMessage({ ...message, id }); } catch (e) {
      clearTimeout(minuteur);
      rejeter(new Error(`Receiving end : ${e.message}`));
    }
  });
}

/** Repli sur sendMessage, avec réessais : certaines versions réveillent mieux
 *  l'event page sur message que sur connexion. */
async function envoyerAuFond(message, tentatives = 3) {
  try { return await envoyerParPort(message); } catch (ePort) {
    console.warn('[Constat] port indisponible :', ePort.message);
    let derniere = ePort;
    for (let i = 0; i < tentatives; i++) {
      try {
        const r = await api.runtime.sendMessage(message);
        if (r) return r;
        derniere = new Error('réponse vide de l’arrière-plan');
      } catch (e) { derniere = e; }
      await attendre(150 * (i + 1));
    }
    throw derniere;
  }
}

function relire(r) {
  if (r.reseau) {
    throw new Error(
      `${r.reseau} — accès à ${r.hote} refusé. Ouvrez « Modèle… » et enregistrez : `
      + `Firefox demandera l’autorisation pour ce fournisseur. En Manifest V3, `
      + `une permission d’hôte déclarée n’est pas accordée d’office.`,
    );
  }
  return { ok: r.ok, status: r.status, json: async () => r.data, text: async () => r.texte };
}

/**
 * Transport des appels aux fournisseurs.
 *
 * Voie 1 — l'arrière-plan. C'est la bonne : une page d'extension subit le CORS
 * comme n'importe quelle page, et c'est l'arrière-plan qui détient les
 * permissions d'hôte (précédent pont-genealogie/src/core/reseau.js).
 *
 * Voie 2 — le panneau lui-même. Utilisée seulement si l'event page reste
 * injoignable. Elle fonctionne quand la permission d'hôte du fournisseur a été
 * accordée, ce qui est le cas dès qu'on a enregistré les réglages ; sinon
 * l'échec CORS reprend, et il est nommé.
 *
 * Les deux voies sont tracées : on saura laquelle a servi.
 */
async function fetchParArrierePlan(url, opts) {
  try {
    return relire(await envoyerAuFond({ type: 'appel-llm', url, headers: opts.headers, body: opts.body }));
  } catch (e) {
    if (/Receiving end|réponse vide|Could not establish/i.test(e.message)) {
      etat('Arrière-plan injoignable, appel direct depuis le panneau…');
      console.warn('[Constat] relais indisponible :', e.message);
      try {
        const res = await fetch(url, { method: 'POST', headers: opts.headers, body: opts.body });
        const texte = await res.text();
        let data = null;
        try { data = JSON.parse(texte); } catch { /* réponse non JSON */ }
        return { ok: res.ok, status: res.status, json: async () => data, text: async () => texte };
      } catch (e2) {
        let hote = url;
        try { hote = new URL(url).origin; } catch { /* URL mal formée */ }
        throw new Error(
          `${e2.message} — appel direct à ${hote} refusé également. `
          + 'Ouvrez « Modèle… » et enregistrez pour accorder l’accès à ce fournisseur, '
          + 'puis rechargez l’extension.',
        );
      }
    }
    throw e;
  }
}

async function reglages() {
  const r = (await D.s.get(CLE_REGLAGES));
  if (r) return { ...r, cle: r.cle || cleSession, cleRecherche: r.cleRecherche || cleRechercheSession };
  return {
    fournisseur: 'anthropic', modele: FOURNISSEURS.anthropic.modeleDefaut,
    url: '', cle: '', cleRecherche: '', memoriser: false, comparer: true,
  };
}

/**
 * Lance une lecture. Deux bras quand la comparaison est active : même corpus,
 * même modèle, même consigne — seule l'entrée change. C'est la seule façon de
 * savoir si la couche déterministe apporte quelque chose, ou si elle n'est
 * qu'un dispositif d'économie de jetons.
 */
async function lire() {
  const r = await reglages();
  if (FOURNISSEURS[r.fournisseur]?.cleRequise && !r.cle) {
    etat('Renseignez une clé API dans « Modèle… ».', true);
    $('form-modele').hidden = false;
    return;
  }

  const origines = originesFournisseur(r.fournisseur, r.url);
  const couvert = await api.permissions.contains({ origins: origines });
  if (!couvert) {
    etat(`Autorisation manquante pour ${origines.join(', ')}. `
      + 'Ouvrez « Modèle… » et enregistrez pour l’accorder.', true);
    $('form-modele').hidden = false;
    return;
  }

  const meta = await D.meta(dossierCourant);
  const sources = await D.corpus(dossierCourant);
  const releve = (await D.relevés(dossierCourant)).at(-1);
  if (!releve) { etat('Établissez un relevé avant de lire.', true); return; }

  const bras = [{ nom: 'releve', contenu: promptDepuisReleve({ meta, releve, sources }) }];
  if (r.comparer) bras.push({ nom: 'textes', contenu: promptDepuisTextes({ meta, sources }) });

  // Le coût estimé s'affiche AVANT l'appel : l'utilisateur paie ses propres
  // jetons, il décide en connaissance de cause.
  const couts = bras.map((b) => estimerCout({
    contenu: b.contenu, consigne: CONSIGNE, maxSortie: 2000, modele: r.modele,
  }));
  const total = couts.reduce((n, c) => n + c.coutMax, 0);
  const detail = bras.map((b, i) => `${b.nom} ${couts[i].jetonsEntree} jetons`).join(' · ');
  const ok = await confirmer(
    `${bras.length} appel(s) à ${r.modele}. ${detail}. `
    + `Coût maximal estimé : ${total.toFixed(4)} (tarifs du ${couts[0].tarifsEtablisLe}`
    + `${couts[0].tarifConnu ? '' : ', tarif inconnu pour ce modèle — valeur par défaut'}), `
    + `estimation à ${couts[0].approximation}.`,
  );
  if (!ok) { etat('Lecture annulée.'); return; }

  const idsConnus = sources.map((s) => s.id);
  for (const b of bras) {
    etat(`Lecture « ${b.nom} » en cours…`);
    const rep = await appeler({
      fournisseur: r.fournisseur, url: r.url, modele: r.modele, cle: r.cle,
      consigne: CONSIGNE, contenu: b.contenu, maxSortie: 2000,
      fetchImpl: fetchParArrierePlan,
    });
    const { blocs, ecartees } = validerLecture(extraireJson(rep.texte));
    await D.ajouter(dossierCourant, {
      t: 'lecture', dossier: dossierCourant, bras: b.nom, mode: 'express',
      fournisseur: r.fournisseur, modele: r.modele,
      releveRef: releve.empreinteCorpus, usage: rep.usage, dureeMs: rep.dureeMs,
      blocs, ecartees, inventees: sourcesInventees(blocs, idsConnus),
    });
  }
  etat(`Lecture terminée (${bras.length} bras).`);
  await afficher();
}

function demanderAccesFournisseur(ev) {
  ev.preventDefault();
  // Aucun await avant permissions.request() : Firefox exige que l'appel parte
  // pendant que le gestionnaire de soumission est encore sur la pile.
  const origines = originesFournisseur($('f-fournisseur').value, $('f-url').value.trim());
  if ($('f-cle-exa').value.trim()) origines.push(MOTEUR.origine);
  const promesse = api.permissions.request({ origins: origines });
  garde(async () => enregistrerReglages(await promesse, origines));
}

async function enregistrerReglages(accorde, origines) {
  const memoriser = $('f-memoriser').checked;
  await D.s.set(CLE_REGLAGES, {
    fournisseur: $('f-fournisseur').value,
    modele: $('f-modele').value.trim(),
    url: $('f-url').value.trim(),
    // Mémorisation opt-in : sans elle la clé ne survit pas à la session.
    cle: memoriser ? $('f-cle').value : '',
    cleRecherche: memoriser ? $('f-cle-exa').value : '',
    memoriser,
    comparer: $('f-comparer').checked,
  });
  if (!memoriser) { cleSession = $('f-cle').value; cleRechercheSession = $('f-cle-exa').value; }
  $('form-modele').hidden = true;

  if (!accorde) {
    etat(`Réglages enregistrés, mais l’accès à ${origines.join(', ')} a été refusé. `
      + 'La lecture échouera tant qu’il ne sera pas accordé.', true);
    return;
  }
  etat(memoriser ? 'Réglages enregistrés, clé mémorisée, accès accordé.'
    : 'Réglages enregistrés, accès accordé, clé gardée pour cette session.');
}

let cleSession = '';
let cleRechercheSession = '';

async function ouvrirReglages() {
  const r = await reglages();
  const sel = $('f-fournisseur');
  sel.textContent = '';
  for (const [id, f] of Object.entries(FOURNISSEURS)) {
    const o = document.createElement('option');
    o.value = id; o.textContent = f.nom;
    sel.append(o);
  }
  sel.value = r.fournisseur;
  $('f-modele').value = r.modele || FOURNISSEURS[r.fournisseur].modeleDefaut;
  $('f-url').value = r.url;
  $('f-cle').value = r.cle || cleSession;
  $('f-cle-exa').value = r.cleRecherche || cleRechercheSession;
  $('f-memoriser').checked = r.memoriser;
  $('f-comparer').checked = r.comparer;
  $('form-modele').hidden = false;
}

/* ----------------------------------------------- pipeline en 11 étapes */

/** Charge une référence du skill depuis l'extension. §7.2 : n'injecter que
 *  celle de l'étape lancée — les onze pèsent 136 Ko, une seule en pèse dix. */
async function lireReference(nom) {
  const res = await fetch(api.runtime.getURL(`references/${nom}`));
  if (!res.ok) throw new Error(`référence introuvable : ${nom}`);
  return res.text();
}

/** Sorties validées par l'utilisateur, par numéro d'étape. Une sortie non
 *  validée n'alimente jamais l'étape suivante (§7.1). */
async function sortiesValidees(journal) {
  const out = {};
  for (const e of journal) if (e.t === 'etape' && e.validee) out[e.numero] = e.sortie;
  return out;
}

async function lancerEtape(numero) {
  const e = ETAPES[numero];
  const r = await reglages();
  if (FOURNISSEURS[r.fournisseur]?.cleRequise && !r.cle) {
    etat('Renseignez une clé API dans « Modèle… ».', true);
    $('form-modele').hidden = false;
    return;
  }

  const origines = originesFournisseur(r.fournisseur, r.url);
  if (!(await api.permissions.contains({ origins: origines }))) {
    etat(`Autorisation manquante pour ${origines.join(', ')}. Ouvrez « Modèle… ».`, true);
    $('form-modele').hidden = false;
    return;
  }

  const meta = await D.meta(dossierCourant);
  const sources = await D.corpus(dossierCourant, { avecTexte: false });
  const releve = (await D.relevés(dossierCourant)).at(-1);
  if (!releve) { etat('Établissez un relevé avant de lancer une étape.', true); return; }

  const journal = await D.journal(dossierCourant);
  const precedentes = await sortiesValidees(journal);
  for (const n of e.requiert) {
    if (!precedentes[n]) {
      etat(`L’étape ${numero} exige la sortie VALIDÉE de l’étape ${n}. `
        + `Lancez-la, relisez-la, puis validez-la.`, true);
      return;
    }
  }

  const reference = await Promise.all(e.references.map(lireReference));
  const contenu = construirePrompt({ numero, meta, releve, reference, precedentes });

  const cout = estimerCout({ contenu, consigne: e.consigne, maxSortie: 3000, modele: r.modele });
  const ok = await confirmer(
    `Étape ${numero} — ${e.nom}. Référence chargée : ${e.references[0]} `
    + `(${Math.round(reference.length / 1024)} Ko). ${cout.jetonsEntree} jetons d’entrée estimés. `
    + `Coût maximal estimé : ${cout.coutMax.toFixed(4)} (tarifs du ${cout.tarifsEtablisLe}).`,
  );
  if (!ok) { etat('Étape annulée.'); return; }

  etat(`Étape ${numero} en cours…`);
  const rep = await appeler({
    fournisseur: r.fournisseur, url: r.url, modele: r.modele, cle: r.cle,
    consigne: e.consigne, contenu, maxSortie: 3000, fetchImpl: fetchParArrierePlan,
  });

  const brut = extraireJson(rep.texte);
  const v = valider(numero, brut, {
    idsSources: sources.map((s) => s.id),
    idsHypotheses: (precedentes[5]?.hypotheses || []).map((h) => h.id),
    idsScenarios: (precedentes[7]?.scenarios || []).map((s) => s.id),
  });

  await D.ajouter(dossierCourant, {
    t: 'etape', dossier: dossierCourant, numero, nom: e.nom,
    fournisseur: r.fournisseur, modele: r.modele, reference: e.references.join(', '),
    releveRef: releve.empreinteCorpus, usage: rep.usage,
    sortie: v.sortie, ecartees: v.ecartees, inventees: v.inventees || [],
    complet: v.complet,
    validee: false, // rien n'avance tant que l'utilisateur n'a pas relu
  });

  etat(v.complet
    ? `Étape ${numero} produite. Relisez-la, puis validez-la pour ouvrir la suivante.`
    : `Étape ${numero} produite avec ${v.ecartees.length} rejet(s). Relisez avant de valider.`,
  !v.complet);
  await afficher();
}

/** La validation est un acte de l'utilisateur, pas un état automatique. Elle
 *  est enregistrée comme une entrée du journal : on saura quoi a été validé,
 *  et quand. */
async function validerEtapeUtilisateur(ts) {
  const journal = await D.journal(dossierCourant);
  const e = journal.find((x) => x.t === 'etape' && x.ts === ts);
  if (!e) { etat('Étape introuvable.', true); return; }
  await D.ajouter(dossierCourant, { ...e, validee: true, valideeLe: new Date().toISOString() });
  etat(`Étape ${e.numero} validée.`);
  await afficher();
}

/** Étape 2 — cotation d'une source. Le motif est exigé : une cotation sans
 *  raison n'est pas contestable, donc pas vérifiable. */
async function coterSource(source, fiabilite, credibilite, motifPrecedent) {
  const motif = await demanderMotif(source, fiabilite, credibilite, motifPrecedent);
  if (!motif) { etat('Cotation annulée : un motif est exigé.'); await afficher(); return; }
  await D.ajouter(dossierCourant, coter({ dossier: dossierCourant, source, fiabilite, credibilite, motif }));
  etat(`${source} coté ${fiabilite}${credibilite}.`);
  await afficher();
}

let resoudreMotif = null;

function demanderMotif(source, f, c, precedent) {
  if (resoudreMotif) resoudreMotif('');
  $('f-motif-titre').textContent = `Pourquoi ${source} est coté ${f}${c} ?`;
  $('f-motif').value = precedent || '';
  $('form-motif').hidden = false;
  $('f-motif').focus();
  return new Promise((r) => { resoudreMotif = r; });
}

function fermerMotif(valeur) {
  $('form-motif').hidden = true;
  const r = resoudreMotif;
  resoudreMotif = null;
  if (r) r(valeur);
}

/* ----------------------------------- versement par moteur de recherche */

let accesPages = false;

/**
 * Relit à la source les articles versés par recherche dont l'extraction est
 * incomplète — sans date déclarée, sans lien, ou sans corps.
 *
 * Le journal est append-only : une relecture est une NOUVELLE entrée, et la
 * lecture du corpus retient la dernière. L'historique de ce qui avait été
 * versé d'abord reste donc intact et vérifiable.
 */
async function relireIncompletes() {
  const sources = await D.corpus(dossierCourant, { avecTexte: false });
  const aRelire = sources.filter((s) => s.provenance === 'recherche'
    && (!s.datePubliee || !(s.liens || []).length || s.diagnostic?.echec));

  if (!aRelire.length) { etat('Aucune source incomplète à relire.'); return; }
  if (!accesPages) { etat('Accès aux sites non accordé — lancez une recherche pour l’obtenir.', true); return; }

  let reussies = 0;
  for (const [i, s] of aRelire.entries()) {
    etat(`Relecture ${i + 1} / ${aRelire.length} — ${s.editeur}…`);
    try {
      const rep = await envoyerAuFond(requetePage(s.canonical || s.url));
      if (!rep?.ok || !rep.texte) continue;
      const extraite = extraire(new DOMParser().parseFromString(rep.texte, 'text/html'),
        s.canonical || s.url, { pret: 'fetch' });
      await D.verser(dossierCourant, {
        ...extraite,
        provenance: 'recherche', rang: s.rang,
        dateFournisseur: s.dateFournisseur, scoreFournisseur: s.scoreFournisseur,
        diagnostic: { ...extraite.diagnostic, origineContenu: 'page', relecture: true },
      });
      if (extraite.datePubliee) reussies++;
    } catch (e) {
      console.warn('[Constat] relecture échouée', s.url, e.message);
    }
  }
  etat(`${aRelire.length} source(s) relues, ${reussies} datée(s) par leur page.`);
  await afficher();
}

/**
 * La soumission du formulaire est le geste utilisateur : la demande d'accès aux
 * sites doit partir ici, avant tout await, sinon Firefox la refuse.
 */
function lancerRecherche(ev) {
  ev.preventDefault();
  let promesse = Promise.resolve(accesPages);
  if (!accesPages) {
    try { promesse = api.permissions.request({ origins: ['*://*/*'] }); } catch (e) {
      promesse = Promise.resolve(false);
      console.warn('[Constat] accès aux sites refusé', e.message);
    }
  }
  garde(async () => {
    accesPages = await promesse;
    await chercher();
  });
}

async function chercher() {
  const r = await reglages();
  if (!r.cleRecherche) {
    etat('Renseignez une clé Exa dans « Modèle… ».', true);
    $('form-modele').hidden = false;
    return;
  }
  if (!(await api.permissions.contains({ origins: [MOTEUR.origine] }))) {
    etat(`Autorisation manquante pour ${MOTEUR.origine}. Ouvrez « Modèle… » et enregistrez.`, true);
    $('form-modele').hidden = false;
    return;
  }

  const query = $('f-query').value.trim();
  if (!query) { etat('Requête vide.', true); return; }

  const corps = corpsRequete({
    query,
    nombre: Math.min(30, Math.max(1, Number($('f-nombre').value) || 12)),
    depuis: $('f-depuis').value || null,
    jusqua: $('f-jusqua').value || null,
  });

  etat(`Recherche « ${query} »…`);
  const res = await fetchParArrierePlan(MOTEUR.url, {
    headers: enTetes(r.cleRecherche), body: JSON.stringify(corps),
  });
  if (!res.ok) throw new Error(`${MOTEUR.nom} — HTTP ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const reponse = await res.json();

  // La requête est archivée avant tout versement : sans elle, le corpus n'est
  // pas rejouable, puisqu'une même requête relancée demain donne autre chose.
  const trace = entreeRecherche({ dossier: dossierCourant, query, corps, reponse });
  await D.ajouter(dossierCourant, trace);

  const versees = [];
  const resultats = reponse.results || [];
  for (const [i, brut] of resultats.entries()) {
    const page = versPage(brut, { rang: i + 1 });
    etat(`Lecture de la page ${i + 1} / ${resultats.length} — ${hoteDe(page.url)}…`);

    // Le moteur a découvert l'URL ; c'est Constat qui lit la page. Sans ça,
    // ni date déclarée, ni lien de corps : trois détecteurs sur cinq meurent.
    let extraite = null;
    if (accesPages) {
      try {
        const rep = await envoyerAuFond(requetePage(page.url));
        if (rep?.ok && rep.texte) {
          extraite = extraire(new DOMParser().parseFromString(rep.texte, 'text/html'), page.url,
            { pret: 'fetch' });
          page.origineContenu = 'page';
        }
      } catch (e) {
        console.warn('[Constat] page non récupérée', page.url, e.message);
      }
    }

    if (!extraite) {
      // Repli sur le contenu du moteur. Déclaré, jamais présenté comme
      // équivalent : il ne porte ni <head>, ni liens de corps.
      page.origineContenu = 'moteur';
      extraite = page.html
        ? extraire(new DOMParser().parseFromString(page.html, 'text/html'), page.url, { pret: 'api' })
        : {
          url: page.url, canonical: page.url, editeur: hoteDe(page.url), titre: null, auteurs: [],
          datePubliee: null, dateModifiee: null, datesIncoherentes: false,
          texte: page.texteBrut || '', liens: [], citations: [],
          diagnostic: { zone: null, paragraphes: 0, caracteres: (page.texteBrut || '').length,
            liensCorps: 0, liensHorsCorps: 0, echec: 'aucun balisage renvoyé par le moteur' },
        };
    }

    const fusionnee = fusionner(page, extraite);
    await D.verser(dossierCourant, fusionnee);
    versees.push(fusionnee);
  }

  dernierVerdict = {
    query,
    cout: trace.cout,
    echecs: trace.echecs,
    ...verdict(versees),
  };

  $('form-recherche').hidden = true;
  const lues = versees.filter((v) => v.diagnostic.origineContenu === 'page').length;
  etat(`${versees.length} article(s) versés — ${lues} page(s) lues à la source, `
    + `${versees.length - lues} repli(s) sur le contenu du moteur`
    + (trace.echecs.length ? ` · ${trace.echecs.length} échec(s) de crawl` : '')
    + (trace.cout !== null ? ` · ${trace.cout} $` : ''));
  await afficher();
}

function hoteDe(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'inconnu'; } }

let dernierVerdict = null;

/* ------------------------------------------------------------------ export */

async function exporter() {
  const meta = await D.meta(dossierCourant);
  const journal = await D.journal(dossierCourant);
  const sources = await D.corpus(dossierCourant, { avecTexte: false });
  const releve = (await D.relevés(dossierCourant)).at(-1);
  if (!releve) { etat('Établissez un relevé avant d’exporter.', true); return; }

  // Le registre B fait partie du dossier : l'export doit le montrer.
  const lectures = journal.filter((e) => e.t === 'lecture' && e.releveRef === releve.empreinteCorpus);
  const parNumero = new Map();
  for (const e of journal) {
    if (e.t === 'etape' && e.releveRef === releve.empreinteCorpus) parNumero.set(e.numero, e);
  }
  const etapes = [...parNumero.values()].sort((a, b) => a.numero - b.numero);

  const json = $('f-format').value === 'json';
  const phrase = $('f-passphrase').value;
  const cotation = { ...distribution(sources, journal), cotes: courantes(journal) };
  const bilan = assembler({ releve, cotation, etapes });
  let contenu = json
    ? versJSON({ meta, journal, releve })
    : versMarkdown({ meta, releve, sources, lectures, etapes, bilan, cotation });
  let extension = json ? 'json' : 'md';

  // Le chiffrement porte sur le fichier, pas sur le stockage (décision D2).
  if (phrase) { contenu = await chiffrer(contenu, phrase); extension = `${extension}.chiffre.json`; }

  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/octet-stream' }));
  await api.downloads.download({ url, filename: `${dossierCourant}.${extension}`, saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 30000);

  $('f-passphrase').value = '';
  $('form-export').hidden = true;
  etat(phrase ? 'Exporté et chiffré.' : 'Exporté en clair.');
}

/* ---------------------------------------------------------------- dossiers */

async function creerDossier(ev) {
  ev.preventDefault();
  const id = `d-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 6)}`;
  await D.creer({
    id,
    question: $('f-question').value.trim(),
    perimetre: $('f-perimetre').value.trim(),
    horizon: $('f-horizon').value.trim(),
    decision: $('f-decision').value.trim(),
  });
  dossierCourant = id;
  $('form-dossier').hidden = true;
  $('form-dossier').reset();
  etat('Dossier ouvert. Ouvrez un article, puis versez-le.');
  await afficher();
}

/* --------------------------------------------------------------- affichage */

async function afficher() {
  const idx = await D.index();
  const choix = $('choix-dossier');
  choix.textContent = '';
  for (const id of idx) {
    const meta = await D.meta(id);
    const o = document.createElement('option');
    o.value = id;
    o.textContent = (meta?.question || id).slice(0, 60);
    choix.append(o);
  }
  choix.hidden = idx.length < 2;
  if (dossierCourant) choix.value = dossierCourant;

  majBoutons();

  const corps = $('corps');
  corps.textContent = '';

  if (!dossierCourant) {
    $('question').textContent = 'Aucun dossier ouvert';
    $('cartouche').textContent = '';
    corps.append(rendreVide(
      'Ouvrez un dossier autour d’une question, puis versez-y les pages que vous lisez.',
    ));
    return;
  }

  const meta = await D.meta(dossierCourant);
  const sources = await D.corpus(dossierCourant, { avecTexte: false });
  const releve = (await D.relevés(dossierCourant)).at(-1);

  $('question').textContent = meta?.question || dossierCourant;
  $('cartouche').textContent = releve
    ? `relevé ${releve.empreinteCorpus} · ${releve.ts.slice(0, 16).replace('T', ' ')} · `
      + `outil ${releve.outil.version} · ${sources.length} sources`
    : `${sources.length} sources versées · aucun relevé établi`;

  if (dernierVerdict) corps.append(rendreVerdict(dernierVerdict));

  const lectures = (await D.journal(dossierCourant)).filter((e) => e.t === 'lecture');

  if (releve) corps.append(rendreReleve(releve));
  else if (sources.length) {
    corps.append(rendreVide('Établissez le relevé pour voir ce que ce corpus contient — et ce qu’il tait.'));
  }
  if (sources.length) {
    corps.append(rendreSources(
      sources,
      courantes(await D.journal(dossierCourant)),
      { FIABILITE, CREDIBILITE },
      (id, f, c, motifPrecedent) => garde(() => coterSource(id, f, c, motifPrecedent)),
    ));
  }
  else corps.append(rendreVide('Aucune page versée. Ouvrez un article, puis « Verser cette page ».'));

  // Registre B, toujours en bas et toujours séparé. Les lectures du dernier
  // relevé seulement : une lecture ancienne porte sur un autre corpus.
  const recentes = lectures.filter((l) => l.releveRef === releve?.empreinteCorpus);
  if (recentes.length) corps.append(rendreLectures(recentes));

  // Étapes : la dernière production de chaque numéro, pour le relevé courant.
  const parNumero = new Map();
  for (const e of (await D.journal(dossierCourant))) {
    if (e.t === 'etape' && e.releveRef === releve?.empreinteCorpus) parNumero.set(e.numero, e);
  }
  if (parNumero.size) {
    corps.append(rendreEtapes([...parNumero.values()].sort((a, b) => a.numero - b.numero),
      (ts) => garde(() => validerEtapeUtilisateur(ts))));
  }
}

/* ------------------------------------------------------------------ amorce */

// Le seul gestionnaire non asynchrone du fichier : la demande de permission
// doit partir avant tout await, sans quoi Firefox refuse le geste.
//
// C'était aussi, jusqu'ici, le seul gestionnaire du fichier sans try/catch.
// Toute exception levée avant le garde() — une origine illisible, un
// permissions.request() refusé par la plateforme — s'échappait sans qu'aucun
// message ne s'affiche. Le bouton semblait ne rien faire, ce qui est la pire
// des pannes : elle ne donne rien à corriger.
$('verser').addEventListener('click', () => {
  try {
    if (!dossierCourant) { etat('Ouvrez d’abord un dossier.', true); return; }
    if (!onglet) { etat('Ouvrez un article dans l’onglet actif, puis réessayez.', true); return; }

    const cible = onglet;
    const origine = origineDe(cible.url);
    if (!origine) { etat(`URL illisible : ${cible.url}`, true); return; }

    if (origineCouverte(origine)) {
      etat(`Accès à ${origine} déjà accordé. Lecture…`);
      garde(() => verserAvecPermission(cible, true));
      return;
    }

    etat(`Autorisation demandée pour ${origine}…`);
    let promesse;
    try {
      promesse = api.permissions.request({ origins: [origine] });
    } catch (e) {
      // Firefox refuse parfois la demande sans passer par la promesse.
      etat(`Firefox a refusé la demande d’autorisation : ${e.message}. `
        + 'Accordez-la depuis about:addons → Constat → Permissions.', true);
      console.error('[Constat] permissions.request', e);
      return;
    }
    garde(async () => {
      const accorde = await promesse;
      await rafraichirPermissions();
      await verserAvecPermission(cible, accorde);
    });
  } catch (e) {
    etat(`Versement impossible : ${e.message}`, true);
    console.error('[Constat] verser', e);
  }
});

$('chercher').addEventListener('click', () => { $('form-recherche').hidden = false; $('f-query').focus(); });
$('relire').addEventListener('click', () => garde(relireIncompletes));
$('annuler-recherche').addEventListener('click', () => { $('form-recherche').hidden = true; });
$('form-recherche').addEventListener('submit', lancerRecherche);

$('relever').addEventListener('click', () => garde(etablirReleve));
$('lire').addEventListener('click', () => garde(lire));
for (const n of NUMEROS) {
  $(`etape-${n}`).addEventListener('click', () => garde(() => lancerEtape(n)));
}
$('reglages').addEventListener('click', () => garde(ouvrirReglages));
$('annuler-modele').addEventListener('click', () => { $('form-modele').hidden = true; });
$('form-modele').addEventListener('submit', demanderAccesFournisseur);
$('f-fournisseur').addEventListener('change', (e) => {
  $('f-modele').value = FOURNISSEURS[e.target.value]?.modeleDefaut || '';
});
$('nouveau').addEventListener('click', () => {
  $('form-dossier').hidden = false;
  $('f-question').focus();
});
$('annuler-dossier').addEventListener('click', () => { $('form-dossier').hidden = true; });
$('form-dossier').addEventListener('submit', (ev) => garde(() => creerDossier(ev)));

$('exporter').addEventListener('click', () => { $('form-export').hidden = false; });
$('annuler-export').addEventListener('click', () => { $('form-export').hidden = true; });

$('form-motif').addEventListener('submit', (ev) => { ev.preventDefault(); fermerMotif($('f-motif').value.trim()); });
$('annuler-motif').addEventListener('click', () => fermerMotif(''));

$('form-confirmer').addEventListener('submit', (ev) => { ev.preventDefault(); fermerConfirmation(true); });
$('annuler-confirmer').addEventListener('click', () => fermerConfirmation(false));
$('form-export').addEventListener('submit', (ev) => { ev.preventDefault(); garde(exporter); });

$('choix-dossier').addEventListener('change', (e) => {
  dossierCourant = e.target.value;
  garde(afficher);
});

api.tabs.onActivated.addListener(() => garde(suivreOnglet));
api.tabs.onUpdated.addListener((_id, chg) => { if (chg.url || chg.status === 'complete') garde(suivreOnglet); });
window.addEventListener('focus', () => garde(suivreOnglet));

api.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'verser-onglet') {
    // Venu du menu contextuel : pas de geste utilisateur dans CETTE page, donc
    // pas de demande de permission possible ici. On dit quoi faire.
    garde(async () => {
      await suivreOnglet();
      etat(dossierCourant
        ? 'Cliquez « Verser cette page » pour autoriser l’accès à ce site et le verser.'
        : 'Ouvrez d’abord un dossier.', !dossierCourant);
    });
  }
});

garde(async () => {
  await rafraichirPermissions();
  const idx = await D.index();
  dossierCourant = idx.at(-1) || null;
  await suivreOnglet();
  await afficher();
  if (!dossierCourant) etat('Commencez par ouvrir un dossier.');
});
