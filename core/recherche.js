// recherche.js — versement par moteur de recherche (piste à l'essai).
//
// STATUT : expérimental. Ce module existe pour être évalué sur pièce, puis
// gardé ou supprimé. Il n'est branché nulle part dans l'extension.
//
// Trois règles qui ne se négocient pas si le relevé doit garder un sens :
//
//  1. `provenance` est un champ du modèle de données. Un corpus assemblé par un
//     moteur et un corpus assemblé par lecture n'ont pas le même biais de
//     sélection. Les mélanger sans le dire rend les comptages ininterprétables.
//
//  2. La date du fournisseur n'est JAMAIS `datePubliee`. Elle va dans
//     `dateFournisseur`. `datePubliee` continue de sortir du balisage de la
//     page. Accepter une date inférée comme date observée, c'est la règle
//     centrale du projet qui tombe.
//
//  3. La requête est archivée telle quelle, avec ses paramètres et les
//     identifiants retournés. Sans ça, la même requête relancée demain donne un
//     autre corpus et le relevé n'est plus rejouable.

export const FOURNISSEUR = {
  nom: 'Exa',
  url: 'https://api.exa.ai/search',
  origine: 'https://api.exa.ai/*',
};

/**
 * Corps de requête. `includeHtmlTags` est demandé parce que sans balisage il
 * n'y a ni JSON-LD, ni guillemets situables, ni liens de corps — et donc plus
 * de détecteurs 1 et 4. Le banc d'essai vérifie si le HTML revient vraiment ;
 * il ne le suppose pas.
 */
export function corpsRequete({
  query, nombre = 10, depuis = null, jusqua = null, ageMaxHeures = null, html = true,
}) {
  const contents = {
    text: html ? { includeHtmlTags: true } : true,
    extras: { links: 20 },
  };
  if (ageMaxHeures !== null) contents.maxAgeHours = ageMaxHeures;

  const corps = { query, type: 'auto', numResults: nombre, contents };
  if (depuis) corps.startPublishedDate = depuis;
  if (jusqua) corps.endPublishedDate = jusqua;
  return corps;
}

export const enTetes = (cle) => ({ 'Content-Type': 'application/json', 'x-api-key': cle });

/** L'entrée de journal qui rend le corpus rejouable. Immuable, comme le reste. */
export function entreeRecherche({ dossier, query, corps, reponse }) {
  return {
    t: 'recherche',
    dossier,
    fournisseur: FOURNISSEUR.nom,
    query,
    parametres: corps,
    requestId: reponse?.requestId || null,
    cout: reponse?.costDollars?.total ?? null,
    resultats: (reponse?.results || []).map((r, rang) => ({ url: r.url, rang: rang + 1 })),
    echecs: (reponse?.statuses || []).filter((s) => s.status !== 'success')
      .map((s) => ({ url: s.id, tag: s.error?.tag, code: s.error?.httpStatusCode })),
  };
}

/**
 * Normalise un résultat en une page prête pour `extraction.extraire()`.
 *
 * On ne fabrique rien : si le champ `text` ne contient pas de balisage, on le
 * dit. C'est au banc d'essai de conclure, pas à ce module de compenser.
 */
export function versPage(resultat, { rang = null } = {}) {
  const brut = String(resultat?.text ?? '');
  const balise = /<\/?(p|div|article|h[1-6]|a|blockquote|script)\b/i.test(brut);

  return {
    url: resultat.url,
    rang,
    provenance: 'recherche',
    // Ce que le moteur affirme. Conservé, jamais promu.
    dateFournisseur: resultat.publishedDate || null,
    auteurFournisseur: resultat.author || null,
    titreFournisseur: resultat.title || null,
    scoreFournisseur: typeof resultat.score === 'number' ? resultat.score : null,
    liensFournisseur: resultat.extras?.links || [],
    // Le contenu, et son état réel.
    html: balise ? brut : null,
    texteBrut: balise ? null : brut,
    baliseur: balise,
  };
}

/**
 * Fusionne l'extraction faite sur le HTML et ce que le moteur affirme.
 *
 * Priorité absolue au balisage de la page. Le moteur ne sert de repli que sur
 * ce qui ne peut pas être extrait, et chaque repli est tracé dans le
 * diagnostic : une source dont la date vient du moteur n'est pas une source
 * datée, c'est une source datée par un tiers.
 */
export function fusionner(page, extraite) {
  const replis = [];
  const titre = extraite.titre || (page.titreFournisseur ? (replis.push('titre'), page.titreFournisseur) : null);
  const auteurs = extraite.auteurs?.length ? extraite.auteurs
    : (page.auteurFournisseur ? (replis.push('auteur'), [page.auteurFournisseur]) : []);

  return {
    ...extraite,
    titre,
    auteurs,
    provenance: 'recherche',
    rang: page.rang,
    // datePubliee reste ce que la page déclare. Jamais celle du moteur.
    datePubliee: extraite.datePubliee,
    dateFournisseur: page.dateFournisseur,
    scoreFournisseur: page.scoreFournisseur,
    diagnostic: {
      ...extraite.diagnostic,
      origineContenu: page.origineContenu || 'moteur',
      balisageRecu: page.baliseur,
      replisFournisseur: replis,
      dateSelonFournisseurSeulement: !extraite.datePubliee && !!page.dateFournisseur,
    },
  };
}

/**
 * Ce que renvoie Exa n'est PAS la page : c'est le contenu extrait par le
 * moteur, sans <head>, donc sans JSON-LD, sans balise <time>, et sans les liens
 * de corps qu'il considère comme de la navigation.
 *
 * Constaté sur un dossier réel de 12 articles : 0 date déclarée par la page,
 * 0 lien de corps. Trois détecteurs sur cinq meurent d'un coup, et pour la
 * même cause.
 *
 * D'où cette séparation : **le moteur découvre, Constat extrait**. On récupère
 * la page à son URL et on lui applique la même extraction qu'à une page lue.
 * Ce qui échoue est déclaré, jamais compensé par la métadonnée du moteur sans
 * le dire.
 */
export function requetePage(url) {
  return {
    type: 'appel-llm',
    methode: 'GET',
    url,
    headers: { Accept: 'text/html,application/xhtml+xml' },
  };
}

/**
 * Verdict de viabilité, calculé sur un lot de sources normalisées.
 *
 * Ce n'est pas une note : ce sont cinq comptages, et chacun décide de la
 * survie d'un détecteur. Si `liensCorps` tombe à zéro, le détecteur 4 est mort
 * quelle que soit la qualité du reste.
 */
export function verdict(sources) {
  const n = sources.length || 1;
  const compte = (f) => sources.filter(f).length;

  return {
    sources: sources.length,
    pagesRecuperees: compte((s) => s.diagnostic?.origineContenu === 'page'),
    contenuMoteur: compte((s) => s.diagnostic?.origineContenu === 'moteur'),
    balisageRecu: compte((s) => s.diagnostic?.balisageRecu),
    corpsExtrait: compte((s) => (s.texte || '').length >= 200),
    avecLiens: compte((s) => (s.liens || []).length > 0),
    avecLienSource: compte((s) => (s.liens || []).some(
      (l) => ['officiel', 'scientifique', 'juridique', 'donnees'].includes(l.nature))),
    avecCitations: compte((s) => (s.citations || []).length > 0),
    datePage: compte((s) => !!s.datePubliee),
    dateFournisseurSeule: compte((s) => s.diagnostic?.dateSelonFournisseurSeulement),
    // Les seuils sont ceux au-dessous desquels un détecteur cesse de dire
    // quelque chose, pas des objectifs de qualité.
    detecteurs: {
      'acteur-non-cite': compte((s) => (s.citations || []).length > 0) / n >= 0.5,
      'article-sans-source': compte((s) => (s.liens || []).length > 0) / n >= 0.5,
      'trou-dossier': compte((s) => !!s.datePubliee) / n >= 0.7,
      'terme-effondre': compte((s) => !!s.datePubliee) / n >= 0.7,
      'grappe-origine-unique': compte((s) => (s.texte || '').length >= 200) / n >= 0.5,
    },
  };
}
