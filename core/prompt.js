// prompt.js — ce que le modèle reçoit.
//
// Deux constructions, délibérément mises en concurrence :
//
//   promptDepuisReleve  §8 du handoff — le modèle lit le relevé, un
//                       représentant par grappe, les citations, les silences.
//   promptDepuisTextes  le témoin — le modèle lit les articles.
//
// Le second n'est pas là pour être utilisé au quotidien : il est là pour que la
// question « la couche déterministe sert-elle à quelque chose ? » soit tranchée
// par comparaison plutôt que par conviction. Si la lecture issue du relevé
// n'apporte rien de plus que celle issue des textes bruts, la couche
// déterministe n'est qu'un dispositif d'économie de jetons — ce qui reste
// légitime, mais change ce qu'est ce projet.

/** Le prompt système, commun aux deux bras. Les interdits sont ceux du skill. */
export const CONSIGNE = `Tu es analyste en renseignement de sources ouvertes.

Tu produis une lecture en quatre blocs : SITUATION, ANALYSE, JUGEMENT, SURVEILLANCE.

Règles absolues :
- Chaque affirmation porte un registre explicite parmi : affirme, infere, hypothese, speculation.
  "affirme" exige une source du corpus, citée par son identifiant.
  "infere" est une déduction que tu poses à partir d'éléments du corpus.
  "hypothese" est une explication possible et non établie.
  "speculation" est tout le reste. Ne la déguise jamais en inférence.
- Aucune probabilité de 0 ni de 1. Aucune certitude.
- Aucune recommandation visant une personne ou une organisation nommée.
- Un scénario est un scénario, jamais une prédiction ni une prophétie.
- Ce que le corpus ne contient pas, tu ne le sais pas. Une absence dans le
  corpus n'est pas une absence dans le monde : c'est une absence dans ce qui a
  été versé. Ne conclus jamais d'un silence du corpus à un silence réel.
- Tu ne produis aucun chiffre nouveau. Les nombres qui apparaissent dans ta
  réponse sont repris tels quels du relevé, ou absents.

Réponds UNIQUEMENT par un objet JSON, sans texte autour, de la forme :
{
  "situation":    [{"registre":"affirme","texte":"...","sources":["s-003"]}],
  "analyse":      [{"registre":"infere","texte":"..."}],
  "jugement":     [{"registre":"hypothese","texte":"..."}],
  "surveillance": [{"registre":"infere","texte":"...","indicateur":"ce qui, si observé, trancherait"}]
}`;

const REGISTRES = ['affirme', 'infere', 'hypothese', 'speculation'];

/** Formulations qui portent une certitude. Testées une par une dans
 *  test/lecture.test.mjs : une expression ajoutée ici sans test ne prouve rien. */
const CERTITUDES = [
  /(^|[^\d])(100|0)\s*%/,
  /probabilit[ée]\s+(de\s+)?(1|0|100\s*%|z[ée]ro)\b/i,
  /certitude\s+absolue/i,
  /[àa]\s+coup\s+s[ûu]r/i,
  /in[ée]vitable/i,
  /avec\s+certitude/i,
  /aucun\s+doute/i,
  /(se\s+produira|arrivera)\s+(certainement|assur[ée]ment)/i,
];

/* ------------------------------------------------------- bras A : le relevé */

/**
 * Le modèle ne lit pas les articles. Il lit le relevé, plus un représentant par
 * grappe et les citations directes. Un corpus de 47 articles pèse environ
 * 50 000 jetons ; ceci en pèse quelques milliers.
 */
export function promptDepuisReleve({ meta, releve, sources }) {
  const parId = new Map(sources.map((s) => [s.id, s]));
  const co = releve.corroboration;
  const L = [];

  L.push('# QUESTION');
  L.push(`Question : ${meta.question}`);
  L.push(`Périmètre : ${meta.perimetre}`);
  L.push(`Horizon : ${meta.horizon}`);
  L.push(`Décision sous-jacente : ${meta.decision}`, '');

  L.push('# RELEVÉ DÉTERMINISTE');
  L.push(`Sources versées : ${co.sources} · éditeurs distincts : ${co.editeurs} · `
    + `grappes : ${co.grappes} · comptes rendus distincts : ${co.comptesRendusDistincts}`);
  L.push(`Compte rendu distinct = ${co.definitionDistincts}.`);
  L.push(`Période : ${(releve.chronologie.debut || '?').slice(0, 10)} – `
    + `${(releve.chronologie.fin || '?').slice(0, 10)}, `
    + `${releve.chronologie.articlesDates} datés, `
    + `${releve.chronologie.articlesSansDate.length} sans date.`, '');

  L.push('## Acteurs');
  L.push(`${releve.acteurs.citationsRelevees} citations relevées, `
    + `${releve.acteurs.citationsAttribuees} rattachées à un acteur nommé.`);
  for (const a of releve.acteurs.liste.slice(0, 20)) {
    L.push(`- ${a.entite} : nommé dans ${a.nomme}, cité dans ${a.cite}`);
  }
  L.push('');

  if (!releve.lexique.nonCalcule && releve.lexique.termes.length) {
    L.push('## Champs lexicaux par période');
    L.push(releve.lexique.periodes.map((b, i) => `P${i + 1} ${b.debut.slice(0, 10)} (${b.articles} art.)`).join(' · '));
    for (const t of releve.lexique.termes) L.push(`- ${t.terme} : ${t.parPeriode.join(' / ')}`);
    L.push('');
  }

  if (releve.contradictions.length) {
    L.push('## Contradictions chiffrées');
    for (const c of releve.contradictions) {
      L.push(`- ${c.indicateur} (${c.unite}) : ${c.valeurs.join(' vs ')} — ${c.articles.join(', ')}`);
    }
    L.push('');
  }

  // Le bloc des silences, avec la distinction calculé / non calculé intacte.
  L.push('## Absences constatées');
  for (const c of releve.silences.calcules) {
    L.push(`- ${c.code} = ${c.constat} (${Object.entries(c.justification)
      .map(([k, v]) => `${k} ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ')})`);
  }
  L.push('## Non calculé — tu ne sais rien de ces points');
  if (!releve.silences.nonCalcules.length) L.push('- aucun');
  for (const n of releve.silences.nonCalcules) L.push(`- ${n.code} : ${n.raison}`);
  L.push('');

  // Un représentant par grappe. C'est ce qui remplace les 47 textes.
  L.push('# UN REPRÉSENTANT PAR GRAPPE');
  for (const g of releve.grappes) {
    const s = parId.get(g.membres[0]);
    L.push(`## ${g.id} — ${g.volume} article(s), ${g.editeurs} éditeur(s), verdict ${g.verdict}`);
    L.push(`${s?.titre || g.titre} — ${s?.editeur || '?'} — ${(s?.datePubliee || '').slice(0, 10)}`);
    L.push(extraitCourt(s?.texte, 5));
    L.push('');
  }

  L.push('# CITATIONS DIRECTES RELEVÉES');
  for (const s of sources) {
    for (const c of (s.citations || []).slice(0, 4)) L.push(`- [${s.id}] « ${c.texte} »`);
  }

  return L.join('\n');
}

/* ------------------------------------------------------- bras B : les textes */

/** Le témoin : les articles, sans relevé, sans grappes, sans silences. */
export function promptDepuisTextes({ meta, sources }) {
  const L = [];
  L.push('# QUESTION');
  L.push(`Question : ${meta.question}`);
  L.push(`Périmètre : ${meta.perimetre}`);
  L.push(`Horizon : ${meta.horizon}`);
  L.push(`Décision sous-jacente : ${meta.decision}`, '');
  L.push('# ARTICLES');
  for (const s of sources) {
    L.push(`## [${s.id}] ${s.titre || '(sans titre)'} — ${s.editeur} — ${(s.datePubliee || '').slice(0, 10)}`);
    L.push(s.texte || '(corps non extrait)', '');
  }
  return L.join('\n');
}

function extraitCourt(texte, phrases = 5) {
  if (!texte) return '(corps non extrait)';
  return texte.split(/(?<=[.!?])\s+/).slice(0, phrases).join(' ');
}

/* ---------------------------------------------------------- validation */

/**
 * Vérifie la sortie du modèle avant affichage. Ce qui viole une règle n'est pas
 * corrigé : c'est écarté et déclaré. Réparer silencieusement une sortie
 * interdite reviendrait à laisser le modèle contourner la règle par la bande —
 * même principe que validerCategories() dans Sentinelle.
 *
 * @returns {{blocs:object, ecartees:Array}}
 */
export function validerLecture(brut) {
  const blocs = {};
  const ecartees = [];
  const attendus = ['situation', 'analyse', 'jugement', 'surveillance'];

  for (const nom of attendus) {
    blocs[nom] = [];
    for (const item of [].concat(brut?.[nom] ?? [])) {
      const texte = String(item?.texte ?? '').trim();
      const registre = String(item?.registre ?? '').toLowerCase();

      if (!texte) { ecartees.push({ bloc: nom, item, raison: 'texte vide' }); continue; }
      if (!REGISTRES.includes(registre)) {
        ecartees.push({ bloc: nom, item, raison: `registre inconnu : ${item?.registre}` });
        continue;
      }
      // Interdits repris du skill.
      //
      // Pas de \b autour de ces motifs : « 100 % » se termine par un caractère
      // non alphanumérique, et « à coup sûr » commence par un caractère
      // non-ASCII. Dans les deux cas \b ne trouve aucune frontière et la règle
      // ne s'appliquait jamais — un garde-fou qui ne se déclenche pas est pire
      // qu'un garde-fou absent, parce qu'on croit l'avoir.
      if (CERTITUDES.some((re) => re.test(texte))) {
        ecartees.push({ bloc: nom, item, raison: 'certitude ou probabilité de 0 ou 1' });
        continue;
      }
      if (registre === 'affirme' && !(item.sources || []).length) {
        ecartees.push({ bloc: nom, item, raison: 'registre « affirme » sans source citée' });
        continue;
      }
      blocs[nom].push({
        registre, texte,
        sources: (item.sources || []).map(String),
        indicateur: item.indicateur ? String(item.indicateur) : null,
      });
    }
  }
  return { blocs, ecartees };
}

/** Les identifiants cités par le modèle qui n'existent pas dans le corpus.
 *  Une source inventée est le signal le plus net d'une lecture décorative. */
export function sourcesInventees(blocs, idsConnus) {
  const connus = new Set(idsConnus);
  const out = new Set();
  for (const items of Object.values(blocs)) {
    for (const i of items) for (const s of i.sources || []) if (!connus.has(s)) out.add(s);
  }
  return [...out].sort();
}
