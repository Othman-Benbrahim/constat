# ACH — Analysis of Competing Hypotheses

> *« Ne cherche pas à prouver ton hypothèse. Cherche à l'invalider. »*
> — Richards J. Heuer Jr., *Psychology of Intelligence Analysis*, CIA (1999)

---

## Pourquoi l'ACH existe

Le biais de confirmation est le défaut structurel de toute analyse intuitive : l'esprit
accumule les éléments qui confirment l'hypothèse préférée et minimise ceux qui la
contredisent. L'ACH retourne cette logique.

**Principe fondateur :** une bonne hypothèse n'est pas celle qui a le plus de preuves
*compatibles* — c'est celle qui résiste le mieux aux preuves *incompatibles*.

L'ACH s'applique en **Étape 5** du pipeline OSINT, quand les hypothèses concurrentes
doivent être discriminées avant de produire les scénarios prospectifs (Étape 7).
Elle produit aussi les entrées directes du Mode FORECAST (probabilisation formelle).

---

## Conditions d'activation

Activer l'ACH quand au moins une de ces conditions est remplie :

- La question d'intelligence admet **≥ 2 explications plausibles** structurellement distinctes
- Les preuves disponibles sont **contradictoires** entre elles
- L'enjeu de la conclusion est **élevé** (décision importante, risque de manipulation)
- L'analyste ressent une **certitude prématurée** — signal d'alarme classique de confirmation
- Le corpus contient des **silences suspects** ou des **dissonances** détectées en Étape 4

---

## Les 11 étapes — détail opératoire

### ÉTAPE 1 — Reformuler la question d'intelligence

Poser la question sous forme **ouverte** (pas orientée vers une réponse).

❌ *« Pourquoi l'acteur X a-t-il retiré ses fonds ? »* — présuppose une action intentionnelle
✅ *« Que signifie le retrait des fonds observé chez l'acteur X ? »*

La reformulation ouverte empêche de structurer la matrice autour d'une réponse déjà préférée.

---

### ÉTAPE 2 — Générer les hypothèses

Produire **3 à 7 hypothèses structurellement distinctes**. Règles :

- Chaque hypothèse répond complètement à la question (pas de chevauchement de couverture)
- Les hypothèses doivent être **MECE** : mutuellement exclusives, collectivement exhaustives
- Inclure systématiquement une **hypothèse dissidente** (contre-narrative)
- Inclure une **hypothèse nulle** : *« Rien d'inhabituel — coïncidence ou bruit »*

**Les 4 types d'hypothèses à toujours considérer :**

| Type | Description | Exemple |
|---|---|---|
| **Dominante** | Explication la plus probable selon le consensus initial | Action délibérée de l'acteur X |
| **Dissidente** | Contredit la dominante — souvent négligée | Réaction à une contrainte externe non visible |
| **Fractale** | Motif systémique — l'événement n'est qu'une manifestation locale | Dynamique de fond qui dépasse l'acteur X |
| **Nulle** | Pas d'intention, pas de signal — bruit ou hasard | Coïncidence temporelle sans causalité |

---

### ÉTAPE 3 — Collecter les preuves, signaux et silences

Inventorier exhaustivement :

- **Preuves positives** — faits documentés, comportements observés, déclarations vérifiables
- **Signaux faibles** — dissonances, anomalies de timing, mots hors-registre (voir `signaux-faibles.md`)
- **Contradictions internes** — éléments du corpus qui s'excluent mutuellement
- **Silences** — ce qui *devrait* être là et ne l'est pas (absence d'action attendue, source muette)

> Les silences sont souvent plus informatifs que les preuves positives.
> Un acteur qui ne réagit pas quand tous les autres réagissent — c'est un signal.

---

### ÉTAPE 4 — Construire la matrice ACH

Structure : **preuves en lignes, hypothèses en colonnes**.

```
                    | H1 (dominante) | H2 (dissidente) | H3 (fractale) | H4 (nulle) |
--------------------|----------------|-----------------|----------------|------------|
Preuve P1           |                |                 |                |            |
Preuve P2           |                |                 |                |            |
Signal S1           |                |                 |                |            |
Silence Si1         |                |                 |                |            |
Contradiction C1    |                |                 |                |            |
```

---

### ÉTAPE 5 — Coder chaque cellule

Quatre codes :

| Code | Signification |
|---|---|
| **C** | Compatible — la preuve *peut* exister si l'hypothèse est vraie |
| **I** | Incompatible — la preuve *ne devrait pas* exister si l'hypothèse est vraie |
| **N** | Neutre — la preuve n'a pas de relation discriminante avec l'hypothèse |
| **?** | Ambigu — la relation n'est pas déterminable avec les informations disponibles |

**Règle fondamentale :** être aussi sévère que possible sur les **I**. Une preuve n'est
incompatible que si elle *ne peut pas* exister si l'hypothèse est vraie — pas seulement
si elle est *improbable*.

---

### ÉTAPE 6 — Évaluer la diagnosticité

**Diagnosticité** = capacité d'une preuve à discriminer entre les hypothèses.

Une preuve est **hautement diagnostique** si elle est compatible avec *peu* d'hypothèses
et incompatible avec *plusieurs*. Une preuve compatible avec toutes les hypothèses n'apporte
aucune valeur discriminante.

Score de diagnosticité IPC (échelle 1-5, intégration avec le système de scoring OSINT) :

| Score | Signification |
|---|---|
| **5** | Permet d'éliminer ≥ 2 hypothèses avec certitude élevée |
| **4** | Défavorise fortement ≥ 1 hypothèse, favorise nettement ≥ 1 autre |
| **3** | Légère discrimination — tendance utile mais non décisive |
| **2** | Faiblement discriminante — compatible avec trop d'hypothèses |
| **1** | Non diagnostique — compatible avec toutes les hypothèses |

Ajouter la colonne **Diag.** à droite de la matrice.

**Matrice complète :**

```
                    | H1  | H2  | H3  | H4  | Diag. |
--------------------|-----|-----|-----|-----|-------|
Preuve P1           |  C  |  I  |  C  |  N  |   4   |
Preuve P2           |  C  |  C  |  I  |  C  |   3   |
Signal S1           |  C  |  C  |  C  |  I  |   2   |
Silence Si1         |  I  |  C  |  C  |  C  |   4   |
Contradiction C1    |  I  |  C  |  N  |  C  |   4   |
--------------------|-----|-----|-----|-----|-------|
Score I total       |  2  |  1  |  1  |  2  |       |
Score I pondéré     | 8   | 4   | 5   | 6   |       |
```

**Score I pondéré** = somme des scores de diagnosticité sur les lignes **I** uniquement.

L'hypothèse avec le **score I pondéré le plus élevé** est la moins bien supportée.
L'hypothèse avec le **score I pondéré le plus faible** est la plus robuste.

---

### ÉTAPE 7 — Identifier les preuves-pivots

Une **preuve-pivot** est une preuve diagnostique (Diag. ≥ 4) dont la nature **I** porte
sur l'hypothèse dominante. C'est le cœur de la méthode : si cette preuve tient,
l'hypothèse dominante vacille.

**Format d'identification :**
```
Preuve-pivot : [intitulé]
Si confirmée → invalide H[n] avec confiance élevée
Si infirmée → renforce H[n], affaiblit H[m]
Vérifiabilité : [source autoritative pour la confirmer/infirmer]
```

---

### ÉTAPE 8 — Test de sensibilité

Pour chaque preuve-pivot : *« Que se passe-t-il si cette preuve est fausse, manipulée,
ou mal interprétée ? »*

Trois scénarios de sensibilité systématiques :

| Scénario | Question posée |
|---|---|
| **Erreur de collecte** | La preuve est-elle vérifiée par une source indépendante ? |
| **Manipulation active** | Est-il plausible qu'un acteur ait intérêt à produire cette preuve ? |
| **Biais d'interprétation** | Ai-je codé **I** parce que c'est vraiment incompatible, ou parce que ça me dérangeait ? |

Si l'analyse change radicalement en retirant une seule preuve → **fragile**. Le signaler.

---

### ÉTAPE 9 — Retenir l'hypothèse la plus robuste

L'hypothèse retenue n'est **pas** celle avec le plus de preuves compatibles.
C'est celle avec **le score I pondéré le plus faible** — celle qui résiste le mieux
aux incompatibilités.

Formuler le jugement analytique avec un marqueur épistémique explicite :

| Marqueur | Usage |
|---|---|
| *Affirme (source)* | Fait établi, source vérifiée |
| *Infère (logique)* | Déduction nécessaire depuis les preuves |
| *Hypothèse* | Conclusion ACH — robuste mais révisable |
| *Spéculation* | Plausible mais non discriminée par les preuves actuelles |

---

### ÉTAPE 10 — Présenter les hypothèses alternatives

Ne jamais livrer une analyse ACH sans présenter les hypothèses non retenues avec leur
niveau de robustesse. Format :

```
H1 [retenue] — Score I pondéré : 4 — Jugement : HYPOTHÈSE robuste
  Failles résiduelles : [preuves ambiguës, silences non résolus]

H2 [dissidente] — Score I pondéré : 8 — Jugement : peu supportée
  Serait retenue si : [condition qui changerait le scoring]

H3 [fractale] — Score I pondéré : 5 — Jugement : secondaire mais active
  À surveiller : [signal qui la renforcerait]

H4 [nulle] — Score I pondéré : 6 — Jugement : éliminée
  Invalidée par : [preuve-pivot P1]
```

---

### ÉTAPE 11 — Définir les indicateurs de surveillance

Pour chaque hypothèse non éliminée, définir **1-2 signaux observables** dont
l'apparition réviserait le classement. Ces indicateurs alimentent directement :

- **Étape 7 OSINT** — scénarios prospectifs avec indicateurs de bascule
- **Mode UPDATE** — les indicateurs deviennent les déclencheurs de révision bayésienne

```
Indicateur de bascule [H2] :
  Signal : [description précise et observable]
  Source autoritative : [où le vérifier]
  Seuil de déclenchement : [à partir de quand activer Mode UPDATE]
  Révision attendue si déclenché : H2 monte de X% → → UPDATE
```

---

## Anti-patterns fréquents

| Erreur | Conséquence | Correction |
|---|---|---|
| Trop peu d'hypothèses (≤ 2) | Biais de confirmation structurel — l'espace des possibles est fermé | Toujours inclure hypothèse nulle + fractale |
| Coder **C** par défaut pour l'hypothèse préférée | Fausse robustesse — le score I ne reflète pas la réalité | Appliquer le test : *« cette preuve ne devrait-elle vraiment pas exister si H est vraie ? »* |
| Preuves non diagnostiques dominantes | La matrice ne discrimine rien — travail formel sans valeur | Filtrer : ne garder que les preuves avec Diag. ≥ 2 |
| Ignorer les silences | Perd les signaux d'absence les plus diagnostiques | Systématiser la question : *« qu'est-ce qui devrait être là et n'y est pas ? »* |
| Omettre le test de sensibilité | Analyse fragile présentée comme robuste | Retirer mentalement chaque preuve-pivot : si le classement s'effondre, le signaler |

---

## Intégration dans le pipeline osint-intel

```
Étape 4 (analyse triple)
        ↓
Étape 5 (ACH) ──────── hypothèses + probabilités ──────► Mode FORECAST
        ↓
Étape 7 (scénarios) ── indicateurs de bascule ──────────► Mode UPDATE
        ↓
Étape 10 (contrôle)    anti-biais → voir biais-cognitifs.md
```

La matrice ACH produit :
- Les **hypothèses rangées** → entrée directe du Mode FORECAST pour probabilisation
- Les **indicateurs de bascule** → déclencheurs du Mode UPDATE
- Le **marqueur épistémique** du jugement → traçabilité pour Mode CALIBRATION
