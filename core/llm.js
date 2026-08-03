// llm.js — couche fournisseurs BYOK.
//
// FOURNISSEURS, enTetes, corpsRequete, extraireTexte et extraireJson sont
// repris de sentinelle/src/llm.js. Le reste de ce fichier est neuf : Sentinelle
// ne compte aucun jeton et ne lit pas `usage`.
//
// Règle héritée, conservée mot pour mot :
//
//   Aucun nombre produit par le modèle n'entre dans un relevé.
//   Un relevé sans modèle est un relevé complet.

export const FOURNISSEURS = {
  anthropic: {
    nom: 'Anthropic',
    urlDefaut: 'https://api.anthropic.com/v1',
    modeleDefaut: 'claude-sonnet-4-5',
    cleRequise: true,
  },
  openai: {
    nom: 'OpenAI',
    urlDefaut: 'https://api.openai.com/v1',
    modeleDefaut: 'gpt-4o-mini',
    cleRequise: true,
  },
  google: {
    nom: 'Google Gemini',
    urlDefaut: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modeleDefaut: 'gemini-2.0-flash',
    cleRequise: true,
  },
  mistral: {
    nom: 'Mistral',
    urlDefaut: 'https://api.mistral.ai/v1',
    modeleDefaut: 'mistral-small-latest',
    cleRequise: true,
  },
  lmstudio: { nom: 'LM Studio (local)', urlDefaut: 'http://localhost:1234/v1', modeleDefaut: '', cleRequise: false },
  ollama: { nom: 'Ollama (local)', urlDefaut: 'http://localhost:11434/v1', modeleDefaut: 'llama3.1', cleRequise: false },
  compatible: { nom: 'Autre API compatible OpenAI', urlDefaut: '', modeleDefaut: '', cleRequise: false },
};

/**
 * Tarifs indicatifs, en unité monétaire par million de jetons.
 *
 * Cette table est périmée dès qu'elle est écrite : les tarifs changent tous les
 * quelques mois. Elle porte donc sa date, et l'interface laisse la corriger.
 * Un coût affiché sans sa date d'établissement serait un chiffre qui ment sans
 * qu'on puisse s'en apercevoir.
 */
export const TARIFS = {
  etabliLe: '2026-08-02',
  parModele: {
    'claude-sonnet-4-5': { entree: 3, sortie: 15 },
    'gpt-4o-mini': { entree: 0.15, sortie: 0.6 },
    'gemini-2.0-flash': { entree: 0.1, sortie: 0.4 },
    'mistral-small-latest': { entree: 0.2, sortie: 0.6 },
  },
  defaut: { entree: 1, sortie: 5 },
};

/**
 * Estimation grossière du nombre de jetons : un jeton pour quatre caractères.
 * L'approximation est déclarée plutôt que masquée — c'est un ordre de grandeur
 * destiné à éviter la surprise, pas une facture.
 */
export function estimerJetons(texte) {
  return Math.ceil(String(texte || '').length / 4);
}

export function estimerCout({ contenu, consigne = '', maxSortie = 2000, modele, tarifs = TARIFS }) {
  const entree = estimerJetons(contenu) + estimerJetons(consigne);
  const t = tarifs.parModele[modele] || tarifs.defaut;
  const cout = (entree / 1e6) * t.entree + (maxSortie / 1e6) * t.sortie;
  return {
    jetonsEntree: entree,
    jetonsSortieMax: maxSortie,
    tarif: t,
    tarifConnu: !!tarifs.parModele[modele],
    tarifsEtablisLe: tarifs.etabliLe,
    coutMax: Number(cout.toFixed(4)),
    approximation: 'un jeton pour quatre caractères',
  };
}

/**
 * Origines à autoriser pour joindre un fournisseur. Une URL personnalisée
 * l'emporte sur l'URL par défaut — c'est elle qui sera jointe.
 *
 * En Manifest V3, une permission d'hôte déclarée dans le manifeste n'est pas
 * accordée à l'installation sous Firefox : elle doit être demandée. Cette
 * fonction existe pour que le panneau sache quoi demander.
 */
export function originesFournisseur(fournisseur, url) {
  const base = url || FOURNISSEURS[fournisseur]?.urlDefaut || '';
  try { return [`${new URL(base).origin}/*`]; } catch { return []; }
}

function enTetes(fournisseur, cle) {
  const h = { 'Content-Type': 'application/json' };
  if (fournisseur === 'anthropic') {
    if (cle) h['x-api-key'] = cle;
    h['anthropic-version'] = '2023-06-01';
    // Requis pour appeler l'API depuis un contexte navigateur.
    h['anthropic-dangerous-direct-browser-access'] = 'true';
  } else if (cle) {
    h.Authorization = `Bearer ${cle}`;
  }
  return h;
}

export function corpsRequete(fournisseur, modele, contenu, consigne, maxTokens) {
  if (fournisseur === 'anthropic') {
    return {
      model: modele, max_tokens: maxTokens, temperature: 0,
      system: consigne, messages: [{ role: 'user', content: contenu }],
    };
  }
  return {
    model: modele, temperature: 0, max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: consigne },
      { role: 'user', content: contenu },
    ],
  };
}

export function extraireTexte(fournisseur, data) {
  if (fournisseur === 'anthropic') {
    return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  }
  return data.choices?.[0]?.message?.content ?? '';
}

/** Isole l'objet JSON même si le modèle l'a entouré de texte ou de balises. */
export function extraireJson(texte) {
  if (!texte) throw new Error('reponse vide');
  const net = String(texte).replace(/```json/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(net); } catch { /* on tente l'extraction */ }
  const debut = net.indexOf('{');
  const fin = net.lastIndexOf('}');
  if (debut === -1 || fin <= debut) throw new Error('aucun objet JSON dans la reponse');
  return JSON.parse(net.slice(debut, fin + 1));
}

/** Usage réel renvoyé par le fournisseur, quand il le renvoie. */
export function lireUsage(fournisseur, data) {
  if (fournisseur === 'anthropic') {
    const u = data.usage || {};
    return { entree: u.input_tokens ?? null, sortie: u.output_tokens ?? null };
  }
  const u = data.usage || {};
  return { entree: u.prompt_tokens ?? null, sortie: u.completion_tokens ?? null };
}

/**
 * Un appel, un seul. Le découpage par étape du §7.1 se fait au-dessus : ce
 * module ne sait pas ce qu'est une étape.
 */
export async function appeler({
  fournisseur, url, modele, cle, consigne, contenu,
  maxSortie = 2000, timeoutMs = 90000, signal, fetchImpl = fetch,
}) {
  const base = (url || FOURNISSEURS[fournisseur]?.urlDefaut || '').replace(/\/$/, '');
  if (!base) throw new Error('URL du fournisseur manquante');
  if (FOURNISSEURS[fournisseur]?.cleRequise && !cle) throw new Error('clé API manquante');

  const point = fournisseur === 'anthropic' ? `${base}/messages` : `${base}/chat/completions`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  signal?.addEventListener?.('abort', () => ctrl.abort('annule'), { once: true });

  const debut = Date.now();
  try {
    const res = await fetchImpl(point, {
      method: 'POST',
      signal: ctrl.signal,
      headers: enTetes(fournisseur, cle),
      body: JSON.stringify(corpsRequete(fournisseur, modele, contenu, consigne, maxSortie)),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`HTTP ${res.status}${detail ? ' — ' + detail : ''}`);
    }
    const data = await res.json();
    return {
      texte: extraireTexte(fournisseur, data),
      usage: lireUsage(fournisseur, data),
      dureeMs: Date.now() - debut,
    };
  } finally {
    clearTimeout(timer);
  }
}
