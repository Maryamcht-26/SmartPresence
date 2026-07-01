##  Lancement du projet en local

### Prérequis
- Python 3.10+ avec les dépendances installées (`pip install -r requirements.txt`)
- Node.js + npm installés côté frontend
- [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) installé (tunnel gratuit, pas besoin de compte)
- (Optionnel) [ngrok](https://ngrok.com/download) si tu préfères l'utiliser à la place de cloudflared

### 1. Lancer le backend (FastAPI)
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
> Démarre l'API sur le port `8000`, accessible sur toutes les interfaces réseau (utile pour le tunnel).

### 2. Exposer le backend publiquement (Cloudflare Tunnel)
```bash
cloudflared tunnel --url http://localhost:8000
```
> Génère une URL publique temporaire (ex: `https://xxxx-xxxx.trycloudflare.com`) à copier dans la config du frontend (`.env` ou fichier de config API).

**Attention** : à chaque redémarrage de `cloudflared`, l'URL change (tunnel gratuit non persistant). Il faut donc mettre à jour l'URL côté frontend à chaque fois.

### 3. Lancer le frontend (React/Vite)
```bash
npm run dev -- --host 0.0.0.0
```
ou directement avec Vite :
```bash
npx vite --host
```
> Démarre le frontend sur `0.0.0.0` (accessible depuis d'autres appareils du réseau local, utile pour tester le scan QR sur mobile).

### 4. (Alternative) Exposer le frontend avec ngrok
```bash
ngrok config add-authtoken <TON_TOKEN>
ngrok http 5175
```
> À utiliser si tu veux exposer le frontend (port `5175`) plutôt que/en plus du backend. Nécessite un compte ngrok gratuit et un authtoken.

### Ordre de démarrage recommandé
1. Backend (`uvicorn`)
2. Tunnel backend (`cloudflared` ou `ngrok`)
3. Mettre à jour l'URL du backend dans la config frontend
4. Frontend (`npm run dev` / `vite`)
