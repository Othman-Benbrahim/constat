# 📄 Format de rapport — Templates de livrables

> Ce module fournit les **templates** des principaux livrables analytiques produits par le skill. Chaque format est conçu pour servir un type de décision précis.

---

## Principes transversaux

Avant de présenter les formats, cinq règles s'appliquent à **tous** les livrables :

### 1. **BLUF — Bottom Line Up Front**

Le **jugement principal** vient en premier. Pas après une introduction, pas après une mise en contexte. **En premier.**

Un décideur doit pouvoir lire les trois premières lignes et savoir l'essentiel. S'il a le temps, il lit la suite. Sinon, il a déjà l'information.

### 2. **Distinguer fait / inférence / hypothèse / spéculation**

À chaque ligne du livrable, l'analyste sait dans quel registre il écrit, et le **signale** au lecteur :

- **Fait** : *« le 12 mars, X a déclaré Y »* (vérifié, attribué).
- **Inférence** : *« cette déclaration implique Z »* (raisonnement logique à partir du fait).
- **Hypothèse** : *« il est plausible que W »* (interprétation argumentée, falsifiable).
- **Spéculation symbolique** : *« cette dynamique rappelle l'archétype K »* (lecture interprétative, signalée comme telle).

### 3. **Niveau de confiance explicite**

Tout jugement principal est accompagné d'un niveau de confiance. Sans cela, le décideur ne sait pas s'il s'agit d'une quasi-certitude ou d'une hypothèse fragile.

### 4. **Sources mobilisées**

L'analyste sait d'où vient chaque affirmation. Sans nécessairement bibliographier en pied de page, il doit pouvoir, sur demande, expliciter ses sources.

### 5. **Concision**

Un mot superflu coûte une seconde d'attention. Un paragraphe redondant fait perdre la lecture. Couper sans pitié.

---

## Format 1 — Note tactique express

**Cas d'usage** : décision dans l'heure, vigilance immédiate, événement émergent.

**Longueur** : ½ à 1 page.

**Structure** :

```
📌 NOTE TACTIQUE — [Sujet]
Date : [...] | Confiance : [faible/modérée/élevée]

🎯 JUGEMENT
[1-3 phrases. L'essentiel. Le BLUF.]

📋 SITUATION
[3-5 lignes factuelles : quoi, où, quand, qui.]

🔍 ANALYSE
[3-6 lignes : ce que cela signifie, en distinguant les niveaux
(fait / inférence / hypothèse).]

⚠️ RISQUE / IMPLICATION
[2-3 lignes : conséquences principales possibles.]

🎬 RECOMMANDATIONS
- R1 : [...]
- R2 : [...]

🔭 SIGNAUX À SURVEILLER
- [...]
- [...]

📎 LACUNES IDENTIFIÉES
[Ce qu'on ne sait pas encore et qu'il faudrait combler.]
```

---

## Format 2 — Profil d'acteur

**Cas d'usage** : comprendre une personne, un groupe, une organisation, une dynamique.

**Longueur** : 2-4 pages.

**Structure** :

```
👤 PROFIL — [Nom de l'acteur]
Date : [...] | Type : [individu / groupe / organisation / réseau]
Mandat de l'analyse : [pourquoi ce profil est produit]

🎯 SYNTHÈSE
[3-5 lignes : qui est cet acteur, pourquoi il compte, ce qui le caractérise.]

📚 BACKGROUND
[Origine, historique, trajectoire. Pour un individu : éducation,
réseau, parcours. Pour un groupe : création, évolution, idéologie.]

🧭 IDENTIFIANTS
[Pour un individu : âge, affiliations, signes distinctifs, habitudes connues.
Pour une organisation : leadership, membres clés, zones d'opération,
structure interne.]

⚙️ MODUS OPERANDI
[Comment il / elle / ils agissent typiquement. Tactiques habituelles,
signatures comportementales.]

🎯 INTENTIONS
[Objectifs apparents, motivations probables. Distinguer intentions
affichées et intentions inférées.]

💪 CAPACITÉS
[Compétences, ressources, soutiens, technologie utilisée.
Granularité : ce que l'acteur peut faire, et ce qu'il ne peut pas.]

🛡️ VULNÉRABILITÉS
[Points faibles : psychologiques, organisationnels, financiers, juridiques,
opérationnels. À traiter avec rigueur factuelle, pas avec ressentiment.]

🌀 LECTURE STRUCTURELLE
[Optionnel : archétype activé par cet acteur, motif récurrent dans son
parcours, lecture symbolique. Signalé comme interprétation.]

📊 ANALYSE / ESTIMATION
[Le jugement de l'analyste : que signifient les informations collectées ?
Quelle est la trajectoire probable de cet acteur ?]

❓ LACUNES D'INFORMATION
[Ce qu'on ignore encore et qui pèse sur l'analyse. Liste explicite.]

🔭 SIGNAUX À SURVEILLER
[Évolutions concrètes à observer pour actualiser le profil.]
```

> **Garde-fou éthique** : un profil OSINT ne formule **jamais** de recommandation d'action ciblée contre une personne nommée. Il décrit, analyse, anticipe — il ne désigne pas une cible opérationnelle.

---

## Format 3 — Évaluation stratégique

**Cas d'usage** : analyse approfondie d'une dynamique, d'un dossier, d'une question géopolitique ou sectorielle ; livrable pour orienter une politique, une stratégie d'entreprise, une décision de long terme.

**Longueur** : 4-10 pages.

**Structure** :

```
📊 ÉVALUATION STRATÉGIQUE — [Sujet]
Date : [...] | Horizon : [...] | Confiance globale : [...]

🎯 SYNTHÈSE EXÉCUTIVE
[1/2 page maximum. Le BLUF étendu : la question, les conclusions
principales, les recommandations. Doit pouvoir être lu indépendamment
du reste.]

❓ QUESTION D'INTELLIGENCE
[Reformulation précise de la question, périmètre, horizon, décision
sous-jacente.]

🗂️ MÉTHODOLOGIE
[Brève — 1 paragraphe. Sources mobilisées, période couverte, approches
utilisées. Mentionner les limites de la base d'information.]

🌐 CONTEXTE
[1-2 pages : situation actuelle, acteurs principaux, dynamiques en jeu,
trajectoire récente. Factuel.]

🔬 ANALYSE
— Lecture qualitative : [patterns, comportements, narratifs]
— Lecture quantitative : [si données disponibles]
— Lecture structurelle / fractale : [archétypes, motifs, homologies — signalés
  comme lectures interprétatives]

🧪 HYPOTHÈSES CONCURRENTES
H1 (dominante) : [énoncé] — soutiens : [...] — fragilités : [...]
H2 (dissidente) : [...]
H3 (fractale) : [...]
[Optionnel : H4, H5]

🔮 SCÉNARIOS PROSPECTIFS
🟢 Scénario favorable (X%) :
  Trame, drivers, conditions, indicateurs de bascule, impact.
🟡 Scénario probable (Y%) :
  [Idem]
🔴 Scénario critique (Z%) :
  [Idem]
[Optionnel : 🌀 Scénario fractal]

⚠️ ÉVALUATION DU RISQUE
[Voir matrice-risque.md : menace, vulnérabilité, probabilité × impact,
conditioning statements, facteurs dynamiques.]

🎬 RECOMMANDATIONS
1. (Priorité haute, court terme) : [action, ressources, risque d'inaction]
2. (Priorité haute, moyen terme) : [...]
3. (Priorité moyenne, court terme) : [...]
4. (Veille active) : [...]

🧠 ROBUSTESSE & BIAIS
[Ce qui pourrait invalider l'analyse, biais probables, points de doute.
Court mais explicite.]

🔭 PROCHAINS POINTS DE CONTRÔLE
[Quand réévaluer, quels indicateurs prioritaires surveiller.]

📎 LACUNES D'INFORMATION
[Liste explicite de ce qui manque pour affiner l'analyse.]
```

---

## Format 4 — Brief de signaux faibles

**Cas d'usage** : veille périodique, surveillance d'un dossier dans la durée.

**Longueur** : 1 page, périodique (hebdomadaire ou bimensuel typiquement).

**Structure** :

```
📡 BRIEF SIGNAUX FAIBLES — [Dossier]
Période couverte : [...] | Source-pool : [...]

🎯 SYNTHÈSE DE LA SEMAINE / PÉRIODE
[2-3 lignes : ce qui ressort, ce qui change, ce qui mérite attention.]

⚡ SIGNAUX MARQUANTS
1. [Type DSF — Dissonance / Silence / Forme]
   Description : [...]
   Score IPC : [Fiabilité × Intensité × Résonance]
   Hypothèse interprétative : [...]
   Indicateur à surveiller : [...]

2. [...]

3. [...]

🔁 SIGNAUX RÉCURRENTS (faisceau)
[Signaux faibles déjà détectés qui se confirment ou se prolongent.
Plus important que les signaux isolés spectaculaires.]

🎭 LECTURES STRUCTURELLES
[Si applicable : archétype émergent, motif récurrent, homologie observée.
Signalé comme lecture interprétative.]

📋 ÉTAT DES HYPOTHÈSES EN COURS
H1 : [statut — confirmée, fragilisée, à reformuler]
H2 : [...]
H3 : [...]

🔭 PRIORITÉS DE VEILLE — PÉRIODE SUIVANTE
- [...]
- [...]
```

---

## Format 5 — Scénarios prospectifs autonomes

**Cas d'usage** : livrable centré exclusivement sur la prospective, pour soutenir un exercice de planification.

**Longueur** : 2-5 pages.

**Structure** :

```
🔮 SCÉNARIOS PROSPECTIFS — [Sujet]
Date : [...] | Horizon : [...] | Auteur : [...]

🎯 QUESTION POSÉE
[Quelle incertitude ces scénarios doivent-ils éclairer ?]

🧭 CADRE & MÉTHODE
[Brève — drivers identifiés, incertitudes principales, méthode utilisée.]

🟢 SCÉNARIO 1 — [Nom évocateur]
Confiance : [X%]

Trame :
[2-4 phrases narratives.]

Drivers principaux : [...]
Conditions d'apparition : [nécessaires / facilitantes / bloquantes]
Indicateurs de bascule :
  1. [...]
  2. [...]
  3. [...]
Impact prévisible : [court terme / moyen terme]
Effets de second ordre : [...]

🟡 SCÉNARIO 2 — [Nom évocateur]
[Idem]

🔴 SCÉNARIO 3 — [Nom évocateur]
[Idem]

🌀 SCÉNARIO FRACTAL (optionnel)
[Si activé : par analogie structurelle avec...]

🎬 CE QUE CES SCÉNARIOS IMPLIQUENT
- À surveiller en priorité : [...]
- À préparer dans tous les cas : [...]
- À éviter de déclencher : [...]

🧠 LIMITES & CAVEATS
[Ce que ces scénarios ne couvrent pas, biais possibles, conditions de
révision.]
```

---

## Format 6 — Note de lecture / décodage rapide

**Cas d'usage** : un article, un discours, un document est porté à l'attention de l'analyste qui doit en proposer une lecture critique en peu de temps.

**Longueur** : 1 page.

**Structure** :

```
📰 DÉCODAGE — [Titre du document analysé]
Source : [...] | Date : [...] | Auteur ou émetteur : [...]

🎯 CE QUE LE DOCUMENT DIT EXPLICITEMENT
[3-5 lignes : résumé fidèle, sans commentaire.]

🔍 CE QUE LE DOCUMENT DIT IMPLICITEMENT
[Sous-entendus, présupposés, intentions inférées.]

🔇 CE QUE LE DOCUMENT NE DIT PAS (et qui devrait)
[Silences significatifs, omissions, points évités.]

🎭 CHAMP LEXICAL & FORME
[Mots-clés mobilisés, registre, ton. Glissements éventuels par rapport
aux productions antérieures de la même source.]

🌀 LECTURE STRUCTURELLE
[Archétype mobilisé, motif récurrent, position dans une dynamique
narrative plus large.]

📋 HYPOTHÈSES SUR LA STRATÉGIE COMMUNICATIONNELLE
[Pourquoi ce document maintenant ? À qui s'adresse-t-il ? Quel effet
recherché ?]

⚠️ POINTS À SURVEILLER
[Suite logique : si l'hypothèse est juste, qu'est-ce qui devrait advenir ?]
```

---

## Règles de présentation

### Hiérarchie visuelle

- **Titres clairs** avec emojis comme marqueurs (sobres, fonctionnels).
- **Listes courtes** plutôt que paragraphes interminables.
- **Espacement** : aérer pour la lecture rapide.
- **Mise en gras** uniquement pour ce qui doit absolument être vu.

### Vocabulaire

- **Précis** sans être jargonnant.
- **Sobre** — éviter les superlatifs, l'alarmisme, le sensationnalisme.
- **Calibré** — niveau de confiance signalé, conditionnels utilisés à bon escient.

### Longueur

- Un livrable trop long n'est pas lu.
- Un livrable trop court n'est pas pris au sérieux.
- Calibrer selon le type de décision à servir.

### Adaptation au lectorat

L'analyste peut avoir affaire à :

- Un **décideur pressé** → BLUF, recommandations, synthèse exécutive.
- Un **expert technique** → détails, méthodologie, sources.
- Un **non-spécialiste** → définitions, contexte, schémas.

Adapter sans dénaturer.

---

## Anti-patterns à éviter

- **L'introduction-fleuve** qui retarde le jugement principal.
- **L'analyse-encyclopédie** qui submerge sans hiérarchiser.
- **La synthèse non-synthétique** qui répète tout au lieu de condenser.
- **Le jargon-protection** : termes savants utilisés pour impressionner plutôt que pour préciser.
- **L'évitement du jugement** : tout dire pour ne rien dire.
- **L'excès de prudence** : la prudence est nécessaire ; l'évitement est lâche.
- **La conclusion-cliché** : *« l'avenir nous le dira »*, *« il faudra être vigilant »*.

---

## Synthèse

- Six formats principaux : **note tactique**, **profil**, **évaluation stratégique**, **brief signaux**, **scénarios autonomes**, **décodage**.
- Tous appliquent : **BLUF**, **distinction des registres**, **niveau de confiance**, **conditioning statements**, **lacunes explicites**.
- Le choix du format dépend de la décision à servir, pas de la richesse de l'analyse disponible.
- Mieux vaut **un format court bien tenu** qu'un format long mal calibré.


