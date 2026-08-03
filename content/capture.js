// capture.js — script de contenu, injecté à la demande par la barre latérale.
//
// Il ne fait qu'une chose : rendre le HTML de la page TELLE QU'ELLE EST À
// L'ÉCRAN, rendu JavaScript compris. L'extraction elle-même tourne dans la
// barre latérale, qui est une page d'extension : modules ES disponibles, et
// aucun code de Constat n'est exposé à la page visitée.
//
// Ne pas remplacer par un fetch de l'URL : ce qui doit être versé est ce que
// l'utilisateur a lu, pas ce que le serveur renverrait à une seconde requête.
//
// La valeur du fichier est celle de sa dernière expression. L'IIFE la rend
// explicite plutôt que de dépendre de la façon dont un littéral objet en
// position d'instruction est évalué.
(() => ({
  url: location.href,
  titre: document.title,
  pret: document.readyState,
  html: document.documentElement ? document.documentElement.outerHTML : '',
}))();
