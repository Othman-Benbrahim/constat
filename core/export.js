// export.js — sortie du dossier.
//
// Le chiffrement porte sur le FICHIER exporté, pas sur le stockage (décision
// D2). L'export est ce qui quitte la machine : c'est là qu'il y a un modèle de
// menace, et là que le chiffrement tient. La passphrase est saisie au moment de
// l'export et n'est jamais conservée — perdre la passphrase, c'est perdre un
// fichier, pas le dossier.

const ITERATIONS = 600000; // recommandation OWASP pour PBKDF2-HMAC-SHA256

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/* ------------------------------------------------------------------- JSON */

export function versJSON({ meta, journal, releve }) {
  return JSON.stringify({
    format: 'constat/dossier',
    version: 1,
    exporteLe: new Date().toISOString(),
    dossier: meta,
    releve: releve || null,
    journal,
  }, null, 2);
}

/* --------------------------------------------------------------- Markdown */

const pct = (n) => (n === null || n === undefined ? '—' : String(n));

/**
 * Le Markdown suit l'ordre de l'écran : question, relevé, absences, sources.
 * Chaque chiffre est suivi de sa justification, jamais seul. Un export dont on
 * ne pourrait pas contester les chiffres serait un export de conclusions.
 */
/**
 * @param {object} a
 * @param {Array} [a.lectures] entrées `lecture` du journal (registre B)
 * @param {Array} [a.etapes]   entrées `etape` du journal (pipeline OSINT)
 *
 * Les lectures et les étapes manquaient à l'export : le document ne montrait
 * que le registre A, et donnait l'impression d'un dossier vide alors que le
 * travail analytique existait à l'écran. Un export partiel qui ne se déclare
 * pas partiel est pire qu'un export absent.
 */
export function versMarkdown({ meta, releve, sources, lectures = [], etapes = [], bilan = null, cotation = null }) {
  const L = [];
  const co = releve.corroboration;
  const ch = releve.chronologie;

  L.push(`# Constat — ${meta.question}`, '');
  L.push(`**Périmètre** ${meta.perimetre}  `);
  L.push(`**Horizon** ${meta.horizon}  `);
  L.push(`**Décision sous-jacente** ${meta.decision}`, '');
  L.push(`Relevé \`${releve.empreinteCorpus}\` — ${releve.ts.slice(0, 16).replace('T', ' ')} `
    + `— ${releve.outil.nom} ${releve.outil.version}`, '');

  // BLUF — Bottom Line Up Front (étape 6). Dérivé des étapes validées, jamais
  // rédigé : si l'étape 5 n'est pas validée, il n'y a pas de conclusion en
  // tête, et le document le dit plutôt que d'en fabriquer une.
  if (bilan) {
    L.push('## En une phrase', '');
    L.push(bilan.bluf.possible ? bilan.bluf.texte : `_Pas de conclusion en tête : ${bilan.bluf.raison}._`, '');
    L.push(`Format visé : **${bilan.format.nom}** (${bilan.format.attendu}).`
      + (bilan.complet ? ' Toutes les étapes attendues sont validées.'
        : ` Manquantes : ${bilan.manquantes.join(', ') || 'aucune'}`
          + ` · produites mais non validées : ${bilan.nonValidees.join(', ') || 'aucune'}.`), '');
    if (bilan.reserves.length) {
      L.push('**Réserves**', '');
      for (const r of bilan.reserves) L.push(`- ${r}`);
      L.push('');
    }
  }

  // Ce que ce corpus permet et ne permet pas de dire, en tête et non en note.
  // Un document qui ouvre sur cinq sections dont quatre sont vides fait perdre
  // du temps avant de le dire.
  const mesurables = releve.silences.calcules.map((c) => LIBELLES[c.code] || c.code);
  const hors = releve.silences.nonCalcules.map((n) => `${LIBELLES[n.code] || n.code} (${n.raison})`);
  L.push('## Ce que ce dossier permet de dire', '');
  L.push(`Sur ${co.sources} sources, ${mesurables.length} mesure(s) sur `
    + `${mesurables.length + hors.length} sont calculables.`, '');
  if (mesurables.length) L.push('**Calculé** — ' + mesurables.join(' · '), '');
  if (hors.length) L.push('**Hors de portée à cette taille** — ' + hors.join(' · '), '');

  L.push('## Relevé', '');
  L.push('| Mesure | Valeur |', '|---|---|');
  L.push(`| Sources versées | ${co.sources} |`);
  L.push(`| Éditeurs distincts | ${co.editeurs} |`);
  L.push(`| Grappes | ${co.grappes} |`);
  L.push(`| Grappe la plus large | ${co.grappePlusLarge ? co.grappePlusLarge.volume : '—'} |`);
  L.push(`| Comptes rendus distincts | ${co.comptesRendusDistincts} |`);
  L.push('');
  L.push(`> Compte rendu distinct : ${co.definitionDistincts}.`, '');
  L.push(`Période couverte par le dossier : ${(ch.debut || '?').slice(0, 10)} – ${(ch.fin || '?').slice(0, 10)}. `
    + `${ch.articlesDates} articles datés, ${ch.articlesSansDate.length} sans date`
    + `${ch.datesIncoherentes.length ? `, ${ch.datesIncoherentes.length} aux dates incohérentes` : ''}.`, '');

  // --- Qui parle, qui est seulement nommé. C'est la matière du dossier, pas
  // une statistique sur le dossier. Elle était calculée et non exportée.
  if (releve.acteurs.liste.length) {
    if (cotation) {
    L.push('## Cotation des sources (étape 2)', '');
    L.push(`${cotation.cotees} source(s) cotées sur ${cotation.total}`
      + (cotation.nonCotees.length ? ` · non cotées : ${cotation.nonCotees.join(', ')}` : '')
      + (cotation.nonEvaluables ? ` · non évaluables (F ou 6) : ${cotation.nonEvaluables}` : ''), '');
    L.push(`Socle fiable et confirmé (A-B × 1-2) : ${cotation.socle.length ? cotation.socle.join(', ') : '_aucun_'}`, '');
    L.push('| Fiabilité | ' + Object.entries(cotation.parFiabilite).map(([k, v]) => `${k} ${v}`).join(' · ') + ' |');
    L.push('|---|', '| Crédibilité | ' + Object.entries(cotation.parCredibilite).map(([k, v]) => `${k} ${v}`).join(' · ') + ' |');
    L.push('');
  }

  L.push('## Qui parle, qui est nommé', '');
    L.push(`${releve.acteurs.citationsRelevees} citations relevées, `
      + `${releve.acteurs.citationsAttribuees} rattachées à un acteur nommé.`, '');
    L.push('| Acteur | Nommé dans | Cité dans |', '|---|---:|---:|');
    for (const a of releve.acteurs.liste.slice(0, 25)) {
      L.push(`| ${a.entite} | ${a.nomme} | ${a.cite} |`);
    }
    if (releve.acteurs.liste.length > 25) L.push(`| … ${releve.acteurs.liste.length - 25} autres | | |`);
    L.push('');
  }

  // --- Chronologie article par article.
  if (ch.ordre.length) {
    L.push('## Chronologie', '');
    for (const o of ch.ordre) L.push(`- ${o.date.slice(0, 16).replace('T', ' ')} — ${o.editeur} (${o.id})`);
    for (const id of ch.articlesSansDate) L.push(`- _date absente_ — ${id}`);
    L.push('');
  }

  // --- Champs lexicaux : les termes et leur répartition dans le temps.
  L.push('## Champs lexicaux', '');
  if (releve.lexique.nonCalcule) {
    L.push(`_Non calculé : ${releve.lexique.nonCalcule}._`, '');
  } else {
    const bornes = releve.lexique.periodes;
    L.push('Périodes : ' + bornes
      .map((b, i) => `P${i + 1} ${b.debut.slice(0, 10)} (${b.articles} art.)`).join(' · '), '');
    L.push('| Terme | Articles | ' + bornes.map((_, i) => `P${i + 1}`).join(' | ') + ' |');
    L.push('|---|---:|' + bornes.map(() => '---:|').join(''));
    for (const t of releve.lexique.termes) {
      L.push(`| ${t.terme} | ${t.articles} | ${t.parPeriode.join(' | ')} |`);
    }
    L.push('');
  }

  if (releve.populations?.mixte) {
    L.push('## Provenance du corpus', '');
    L.push(`${releve.populations.lecture} article(s) versés par lecture · `
      + `${releve.populations.recherche} par recherche.`, '');
    L.push(`> ${releve.populations.avertissement}`, '');
    L.push('| Absence | Lecture | Recherche |', '|---|---:|---:|');
    const par = releve.silencesParProvenance;
    const codes = new Set([...par.lecture.calcules, ...par.recherche.calcules].map((c) => c.code));
    for (const code of codes) {
      const l = par.lecture.calcules.find((c) => c.code === code);
      const r = par.recherche.calcules.find((c) => c.code === code);
      L.push(`| ${LIBELLES[code] || code} | ${l ? l.constat : '_non calculé_'} | `
        + `${r ? r.constat : '_non calculé_'} |`);
    }
    L.push('');
    L.push('_Un terme présent dans la requête ne peut pas s’effondrer, puisqu’il conditionne '
      + 'l’appartenance au corpus. Un trou dans la colonne « recherche » dit ce que le moteur '
      + 'n’a pas indexé, pas ce que la presse n’a pas publié._', '');
  }

  L.push('## Absences constatées', '');
  for (const c of releve.silences.calcules) {
    L.push(`### ${LIBELLES[c.code] || c.code} — ${c.constat}`, '');
    L.push('Justification : ' + Object.entries(c.justification)
      .map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '), '');
    for (const d of c.details.slice(0, 12)) L.push(`- ${ligneDetail(c.code, d)}`);
    L.push('');
  }

  if (!releve.silences.calcules.length) L.push('_aucune mesure calculable à cette taille de corpus._', '');

  L.push('### Non calculé', '');
  if (!releve.silences.nonCalcules.length) L.push('_aucun_', '');
  for (const n of releve.silences.nonCalcules) {
    L.push(`- **${LIBELLES[n.code] || n.code}** : ${n.raison} — ${JSON.stringify(n.chiffre)}`);
  }
  L.push('');

  if (releve.contradictions.length) {
    L.push('## Contradictions chiffrées', '');
    for (const c of releve.contradictions) {
      L.push(`- **${c.indicateur}** (${c.unite}) : ${c.valeurs.join(' / ')} — ${c.articles.length} articles`);
      for (const e of c.extraits.slice(0, 3)) L.push(`  - \`${e.source}\` … ${e.extrait} …`);
    }
    L.push('');
  }

  // ------------------------------------------------------------ registre B
  if (lectures.length || etapes.length) {
    L.push('---', '');
    L.push('# Registre B — produit par un modèle', '');
    L.push('_Aucun chiffre de cette partie n’entre dans le relevé. '
      + 'Un relevé sans modèle est un relevé complet._', '');
  }

  for (const l of lectures) {
    L.push(`## Lecture — ${l.bras === 'releve' ? 'depuis le relevé' : 'témoin, depuis les articles'}`, '');
    L.push(`\`${l.fournisseur} · ${l.modele} · ${l.ts.slice(0, 16).replace('T', ' ')} · `
      + `relevé ${l.releveRef}\``, '');
    for (const [cle, titre] of [['situation', 'Situation'], ['analyse', 'Analyse'],
      ['jugement', 'Jugement'], ['surveillance', 'Surveillance']]) {
      const items = l.blocs?.[cle] || [];
      if (!items.length) continue;
      L.push(`### ${titre}`, '');
      for (const i of items) {
        L.push(`- **[${i.registre}]** ${i.texte}`
          + (i.sources?.length ? ` _(${i.sources.join(', ')})_` : '')
          + (i.indicateur ? `  \n  À surveiller : ${i.indicateur}` : ''));
      }
      L.push('');
    }
    if (l.ecartees?.length) {
      L.push(`_${l.ecartees.length} énoncé(s) écarté(s) : `
        + `${[...new Set(l.ecartees.map((e) => e.raison))].join(' · ')}._`, '');
    }
    if (l.inventees?.length) {
      L.push(`_Sources citées absentes du corpus : ${l.inventees.join(', ')}._`, '');
    }
  }

  for (const e of etapes) {
    L.push(`## Étape ${e.numero} — ${e.nom}${e.validee ? '' : ' _(non validée)_'}`, '');
    L.push(`\`${e.fournisseur} · ${e.modele} · référence ${e.reference} · `
      + `${e.ts.slice(0, 16).replace('T', ' ')}\``, '');
    L.push(...corpsEtape(e));
    if (e.ecartees?.length) {
      L.push(`_${e.ecartees.length} rejet(s), rien n’a été réparé : `
        + `${[...new Set(e.ecartees.map((x) => x.raison))].join(' · ')}._`, '');
    }
    L.push('');
  }

  L.push('## Sources', '');
  for (const s of sources) {
    // Lien Markdown et non URL nue : le titre reste lisible et la pièce reste
    // atteignable depuis l'export, y compris hors de l'extension.
    const url = s.canonical || s.url;
    L.push(`- **[${(s.titre || '(sans titre)').replace(/([\[\]])/g, '\\$1')}](${url})** — ${s.editeur}, `
      + `${s.datePubliee ? s.datePubliee.slice(0, 10) : '_date absente_'}  `);
    L.push(`  <${url}>  `);
    const cote = cotation && cotation.cotes ? cotation.cotes.get(s.id) : null;
    L.push(`  consultée le ${(s.consulteeLe || '').slice(0, 10)} · `
      + `${(s.citations || []).length} citations · ${(s.liens || []).length} liens`
      + (cote ? ` · **${cote.fiabilite}${cote.credibilite}** (${cote.motif})` : ' · _non cotée_'));
  }
  L.push('');
  L.push('---', '');
  L.push('Ce document décrit un dossier, pas la presse. Une absence qui y figure est une');
  L.push(`absence dans les ${co.sources} articles qui ont été versés.`, '');
  return L.join('\n');
}

const NIVEAUX = { 'tres-faible': 'très faible', faible: 'faible', modere: 'modéré',
  eleve: 'élevé', critique: 'critique' };

/** Une étape s'exporte avec ce qui la rend contestable : la matrice pour l'ACH,
 *  les conditions pour le risque, l'appui factuel pour la lecture symbolique. */
function corpsEtape(e) {
  const s = e.sortie || {};
  const L = [];

  if (e.numero === 4) {
    for (const [cle, titre] of [['factuelle', 'Lecture factuelle'],
      ['signaux', 'Signaux faibles'], ['symbolique', 'Lecture symbolique']]) {
      L.push(`### ${titre}`, '');
      for (const i of s[cle] || []) {
        L.push(`- ${i.texte}${i.appui ? ` — _appui : ${i.appui}_` : ''}`
          + `${i.pourquoiNeglige ? ` — _négligé car : ${i.pourquoiNeglige}_` : ''}`);
      }
      L.push('');
    }
    if (s.convergence) {
      L.push(s.convergence.statut === 'convergent'
        ? '_Les trois lectures convergent._'
        : `_Lectures ${s.convergence.statut}es — ce que la dissonance révèle : ${s.convergence.revele}_`, '');
    }
  }

  if (e.numero === 5) {
    L.push('| Preuve | ' + (s.hypotheses || []).map((h) => h.id).join(' | ') + ' |');
    L.push('|---|' + (s.hypotheses || []).map(() => ':-:|').join(''));
    for (const p of s.preuves || []) {
      L.push(`| ${p.id} ${p.enonce} | `
        + (s.hypotheses || []).map((h) => s.matrice?.[p.id]?.[h.id] || '·').join(' | ') + ' |');
    }
    L.push('');
    L.push('Classement par nombre de preuves **incompatibles** — calculé, non demandé au modèle :', '');
    for (const [i, c] of (s.classement || []).entries()) {
      L.push(`${i + 1}. **${c.id}** (${c.role}) — ${c.incompatibles} incompatible(s), ${c.compatibles} compatible(s)`);
    }
    L.push('');
    for (const h of s.hypotheses || []) {
      L.push(`- **${h.id}** ${h.enonce}  \n  Confirmerait : ${h.confirmerait}  \n  Démolirait : ${h.demolirait}`);
    }
    L.push('');
  }

  if (e.numero === 7) {
    for (const sc of s.scenarios || []) {
      L.push(`### ${sc.role} — ${sc.titre} _(confiance ${sc.confiance})_`, '');
      L.push(sc.impact, '');
      L.push('Indicateurs de bascule :');
      for (const i of sc.indicateursBascule) L.push(`- ${i}`);
      L.push('');
    }
  }

  if (e.numero === 8) {
    L.push('| Scénario | Probabilité | Impact | Risque | Ne tient que si |');
    L.push('|---|---|---|---|---|');
    for (const ev of s.evaluations || []) {
      L.push(`| ${ev.scenario} | ${ev.probabilite} | ${ev.impact} | `
        + `**${NIVEAUX[ev.niveau] || ev.niveau}** | ${ev.conditions.join(' ; ')} |`);
    }
    L.push('', '_Niveau croisé par l’outil. Le modèle donne probabilité et impact, il ne conclut pas._', '');
  }

  if (e.numero === 9) {
    for (const r of s.recommandations || []) {
      L.push(`**${r.id} — priorité ${r.priorite}, terme ${r.terme}`
        + `${r.reversible ? ', réversible' : ', NON réversible'}**`, '');
      L.push(`- Action : ${r.action}`);
      L.push(`- Ressources : ${r.ressources}`);
      L.push(`- Risque d’inaction : ${r.risqueInaction}`, '');
    }
  }

  if (e.numero === 10) {
    for (const c of s.checklist || []) L.push(`- **${c.point}** : ${c.reponse} — ${c.justification}`);
    L.push('', `**Ce qu’une équipe rouge opposerait** — ${s.demolition}`, '');
    L.push('Lacunes déclarées :');
    for (const l of s.lacunes || []) L.push(`- ${l}`);
    L.push('');
  }

  if (e.numero === 11) {
    for (const [cle, titre] of [['invalidants', 'Ce qui invaliderait l’analyse'],
      ['lacunes', 'Lacunes d’information'], ['signaux', 'Signaux à surveiller']]) {
      L.push(`**${titre}**`, '');
      for (const i of s[cle] || []) L.push(`- ${i}`);
      L.push('');
    }
    L.push(`**Prochain point de contrôle** : ${s.prochainPoint?.quand} — `
      + `déclencheur : ${s.prochainPoint?.declencheur}`, '');
  }

  return L;
}

const LIBELLES = {
  'acteur-non-cite': 'Acteurs nommés jamais cités',
  'terme-effondre': 'Termes en effondrement',
  'trou-dossier': 'Trous dans le dossier',
  'article-sans-source': 'Articles ne liant aucun document source',
  'grappe-origine-unique': 'Grappes à origine unique',
};

function ligneDetail(code, d) {
  switch (code) {
    case 'acteur-non-cite':
      return `${d.entite} — nommé dans ${d.nomme} articles, cité 0 fois`;
    case 'terme-effondre':
      return `« ${d.terme} » — ${d.occurrencesAvant} occurrences jusqu'au ${d.dernierArticle.slice(0, 10)}, `
        + `0 sur les ${d.articlesApres} articles suivants, ${d.articlesTermeEtMarqueur} article(s) `
        + `contenant le terme et un marqueur d'abandon`;
    case 'trou-dossier':
      return `${d.debut.slice(0, 10)} → ${d.fin.slice(0, 10)} — ${d.jours} jours sans article versé`;
    case 'article-sans-source':
      return `${d.id} — ${d.natures.join(', ')}`;
    case 'grappe-origine-unique':
      return `${d.grappe} — ${d.volume} articles, ${d.editeurs} éditeurs, `
        + (d.regime === 'constate'
          ? `${d.empreintesIdentiques} empreintes de texte identiques (constaté)`
          : `recouvrement médian ${pct(d.recouvrementMedian)} (mesuré)`);
    default:
      return JSON.stringify(d);
  }
}

/* ------------------------------------------------------------ chiffrement */

async function deriver(passphrase, sel) {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sel, iterations: ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

/** @returns {Promise<string>} enveloppe JSON, sûre à écrire sur disque. */
export async function chiffrer(texte, passphrase) {
  if (!passphrase) throw new Error('passphrase requise');
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cle = await deriver(passphrase, sel);
  const chiffre = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, cle, new TextEncoder().encode(texte),
  );
  return JSON.stringify({
    format: 'constat/chiffre',
    version: 1,
    kdf: { nom: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS },
    chiffrement: 'AES-GCM-256',
    sel: b64(sel),
    iv: b64(iv),
    donnees: b64(chiffre),
    // Rappel dans le fichier lui-même : il n'y a pas de récupération.
    note: 'Sans la passphrase, ce fichier est irrécupérable. Aucune trappe.',
  }, null, 2);
}

export async function dechiffrer(enveloppe, passphrase) {
  const e = typeof enveloppe === 'string' ? JSON.parse(enveloppe) : enveloppe;
  if (e.format !== 'constat/chiffre') throw new Error('format inconnu');
  const cle = await deriver(passphrase, deb64(e.sel));
  let clair;
  try {
    clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deb64(e.iv) }, cle, deb64(e.donnees));
  } catch {
    throw new Error('passphrase incorrecte ou fichier altéré');
  }
  return new TextDecoder().decode(clair);
}
