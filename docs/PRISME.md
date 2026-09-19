# Constat → PRISME : verser une hypothèse ACH

Constat garde son architecture Firefox : calculs et contrat dans `core/`, transport
réseau dans `background/`, rendu et formulaires dans `sidebar/`. Aucun serveur ni
paquet d'exécution ajouté à l'extension. Le classement ACH ne devient pas une
probabilité ; le relevé déterministe n'est pas modifié.

Le bouton livre la troisième pièce de la décision PRISME 0031. E11 est son prérequis.
Les scores appartiennent au plugin PRISME de calibration (0025), livré séparément.
Le plugin active les bornes du monde (0026) ; l'extension ne les devine pas.

## Utiliser

1. Lancer PRISME, avec E11 fusionnée. Dans **Agents**, créer une clé nommée Constat,
   avec **lecture** et **proposition** seulement. Aucun droit d'écriture nécessaire.
2. Dans Firefox, recharger l'extension temporaire via `about:debugging`,
   « Ce Firefox », puis recharger Constat (ou charger son `manifest.json`).
3. Ouvrir le panneau Constat, **PRISME…**, saisir l'adresse locale (par défaut
   `http://127.0.0.1:5000`) et la clé, puis **Tester et enregistrer la connexion**.
   Autoriser l'hôte local si Firefox le demande. Seuls localhost et 127.0.0.1 en
   HTTP sont acceptés, sans chemin ni identifiants dans l'adresse.
4. Dans un dossier actif, achever et valider l'étape ACH 5. Chaque hypothèse offre
   **Verser comme prédiction dans PRISME**. Les étapes incomplètes/non validées
   n'offrent pas ce bouton.
5. Relire le titre et l'événement préremplis depuis l'hypothèse ; saisir soi-même
   probabilité (0 à 1), date butoir et condition vérifiable de résolution. Ces
   trois champs commencent vides. Le domaine est facultatif.
6. **Déposer dans la file PRISME**. Relire ensuite la proposition dans PRISME et
   l'accepter : avant cette acceptation, aucun objet n'est créé dans le vault.
7. Pour scorer ce pari, ouvrir **Calibration** dans PRISME et confirmer sa copie
   avant le jour de son échéance et avant de connaître le résultat. Les bornes du
   monde sont renseignées à cette étape ; elles ne remplacent pas la date butoir.

Sans mémorisation, la clé reste en mémoire pendant l'ouverture du panneau.
La case **Mémoriser** est décochée par défaut. La cocher enregistre la clé dans
`browser.storage.local`, non chiffrée, comme indiqué à l'écran. Décocher puis tester
une connexion valide retire la copie persistée. La clé ne va ni dans le dossier
ni dans ses exports. Elle voyage uniquement dans l'en-tête d'une requête locale.
Les redirections sont refusées pour éviter de l'envoyer à une autre destination.

Le journal du dossier conserve la proposition, sa destination, sa clé de file
(ce n'est pas une clé d'authentification), la révision ACH et l'hypothèse source.
Le corpus et la révision sont revérifiés avant l'envoi. Un dossier clos ou un ACH
remplacé exige de rouvrir le formulaire depuis la version actuelle.
Une proposition identique déjà envoyée à cette adresse est bloquée localement.
Une réponse perdue n'est jamais relancée automatiquement : vérifier la file PRISME
avant toute nouvelle tentative. Cette trace locale ne suit pas les rejets ultérieurs
dans PRISME ; une proposition révisée doit avoir un titre distinct si nécessaire.

## Vérification avant fusion

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm test
python outils/verifier-prisme.py --depot "D:\Documents\PRISME\PRISME-depot"
```

Résultat de préparation : **170 tests Node réussis**, dont 14 tests de cette intégration.
Le banc Python lance un PRISME temporaire sur un port local libre et emploie le vrai
contrat et le relais JavaScript Constat pour ping, catalogue et proposition HTTP.
Il vérifie l'absence de note avant acceptation, puis simule l'acceptation humaine.
Profil et vault de test sont isolés. Aucun modèle n'est appelé.

**Parcours visuel Firefox à effectuer dans un dossier d'essai :**

1. Panneau étroit : vérifier défilement, libellés, largeur de case à cocher et
   fermeture des réglages. Les boutons existants et la navigation restent utilisables.
2. ACH non validée : pas de bouton de versement. Après validation : bouton sous
   chaque hypothèse, référence et éléments qui la réfuteraient visibles.
3. Ouverture : les trois champs du pari sont vides. Annuler puis rouvrir ne verse rien.
4. Tester la connexion et l'autorisation d'hôte, puis un refus d'autorisation,
   une mauvaise clé et PRISME arrêté : erreur explicite, saisies conservées.
5. Envoyer un pari à 0,8 ; cliquer deux fois rapidement. Une proposition en file,
   aucun objet créé. Vérifier dans PRISME titre, champs, contexte ACH et provenance.
6. Accepter dans PRISME, copier le pari depuis Calibration, puis le résoudre dans
   le scénario d'essai. Vérifier le score côté PRISME, sans score ajouté à Constat.
7. Changer le corpus ou clore le dossier pendant un formulaire ouvert : envoi refusé.
8. Fermer/réouvrir le panneau avec mémorisation décochée : clé absente. Tester
   séparément la mémorisation volontaire puis son retrait.
9. Console Firefox : absence d'erreur CSP, de permission et de clé dans les traces.

Les tests de DOM passent, mais **Firefox réel et PowerShell n'ont pas été exécutés
ici**. Le navigateur local est indisponible et le navigateur distant refuse localhost.
La PR doit rester en revue jusqu'à ce parcours. Aucun essai avec le vrai dossier
ou le vault de l'auteur n'est revendiqué.

## Fichiers et limites

Ajouts : `core/prisme.js`, `background/prisme.js`, `sidebar/prisme.js`,
`sidebar/prisme-transport.js`, `test/prisme.test.mjs`, ce guide et le banc HTTP.
Modifications : liste des scripts du manifeste, branchement du relais, rendu ACH,
panneau et styles, README. `package-lock.json` fixe les dépendances de test existantes.
Pas de migration des dossiers, pas de nouvelle dépendance d'exécution.
Pas de brouillon différé persistant, de synchronisation des scores ou d'acceptation
automatique. E9 de PRISME reste une étape distincte.
