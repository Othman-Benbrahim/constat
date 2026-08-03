# ⚠️ Matrice de risque — Probabilité × Impact

> Ce module détaille la construction d'une **évaluation du risque** rigoureuse, défendable, et utile à la décision. Il intervient à l'**Étape 8** du workflow.

---

## Principe fondamental

L'évaluation du risque transforme une analyse en outil de **priorisation**. Sans elle, le décideur reçoit un panorama mais pas de hiérarchie ; il ne sait pas par où commencer.

### Formule de base

```
Risque = Probabilité × Impact
```

Cette formule, malgré sa simplicité, est puissante : elle force à séparer ce qu'on confond souvent.

- Un événement **très probable mais peu grave** = risque modéré.
- Un événement **improbable mais catastrophique** = risque élevé.
- Un événement **probable et grave** = priorité absolue.

### Pourquoi cette séparation est cruciale

L'émotion humaine pèse beaucoup plus sur l'**impact** que sur la **probabilité**. Sans discipline méthodique, les décideurs et les analystes :

- surestiment les risques spectaculaires (terrorisme, catastrophes médiatisées) ;
- sous-estiment les risques diffus (érosion lente, fragilités structurelles).

La matrice corrige cette asymétrie.

---

## Décomposition fine

Le risque est rarement réductible à une seule équation. Quatre composants à examiner :

### 1. **Menace**

> *Qui veut nous nuire (ou nuire au système analysé) ? Avec quelles capacités, ressources, intentions ?*

Formule analytique :

```
Menace = Intention × Capacité × Ressources
```

- **Intention** : volonté manifeste ou inférée de causer un préjudice.
- **Capacité** : compétences, expertise, savoir-faire opérationnels.
- **Ressources** : moyens humains, financiers, matériels, technologiques.

Une menace **n'existe que si les trois composants sont présents**. Une intention sans capacité reste un vœu ; une capacité sans intention reste un potentiel inactivé.

### 2. **Vulnérabilité**

> *Où la cible (personne, organisation, système, territoire) est-elle exposée ?*

Types de vulnérabilités à considérer :

- **Physiques** — accès, sécurité périmétrique, redondance des infrastructures.
- **Humaines** — formation du personnel, fidélisation, fiabilité des accès.
- **Logistiques** — chaînes d'approvisionnement, dépendances critiques.
- **Numériques** — surface d'attaque, posture cyber, gestion des accès.
- **Informationnelles** — exposition médiatique, gestion de la communication.
- **Juridiques** — failles réglementaires exploitables.
- **Symboliques** — image, légitimité, narratif.

Une vulnérabilité est **toujours relative à une menace** : un château fort est vulnérable à une attaque cyber, pas à une horde médiévale.

### 3. **Probabilité**

> *Quelle est la chance que l'événement se produise dans l'horizon considéré ?*

Trois approches selon la nature du sujet :

- **Qualitative** : faible / modérée / élevée — la plus courante en OSINT, faute de données statistiques.
- **Semi-quantitative** : fourchettes (10-30%, 30-50%...) — utile pour communiquer un ordre de grandeur.
- **Quantitative** : valeur précise — rarement justifiable en analyse stratégique, à réserver aux cas où des statistiques solides existent.

**Règle** : ne jamais donner une probabilité à un chiffre près sans pouvoir la défendre rigoureusement. *« 65% »* est presque toujours suspect ; *« 50-70% »* est honnête.

### 4. **Impact / Conséquences**

> *Si l'événement se produit, quelles en sont les conséquences ?*

Dimensions à évaluer :

- **Humain** — pertes, blessés, déplacements, atteintes psychologiques.
- **Économique** — coûts directs, indirects, opportunités perdues.
- **Politique** — déstabilisation, perte de légitimité, transitions forcées.
- **Opérationnel** — interruption de fonctions, dégradation de capacités.
- **Médiatique / symbolique** — atteinte à l'image, narratifs durables.
- **Second ordre** — effets en cascade que la première réaction ne capte pas.

Distinguer **court terme** (semaines/mois) et **long terme** (années) — les deux dimensions ne se hiérarchisent pas de la même façon.

---

## Matrice 3×3 — modèle de base

| | **Impact mineur** | **Impact important** | **Impact critique** |
|---|---|---|---|
| **Probabilité élevée** | Modéré | Élevé | **Critique** |
| **Probabilité modérée** | Faible | Modéré | Élevé |
| **Probabilité faible** | Très faible | Faible | Modéré |

### Lecture

- **Très faible / Faible** — surveillance routinière, pas d'action immédiate.
- **Modéré** — vigilance active, plan de contingence léger.
- **Élevé** — préparation explicite, mesures préventives.
- **Critique** — priorité absolue, ressources mobilisées immédiatement.

### Quand utiliser une matrice 5×5

Pour les analyses où une granularité supérieure est nécessaire (sécurité industrielle, sûreté nationale, audits formels), la matrice 5×5 (impact: négligeable / mineur / modéré / majeur / catastrophique × probabilité : très faible / faible / moyenne / élevée / quasi certaine) offre 25 cases au lieu de 9. Réserver aux contextes professionnels qui le justifient — pour la plupart des analyses OSINT prospectives, **la 3×3 suffit largement** et reste lisible.

---

## Conditioning statements — le composant clé

Une évaluation de risque **doit toujours** s'accompagner de ses **conditions de validité**. Sans cela, elle devient une prophétie — et donc une faute professionnelle.

### Format type

> *« Le risque est évalué **élevé** dans l'hypothèse où [condition 1], et **si** [condition 2] reste vérifiée. Il deviendrait **modéré** dans le scénario où [variation]. Il pourrait devenir **critique** si [facteur aggravant] survient. »*

### Conditions à expliciter systématiquement

- **Hypothèses sous-jacentes** — sur quoi repose l'évaluation ?
- **Horizon temporel** — l'évaluation porte sur combien de temps ?
- **Variables sensibles** — quels facteurs, s'ils évoluent, changent l'évaluation ?
- **Seuils** — quelles valeurs de quels indicateurs feraient basculer la note ?

### Pourquoi c'est essentiel

Une évaluation non-conditionnelle :

- est **non-falsifiable** — on ne peut pas dire si elle était juste ou non a posteriori ;
- est **non-actualisable** — on ne sait pas quand la réévaluer ;
- est **non-actionnable** — le décideur ne sait pas quoi surveiller.

Une évaluation conditionnelle, à l'inverse, devient un **outil dynamique** : elle dit ce qu'il faut surveiller pour savoir si elle reste valide.

---

## Facteurs dynamiques

Le risque **n'est pas statique**. Identifier :

### Facteurs **aggravants**

Évolutions qui font monter la probabilité ou l'impact :

- tensions politiques croissantes ;
- accès nouveau à des ressources critiques ;
- radicalisation accélérée d'un acteur ;
- instabilité géopolitique régionale ;
- dégradation économique ;
- événements déclencheurs (échéances électorales, anniversaires symboliques, transitions de pouvoir).

### Facteurs **atténuants**

Évolutions qui font baisser le risque :

- arrestation ou neutralisation d'un leader clé ;
- fragmentation interne d'un groupe hostile ;
- renforcement de la surveillance ou des défenses ;
- stabilisation politique ou économique ;
- accord ou désescalade diplomatique.

Pour chaque facteur, préciser :

- son **état actuel** ;
- son **évolution probable** dans l'horizon considéré ;
- l'**effet attendu** sur le niveau de risque.

---

## Trois distinctions à ne jamais confondre

| Outil | Question | Composant analysé |
|---|---|---|
| **Threat Assessment** | Qui veut nuire et avec quoi ? | L'adversaire |
| **Vulnerability Assessment** | Où est-on exposé ? | La cible / le système |
| **Risk Assessment** | Quelle est la probabilité × impact ? | La synthèse orientée décision |

Un livrable complet articule les trois :

> *« La menace est [caractérisée]. Les vulnérabilités principales sont [listées]. Le risque global, à horizon X, est évalué [niveau] sous réserve de [conditions]. »*

---

## Présentation type d'une évaluation de risque

```
🎯 OBJET DE L'ÉVALUATION
[Quoi / qui / sur quel horizon]

⚠️ MENACE
- Acteur(s) source : [...]
- Intention : [...]
- Capacités : [...]
- Ressources : [...]
- Niveau de menace estimé : [faible/modéré/élevé]

🛡️ VULNÉRABILITÉS PRINCIPALES
1. [Type] : [description] — [niveau d'exposition]
2. [...]
3. [...]

📊 ÉVALUATION DU RISQUE
- Probabilité : [niveau, avec justification courte]
- Impact : [niveau, avec dimensions principales]
- Risque synthétique : [niveau matriciel]
- Confiance dans l'évaluation : [faible/modérée/élevée]

🔧 FACTEURS DYNAMIQUES
- Aggravants : [...]
- Atténuants : [...]

📋 CONDITIONING STATEMENTS
- Hypothèses : [...]
- Variables sensibles : [...]
- Seuils de bascule : [...]

🔭 SIGNAUX À SURVEILLER POUR RÉÉVALUATION
1. [...]
2. [...]
```

---

## Pièges classiques

### Le risque "intuitif"

L'analyste indique un niveau de risque sans le décomposer en probabilité × impact. Le décideur ne peut pas auditer le raisonnement.

### L'overconfidence

Tendance à surestimer ses propres évaluations, surtout en environnement de pression. Antidote : passer la check-list anti-biais de `biais-cognitifs.md`.

### L'alarmisme

Tout est *« élevé »* ou *« critique »*. À force, plus rien n'attire l'attention. La discipline est de **réserver le critique** aux cas qui le justifient réellement.

### La minimisation

L'inverse : tout est *« modéré »* parce que personne ne veut être accusé d'alarmisme. La rigueur de l'évaluation prime sur les considérations politiques.

### Le risque "boîte noire"

L'évaluation n'est pas explicitable. Si l'analyste ne peut pas justifier en 3 phrases pourquoi le niveau est X et pas Y, l'évaluation n'est pas défendable.

### L'évaluation gelée

Une évaluation produite il y a 3 mois et jamais mise à jour. Le risque est dynamique : prévoir des **points de réévaluation** dès la première analyse.

---

## Synthèse

- L'évaluation du risque sépare ce que l'intuition confond : **probabilité** et **impact**.
- Une évaluation complète articule : menace, vulnérabilité, probabilité, impact, conditions, facteurs dynamiques.
- Les **conditioning statements** sont **obligatoires** : ils transforment l'évaluation en outil de surveillance.
- La matrice 3×3 suffit pour la plupart des analyses OSINT.
- L'évaluation doit être **lisible**, **défendable**, **actualisable**, **actionnable** — sinon elle ne sert à rien.


