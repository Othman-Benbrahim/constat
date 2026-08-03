# 🧠 Biais cognitifs et contre-mesures

> *« Le premier ennemi de l'analyste, c'est lui-même. »*
>
> Ce module recense les biais cognitifs qui menacent une analyse OSINT, et propose des **contre-mesures opérationnelles** à appliquer avant toute livraison.

---

## Pourquoi les biais sont particulièrement dangereux dans le renseignement

Quatre facteurs aggravent le poids des biais en analyse OSINT par rapport à d'autres disciplines :

1. **L'information est incomplète** — l'esprit comble les trous avec ses propres croyances.
2. **Les situations sont ambiguës** — le biais pousse à voir des patterns même là où il n'y en a pas.
3. **Le temps est limité** — la pression force à utiliser des raccourcis mentaux.
4. **L'enjeu est élevé** — le stress amplifie systématiquement les erreurs.

Les biais ne sont **pas des fautes morales** — ce sont des **fonctionnements normaux** du cerveau humain. La discipline analytique consiste non à les éliminer (impossible), mais à les **détecter** et les **compenser** par des méthodes structurelles.

---

## Inventaire des biais critiques

### 1. **Biais de confirmation**

> *Tendance à chercher, mémoriser et privilégier les informations qui confirment l'hypothèse déjà préférée.*

**Le plus dangereux de tous.** Il est sournois parce qu'il se déguise en rigueur (*« je ne fais que confirmer ce que je voyais déjà »*).

**Signes :**
- L'analyste cite essentiellement les sources qui vont dans son sens.
- Les sources contradictoires sont écartées comme *« non fiables »*, sans véritable examen.
- L'analyste se sent de plus en plus *« sûr »* à mesure qu'il accumule des éléments compatibles.

**Contre-mesures :**
- Avant de conclure, **rechercher activement** les preuves qui contredisent l'hypothèse.
- Méthode ACH (détaillée plus bas).
- Demander à un tiers (ou simuler une équipe rouge) de **défendre l'hypothèse opposée**.

---

### 2. **Biais d'ancrage**

> *La première information ou estimation reçue devient un point d'ancrage mental qui pèse de façon disproportionnée sur les jugements suivants.*

**Signes :**
- La première hypothèse formulée reste centrale même après que des données contraires soient apparues.
- Les estimations chiffrées dérivent autour d'un premier chiffre cité, même s'il était arbitraire.
- L'analyse "ajuste" plutôt que de **reconsidérer**.

**Contre-mesures :**
- Faire l'analyse **deux fois**, en commençant la seconde par une hypothèse opposée.
- Formuler les estimations chiffrées **sans regarder** les ordres de grandeur déjà cités.
- Utiliser plusieurs sources pour les premières informations, pas une seule.

---

### 3. **Heuristique de disponibilité**

> *La probabilité d'un événement est estimée à partir de la facilité avec laquelle un exemple vient à l'esprit.*

**Signes :**
- Un événement récent et médiatisé fait surestimer la probabilité d'événements similaires.
- Un événement personnel ou frappant fait surestimer son occurrence générale.
- Les événements rares mais médiatiques (attentats, crashes) dominent l'évaluation au détriment des événements fréquents mais discrets.

**Contre-mesures :**
- S'appuyer sur des **données de base** (fréquences historiques) plutôt que sur des exemples saillants.
- Distinguer *« combien j'en ai entendu parler »* de *« combien il y en a réellement »*.
- Inclure systématiquement des **statistiques structurelles** quand elles existent.

---

### 4. **Excès de confiance**

> *Surestimation systématique de la précision de ses propres jugements.*

Particulièrement présent chez les analystes expérimentés, qui se croient *immunisés* contre les biais — ce qui est en soi un biais.

**Signes :**
- Niveau de confiance affiché supérieur à ce que les données soutiennent.
- Disparition des conditioning statements (*« sauf si... »*, *« sous réserve de... »*).
- Disparition des hypothèses alternatives au profit d'une *« seule lecture cohérente »*.

**Contre-mesures :**
- Toujours afficher un **niveau de confiance** explicite (faible / modéré / élevé).
- Toujours formuler **ce qui pourrait invalider l'analyse**.
- Calibrer ses confiances : tenir un journal des prédictions et vérifier ex post si les *« 70% »* ont effectivement réussi 7 fois sur 10.

---

### 5. **Pensée de groupe (Groupthink)**

> *Dans une équipe ou un milieu, le désir de consensus l'emporte sur l'évaluation critique des alternatives.*

**Signes :**
- Auto-censure des opinions divergentes.
- Pression sur les dissidents pour qu'ils s'alignent.
- Sentiment d'invulnérabilité collective.
- Stéréotypisation des acteurs extérieurs ou opposés.

**Contre-mesures :**
- **Devil's Advocacy** institutionnalisé : désigner explicitement quelqu'un (ou simuler un agent interne) pour défendre la position opposée.
- **Red Team** : équipe distincte chargée de démolir l'analyse.
- Pratiquer la **dissensus tolerance** : accepter qu'un livrable mentionne des désaccords analytiques.

---

### 6. **Effet miroir (Mirror-Imaging)**

> *Croire que l'adversaire, l'autre acteur, ou le sujet d'étude pense, raisonne, valorise comme nous.*

**Très répandu** en analyse de cultures étrangères, de mouvements politiques opposés, d'acteurs criminels ou hostiles.

**Signes :**
- *« Il ne fera pas X parce que ce serait irrationnel »* — selon notre rationalité, pas la sienne.
- Sous-estimation systématique des engagements idéologiques, religieux, identitaires de l'autre.
- Projection de nos catégories morales sur des acteurs qui ne les partagent pas.

**Contre-mesures :**
- Toujours se demander : *« quelle est la rationalité interne de cet acteur, dans son propre référentiel ? »*
- Mobiliser des **analystes culturellement proches** de l'acteur étudié, ou des sources qui parlent depuis ce référentiel.
- Distinguer **ce que je trouverais rationnel** et **ce qui est rationnel pour lui**.

---

### 7. **Biais de récence**

> *Surinvestissement des événements récents au détriment de l'historique.*

**Signes :**
- L'analyse mobilise essentiellement des données des dernières semaines.
- Les tendances longues sont éclipsées par des soubresauts courts.
- Une discontinuité récente est interprétée comme rupture structurelle alors qu'elle peut être anecdotique.

**Contre-mesures :**
- Inclure systématiquement une **profondeur historique** dans l'analyse (1 an minimum, souvent 5 ans, parfois plus).
- Distinguer **événement** et **tendance** par leur durée et leur récurrence.
- Vérifier si la *« nouveauté »* observée est effectivement nouvelle ou si elle s'est déjà produite.

---

### 8. **Satisficing** (suffisance prématurée)

> *Acceptation de la première explication « satisfaisante » sans explorer les alternatives.*

**Signes :**
- L'analyse s'arrête dès qu'une hypothèse plausible est trouvée.
- Le test d'autres hypothèses est superficiel ou absent.
- *« Ça tient, donc c'est ça. »*

**Contre-mesures :**
- Méthode ACH (Analysis of Competing Hypotheses) — voir plus bas.
- Règle minimale : **toujours formuler au moins 3 hypothèses** avant de conclure.
- Forcer la question : *« quelle autre explication, structurellement différente, est compatible avec ces faits ? »*

---

### 9. **Biais d'attribution**

> *Tendance à expliquer les actions des autres par leur caractère, et nos propres actions par les circonstances.*

**Signes :**
- *« Ils ont fait X parce qu'ils sont [agressifs, irrationnels, manipulateurs] »* — alors qu'on expliquerait notre action similaire par le contexte.
- Sur-attribution d'intentions stratégiques à des comportements qui peuvent être réactifs ou accidentels.

**Contre-mesures :**
- Pour chaque action d'un acteur, formuler **deux explications** : une par caractère, une par circonstances.
- Tester laquelle est mieux soutenue par les faits.

---

### 10. **Biais de représentativité**

> *Évaluation de la probabilité d'un événement par sa similarité avec une catégorie connue, en négligeant les probabilités de base.*

**Signes :**
- Un acteur ressemble à un type connu → on lui prête tous les comportements de ce type.
- Une situation rappelle un précédent → on extrapole l'issue du précédent.

**Contre-mesures :**
- Toujours combiner la **ressemblance** avec la **probabilité de base** (combien d'acteurs similaires ont effectivement adopté ce comportement ?).
- Méfiance avec les analogies historiques mécaniques.

---

## Méthode ACH — Analysis of Competing Hypotheses

Méthode structurée pour combattre simultanément le biais de confirmation, le satisficing et l'ancrage.

### Procédure

**Étape 1.** Énumérer **toutes** les hypothèses raisonnablement envisageables (viser 4-7).

**Étape 2.** Lister **toutes les preuves significatives** disponibles.

**Étape 3.** Construire une matrice :

|  | H1 | H2 | H3 | H4 |
|---|---|---|---|---|
| Preuve A | C | I | C | N |
| Preuve B | I | C | C | C |
| Preuve C | N | N | I | C |
| Preuve D | C | C | N | I |

Où :
- **C** = preuve **compatible** avec l'hypothèse,
- **I** = preuve **incompatible**,
- **N** = preuve **neutre**.

**Étape 4.** Évaluation — **l'hypothèse à retenir n'est PAS celle qui a le plus de C, mais celle qui a le moins de I.**

Cette inversion est fondamentale : elle force à raisonner par **falsification** plutôt que par confirmation.

**Étape 5.** Sensibilité — pour chaque preuve clé, se demander : *« si cette preuve s'avère inexacte, comment l'analyse change-t-elle ? »*

### Avantages

- Force à considérer **plusieurs hypothèses** simultanément.
- Rend **explicite** le raisonnement (chaque cellule peut être discutée).
- Identifie les **preuves cruciales** — celles dont la fiabilité conditionne le jugement.
- Produit une **trace défendable** : on peut auditer l'analyse a posteriori.

### Limite

ACH ne traite pas le biais d'ancrage sur la **sélection des hypothèses**. Si on a déjà oublié H5 en formulant la liste, ACH ne le rattrapera pas. D'où l'importance d'efforts spécifiques pour **élargir la liste d'hypothèses** (red team, devil's advocacy, hypothèse fractale).

---

## Red Team / Équipe rouge

### Principe

Désigner une équipe (ou un mode mental distinct) chargée explicitement de **démolir** l'analyse principale.

### Méthode pratique

Avant de livrer l'analyse, l'analyste se met **mentalement** dans la position d'un adversaire intellectuel et s'attaque à son propre travail :

- *« Quelles sont les 3 faiblesses les plus graves de cette analyse ? »*
- *« Sur quelle hypothèse alternative tiendrait le mieux la même base de faits ? »*
- *« Quelle information manquante invaliderait le raisonnement ? »*
- *« Quels biais ai-je probablement laissés passer ? »*

Réécrire l'analyse en intégrant les attaques qui résistent.

---

## Devil's Advocacy

Variante plus modeste mais systématique : avant chaque conclusion importante, **formuler à voix haute (ou par écrit) l'argument opposé** et le considérer sérieusement pendant au moins quelques minutes avant de l'écarter.

> *« Et si c'était l'inverse ? »*

Cette pratique élémentaire désamorce une bonne partie des biais — à condition d'être appliquée de manière disciplinée.

---

## Lecture symbolique inversée

Spécifique à ce skill : la couche 3 (lecture symbolique / fractale) peut elle-même générer des biais (apophénie, plaquage d'archétype). Contre-mesure :

> *« Si je n'avais pas en tête cet archétype, est-ce que je verrais quand même les éléments que j'invoque pour l'étayer ? »*

Et inversement :

> *« Quel archétype concurrent pourrait s'appliquer aux mêmes faits ? »*

Toujours formuler **2 archétypes** candidats minimum quand on active la couche symbolique. Si un seul vient, c'est un signe d'ancrage.

---

## Check-list anti-biais avant livraison

À passer **systématiquement** avant tout livrable analytique :

```
□ Ai-je cherché activement les preuves contraires à mon hypothèse préférée ?
□ Mon ancrage initial a-t-il été remis en cause au cours de l'analyse ?
□ Ai-je formulé au moins 3 hypothèses concurrentes ?
□ Ai-je distingué la rationalité de l'acteur étudié de la mienne ?
□ L'analyse intègre-t-elle une profondeur historique suffisante ?
□ Mon niveau de confiance est-il calibré (pas systématiquement trop élevé) ?
□ Ai-je explicité ce qui pourrait invalider l'analyse ?
□ Ai-je distingué fait / inférence / hypothèse / spéculation ?
□ Une équipe rouge mentale a-t-elle été passée ?
□ Si j'ai mobilisé un archétype, en ai-je testé au moins un autre concurrent ?
```

Si une case reste non cochée, **revenir à l'analyse** avant de livrer.

---

## Le piège méta : se croire immunisé

Le biais ultime est de penser qu'on est *au-dessus* des biais parce qu'on les connaît. Connaître les biais **diminue** mais **n'élimine pas** leur effet. La discipline est dans la **routine** d'application des contre-mesures, pas dans la conscience théorique.

> *Un analyste compétent n'est pas celui qui n'a pas de biais — c'est celui qui les connaît et les combat activement, à chaque livrable.*


