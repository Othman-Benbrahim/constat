// Formulaires de versement : les trois champs du pari restent ceux de l'auteur.
import { adressePrisme, preparerPrediction, verifierContrat } from '../core/prisme.js';
import { appelPrisme } from './prisme-transport.js';

export function installerPrisme({ api, dossiers, courant, etat }) {
  const $ = id => document.getElementById(id);
  const CLE = 'prisme-reglages';
  let cible = null, cleSession = '', enCours = false;
  const afficherEtat = (texte, erreur = false) => {
    $('prisme-etat').textContent = texte;
    $('prisme-etat').classList.toggle('erreur', erreur);
    etat(texte, erreur);
  };
  async function charger() {
    const r = await dossiers.s.get(CLE) || {};
    $('prisme-adresse').value = r.base || 'http://127.0.0.1:5000';
    $('prisme-cle').value = r.cle || cleSession;
    $('prisme-memoriser').checked = !!r.memoriser;
  }
  function reglages() {
    const a = adressePrisme($('prisme-adresse').value.trim());
    const cle = $('prisme-cle').value.trim();
    if (!/^prisme-[A-Za-z0-9_-]{20,100}$/.test(cle)) throw new Error('Saisissez une clé d’agent PRISME avec lecture et proposition.');
    return { ...a, cle };
  }
  async function conserver(r) {
    cleSession = r.cle;
    const memoriser = $('prisme-memoriser').checked;
    await dossiers.s.set(CLE, { base: r.base, memoriser, cle: memoriser ? r.cle : '' });
  }
  async function verifier(r) {
    const ping = await appelPrisme(api, { base:r.base, cle:r.cle, route:'/api/v1/ping' });
    const types = await appelPrisme(api, { base:r.base, cle:r.cle, route:'/api/v1/types' });
    verifierContrat(ping, types);
    return ping;
  }
  // permissions.request est appelé avant tout await pour conserver le geste Firefox.
  $('form-prisme-reglages').addEventListener('submit', async ev => {
    ev.preventDefault(); const bouton = $('prisme-tester'); bouton.disabled = true;
    try {
      const r = reglages();
      const accord = api.permissions.request({ origins:[r.permission] });
      if (!await accord) throw new Error('Accès local refusé ; aucune requête envoyée.');
      const p = await verifier(r); await conserver(r);
      afficherEtat(`Connexion PRISME vérifiée pour « ${p.agent} ». Les propositions attendront votre validation dans PRISME.`);
    } catch(e) { afficherEtat(e.message, true); }
    finally { bouton.disabled = false; }
  });
  $('reglages-prisme').addEventListener('click', async () => {
    try { await charger(); $('zone-prisme').hidden = false; $('form-prisme-reglages').hidden = false; }
    catch(e) { etat(e.message, true); }
  });
  $('prisme-fermer').addEventListener('click', () => { if (!enCours) $('zone-prisme').hidden = true; });
  $('prisme-annuler').addEventListener('click', () => { if (!enCours) { $('form-prisme-pari').hidden = true; cible = null; } });
  $('form-prisme-pari').addEventListener('submit', async ev => {
    ev.preventDefault(); if (enCours) return;
    enCours = true; $('prisme-envoyer').disabled = true;
    let transmis = false;
    try {
      if (!cible || courant() !== cible.dossier.id) throw new Error('Le dossier courant a changé. Rouvrez le versement depuis l’hypothèse.');
      const r = reglages();
      const saisie = Object.fromEntries(['titre','enonce','probabilite','echeance','critere_resolution','domaine'].map(k => [k,$('prisme-'+k).value]));
      const payload = preparerPrediction({ ...cible, saisie });
      const accord = api.permissions.request({ origins:[r.permission] });
      if (!await accord) throw new Error('Accès local refusé ; aucune proposition envoyée.');
      const id = cible.dossier.id;
      if (await dossiers.etat(id) !== 'actif') throw new Error('Le dossier a été clos. Restaurez-le avant de verser.');
      const j = await dossiers.journal(id);
      const derniere = j.filter(x => x.t === 'etape' && x.numero === 5 && x.releveRef === cible.etape.releveRef).at(-1);
      const releve = (await dossiers.relevés(id)).at(-1);
      if (!derniere || !derniere.validee || !derniere.complet || derniere.ts !== cible.etape.ts || JSON.stringify(derniere.sortie) !== JSON.stringify(cible.etape.sortie) || releve?.empreinteCorpus !== cible.etape.releveRef) {
        throw new Error('La révision ACH ou le corpus a changé. Rouvrez le versement depuis l’étape actuelle.');
      }
      if (j.some(x => x.t === 'prisme-proposition' && x.destination === r.base && JSON.stringify(x.proposition) === JSON.stringify(payload))) {
        throw new Error('Cette proposition a déjà été envoyée depuis ce dossier. Vérifiez la file PRISME.');
      }
      await verifier(r); await conserver(r);
      const resultat = await appelPrisme(api, { base:r.base, cle:r.cle, route:'/api/v1/proposer', corps:payload });
      if (resultat?.acceptee !== true || resultat.entree?.type !== 'prediction' || typeof resultat.entree?.cle !== 'string') {
        throw new Error('Réponse de versement inattendue. Vérifiez la file PRISME avant de réessayer.');
      }
      transmis = true;
      await dossiers.ajouter(id, { t:'prisme-proposition', destination:r.base, proposition:payload,
        cleProposition:resultat.entree.cle, etapeRef:cible.etape.ts, hypotheseId:cible.hypotheseId });
      $('form-prisme-pari').hidden = true;
      afficherEtat('Proposition déposée dans la file PRISME. Elle n’est pas encore dans le vault : relisez-la et validez-la dans PRISME.');
    } catch(e) {
      afficherEtat(transmis ? 'Proposition envoyée à PRISME, mais journal local non enregistré. Ne renvoyez pas ; vérifiez la file PRISME.' : e.message, true);
    } finally { enCours = false; $('prisme-envoyer').disabled = false; }
  });
  return {
    async ouvrir(dossierId, etape, hypotheseId) {
      if (enCours) throw new Error('Un versement est déjà en cours.');
      if (!etape.validee || !etape.complet) throw new Error('Validez une étape ACH complète avant le versement.');
      const h = etape.sortie.hypotheses.find(x => x.id === hypotheseId);
      if (!h) throw new Error('Hypothèse introuvable');
      const dossier = await dossiers.meta(dossierId);
      if (!dossier) throw new Error('Dossier introuvable');
      cible = { dossier, etape, hypotheseId };
      await charger();
      $('zone-prisme').hidden = false; $('form-prisme-pari').hidden = false;
      $('prisme-source').textContent = `${hypotheseId} — ${h.enonce} · réfuterait : ${h.demolirait}`;
      $('prisme-titre').value = `${hypotheseId} — ${h.enonce}`.slice(0,200);
      $('prisme-enonce').value = h.enonce.replace(/\s+/g,' ').trim();
      // Aucun nombre proposé par le modèle n'est utilisé pour ce pari.
      ['probabilite','echeance','critere_resolution','domaine'].forEach(k => { $('prisme-'+k).value = ''; });
      $('prisme-etat').textContent = '';
      $('zone-prisme').scrollIntoView({ block:'start' });
      $('prisme-probabilite').focus();
    },
  };
}
