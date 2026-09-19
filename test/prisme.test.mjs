import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { parseHTML } from 'linkedom';
import { adressePrisme, probabilite, datePrisme, preparerPrediction, verifierContrat } from '../core/prisme.js';
import { appelPrisme } from '../sidebar/prisme-transport.js';
import { installerPrisme } from '../sidebar/prisme.js';
import { rendreEtapes } from '../sidebar/rendu.js';
import { Dossiers, stockageMemoire } from '../core/dossier.js';

const CLE = 'prisme-12345678901234567890';
const META = { id:'d-1', question:'Le service reviendra-t-il ?', perimetre:'Service', horizon:'2030', decision:'Attendre' };
const ETAPE = { t:'etape', numero:5, nom:'ACH', complet:true, validee:true, ts:'2026-09-19T10:00:00Z',
  valideeLe:'2026-09-19T10:01:00Z', releveRef:'corpus-1', sortie:{
    hypotheses:[{id:'H1',role:'dominante',enonce:'Le service revient <script>',confirmerait:'HTTP 200',demolirait:'HTTP 503'}],
    preuves:[{id:'P1',enonce:'Panne',sources:['s-1']}], matrice:{P1:{H1:'C'}}, classement:[] }};
const SAISIE = {titre:'Retour', enonce:'HTTP rétabli', probabilite:'0.8', echeance:'2030-01-08', critere_resolution:'Journal HTTP 200', domaine:'Technique'};
const PING = {prisme:true, droits:['lecture','proposition'], agent:'Constat'};
const TYPES = {schema:1, types:{prediction:{champs:['enonce','probabilite','echeance','critere_resolution','hypothese'].map(nom=>({nom}))}}};
const preparer = (saisie=SAISIE, etape=ETAPE) => preparerPrediction({dossier:META,etape,hypotheseId:'H1',saisie});

test('destination locale stricte et permission limitée à son hôte', () => {
  assert.deepEqual(adressePrisme('http://localhost:5000/'),{base:'http://localhost:5000',permission:'http://localhost/*'});
  for (const u of ['https://localhost:5000','http://example.org','http://localhost.evil.test','http://user:pass@localhost','http://localhost/path','http://localhost?secret=x','http://localhost/#x']) assert.throws(()=>adressePrisme(u));
});
test('probabilité explicitement saisie, certitudes permises, absence jamais zéro', () => {
  assert.equal(probabilite('0'),0); assert.equal(probabilite('1.0'),1); assert.equal(probabilite('0.8'),.8);
  for (const v of ['',null,undefined,true,false,'0,8','80%',NaN,Infinity,2,-1]) assert.throws(()=>probabilite(v));
});
test('dates réelles et compatibles avec Python', () => {
  assert.equal(datePrisme('2028-02-29'),'2028-02-29');
  for (const v of ['0000-01-01','2027-02-29','2030-02-30','2030-1-01','demain','']) assert.throws(()=>datePrisme(v));
});
test('proposition E11 traçable ; aucun résultat ni score ni validation automatique', () => {
  const p=preparer(); assert.equal(p.champs.probabilite,.8); assert.equal(p.champs.hypothese,`constat:d-1:${ETAPE.ts}:H1`);
  assert.equal(p.champs.statut,'ouverte'); assert.match(p.motif,/corpus-1/); assert.match(p.motif,/s-1/);
  for(const k of ['resultat','brier','origine','relu','entree_directe']) assert.ok(!(k in p) && !(k in p.champs));
  for(const k of ['probabilite','echeance','critere_resolution']) assert.throws(()=>preparer({...SAISIE,[k]:''}));
  for(const k of ['validee','complet']) assert.throws(()=>preparer(SAISIE,{...ETAPE,[k]:false}));
});
test('contrat et droits vérifiés avant tout versement', () => {
  verifierContrat(PING,TYPES);
  assert.throws(()=>verifierContrat({...PING,droits:['lecture']},TYPES));
  assert.throws(()=>verifierContrat(PING,{schema:1,types:{}}));
});

function relais(fetch) {
  const ctx={ URL, AbortController, setTimeout, clearTimeout, fetch };
  runInNewContext(readFileSync('background/prisme.js','utf8'),ctx);
  return ctx.constatPrismeRelayer;
}
test('relais : trois routes, en-tête dédié, redirections interdites', async () => {
  const appels=[];
  const envoyer=relais(async (url,options)=>{appels.push({url,options});return {ok:true,status:201,text:async()=>'{"acceptee":true}'};});
  const r=await envoyer({base:'http://localhost:5000',cle:CLE,route:'/api/v1/proposer',corps:preparer()});
  assert.equal(r.data.acceptee,true); assert.equal(appels.length,1);
  assert.equal(appels[0].options.redirect,'error'); assert.equal(appels[0].options.credentials,'omit');
  assert.equal(appels[0].options.headers['X-Prisme-Cle'],CLE);
  for(const mod of [{base:'http://example.org'}, {route:'/api/v1/ecrire'}, {cle:'secret'}, {corps:{type:'tache'}}]) {
    assert.ok((await envoyer({base:'http://localhost:5000',cle:CLE,route:'/api/v1/proposer',corps:preparer(),...mod})).erreur);
  }
  assert.equal(appels.length,1);
});
test('erreurs de réseau sans clé, corps ni renvoi', async () => {
  let appels=0; const envoyer=relais(async()=>{appels++;throw new Error(CLE);});
  const r=await envoyer({base:'http://localhost:5000',cle:CLE,route:'/api/v1/ping'});
  assert.ok(r.erreur); assert.ok(!r.erreur.includes(CLE)); assert.equal(appels,1);
});
function navigateur(repondre) {
  const appels=[];
  return { appels, permissions:{request:async()=>true}, runtime:{connect({name}) {
    assert.equal(name,'constat-prisme'); let message,fermeture;
    return {onMessage:{addListener:f=>message=f},onDisconnect:{addListener:f=>fermeture=f},
      disconnect:()=>fermeture?.(), postMessage(m){appels.push(m);queueMicrotask(()=>{
        const r=repondre(m);if(r!==undefined)message(r);
      });}};
  }}};
}
test('transport : réponse perdue, une tentative et message vérifiable', async () => {
  const api=navigateur(()=>undefined);
  await assert.rejects(appelPrisme(api,{route:'/api/v1/proposer'},5),/Vérifiez sa file/);
  assert.equal(api.appels.length,1);
});
test('transport : refus HTTP ne devient pas succès', async () => {
  const api=navigateur(()=>({ok:false,status:409,data:{secret:CLE}}));
  await assert.rejects(appelPrisme(api,{}),/déjà en file/);
  assert.equal(api.appels.length,1);
});

function dom() {
  const {document,window}=parseHTML(readFileSync('sidebar/panel.html','utf8'));
  globalThis.document=document;
  window.HTMLElement.prototype.scrollIntoView=function(){};
  return {document,window,$:id=>document.getElementById(id)};
}
test('bouton par hypothèse seulement sur ACH complète validée, texte échappé', () => {
  dom(); let selection;
  const r=rendreEtapes([ETAPE],()=>{},(e,id)=>selection=[e,id]);
  assert.equal(r.querySelectorAll('script').length,0);
  const b=[...r.querySelectorAll('button')].find(n=>n.textContent.startsWith('Verser'));
  assert.ok(b);b.click();assert.equal(selection[1],'H1');
  for(const k of ['validee','complet']) {
    const n=rendreEtapes([{...ETAPE,[k]:false}],()=>{},()=>{});
    assert.ok(![...n.querySelectorAll('button')].some(b=>b.textContent.startsWith('Verser')));
  }
});
async function formulaire() {
  const vue=dom(); const D=new Dossiers(stockageMemoire());
  await D.creer(META);await D.ajouter(META.id,{t:'releve',empreinteCorpus:'corpus-1'});await D.ajouter(META.id,ETAPE);
  const api=navigateur(m=>({ok:true,status:200,data:m.route.endsWith('/ping')?PING:m.route.endsWith('/types')?TYPES:{acceptee:true,entree:{type:'prediction',cle:'prediction:retour'}}}));
  const etats=[];let courant=META.id;
  const controle=installerPrisme({api,dossiers:D,courant:()=>courant,etat:t=>etats.push(t)});
  await controle.ouvrir(META.id,ETAPE,'H1');
  const remplir=()=>{vue.$('prisme-cle').value=CLE;for(const [k,v] of Object.entries(SAISIE))vue.$('prisme-'+k).value=v;};
  const soumettre=()=>vue.$('form-prisme-pari').dispatchEvent(new vue.window.Event('submit',{cancelable:true}));
  const fini=async()=>{for(let n=0;n<30;n++){await new Promise(r=>setTimeout(r,1));if(!vue.$('prisme-envoyer').disabled)return;}throw Error('Formulaire bloqué');};
  return {...vue,D,api,etats,controle,remplir,soumettre,fini,changer:id=>courant=id};
}
test('formulaire : trois champs vides ; envoi unique et journal sans clé', async () => {
  const f=await formulaire();
  for(const k of ['probabilite','echeance','critere_resolution'])assert.equal(f.$('prisme-'+k).value,'');
  assert.ok(!f.$('prisme-memoriser').checked);
  f.remplir();f.soumettre();f.soumettre();await f.fini();
  assert.equal(f.api.appels.filter(x=>x.route.endsWith('/proposer')).length,1);
  const traces=(await f.D.journal(META.id)).filter(x=>x.t==='prisme-proposition');
  assert.equal(traces.length,1);assert.ok(!JSON.stringify(traces).includes(CLE));
  assert.equal((await f.D.s.get('prisme-reglages')).cle,'');
  assert.match(f.etats.at(-1),/pas encore dans le vault/);
  await f.controle.ouvrir(META.id,ETAPE,'H1');f.remplir();f.soumettre();await f.fini();
  assert.equal(f.api.appels.filter(x=>x.route.endsWith('/proposer')).length,1);
  assert.match(f.etats.at(-1),/déjà été envoyée/);
});
test('dossier clos, corpus changé ou permission refusée : aucun POST', async () => {
  for(const cas of ['clos','corpus','permission','autreDossier']) {
    const f=await formulaire();f.remplir();
    if(cas==='clos')await f.D.ajouter(META.id,{t:'etat',etat:'corbeille'});
    if(cas==='corpus')await f.D.ajouter(META.id,{t:'releve',empreinteCorpus:'nouveau'});
    if(cas==='permission')f.api.permissions.request=async()=>false;
    if(cas==='autreDossier')f.changer('autre');
    f.soumettre();await f.fini();
    assert.equal(f.api.appels.length,0,cas);assert.equal(f.$('prisme-probabilite').value,'0.8');
  }
});
