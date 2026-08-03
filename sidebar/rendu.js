// rendu.js — construction du DOM de la barre latérale.
//
// Règle unique et non négociable : **le rendu ne calcule rien.** Il affiche des
// valeurs déjà présentes dans le relevé et les justifications déjà présentes à
// côté d'elles. Le jour où une addition apparaît ici, un chiffre du registre A
// aura été produit ailleurs que par releve.js — et il ne sera plus rejouable.
//
// Chaque ligne porte trois choses : un libellé, un chiffre, et le comptage qui
// permet de contester le chiffre. Le comptage est replié, jamais absent.

const LIBELLES = {
  'acteur-non-cite': 'Acteurs nommés jamais cités',
  'terme-effondre': 'Termes en effondrement',
  'trou-dossier': 'Trous dans le dossier',
  'article-sans-source': 'Articles sans document source',
  'grappe-origine-unique': 'Grappes à origine unique',
};

const el = (tag, props = {}, enfants = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const e of [].concat(enfants)) if (e) n.append(e);
  return n;
};

/** Le motif signature. `comptage` absent → ligne non dépliable. */
function ligne(libelle, chiffre, comptage, { creuse = false, classe = '' } = {}) {
  const cls = `ligne${creuse ? ' creuse' : ''}${classe ? ' ' + classe : ''}`;
  const contenu = [
    el('span', { class: 'libelle', text: libelle }),
    el('span', { class: 'conduite' }),
    el('span', { class: 'chiffre', text: String(chiffre) }),
  ];

  if (!comptage) return el('div', { class: cls }, contenu);

  const bouton = el('button', { class: cls, 'aria-expanded': 'false', type: 'button' }, contenu);
  const bloc = el('div', { class: 'comptage', hidden: 'hidden' }, comptage);
  bouton.addEventListener('click', () => {
    const ouvert = bouton.getAttribute('aria-expanded') === 'true';
    bouton.setAttribute('aria-expanded', String(!ouvert));
    bloc.hidden = ouvert;
  });
  return el('div', {}, [bouton, bloc]);
}

const listeCourte = (items, max = 10) => {
  const ul = el('ul');
  for (const t of items.slice(0, max)) ul.append(el('li', { text: t }));
  if (items.length > max) ul.append(el('li', { text: `… et ${items.length - max} autres` }));
  return ul;
};

const paires = (obj) => Object.entries(obj)
  .map(([k, v]) => `${k} : ${typeof v === 'object' && v !== null ? JSON.stringify(v) : v}`)
  .join('\n');

/* ------------------------------------------------------- détails par code */

function detailsDe(code, details) {
  switch (code) {
    case 'acteur-non-cite':
      return listeCourte(details.map((d) => `${d.entite} — nommé ${d.nomme} ×, cité 0 ×`));
    case 'terme-effondre':
      return listeCourte(details.map((d) => `« ${d.terme} » — ${d.occurrencesAvant} occurrences `
        + `jusqu'au ${d.dernierArticle.slice(0, 10)}, 0 sur ${d.articlesApres} articles suivants ; `
        + `${d.articlesTermeEtMarqueur} article(s) portant le terme et un marqueur d'abandon`));
    case 'trou-dossier':
      return listeCourte(details.map((d) => `${d.debut.slice(0, 10)} → ${d.fin.slice(0, 10)} — `
        + `${d.jours} jours sans article versé`));
    case 'article-sans-source':
      return listeCourte(details.map((d) => `${d.id} — ${d.natures.join(', ')}`));
    case 'grappe-origine-unique':
      return listeCourte(details.map((d) => `${d.grappe} — ${d.volume} articles, ${d.editeurs} éditeurs `
        + (d.regime === 'constate'
          ? `— ${d.empreintesIdentiques} empreintes de texte identiques [CONSTATÉ]`
          : `— recouvrement médian ${d.recouvrementMedian} [MESURÉ]`)));
    default:
      return listeCourte(details.map((d) => JSON.stringify(d)));
  }
}

/* ---------------------------------------------------------------- relevé */

export function rendreReleve(releve) {
  const co = releve.corroboration;
  const ch = releve.chronologie;
  const frag = document.createDocumentFragment();

  // Ce que ce corpus permet de dire, avant tout chiffre. Ouvrir sur cinq
  // rubriques dont quatre sont hors de portée fait perdre du temps.
  const n = releve.silences.calcules.length;
  const total = n + releve.silences.nonCalcules.length;
  if (n < total) {
    frag.append(el('p', {
      class: 'portee',
      text: `${n} mesure sur ${total} est calculable sur ${co.sources} sources. `
        + `Les autres attendent un corpus plus fourni — voir « Non calculé ».`,
    }));
  }

  // Qui parle, qui est seulement nommé : la matière du dossier, avant les
  // statistiques sur le dossier.
  if (releve.acteurs.liste.length) {
    frag.append(el('h2', { text: 'Qui parle, qui est nommé' }));
    frag.append(ligne('Citations relevées', releve.acteurs.citationsRelevees,
      el('div', { text: `${releve.acteurs.citationsAttribuees} rattachées à un acteur nommé.\n`
        + `Les autres sont attribuées à une fonction (« un diplomate », « un responsable ») `
        + `ou à personne.` })));
    frag.append(ligne('Acteurs nommés', releve.acteurs.total,
      listeCourte(releve.acteurs.liste.map((a) => `${a.entite} — nommé ${a.nomme} ×, cité ${a.cite} ×`), 25)));
  }

  frag.append(el('h2', { text: 'Corroboration' }));
  frag.append(ligne('Sources versées', co.sources));
  frag.append(ligne('Éditeurs distincts', co.editeurs));
  frag.append(ligne('Grappes', co.grappes,
    el('div', {}, [
      el('span', { text: `${co.grappesSansMateriau} grappe(s) sans citation ni lien vers un document source.` }),
      listeCourte(releve.grappes.map((g) => `${g.id} — ${g.volume} art., ${g.editeurs} éd., ${g.verdict}`)),
    ])));
  frag.append(ligne('  la plus large', co.grappePlusLarge ? co.grappePlusLarge.volume : '—', null, { creuse: true }));
  frag.append(ligne('Comptes rendus distincts', co.comptesRendusDistincts,
    el('div', { text: `Définition retenue : ${co.definitionDistincts}.\n\n`
      + `${co.grappes} grappes, dont ${co.grappesSansMateriau} sans matériau propre.` })));

  frag.append(el('h2', { text: 'Chronologie' }));
  frag.append(ligne('Articles datés', ch.articlesDates,
    el('div', { text: `Période : ${(ch.debut || '?').slice(0, 10)} – ${(ch.fin || '?').slice(0, 10)}` })));
  frag.append(ligne('Sans date', ch.articlesSansDate.length,
    ch.articlesSansDate.length ? listeCourte(ch.articlesSansDate) : null, { creuse: true }));
  frag.append(ligne('Dates incohérentes', ch.datesIncoherentes.length,
    ch.datesIncoherentes.length
      ? listeCourte(ch.datesIncoherentes.map((d) => `${d.id} — modifiée ${d.modifiee?.slice(0, 10)} `
        + `antérieure à publiée ${d.publiee?.slice(0, 10)}`))
      : null, { creuse: true }));

  if (releve.contradictions.length) {
    frag.append(el('h2', { text: 'Contradictions chiffrées' }));
    for (const c of releve.contradictions) {
      frag.append(ligne(`« ${c.indicateur} » (${c.unite})`, c.valeurs.join(' / '),
        listeCourte(c.extraits.map((e) => `${e.source} … ${e.extrait} …`))));
    }
  }

  frag.append(el('h2', { text: 'Absences constatées' }));
  for (const c of releve.silences.calcules) {
    frag.append(ligne(LIBELLES[c.code] || c.code, c.constat,
      el('div', {}, [
        el('b', { text: 'Comptage\n' }),
        el('span', { text: paires(c.justification) }),
        c.details.length ? detailsDe(c.code, c.details) : null,
      ])));
  }

  // Toujours présente, même vide : un relevé qui tairait ce qu'il n'a pas pu
  // calculer serait un faux relevé.
  frag.append(el('h2', { text: 'Non calculé' }));
  if (!releve.silences.nonCalcules.length) {
    frag.append(ligne('aucun', '—', null, { classe: 'non-calcule' }));
  }
  for (const n of releve.silences.nonCalcules) {
    frag.append(ligne(LIBELLES[n.code] || n.code, 'non calculé',
      el('div', { text: `${n.raison}\n\n${paires(n.chiffre)}` }), { classe: 'non-calcule' }));
  }

  frag.append(el('p', {
    class: 'avertissement',
    text: `Ce bloc décrit le dossier, pas la presse. Une absence qui y figure est une `
      + `absence dans les ${co.sources} articles que vous avez versés.`,
  }));

  return frag;
}

/* --------------------------------------------------------------- sources */

/**
 * Cotation Admiralty, saisie à la main (étape 2). Aucune valeur par défaut :
 * une source non cotée affiche « non cotée », ce qui est une information. Un
 * réglage par défaut ferait passer l'absence d'évaluation pour une évaluation.
 */
function selecteurCotation(source, cote, echelles, surCoter) {
  const bloc = el('span', { class: 'cotation' });
  const fiab = el('select', { 'aria-label': `Fiabilité de ${source.id}` });
  const cred = el('select', { 'aria-label': `Crédibilité de ${source.id}` });

  fiab.append(el('option', { value: '', text: '— fiabilité' }));
  for (const [k, v] of Object.entries(echelles.FIABILITE)) {
    fiab.append(el('option', { value: k, text: `${k} · ${v}` }));
  }
  cred.append(el('option', { value: '', text: '— crédibilité' }));
  for (const [k, v] of Object.entries(echelles.CREDIBILITE)) {
    cred.append(el('option', { value: k, text: `${k} · ${v}` }));
  }
  if (cote) { fiab.value = cote.fiabilite; cred.value = cote.credibilite; }

  const appliquer = () => {
    if (!fiab.value || !cred.value) return;
    surCoter(source.id, fiab.value, cred.value, cote?.motif || '');
  };
  fiab.addEventListener('change', appliquer);
  cred.addEventListener('change', appliquer);

  bloc.append(fiab, cred);
  if (cote) bloc.append(el('span', { class: 'provenance', text: ` ${cote.fiabilite}${cote.credibilite} — ${cote.motif}` }));
  return bloc;
}

export function rendreSources(sources, cotes = new Map(), echelles = null, surCoter = null) {
  const frag = document.createDocumentFragment();
  const nonCotees = sources.filter((s) => !cotes.has(s.id)).length;
  frag.append(el('h2', { text: `Sources versées — ${sources.length}` }));
  if (echelles && nonCotees) {
    frag.append(el('p', { class: 'provenance', text: `${nonCotees} source(s) non cotées — étape 2 incomplète.` }));
  }
  const ul = el('ul', { class: 'sources' });

  for (const s of sources) {
    const li = el('li', {}, [el('span', { text: s.titre || '(sans titre)' })]);
    const meta = el('span', { class: 'meta' });
    meta.append(document.createTextNode(`${s.editeur} · `));
    if (s.datePubliee) meta.append(document.createTextNode(s.datePubliee.slice(0, 10)));
    else meta.append(el('span', { class: 'sans-date', text: 'date absente' }));
    meta.append(document.createTextNode(
      ` · ${(s.citations || []).length} citations · ${(s.liens || []).length} liens`,
    ));
    if (s.diagnostic?.echec) {
      meta.append(el('span', { class: 'sans-date', text: ` · SANS CORPS : ${s.diagnostic.echec}` }));
      li.classList.add('sans-corps');
    }
    li.append(meta);
    if (echelles && surCoter) li.append(selecteurCotation(s, cotes.get(s.id), echelles, surCoter));
    ul.append(li);
  }
  frag.append(ul);
  return frag;
}

export function rendreVide(message) {
  return el('p', { class: 'vide', text: message });
}

/* ------------------------------------------------- registre B — la lecture
 *
 * Zone visuellement irréconciliable avec le relevé : autre fond, autre filet,
 * italique, étiquette de provenance. Aucun chiffre du registre A n'y est
 * recalculé, et rien de ce qui s'y trouve ne remonte dans le relevé.
 *
 * Quand les deux bras existent, ils sont présentés côte à côte, sans que l'un
 * soit désigné comme le bon. C'est une expérience, pas un résultat.
 */

const TITRES = {
  situation: 'Situation', analyse: 'Analyse',
  jugement: 'Jugement', surveillance: 'Surveillance',
};

function rendreBras(lecture) {
  const div = el('div', { class: 'bras' });
  div.append(el('h3', {
    text: lecture.bras === 'releve' ? 'Depuis le relevé' : 'Témoin — depuis les articles',
  }));
  div.append(el('p', {
    class: 'provenance',
    text: `${lecture.fournisseur} · ${lecture.modele} · ${lecture.ts.slice(0, 16).replace('T', ' ')}`
      + ` · ${lecture.usage?.entree ?? '?'} jetons entrée, ${lecture.usage?.sortie ?? '?'} sortie`
      + ` · relevé ${lecture.releveRef}`,
  }));

  for (const [cle, titre] of Object.entries(TITRES)) {
    const items = lecture.blocs[cle] || [];
    if (!items.length) continue;
    const bloc = el('div', { class: 'bloc-lecture' }, [el('div', { class: 'titre', text: titre })]);
    for (const i of items) {
      const p = el('p', { class: 'enonce' });
      p.append(el('span', { class: `etiquette ${i.registre}`, text: i.registre }));
      p.append(document.createTextNode(i.texte));
      if (i.sources?.length) {
        p.append(el('span', { class: 'provenance', text: ` [${i.sources.join(', ')}]` }));
      }
      if (i.indicateur) p.append(el('p', { class: 'provenance', text: `à surveiller : ${i.indicateur}` }));
      bloc.append(p);
    }
    div.append(bloc);
  }

  // Ce que le modèle a produit et qui a été refusé. Affiché, jamais réparé.
  if (lecture.ecartees?.length || lecture.inventees?.length) {
    const e = el('div', { class: 'ecartees' });
    if (lecture.ecartees?.length) {
      e.append(el('div', { text: `${lecture.ecartees.length} énoncé(s) écarté(s) :` }));
      e.append(listeCourte(lecture.ecartees.map((x) => `${x.bloc} — ${x.raison}`), 8));
    }
    if (lecture.inventees?.length) {
      e.append(el('div', { text: `Sources citées qui n’existent pas dans le corpus : ${lecture.inventees.join(', ')}` }));
    }
    div.append(e);
  }
  return div;
}

export function rendreLectures(lectures) {
  const sec = el('section', { class: 'lecture' });
  for (const l of lectures) sec.append(rendreBras(l));
  sec.append(el('p', {
    class: 'provenance',
    text: 'Aucun chiffre de cette zone n’entre dans le relevé. Un relevé sans modèle '
      + 'est un relevé complet.',
  }));
  return sec;
}

/* ------------------------------------------------- pipeline en 11 étapes
 *
 * Une étape s'affiche produite ET non validée par défaut. La validation est un
 * geste : tant qu'elle n'a pas eu lieu, l'étape suivante refuse de partir.
 * C'est ce qui distingue ce pipeline d'un appel unique en onze morceaux.
 */

const NOTE_ACH = 'Classement calculé à partir de la matrice, sur le nombre de preuves '
  + 'INCOMPATIBLES. L’hypothèse en tête n’est pas la mieux étayée : c’est celle que le '
  + 'corpus réfute le moins.';

function rendreACH(sortie) {
  const d = el('div');
  d.append(el('p', { class: 'provenance', text: NOTE_ACH }));

  const t = el('table', { class: 'matrice' });
  const entete = el('tr', {}, [el('th', { text: 'Preuve' })]);
  for (const h of sortie.hypotheses) entete.append(el('th', { text: h.id }));
  t.append(entete);
  for (const p of sortie.preuves) {
    const tr = el('tr', {}, [el('td', { text: `${p.id} — ${p.enonce}`, title: (p.sources || []).join(', ') })]);
    for (const h of sortie.hypotheses) {
      const v = sortie.matrice[p.id]?.[h.id];
      tr.append(el('td', { class: `case ${v || 'manquante'}`, text: v || '·' }));
    }
    t.append(tr);
  }
  d.append(t);

  d.append(listeCourte(sortie.classement.map((c, i) => `${i + 1}. ${c.id} (${c.role}) — `
    + `${c.incompatibles} incompatible(s), ${c.compatibles} compatible(s)`), 7));
  d.append(listeCourte(sortie.hypotheses.map((h) => `${h.id} ${h.enonce} — `
    + `confirmerait : ${h.confirmerait} — démolirait : ${h.demolirait}`), 7));
  return d;
}

function rendreScenarios(sortie) {
  const d = el('div');
  for (const s of sortie.scenarios) {
    d.append(el('div', { class: 'bloc-lecture' }, [
      el('div', { class: 'titre', text: `${s.role} — ${s.titre} (confiance ${s.confiance})` }),
      el('p', { class: 'enonce', text: s.impact }),
      el('div', { class: 'provenance', text: 'Indicateurs de bascule' }),
      listeCourte(s.indicateursBascule, 6),
    ]));
  }
  return d;
}

function rendreBiais(sortie) {
  const d = el('div');
  d.append(listeCourte(sortie.checklist.map((c) => `${c.point} : ${c.reponse} — ${c.justification}`), 7));
  d.append(el('div', { class: 'provenance', text: 'Ce qu’une équipe rouge opposerait' }));
  d.append(el('p', { class: 'enonce', text: sortie.demolition }));
  d.append(el('div', { class: 'provenance', text: 'Lacunes déclarées' }));
  d.append(listeCourte(sortie.lacunes, 8));
  return d;
}

function rendreTriple(sortie) {
  const d = el('div');
  for (const [cle, titre] of [['factuelle', 'Lecture factuelle'],
    ['signaux', 'Signaux faibles'], ['symbolique', 'Lecture symbolique']]) {
    d.append(el('div', { class: 'titre', text: titre }));
    d.append(listeCourte((sortie[cle] || []).map((i) => i.texte
      + (i.appui ? ` — appui : ${i.appui}` : '')
      + (i.pourquoiNeglige ? ` — négligé car : ${i.pourquoiNeglige}` : '')), 8));
  }
  if (sortie.convergence) {
    d.append(el('p', {
      class: 'provenance',
      text: sortie.convergence.statut === 'convergent'
        ? 'Les trois lectures convergent.'
        : `Lectures ${sortie.convergence.statut}es — ce que la dissonance révèle : ${sortie.convergence.revele}`,
    }));
  }
  return d;
}

const NIVEAUX = { 'tres-faible': 'très faible', faible: 'faible', modere: 'modéré',
  eleve: 'élevé', critique: 'critique' };

function rendreRisque(sortie) {
  const d = el('div');
  d.append(el('p', {
    class: 'provenance',
    text: 'Niveau croisé par l’outil à partir de la probabilité et de l’impact. '
      + 'Le modèle donne les deux ; il ne conclut pas.',
  }));
  for (const e of sortie.evaluations) {
    d.append(el('div', { class: 'bloc-lecture' }, [
      el('div', { class: 'titre', text: `${e.scenario} — risque ${NIVEAUX[e.niveau] || e.niveau} `
        + `(probabilité ${e.probabilite} × impact ${e.impact})` }),
      el('p', { class: 'enonce', text: e.justification }),
      el('div', { class: 'provenance', text: `Ne tient que si : ${e.conditions.join(' ; ')}` }),
      el('div', { class: 'provenance', text: `Dimensions : ${e.dimensions.join(', ') || '—'} · `
        + `confiance ${e.confiance}` }),
    ]));
  }
  return d;
}

function rendreRecommandations(sortie) {
  const d = el('div');
  for (const r of sortie.recommandations) {
    d.append(el('div', { class: 'bloc-lecture' }, [
      el('div', { class: 'titre', text: `${r.id} — priorité ${r.priorite}, terme ${r.terme}`
        + (r.reversible ? ', réversible' : ', NON réversible') }),
      el('p', { class: 'enonce', text: r.action }),
      el('div', { class: 'provenance', text: `Ressources : ${r.ressources}` }),
      el('div', { class: 'provenance', text: `Risque d’inaction : ${r.risqueInaction}` }),
    ]));
  }
  return d;
}

function rendreRetroaction(sortie) {
  const d = el('div');
  for (const [cle, titre] of [['invalidants', 'Ce qui invaliderait l’analyse'],
    ['lacunes', 'Lacunes d’information'], ['signaux', 'Signaux à surveiller']]) {
    d.append(el('div', { class: 'titre', text: titre }));
    d.append(listeCourte(sortie[cle] || [], 8));
  }
  d.append(el('p', {
    class: 'provenance',
    text: `Prochain point de contrôle : ${sortie.prochainPoint.quand} — `
      + `déclencheur : ${sortie.prochainPoint.declencheur}`,
  }));
  return d;
}

export function rendreEtapes(etapes, surValider) {
  const sec = el('section', { class: 'lecture etapes' });
  sec.append(el('h3', { text: 'Pipeline OSINT' }));

  for (const e of etapes) {
    const bloc = el('div', { class: `bras etape${e.validee ? ' validee' : ''}` });
    bloc.append(el('h3', { text: `Étape ${e.numero} — ${e.nom}` }));
    bloc.append(el('p', {
      class: 'provenance',
      text: `${e.fournisseur} · ${e.modele} · référence ${e.reference} · `
        + `${e.ts.slice(0, 16).replace('T', ' ')}`
        + (e.validee ? ` · VALIDÉE le ${String(e.valideeLe).slice(0, 10)}` : ' · non validée'),
    }));

    if (e.numero === 4) bloc.append(rendreTriple(e.sortie));
    else if (e.numero === 5) bloc.append(rendreACH(e.sortie));
    else if (e.numero === 7) bloc.append(rendreScenarios(e.sortie));
    else if (e.numero === 8) bloc.append(rendreRisque(e.sortie));
    else if (e.numero === 9) bloc.append(rendreRecommandations(e.sortie));
    else if (e.numero === 10) bloc.append(rendreBiais(e.sortie));
    else if (e.numero === 11) bloc.append(rendreRetroaction(e.sortie));

    if (e.ecartees?.length || e.inventees?.length) {
      const x = el('div', { class: 'ecartees' });
      if (e.ecartees?.length) {
        x.append(el('div', { text: `${e.ecartees.length} rejet(s) — rien n’a été réparé :` }));
        x.append(listeCourte(e.ecartees.map((r) => r.raison), 8));
      }
      if (e.inventees?.length) {
        x.append(el('div', { text: `Sources citées absentes du corpus : ${e.inventees.join(', ')}` }));
      }
      bloc.append(x);
    }

    if (!e.validee) {
      const b = el('button', { type: 'button', text: `Valider l’étape ${e.numero}` });
      b.addEventListener('click', () => surValider(e.ts));
      bloc.append(el('p', {
        class: 'provenance',
        text: 'Relisez avant de valider : l’étape suivante recevra ceci tel quel.',
      }));
      bloc.append(b);
    }
    sec.append(bloc);
  }
  return sec;
}
