// etapes.js — le pipeline OSINT, une étape à la fois.
//
// §7.1 du handoff : ne jamais lancer les 11 étapes en un seul appel. Le skill
// fonctionne dans une conversation parce qu'on peut contester une étape et
// reprendre. Une étape reçoit ici la sortie VALIDÉE par l'utilisateur de la
// précédente, jamais sa sortie brute.
//
// §7.2 : les références du skill sont embarquées et chargées conditionnellement.
// N'injecter que celle qui correspond à l'étape lancée est ce qui préserve la
// profondeur du skill sans faire exploser le prompt — les onze pèsent 136 Ko,
// une seule en pèse 10 à 13.
//
// Principe conservé partout : le modèle remplit, l'outil calcule. Le classement
// ACH n'est pas demandé au modèle, il est déduit de la matrice qu'il a remplie.
// Un rang produit par le modèle serait un nombre du registre B déguisé en fait.

const REGISTRES = ['affirme', 'infere', 'hypothese', 'speculation'];

export const ETAPES = {
  4: {
    numero: 4,
    nom: 'Analyse triple',
    references: ['signaux-faibles.md', 'lecture-symbolique-fractale.md'],
    requiert: [],
    consigne: `Tu produis trois lectures du corpus. Elles ne s'additionnent pas :
elles se répondent.

1. "factuelle"  — ce que le corpus établit. Quantitatif et qualitatif.
2. "signaux"    — ce que la lecture factuelle a laissé de côté. Anomalies,
                  répétitions faibles, ruptures de ton, absences.
3. "symbolique" — quelle structure unifie le tout. Motif, précédent,
                  reproduction d'un schéma connu à une autre échelle.

Chaque énoncé de la lecture symbolique DOIT nommer l'appui factuel qui l'étaye,
dans le champ "appui". Un archétype plaqué sans fait est de la spéculation
déguisée, et sera rejeté.

Puis dis si les trois lectures convergent. Si elles divergent, la divergence est
elle-même un signal : dis ce qu'elle révèle. Ne la lisse pas.

N'invente aucune précision chiffrée que le relevé ne contient pas.

Réponds UNIQUEMENT par un objet JSON :
{
  "factuelle":  [{"texte":"...","sources":["s-003"]}],
  "signaux":    [{"texte":"...","pourquoiNeglige":"..."}],
  "symbolique": [{"texte":"...","appui":"le fait précis qui l’étaye"}],
  "convergence": {"statut":"convergent|divergent|partiel","revele":"..."}
}`,
  },

  5: {
    numero: 5,
    nom: 'Hypothèses concurrentes (ACH)',
    references: ['ach-heuer.md'],
    requiert: [],
    consigne: `Tu appliques la méthode ACH (Heuer) au corpus décrit.

Énumère 3 à 7 hypothèses concurrentes. Trois rôles sont obligatoires :
- "dominante"  : le narratif majoritaire, celui qui semble évident.
- "dissidente" : contre-intuitive mais structurellement plausible.
- "fractale"   : interprète l'événement à une autre échelle.
Rôles facultatifs : "strategique" (manœuvre planifiée d'un acteur),
"systemique" (effet de système, l'œuvre de personne).

Liste ensuite les preuves disponibles, chacune rattachée aux identifiants de
source du corpus. Puis remplis la matrice preuves × hypothèses avec, pour
chaque case, exactement une valeur : "C" compatible, "I" incompatible,
"N" neutre.

Ne désigne AUCUNE hypothèse comme retenue. Le classement est calculé hors de
toi, à partir de ta matrice, sur le nombre de preuves incompatibles — pas sur
le nombre de preuves compatibles. Cette inversion est le cœur de la méthode.

Pour chaque hypothèse, donne ce qui la confirmerait et ce qui la démolirait.
Sans ces deux indicateurs, une hypothèse n'est pas testable.

Réponds UNIQUEMENT par un objet JSON :
{
  "hypotheses": [{"id":"H1","role":"dominante","enonce":"...",
                  "confirmerait":"...","demolirait":"..."}],
  "preuves":    [{"id":"P1","enonce":"...","sources":["s-003"]}],
  "matrice":    {"P1": {"H1":"C","H2":"I","H3":"N"}}
}`,
  },

  7: {
    numero: 7,
    nom: 'Scénarios prospectifs',
    references: ['scenarios-prospectifs.md'],
    requiert: [5],
    consigne: `Tu construis des scénarios à partir des hypothèses validées fournies.

Trois rôles obligatoires, un facultatif :
- "optimiste" : la trajectoire favorable structurellement activable — pas le
  scénario magique.
- "probable"  : la continuation des tendances, sans rupture majeure.
- "critique"  : le point de bascule plausible — pas la catastrophe fantasmée.
- "fractal"   : et si ce qui se prépare reproduisait, à cette échelle, un
  précédent identifiable ? (facultatif)

Pour chaque scénario : forces motrices, conditions d'apparition, indicateurs de
bascule concrets et OBSERVABLES, impact prévisible, niveau de confiance
("faible", "moderee" ou "elevee").

Un scénario n'engage que sa structure logique. Il ne dit pas « cela arrivera »,
il dit « cela peut arriver si ces conditions se réunissent, et voici comment le
savoir ». N'écris aucune probabilité de 0 ni de 1, aucune prophétie.

Réponds UNIQUEMENT par un objet JSON :
{
  "scenarios": [{"id":"S1","role":"probable","titre":"...",
                 "drivers":["..."],"conditions":["..."],
                 "indicateursBascule":["signal concret et observable"],
                 "impact":"...","confiance":"moderee",
                 "hypotheses":["H1"]}]
}`,
  },

  8: {
    numero: 8,
    nom: 'Évaluation du risque',
    references: ['matrice-risque.md'],
    requiert: [7],
    consigne: `Tu évalues le risque associé à chaque scénario validé fourni.

Pour chaque scénario : probabilité ("faible", "moderee" ou "elevee"), impact
("mineur", "important" ou "critique"), les dimensions touchées (humaine,
economique, politique, mediatique, operationnelle, symbolique), et ta confiance
dans l'évaluation.

Tu ne calcules AUCUN niveau de risque. Le croisement probabilité × impact est
fait hors de toi, à partir des deux niveaux que tu donnes.

CONDITIONNEMENT OBLIGATOIRE. Chaque évaluation doit préciser dans quelles
conditions elle tient — au moins une condition explicite. Sans conditionnement,
une évaluation de risque devient une prophétie, donc une faute professionnelle.
Une évaluation sans condition sera rejetée.

Ne mets pas tout au niveau critique, ni tout au niveau modéré. Les deux
travers se valent : le premier noie l'alerte, le second la supprime.

Réponds UNIQUEMENT par un objet JSON :
{
  "evaluations": [{"scenario":"S1","probabilite":"moderee","impact":"important",
                   "dimensions":["politique","economique"],
                   "conditions":["si les pourparlers échouent avant le 30 mars"],
                   "confiance":"moderee","justification":"..."}]
}`,
  },

  9: {
    numero: 9,
    nom: 'Recommandations actionnables',
    references: ['format-rapport.md'],
    requiert: [8],
    consigne: `Tu formules 2 à 4 recommandations, adressées à la personne qui
porte la décision sous-jacente du dossier — personne d'autre.

Chacune doit être :
- concrète : une action nommable, pas un principe général ;
- priorisée : "haute", "moyenne" ou "basse" ;
- datée : "court", "moyen" ou "long" terme ;
- ressourcée : qui fait, avec quoi, à partir de quoi ;
- réversible si possible : ne verrouille pas la décision.

Donne aussi, pour chacune, le risque de ne rien faire.

Sont rejetés d'office : « suivre attentivement la situation », « renforcer la
coopération », « agir avant qu'il ne soit trop tard », et toute recommandation
visant un acteur nommé plutôt que le porteur de la décision. Ce sont des
formules vides ou des consignes d'action contre un tiers ; ni l'une ni l'autre
n'a sa place ici.

Réponds UNIQUEMENT par un objet JSON :
{
  "recommandations": [{"id":"R1","priorite":"haute","terme":"court",
                       "action":"...","ressources":"...",
                       "risqueInaction":"...","reversible":true,
                       "scenarios":["S1"]}]
}`,
  },

  10: {
    numero: 10,
    nom: 'Contrôle des biais',
    references: ['biais-cognitifs.md'],
    requiert: [5, 7],
    consigne: `Tu audites l'analyse produite aux étapes précédentes. Tu ne la
réécris pas : tu cherches ce qui cloche.

Réponds à la check-list, une entrée par point, sans en omettre aucun :
  preuves_contraires · ancrage · effet_miroir · surmediatisation ·
  equipe_rouge · registres_distingues · lacunes_precisees

Pour chacun : "reponse" ("oui", "non" ou "partiel"), "justification", et
"vise" — la liste des identifiants d'hypothèses ou de scénarios concernés,
vide si aucun.

Ajoute "lacunes" : ce que le corpus ne permet pas de savoir. Rappel : une
absence dans le corpus n'est pas une absence dans le monde.

Ajoute "demolition" : le raisonnement qu'une équipe rouge opposerait en trois
minutes. S'il n'y en a pas, tu n'as pas cherché.

Réponds UNIQUEMENT par un objet JSON :
{
  "checklist": [{"point":"preuves_contraires","reponse":"partiel",
                 "justification":"...","vise":["H1"]}],
  "lacunes":   ["..."],
  "demolition":"..."
}`,
  },
};

const ETAPE_11 = {
  numero: 11,
  nom: 'Boucle de rétroaction',
  references: ['calibration-engine.md'],
  requiert: [],
  consigne: `Tu clôtures l'analyse. Une analyse livrée n'est pas un point final :
c'est un état de la question à un instant T.

Donne :
- "invalidants" : les données qui, si elles apparaissaient, forceraient à
  réviser l'analyse. Précises, observables.
- "lacunes" : ce qu'on ne sait pas encore, explicitement.
- "prochainPoint" : quand réévaluer, et sur quel déclencheur.
- "signaux" : la liste courte des indicateurs critiques à surveiller.

Sont rejetés : « l'avenir nous le dira », « tout est possible », et toute
certitude absolue. Le premier est abdicatif, le deuxième équivaut à n'avoir
rien dit, le troisième est toujours suspect en prospective.

Réponds UNIQUEMENT par un objet JSON :
{
  "invalidants": ["..."],
  "lacunes": ["..."],
  "prochainPoint": {"quand":"...","declencheur":"..."},
  "signaux": ["..."]
}`,
};

const POINTS_CHECKLIST = ['preuves_contraires', 'ancrage', 'effet_miroir',
  'surmediatisation', 'equipe_rouge', 'registres_distingues', 'lacunes_precisees'];

ETAPES[11] = ETAPE_11;

const ROLES_ACH_OBLIGATOIRES = ['dominante', 'dissidente', 'fractale'];
const ROLES_ACH = [...ROLES_ACH_OBLIGATOIRES, 'strategique', 'systemique'];
const ROLES_SCENARIO_OBLIGATOIRES = ['optimiste', 'probable', 'critique'];
const ROLES_SCENARIO = [...ROLES_SCENARIO_OBLIGATOIRES, 'fractal'];
const CONFIANCES = ['faible', 'moderee', 'elevee'];

/* ------------------------------------------------------------- prompts */

/**
 * Construit le contenu d'un appel d'étape.
 *
 * @param {object} a
 * @param {number} a.numero        étape à lancer
 * @param {object} a.meta          question, périmètre, horizon, décision
 * @param {object} a.releve        relevé déterministe
 * @param {string|string[]} a.reference contenu du ou des fichiers references/*.md
 * @param {object} a.precedentes   { 5: sortieValidee, 7: sortieValidee }
 */
export function construirePrompt({ numero, meta, releve, reference, precedentes = {} }) {
  const e = ETAPES[numero];
  if (!e) throw new Error(`étape inconnue : ${numero}`);

  for (const n of e.requiert) {
    if (!precedentes[n]) {
      throw new Error(`l’étape ${numero} exige la sortie validée de l’étape ${n}`);
    }
  }

  const L = [];
  L.push(`# ÉTAPE ${e.numero} — ${e.nom}`, '');
  L.push('# QUESTION');
  L.push(`Question : ${meta.question}`);
  L.push(`Périmètre : ${meta.perimetre}`);
  L.push(`Horizon : ${meta.horizon}`);
  L.push(`Décision sous-jacente : ${meta.decision}`, '');

  L.push('# RELEVÉ DÉTERMINISTE');
  const co = releve.corroboration;
  L.push(`${co.sources} sources · ${co.editeurs} éditeurs · ${co.grappes} grappes · `
    + `${co.comptesRendusDistincts} comptes rendus distincts.`);
  L.push(`${releve.acteurs.citationsRelevees} citations relevées, `
    + `${releve.acteurs.citationsAttribuees} rattachées à un acteur nommé.`);
  for (const c of releve.silences.calcules) L.push(`- ${c.code} = ${c.constat}`);
  L.push('Points sur lesquels tu ne sais rien (non calculés) :');
  for (const n of releve.silences.nonCalcules) L.push(`- ${n.code} : ${n.raison}`);
  if (!releve.silences.nonCalcules.length) L.push('- aucun');
  L.push('');

  for (const n of e.requiert) {
    L.push(`# SORTIE VALIDÉE DE L’ÉTAPE ${n}`);
    L.push(JSON.stringify(precedentes[n], null, 1), '');
  }

  const refs = [].concat(reference ?? []).filter(Boolean);
  if (refs.length) {
    L.push('# RÉFÉRENCE MÉTHODOLOGIQUE', '');
    L.push(refs.join('\n\n---\n\n'), '');
  }

  return L.join('\n');
}

/* ---------------------------------------------------------- validation */

const vide = (x) => !String(x ?? '').trim();

/**
 * Classement ACH, calculé ici et non demandé au modèle.
 *
 * L'hypothèse retenue n'est pas celle qui rassemble le plus de preuves
 * compatibles, mais celle qui rassemble le moins de preuves incompatibles.
 * Cette inversion force la recherche de réfutation. La laisser au modèle
 * reviendrait à lui laisser choisir sa propre conclusion.
 */
export function classerHypotheses(hypotheses, matrice) {
  const scores = hypotheses.map((h) => {
    let C = 0; let I = 0; let N = 0;
    for (const ligne of Object.values(matrice)) {
      const v = ligne?.[h.id];
      if (v === 'C') C++; else if (v === 'I') I++; else if (v === 'N') N++;
    }
    return { id: h.id, role: h.role, compatibles: C, incompatibles: I, neutres: N };
  });
  // Tri par incompatibles croissantes, puis compatibles décroissantes.
  return [...scores].sort((a, b) => a.incompatibles - b.incompatibles
    || b.compatibles - a.compatibles
    || a.id.localeCompare(b.id));
}

export function validerEtape5(brut, idsSources = []) {
  const ecartees = [];
  const connus = new Set(idsSources);

  const hypotheses = [];
  for (const h of [].concat(brut?.hypotheses ?? [])) {
    if (vide(h?.id) || vide(h?.enonce)) { ecartees.push({ objet: h, raison: 'hypothèse sans id ou sans énoncé' }); continue; }
    if (!ROLES_ACH.includes(h.role)) { ecartees.push({ objet: h, raison: `rôle inconnu : ${h.role}` }); continue; }
    if (vide(h.confirmerait) || vide(h.demolirait)) {
      ecartees.push({ objet: h, raison: 'hypothèse non testable : indicateur de confirmation ou de réfutation manquant' });
      continue;
    }
    hypotheses.push({ id: String(h.id), role: h.role, enonce: String(h.enonce),
      confirmerait: String(h.confirmerait), demolirait: String(h.demolirait) });
  }

  const manquants = ROLES_ACH_OBLIGATOIRES.filter((r) => !hypotheses.some((h) => h.role === r));
  if (manquants.length) ecartees.push({ objet: null, raison: `rôles obligatoires absents : ${manquants.join(', ')}` });
  if (hypotheses.length < 3) ecartees.push({ objet: null, raison: `${hypotheses.length} hypothèse(s) retenue(s), 3 minimum` });

  const preuves = [];
  const inventees = new Set();
  for (const p of [].concat(brut?.preuves ?? [])) {
    if (vide(p?.id) || vide(p?.enonce)) { ecartees.push({ objet: p, raison: 'preuve sans id ou sans énoncé' }); continue; }
    for (const s of p.sources || []) if (connus.size && !connus.has(s)) inventees.add(s);
    preuves.push({ id: String(p.id), enonce: String(p.enonce), sources: (p.sources || []).map(String) });
  }

  // Une case manquante n'est pas comblée par « neutre » : elle est signalée.
  // Compléter à la place du modèle fausserait le classement en sa faveur.
  const matrice = {};
  const cellulesManquantes = [];
  for (const p of preuves) {
    matrice[p.id] = {};
    for (const h of hypotheses) {
      const v = brut?.matrice?.[p.id]?.[h.id];
      if (v === 'C' || v === 'I' || v === 'N') matrice[p.id][h.id] = v;
      else cellulesManquantes.push(`${p.id}×${h.id}`);
    }
  }
  if (cellulesManquantes.length) {
    ecartees.push({ objet: null, raison: `${cellulesManquantes.length} case(s) de matrice manquante(s) ou invalide(s)` });
  }

  return {
    sortie: { hypotheses, preuves, matrice, classement: classerHypotheses(hypotheses, matrice) },
    ecartees,
    inventees: [...inventees].sort(),
    complet: !ecartees.length,
    cellulesManquantes,
  };
}

const CERTITUDE = /(^|[^\d])(100|0)\s*%|certitude absolue|[àa]\s+coup\s+s[ûu]r|in[ée]vitable|aucun\s+doute/i;

export function validerEtape7(brut, idsHypotheses = []) {
  const ecartees = [];
  const connues = new Set(idsHypotheses);
  const scenarios = [];

  for (const s of [].concat(brut?.scenarios ?? [])) {
    if (vide(s?.id) || vide(s?.titre)) { ecartees.push({ objet: s, raison: 'scénario sans id ou sans titre' }); continue; }
    if (!ROLES_SCENARIO.includes(s.role)) { ecartees.push({ objet: s, raison: `rôle inconnu : ${s.role}` }); continue; }
    if (!(s.indicateursBascule || []).filter((x) => !vide(x)).length) {
      // Sans indicateur observable, un scénario n'est pas surveillable : c'est
      // une histoire. Le §7 du skill en fait une exigence, pas une option.
      ecartees.push({ objet: s, raison: 'scénario sans indicateur de bascule observable' });
      continue;
    }
    if (!CONFIANCES.includes(s.confiance)) { ecartees.push({ objet: s, raison: `confiance hors échelle : ${s.confiance}` }); continue; }
    const texte = [s.titre, s.impact, ...(s.conditions || []), ...(s.drivers || [])].join(' ');
    if (CERTITUDE.test(texte)) { ecartees.push({ objet: s, raison: 'certitude ou probabilité de 0 ou 1' }); continue; }

    const orphelines = (s.hypotheses || []).filter((h) => connues.size && !connues.has(h));
    if (orphelines.length) { ecartees.push({ objet: s, raison: `hypothèses inconnues : ${orphelines.join(', ')}` }); continue; }

    scenarios.push({
      id: String(s.id), role: s.role, titre: String(s.titre),
      drivers: (s.drivers || []).map(String),
      conditions: (s.conditions || []).map(String),
      indicateursBascule: (s.indicateursBascule || []).map(String),
      impact: String(s.impact ?? ''), confiance: s.confiance,
      hypotheses: (s.hypotheses || []).map(String),
    });
  }

  const manquants = ROLES_SCENARIO_OBLIGATOIRES.filter((r) => !scenarios.some((s) => s.role === r));
  if (manquants.length) ecartees.push({ objet: null, raison: `rôles obligatoires absents : ${manquants.join(', ')}` });

  return { sortie: { scenarios }, ecartees, complet: !ecartees.length };
}

export function validerEtape10(brut) {
  const ecartees = [];
  const parPoint = new Map();

  for (const c of [].concat(brut?.checklist ?? [])) {
    if (!POINTS_CHECKLIST.includes(c?.point)) { ecartees.push({ objet: c, raison: `point inconnu : ${c?.point}` }); continue; }
    if (!['oui', 'non', 'partiel'].includes(c?.reponse)) { ecartees.push({ objet: c, raison: `réponse hors échelle : ${c?.reponse}` }); continue; }
    if (vide(c?.justification)) { ecartees.push({ objet: c, raison: `point « ${c.point} » sans justification` }); continue; }
    parPoint.set(c.point, {
      point: c.point, reponse: c.reponse,
      justification: String(c.justification), vise: (c.vise || []).map(String),
    });
  }

  const absents = POINTS_CHECKLIST.filter((p) => !parPoint.has(p));
  if (absents.length) ecartees.push({ objet: null, raison: `points de check-list absents : ${absents.join(', ')}` });

  // « Aucune démolition » n'est pas une réponse acceptable : c'est le signe que
  // l'équipe rouge n'a pas été jouée.
  if (vide(brut?.demolition)) ecartees.push({ objet: null, raison: 'aucune démolition proposée — l’équipe rouge n’a pas été jouée' });

  const lacunes = [].concat(brut?.lacunes ?? []).map(String).filter((x) => !vide(x));
  if (!lacunes.length) ecartees.push({ objet: null, raison: 'aucune lacune d’information déclarée' });

  return {
    sortie: {
      checklist: POINTS_CHECKLIST.map((p) => parPoint.get(p)).filter(Boolean),
      lacunes,
      demolition: String(brut?.demolition ?? ''),
    },
    ecartees,
    complet: !ecartees.length,
  };
}

/* ------------------------------------------------- étape 4 — analyse triple */

const COUCHES = ['factuelle', 'signaux', 'symbolique'];
const STATUTS = ['convergent', 'divergent', 'partiel'];

export function validerEtape4(brut, idsSources = []) {
  const ecartees = [];
  const connus = new Set(idsSources);
  const inventees = new Set();
  const sortie = { factuelle: [], signaux: [], symbolique: [], convergence: null };

  for (const item of [].concat(brut?.factuelle ?? [])) {
    if (vide(item?.texte)) { ecartees.push({ objet: item, raison: 'lecture factuelle vide' }); continue; }
    for (const s of item.sources || []) if (connus.size && !connus.has(s)) inventees.add(s);
    sortie.factuelle.push({ texte: String(item.texte), sources: (item.sources || []).map(String) });
  }

  for (const item of [].concat(brut?.signaux ?? [])) {
    if (vide(item?.texte)) { ecartees.push({ objet: item, raison: 'signal faible vide' }); continue; }
    sortie.signaux.push({ texte: String(item.texte), pourquoiNeglige: String(item.pourquoiNeglige ?? '') });
  }

  for (const item of [].concat(brut?.symbolique ?? [])) {
    if (vide(item?.texte)) { ecartees.push({ objet: item, raison: 'lecture symbolique vide' }); continue; }
    // Le piège nommé par le skill : un archétype plaqué sans fait est de la
    // spéculation déguisée. Sans appui factuel, l'énoncé ne passe pas.
    if (vide(item?.appui)) {
      ecartees.push({ objet: item, raison: 'lecture symbolique sans appui factuel — archétype plaqué' });
      continue;
    }
    sortie.symbolique.push({ texte: String(item.texte), appui: String(item.appui) });
  }

  for (const c of COUCHES) {
    if (!sortie[c].length) ecartees.push({ objet: null, raison: `couche « ${c} » vide` });
  }

  const cv = brut?.convergence;
  if (!STATUTS.includes(cv?.statut)) {
    ecartees.push({ objet: cv, raison: `statut de convergence inconnu : ${cv?.statut}` });
  } else if (cv.statut !== 'convergent' && vide(cv?.revele)) {
    // Une divergence non expliquée est une divergence lissée.
    ecartees.push({ objet: cv, raison: 'divergence déclarée sans dire ce qu’elle révèle' });
  } else {
    sortie.convergence = { statut: cv.statut, revele: String(cv.revele ?? '') };
  }

  return { sortie, ecartees, inventees: [...inventees].sort(), complet: !ecartees.length };
}

/* --------------------------------------------------- étape 8 — le risque */

const PROBABILITES = ['faible', 'moderee', 'elevee'];
const IMPACTS = ['mineur', 'important', 'critique'];
const DIMENSIONS = ['humaine', 'economique', 'politique', 'mediatique', 'operationnelle', 'symbolique'];

/**
 * Matrice 3×3 du skill. Le niveau de risque est calculé ici, jamais demandé au
 * modèle — même principe que le classement ACH. Un modèle qui annonce
 * « risque critique » a produit un jugement ; un modèle qui donne une
 * probabilité et un impact a produit deux observations, et le croisement est
 * une règle publique que l'on peut contester.
 */
const MATRICE_RISQUE = {
  elevee: { mineur: 'modere', important: 'eleve', critique: 'critique' },
  moderee: { mineur: 'faible', important: 'modere', critique: 'eleve' },
  faible: { mineur: 'tres-faible', important: 'faible', critique: 'modere' },
};

export function croiser(probabilite, impact) {
  return MATRICE_RISQUE[probabilite]?.[impact] ?? null;
}

export function validerEtape8(brut, idsScenarios = []) {
  const ecartees = [];
  const connus = new Set(idsScenarios);
  const evaluations = [];

  for (const e of [].concat(brut?.evaluations ?? [])) {
    if (connus.size && !connus.has(e?.scenario)) {
      ecartees.push({ objet: e, raison: `scénario inconnu : ${e?.scenario}` }); continue;
    }
    if (!PROBABILITES.includes(e?.probabilite)) {
      ecartees.push({ objet: e, raison: `probabilité hors échelle : ${e?.probabilite}` }); continue;
    }
    if (!IMPACTS.includes(e?.impact)) {
      ecartees.push({ objet: e, raison: `impact hors échelle : ${e?.impact}` }); continue;
    }
    // « Sans conditionnement, une évaluation de risque devient une prophétie —
    // donc une faute professionnelle. » La règle est appliquée, pas seulement
    // demandée.
    const conditions = (e.conditions || []).map(String).filter((c) => !vide(c));
    if (!conditions.length) {
      ecartees.push({ objet: e, raison: 'évaluation sans condition — une prophétie, pas une évaluation' });
      continue;
    }
    if (!CONFIANCES.includes(e?.confiance)) {
      ecartees.push({ objet: e, raison: `confiance hors échelle : ${e?.confiance}` }); continue;
    }
    evaluations.push({
      scenario: String(e.scenario), probabilite: e.probabilite, impact: e.impact,
      dimensions: (e.dimensions || []).map(String).filter((d) => DIMENSIONS.includes(d)),
      conditions, confiance: e.confiance, justification: String(e.justification ?? ''),
      niveau: croiser(e.probabilite, e.impact),
    });
  }

  // Deux travers symétriques, tous deux détectables par comptage.
  const niveaux = evaluations.map((e) => e.niveau);
  if (evaluations.length >= 3 && new Set(niveaux).size === 1) {
    ecartees.push({
      objet: null,
      raison: niveaux[0] === 'critique' || niveaux[0] === 'eleve'
        ? 'toutes les évaluations au même niveau élevé — inflation du risque, plus rien n’alerte'
        : 'toutes les évaluations au même niveau bas — nivellement, l’alerte est supprimée',
    });
  }

  return { sortie: { evaluations }, ecartees, complet: !ecartees.length };
}

/* ------------------------------------------ étape 9 — les recommandations */

const PRIORITES = ['haute', 'moyenne', 'basse'];
const TERMES = ['court', 'moyen', 'long'];

/** Anti-patterns nommés par le skill, plus les formules d'action contre un
 *  tiers. Chaque expression est testée individuellement. */
const RECOMMANDATIONS_VIDES = [
  /suivre\s+attentivement/i,
  /rester\s+vigilant/i,
  /renforcer\s+la\s+coop[ée]ration/i,
  /avant\s+qu[’']il\s+ne\s+soit\s+trop\s+tard/i,
  /continuer\s+[àa]\s+observer/i,
  /prendre\s+les\s+mesures\s+n[ée]cessaires/i,
];

const ACTION_CONTRE_TIERS = [
  /\bfrapper\b/i, /\bsanctionner\b/i, /\b[ée]liminer\b/i, /\bneutraliser\b/i,
  /\brenverser\b/i, /\bd[ée]stabiliser\b/i, /\bdiscr[ée]diter\b/i,
];

export function validerEtape9(brut, idsScenarios = []) {
  const ecartees = [];
  const connus = new Set(idsScenarios);
  const recommandations = [];

  for (const r of [].concat(brut?.recommandations ?? [])) {
    if (vide(r?.id) || vide(r?.action)) { ecartees.push({ objet: r, raison: 'recommandation sans id ou sans action' }); continue; }
    if (!PRIORITES.includes(r?.priorite)) { ecartees.push({ objet: r, raison: `priorité hors échelle : ${r?.priorite}` }); continue; }
    if (!TERMES.includes(r?.terme)) { ecartees.push({ objet: r, raison: `terme hors échelle : ${r?.terme}` }); continue; }
    if (vide(r?.ressources)) { ecartees.push({ objet: r, raison: 'recommandation non ressourcée : qui fait, avec quoi ?' }); continue; }
    if (vide(r?.risqueInaction)) { ecartees.push({ objet: r, raison: 'risque d’inaction non dit' }); continue; }

    const vide_ = RECOMMANDATIONS_VIDES.find((re) => re.test(r.action));
    if (vide_) { ecartees.push({ objet: r, raison: `formule vide : ${vide_.source}` }); continue; }

    const contre = ACTION_CONTRE_TIERS.find((re) => re.test(r.action));
    if (contre) {
      ecartees.push({ objet: r, raison: 'recommandation d’action contre un tiers — hors du périmètre de l’outil' });
      continue;
    }

    const orphelins = (r.scenarios || []).filter((s) => connus.size && !connus.has(s));
    if (orphelins.length) { ecartees.push({ objet: r, raison: `scénarios inconnus : ${orphelins.join(', ')}` }); continue; }

    recommandations.push({
      id: String(r.id), priorite: r.priorite, terme: r.terme,
      action: String(r.action), ressources: String(r.ressources),
      risqueInaction: String(r.risqueInaction), reversible: !!r.reversible,
      scenarios: (r.scenarios || []).map(String),
    });
  }

  // « 2 à 4 maximum, classées. » Au-delà, ce n'est plus une priorisation.
  if (recommandations.length > 4) {
    ecartees.push({ objet: null, raison: `${recommandations.length} recommandations — 4 maximum, sinon rien n’est prioritaire` });
  }
  if (recommandations.length < 2) {
    ecartees.push({ objet: null, raison: `${recommandations.length} recommandation(s) retenue(s), 2 minimum` });
  }

  const rang = (r) => PRIORITES.indexOf(r.priorite) * 10 + TERMES.indexOf(r.terme);
  return {
    sortie: { recommandations: [...recommandations].sort((a, b) => rang(a) - rang(b)) },
    ecartees, complet: !ecartees.length,
  };
}

/* ---------------------------------------------- étape 11 — la rétroaction */

const CLOTURES_INTERDITES = [
  /l[’']avenir\s+nous\s+le\s+dira/i,
  /tout\s+est\s+possible/i,
  /seul\s+le\s+temps\s+le\s+dira/i,
  /wait\s+and\s+see/i,
];

export function validerEtape11(brut) {
  const ecartees = [];
  const liste = (x, nom) => {
    const out = [].concat(x ?? []).map(String).filter((v) => !vide(v));
    if (!out.length) ecartees.push({ objet: null, raison: `${nom} : aucune entrée` });
    for (const v of out) {
      const mauvais = CLOTURES_INTERDITES.find((re) => re.test(v));
      if (mauvais) ecartees.push({ objet: v, raison: `clôture abdicative : ${mauvais.source}` });
    }
    return out.filter((v) => !CLOTURES_INTERDITES.some((re) => re.test(v)));
  };

  const invalidants = liste(brut?.invalidants, 'invalidants');
  const lacunes = liste(brut?.lacunes, 'lacunes');
  const signaux = liste(brut?.signaux, 'signaux');

  const pp = brut?.prochainPoint;
  if (vide(pp?.quand) || vide(pp?.declencheur)) {
    ecartees.push({ objet: pp, raison: 'prochain point de contrôle sans échéance ou sans déclencheur' });
  }

  return {
    sortie: {
      invalidants, lacunes, signaux,
      prochainPoint: { quand: String(pp?.quand ?? ''), declencheur: String(pp?.declencheur ?? '') },
    },
    ecartees, complet: !ecartees.length,
  };
}

export function valider(numero, brut, contexte = {}) {
  if (numero === 4) return validerEtape4(brut, contexte.idsSources);
  if (numero === 5) return validerEtape5(brut, contexte.idsSources);
  if (numero === 7) return validerEtape7(brut, contexte.idsHypotheses);
  if (numero === 8) return validerEtape8(brut, contexte.idsScenarios);
  if (numero === 9) return validerEtape9(brut, contexte.idsScenarios);
  if (numero === 10) return validerEtape10(brut);
  if (numero === 11) return validerEtape11(brut);
  throw new Error(`étape inconnue : ${numero}`);
}

export {
  REGISTRES, POINTS_CHECKLIST, ROLES_ACH, ROLES_SCENARIO, CONFIANCES,
  COUCHES, STATUTS, PROBABILITES, IMPACTS, DIMENSIONS, PRIORITES, TERMES,
  MATRICE_RISQUE,
};
