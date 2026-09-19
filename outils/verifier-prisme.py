"""Épreuve HTTP locale Constat → vraie API PRISME, avec profil et vault jetables.

Usage : python outils/verifier-prisme.py --depot CHEMIN_DU_DEPOT_PRISME
Ne lance aucun modèle et ne touche pas au profil habituel de l'auteur.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading

p = argparse.ArgumentParser()
p.add_argument('--depot', required=True, type=Path)
a = p.parse_args()
if not (a.depot / 'prisme_core').is_dir():
    p.error('Le dépôt PRISME avec E11 est requis')
for flux in (sys.stdout, sys.stderr):
    if hasattr(flux, 'reconfigure'): flux.reconfigure(encoding='utf-8')
sys.path.insert(0, str(a.depot.resolve()))
JS = r'''
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import { preparerPrediction, verifierContrat } from './core/prisme.js';
const r=JSON.parse(readFileSync(0,'utf8'));
runInThisContext(readFileSync('background/prisme.js','utf8'));
async function appel(route,corps) {
  const d=await globalThis.constatPrismeRelayer({...r,route,corps});
  if(!d.ok)throw Error(`Échec du contrat HTTP ${d.status||'réseau'}`);
  return d.data;
}
verifierContrat(await appel('/api/v1/ping'),await appel('/api/v1/types'));
const corps=preparerPrediction({dossier:{id:'essai-http',question:'Service rétabli ?'},
 etape:{numero:5,complet:true,validee:true,ts:'essai-1',valideeLe:'essai-2',releveRef:'corpus-essai',
 sortie:{hypotheses:[{id:'H1',role:'dominante',enonce:'Service rétabli',confirmerait:'HTTP 200',demolirait:'HTTP 503'}],preuves:[]}},
 hypotheseId:'H1',saisie:{titre:'Essai HTTP Constat',enonce:'Le service revient',probabilite:'0.8',
 echeance:'2099-01-08',critere_resolution:'Réponse HTTP 200 observée',domaine:'Technique'}});
const resultat=await appel('/api/v1/proposer',corps);
if(resultat.acceptee!==true||resultat.entree.type!=='prediction')throw Error('File inattendue');
process.stdout.write(JSON.stringify(resultat));
'''
with tempfile.TemporaryDirectory(prefix='constat-prisme-', ignore_cleanup_errors=True) as tmp:
    racine=Path(tmp); vault=racine/'vault'; vault.mkdir()
    os.environ['PRISME_DATA_DIR']=str(racine/'profil')
    from prisme_core import config
    from prisme_core.agents import cles
    from prisme_core.app import create_app
    from prisme_core.objets import registre, file
    from werkzeug.serving import make_server, WSGIRequestHandler
    config.wr_cfg({'workspace':str(vault),'configured':True})
    cle=cles.creer('Constat banc HTTP',['lecture','proposition'])[1]
    class Silencieux(WSGIRequestHandler):
        def log(self,*_args,**_kwargs): pass
    serveur=make_server('127.0.0.1',0,create_app(with_plugins=False),request_handler=Silencieux)
    fil=threading.Thread(target=serveur.serve_forever,daemon=True); fil.start()
    try:
        execution=subprocess.run(['node','--input-type=module','-e',JS],cwd=Path(__file__).resolve().parents[1],
            input=json.dumps({'base':f'http://127.0.0.1:{serveur.server_port}','cle':cle}),
            text=True,encoding='utf-8',capture_output=True,timeout=40,
            env=dict(os.environ,PYTHONUTF8='1',PYTHONIOENCODING='utf-8'))
        if execution.returncode:
            raise RuntimeError('Échec du client Constat : '+execution.stderr.replace(cle,'[clé masquée]'))
        resultat=json.loads(execution.stdout)
        assert len(file.lister())==1 and not registre.lister(), 'Écriture sans validation !'
        o=registre.accepter(resultat['entree']['cle'])['objet']
        assert o['champs']['probabilite']==.8 and o['champs']['statut']=='ouverte'
        assert o['relu'] and not file.lister()
        print('OK : contrat E11, relais HTTP réel, proposition en file, puis acceptation humaine simulée.')
    finally:
        serveur.shutdown();serveur.server_close();fil.join(timeout=5)
