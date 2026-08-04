# Constat

Extension Firefox qui instruit une question de renseignement à partir des pages
que vous lisez.

> Ouvrez un dossier sur une question, versez-y les articles au fil de votre
> navigation, obtenez un relevé de ce que le corpus contient — et de ce qu'il
> tait — puis une lecture analytique que vous pouvez contester étape par étape.

Aucun compte, aucun serveur, aucune collecte automatique. Les seuls appels
réseau sortants sont ceux que vous déclenchez, vers le fournisseur de modèle et
le moteur de recherche de votre choix, avec vos propres clés.

---

## Le principe : deux registres, jamais fusionnés

C'est la contrainte centrale du projet, et elle est visible à l'écran comme
dans les exports.

| | **Registre A — Relevé** | **Registre B — Lecture** |
|---|---|---|
| Produit par | du comptage local | un modèle de langage, en BYOK |
| Reproductible | oui, à version d'outil égale | non, horodaté et rejouable |
| Contient des chiffres | oui, tous justifiés | aucun qui lui soit propre |

> **Aucun nombre produit par le modèle n'entre dans un relevé.
> Un relevé sans modèle est un relevé complet.**

Règle héritée de [Sentinelle](https://github.com/Othman-Benbrahim/sentinelle),
conservée mot pour mot.

Conséquence pratique : le modèle ne conclut jamais à la place de l'outil. Il
remplit une matrice ACH, l'outil calcule le classement. Il donne une probabilité
et un impact, l'outil croise le niveau de risque. Un rang ou un niveau annoncé
par le modèle est écrasé.

---

## Ce que l'outil compte

### Corroboration

Combien de sources, combien d'éditeurs, combien de grappes — et surtout
**combien de comptes rendus réellement distincts**. Dix-huit articles ne font
pas dix-huit confirmations.

Les quasi-doublons sont détectés sur le **corps de l'article**, pas sur le
titre : une dépêche reprise par neuf éditeurs qui réécrivent tous le titre n'est
détectable que par le texte. Deux régimes de certitude, jamais confondus :

- **SHA-256 identiques** → reprise à l'identique, *constatée* ;
- **recouvrement de séquences de 4 mots** → dérivation *mesurée*, affichée en
  pourcentage (« 94 % des séquences de 4 mots de cet article se retrouvent dans
  celui du 14/02 » est vérifiable par le lecteur ; « 4 bits sur 64 » ne l'est
  pas).

### Les silences — la fonction distinctive

Cinq absences, chacune adossée à un comptage affichable :

1. **acteur nommé, jamais cité entre guillemets** ;
2. **terme dont la fréquence s'effondre** sans qu'aucun article ne porte le
   terme accompagné d'un marqueur d'abandon ;
3. **trou dans le dossier** — une fenêtre vide dans un corpus par ailleurs
   dense ;
4. **article ne liant aucun document source** (officiel, scientifique,
   juridique, jeu de données) ;
5. **grappe ne remontant qu'à une origine**.

Chaque chiffre s'ouvre d'un clic sur le comptage qui l'a produit. Rien n'est un
score, rien n'est une note.

### « Non calculé » n'est pas « zéro »

Un détecteur qui n'a pas pu tourner le déclare, avec son motif et ses chiffres,
au lieu d'afficher `0`. Un zéro se lit « aucune absence » ; une population vide
se lit « la question n'a pas pu être posée ». Les confondre produit un résultat
là où il n'y a qu'un corpus trop mince.

Un compteur de contrôle accompagne chaque constat pour la même raison : sans
« 312 citations attribuées relevées », l'énoncé « 3 acteurs jamais cités » est
indistinguable d'un détecteur de citations en panne.

---

## Deux façons de remplir un dossier

### Par lecture

Un bouton, ou le menu contextuel, sur la page que vous consultez. Rien n'est
re-téléchargé : ce qui est versé est ce que vous avez lu, DOM rendu compris. La
permission d'hôte est demandée à ce moment, pour la seule origine concernée.

### Par recherche

Une requête envoyée à [Exa](https://exa.ai) avec votre clé. **Le moteur découvre
les URL, Constat lit les pages.** Cette séparation n'est pas un détail
d'implémentation : le contenu renvoyé par un moteur est du texte extrait, sans
`<head>` — donc sans JSON-LD, sans balise `<time>`, et sans les liens de corps
qu'il prend pour de la navigation. Constaté sur un dossier réel de douze
articles : zéro date déclarée, zéro lien, trois détecteurs morts d'un coup.
Constat récupère donc chaque page à son URL et lui applique la même extraction
qu'à une page lue.

Cela demande la permission d'accès aux sites, annoncée dans le formulaire et
demandée au premier lancement. Si vous la refusez, la recherche fonctionne en
repli sur le contenu du moteur — et le verdict affiche combien de sources sont
dans ce cas.

### Les deux populations ne se mélangent pas

`provenance` est un champ du modèle de données. Dès que les deux coexistent, les
cinq comptages sont calculés **trois fois** : sur le total, sur la lecture
seule, sur la recherche seule. L'export sort un tableau à deux colonnes.

Ce n'est pas de la présentation. Un terme présent dans votre requête ne peut pas
s'effondrer, puisqu'il conditionne l'appartenance au corpus ; et un trou dans la
colonne « recherche » dit ce que le moteur n'a pas indexé, pas ce que la presse
n'a pas publié. Les fusionner produirait un chiffre juste sur un objet qui
n'existe pas.

La date renvoyée par le moteur n'est **jamais** promue en date de publication.
Elle reste dans `dateFournisseur`, et le repli est tracé dans le diagnostic.

---

## Le pipeline OSINT

Transposition du skill `osint-intel`. Une étape = un bouton = un appel, recevant
la sortie **validée par vous** de l'étape précédente. Jamais les onze étapes en
un seul appel : la méthode fonctionne en conversation parce qu'on peut contester
une étape et reprendre.

| | Étape | Registre |
|---|---|---|
| 1 | Question d'intelligence | saisie |
| 2 | Cotation des sources (Admiralty A–F × 1–6) | saisie, jamais déduite |
| 3 | Structuration | **A** — déterministe |
| 4 | Analyse triple | B |
| 5 | Hypothèses concurrentes (ACH) | B, classement calculé |
| 6 | Production analytique | **A** — assemblage, BLUF dérivé |
| 7 | Scénarios prospectifs | B |
| 8 | Évaluation du risque | B, niveau croisé par l'outil |
| 9 | Recommandations actionnables | B |
| 10 | Contrôle des biais | B |
| 11 | Boucle de rétroaction | B |

Les onze fichiers de référence du skill sont embarqués et **chargés
conditionnellement** : seule celle de l'étape lancée entre dans le prompt.

### Ce qui est refusé, et jamais réparé

Une sortie qui viole une règle est écartée et affichée comme telle, avec son
motif. La réparer silencieusement laisserait le modèle contourner la règle par
la bande.

- une hypothèse sans indicateur de réfutation — elle n'est pas testable ;
- une case de matrice ACH manquante — la combler fausserait le classement ;
- un scénario sans indicateur de bascule observable — c'est une histoire ;
- une évaluation de risque sans conditionnement — c'est une prophétie ;
- une lecture symbolique sans appui factuel — c'est un archétype plaqué ;
- « suivre attentivement la situation », « renforcer la coopération » ;
- une recommandation visant un tiers plutôt que le porteur de la décision ;
- « l'avenir nous le dira » en clôture ;
- toute probabilité de 0 ou de 1.

Les sources citées par le modèle qui n'existent pas dans le corpus sont listées
à part : c'est le signal le plus net d'une lecture décorative.

---

## Installation

Firefox **140** ou plus récent (bureau).

```
about:debugging → Ce Firefox → Charger un module temporaire → manifest.json
```

La contrainte de version vient de `data_collection_permissions` : la déclaration
intégrée des données transmises n'est reconnue qu'à partir de Firefox 140. Sur
une version antérieure, Firefox ignore la clé et affiche un avertissement au
chargement — la déclaration serait alors invisible pour l'utilisateur, ce qui
revient à ne pas la faire.

L'extension n'est pas encore sur addons.mozilla.org.

### Permissions et données

| Permission | Pourquoi |
|---|---|
| `storage`, `unlimitedStorage` | les dossiers, en local |
| `tabs` | connaître la page à verser |
| `scripting` | lire la page **au moment où vous cliquez** |
| `menus`, `downloads` | menu contextuel, export |
| hôte de la page | demandé **au versement**, pour la seule origine concernée |
| `*://*/*` | facultatif, demandé **au premier usage de la recherche**, pour lire les pages trouvées |

Jamais `<all_urls>` à l'installation. Aucune collecte en arrière-plan.

**`storage.local` n'est pas chiffré.** Les dossiers sont enregistrés en clair
dans votre profil Firefox ; toute personne y ayant accès peut les lire. Le
chiffrement porte sur le **fichier exporté** (AES-GCM 256, clé dérivée en
PBKDF2-SHA256, 600 000 itérations), là où il y a un modèle de menace réel.
Passphrase saisie à l'export, jamais conservée : la perdre, c'est perdre un
fichier, pas le dossier.

Deux types de données sont déclarés dans
`browser_specific_settings.gecko.data_collection_permissions` :

- **`websiteContent`** — le contenu des pages versées, transmis au fournisseur
  de modèle lors d'une lecture ou d'une étape ;
- **`authenticationInfo`** — vos clés d'API, transmises aux services que vous
  avez choisis.

Les deux sont déclarés **requis** plutôt qu'optionnels. La couche déterministe
fonctionne sans rien transmettre, et on aurait pu n'annoncer ces données qu'au
moment de configurer un modèle. Mais annoncer une capacité au moment où on s'en
sert, c'est l'annoncer trop tard pour qu'elle pèse dans la décision d'installer.

### BYOK

Modèle : Anthropic, OpenAI, Google, Mistral, ou toute API compatible OpenAI, y
compris locale (Ollama, LM Studio). Recherche : Exa. Clés stockées localement,
mémorisation facultative, jamais transmises ailleurs qu'au service choisi.
**Le coût maximal estimé s'affiche avant chaque appel**, avec la date
d'établissement des tarifs et la mention de l'approximation employée.

---

## Développement

```bash
npm install     # linkedom, dépendance de test uniquement
npm test        # 156 tests, node --test, sans réseau ni navigateur
```

L'extension elle-même n'a **aucune dépendance**.

```
core/           16 modules, aucun ne connaît le navigateur ni le réseau
  extraction.js   corps, liens, citations, métadonnées, diagnostic
  entites.js      entités nommées, désélision, fusion des variantes
  empreinte.js    SHA-256 · recouvrement de shingles · SimHash
  cluster.js      grappes par preuve de texte, repli sur titre
  silences.js     les cinq absences
  releve.js       corroboration · chronologie · lexique · contradictions
  cotation.js     Admiralty (étape 2)
  rapport.js      assemblage du livrable (étape 6)
  etapes.js       pipeline, prompts, validation stricte
  prompt.js       les deux prompts concurrents
  llm.js          fournisseurs BYOK, estimation de coût
  recherche.js    versement par moteur, verdict de viabilité
  dossier.js      journal append-only
  export.js       JSON · Markdown · chiffrement
  stockage.js     adaptateur browser.storage.local
  normalize.js    repris verbatim de Sentinelle
sidebar/        panneau, rendu, style
background/     menu contextuel, relais réseau
content/        capture de la page
references/     les 11 fichiers du skill osint-intel
outils/
  calibrer.mjs    mesure du seuil de recouvrement sur un corpus réel
  demo.mjs        la chaîne complète sur un corpus fabriqué
  essai-exa.mjs   banc d'essai du versement par moteur, hors extension
```

### Réseau

Tous les appels sortants passent par l'arrière-plan, jamais par le panneau : une
page d'extension subit le CORS comme n'importe quelle page, et c'est
l'arrière-plan qui détient les permissions d'hôte. Le canal est un **port** et
non un message, pour deux raisons distinctes — l'ouverture réveille l'event page
non persistante, et la garder ouverte l'empêche d'être terminée pendant un appel
d'une minute.

### Rejouabilité

Le journal est **append-only** : une révision est une nouvelle entrée, jamais
une réécriture. Chaque relevé enregistre les identifiants des sources qu'il a
consommées, l'empreinte du corpus, la version d'outil et les seuils effectifs.
Chaque recherche enregistre sa requête, ses paramètres, son `requestId`, le rang
de chaque résultat et les échecs de crawl. Un relevé ancien est donc rejouable à
l'identique, même après ajout de nouvelles sources.

Si la version d'outil a changé, le rejeu donne un résultat **différent**, et
c'est correct : l'écart s'affiche au lieu d'être masqué.

---

## Limites connues

Elles sont dans le README parce qu'elles sont dans le code, pas l'inverse.

- **Tout est calibré pour le français.** Lexique d'institutions, marqueurs
  d'abandon, verbes d'attribution, règles de désélision. Sur un corpus
  anglophone, la reconnaissance d'entités dérive — les noms de mois et de jours
  remontent comme acteurs.
- **Le seuil de recouvrement (0,60) n'est pas établi.** Il vient de textes
  synthétiques. `node outils/calibrer.mjs corpus/` sort la distribution des
  paires et les dix plus fortes à juger à la main. Si les deux populations ne se
  séparent pas, c'est que le seuil n'existe pas — et il faut le dire dans le
  relevé plutôt que d'en choisir un.
- **La reconnaissance d'entités est un lexique et des règles de
  capitalisation**, sans modèle. Le seuil de trois articles écarte le bruit
  isolé, pas le bruit récurrent.
- **Les entités d'un seul mot sont exclues du détecteur « jamais cité ».** Gaza,
  Brent, Khasab sont des entités nommées légitimes mais pas des acteurs, et
  rien ici ne permet de les distinguer sans modèle. Le comptage des exclusions
  est affiché.
- **L'appariement des contradictions** prend le nom signifiant le plus proche à
  gauche du nombre. C'est grossier, d'où l'affichage des extraits.
- **Un live blog est traité comme un article unique**, avec une date unique.
- **Les pages rendues côté client** ou derrière un mur de consentement
  échouent à la relecture par recherche. La source est enregistrée avec son
  échec plutôt que d'être écartée.
- **La couche modèle n'est pas testable** ; seule la couche déterministe l'est.

---

## Ce que Constat ne fait pas

- aucune collecte automatique, aucun flux RSS — c'est
  [Sentinelle](https://github.com/Othman-Benbrahim/sentinelle), projet distinct ;
- aucune reconstruction de chaîne de provenance : l'arête « cite » est absente
  du HTML de la presse française ;
- aucun compte, aucun serveur, aucune télémétrie.

---

## Licence

AGPL-3.0-only.
