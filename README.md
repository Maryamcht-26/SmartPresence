# SmartPresence

Progressive Web App for managing student attendance in a school or university.
Attendance is taken either by **scanning a session QR code** or by **face recognition**,
and teachers and administrators manage schedules, groups and attendance records from a
dedicated back office.

**English** | [Français](#français)

---

## Overview

SmartPresence is made of three applications:

| Application | Role |
|---|---|
| `backend/` | REST API (FastAPI) — authentication, data, face recognition, attendance logic |
| `frontend-student/` | Student PWA — log in, enroll a face, scan the session QR code, mark attendance |
| `frontendAdmin-Prof/` | Admin & teacher PWA — manage programmes, levels, groups, students, teachers and schedules; open sessions, generate QR codes, review and export attendance |

### Main features

- **Two ways to mark attendance** — QR code scanning (`html5-qrcode`, `jsqr`) and face
  recognition (client-side `face-api`, server-side InsightFace / ONNX Runtime).
- **Face enrollment** — a student registers a reference photo once, then is recognized at
  each session.
- **Session management** — teachers open a session and generate a QR code
  (`qrcode.react`); students have a limited time window to check in.
- **Academic structure** — programmes (filières), levels (niveaux), groups, students and
  teachers managed from the back office.
- **Schedules** — timetable files handled as Excel documents (`pandas`, `openpyxl`) and
  served as static files.
- **Attendance export** — attendance sheets exported to Excel (`xlsx`).
- **Installable PWA** — the admin/teacher app can be installed on desktop or mobile
  (`vite-plugin-pwa`).

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy 2, PostgreSQL (psycopg2) |
| Auth | JWT (python-jose) + password hashing (passlib / bcrypt) |
| Face recognition | InsightFace, OpenCV, ONNX Runtime (backend); `@vladmandic/face-api` (frontend) |
| Student frontend | React 18, Vite 5, React Router 6, Axios |
| Admin/teacher frontend | React 19, Vite 8, React Router 7, Axios, vite-plugin-pwa |

## Repository structure

```
SmartPresence/
├── backend/
│   ├── app/
│   │   ├── core/          config and security (JWT, hashing)
│   │   ├── db/            SQLAlchemy engine and session
│   │   ├── models/        ORM models
│   │   ├── repositories/  database access
│   │   ├── routes/        API routes (admin / prof / etudiant)
│   │   ├── schemas/       Pydantic schemas
│   │   └── services/      business logic (incl. face recognition)
│   ├── emplois/           schedule files (Excel)
│   └── requirements.txt
├── frontend-student/
└── frontendAdmin-Prof/
```

## Prerequisites

- Python 3.10+
- Node.js 20+ and npm
- PostgreSQL 14+

## Getting started

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv310
venv310\Scripts\activate        # Windows
# source venv310/bin/activate   # macOS / Linux
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/smartpresence
SECRET_KEY=replace_with_a_long_random_secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

Run the API:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API is available on `http://localhost:8000` (interactive docs at `/docs`).

### 2. Frontends (React / Vite)

```bash
# Student app
cd frontend-student
npm install
npm run dev

# Admin & teacher app
cd frontendAdmin-Prof
npm install
npm run dev
```

Set the backend URL in each frontend's API configuration (`.env` or config file) before
starting.

### 3. Testing on a phone (QR scan + camera)

Camera access requires HTTPS, so to test from a mobile device expose the backend (and, if
needed, the frontend) through a tunnel:

```bash
# Cloudflare Tunnel (no account required)
cloudflared tunnel --url http://localhost:8000

# or ngrok
ngrok http 5173
```

The free Cloudflare tunnel URL changes on every restart — update it in the frontend
configuration each time.

**Recommended startup order:** backend → backend tunnel → update the backend URL in the
frontend config → frontends.

## Build

```bash
cd frontend-student && npm run build        # output in dist/
cd frontendAdmin-Prof && npm run build      # output in dist/
```

## Authors

- **Hanane Aissaoui**
- **Yassmina Ait-ben-Addi**
- **Maryam Chtioui**

End-of-year project (PFA) — École Nationale des Sciences Appliquées d'Oujda (ENSAO).

---

## Français

Application web progressive (PWA) de gestion de la présence des étudiants dans un
établissement scolaire ou universitaire. La présence est prise soit en **scannant le QR
code de la séance**, soit par **reconnaissance faciale**, et les enseignants et
administrateurs gèrent les emplois du temps, les groupes et les relevés de présence depuis
un back-office dédié.

[English](#smartpresence) | **Français**

### Présentation

SmartPresence est composé de trois applications :

| Application | Rôle |
|---|---|
| `backend/` | API REST (FastAPI) — authentification, données, reconnaissance faciale, logique de présence |
| `frontend-student/` | PWA étudiant — se connecter, enregistrer son visage, scanner le QR code de la séance, marquer sa présence |
| `frontendAdmin-Prof/` | PWA admin et enseignant — gérer filières, niveaux, groupes, étudiants, professeurs et emplois du temps ; ouvrir des séances, générer les QR codes, consulter et exporter les présences |

### Principales fonctionnalités

- **Deux modes de pointage** — scan de QR code (`html5-qrcode`, `jsqr`) et reconnaissance
  faciale (`face-api` côté client, InsightFace / ONNX Runtime côté serveur).
- **Enregistrement du visage** — l'étudiant enregistre une photo de référence une fois,
  puis est reconnu à chaque séance.
- **Gestion des séances** — l'enseignant ouvre une séance et génère un QR code
  (`qrcode.react`) ; les étudiants disposent d'une fenêtre de temps limitée pour pointer.
- **Structure académique** — filières, niveaux, groupes, étudiants et professeurs gérés
  depuis le back-office.
- **Emplois du temps** — fichiers d'emploi du temps traités au format Excel (`pandas`,
  `openpyxl`) et servis en fichiers statiques.
- **Export des présences** — feuilles de présence exportées en Excel (`xlsx`).
- **PWA installable** — l'application admin/enseignant peut être installée sur ordinateur
  ou mobile (`vite-plugin-pwa`).

### Stack technique

| Couche | Technologie |
|---|---|
| Backend | Python 3.10+, FastAPI, Uvicorn, SQLAlchemy 2, PostgreSQL (psycopg2) |
| Authentification | JWT (python-jose) + hachage des mots de passe (passlib / bcrypt) |
| Reconnaissance faciale | InsightFace, OpenCV, ONNX Runtime (backend) ; `@vladmandic/face-api` (frontend) |
| Frontend étudiant | React 18, Vite 5, React Router 6, Axios |
| Frontend admin/enseignant | React 19, Vite 8, React Router 7, Axios, vite-plugin-pwa |

### Structure du dépôt

```
SmartPresence/
├── backend/
│   ├── app/
│   │   ├── core/          configuration et sécurité (JWT, hachage)
│   │   ├── db/            moteur et session SQLAlchemy
│   │   ├── models/        modèles ORM
│   │   ├── repositories/  accès à la base
│   │   ├── routes/        routes de l'API (admin / prof / etudiant)
│   │   ├── schemas/       schémas Pydantic
│   │   └── services/      logique métier (dont la reconnaissance faciale)
│   ├── emplois/           fichiers d'emploi du temps (Excel)
│   └── requirements.txt
├── frontend-student/
└── frontendAdmin-Prof/
```

### Prérequis

- Python 3.10+
- Node.js 20+ et npm
- PostgreSQL 14+

### Démarrage

#### 1. Backend (FastAPI)

```bash
cd backend
python -m venv venv310
venv310\Scripts\activate        # Windows
# source venv310/bin/activate   # macOS / Linux
pip install -r requirements.txt
```

Créer le fichier `backend/.env` :

```env
DATABASE_URL=postgresql://user:password@localhost:5432/smartpresence
SECRET_KEY=remplacer_par_une_cle_secrete_longue_et_aleatoire
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

Lancer l'API :

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

L'API est disponible sur `http://localhost:8000` (documentation interactive sur `/docs`).

#### 2. Frontends (React / Vite)

```bash
# Application étudiant
cd frontend-student
npm install
npm run dev

# Application admin et enseignant
cd frontendAdmin-Prof
npm install
npm run dev
```

Renseigner l'URL du backend dans la configuration API de chaque frontend (`.env` ou
fichier de config) avant de lancer.

#### 3. Test sur téléphone (scan QR + caméra)

L'accès à la caméra nécessite HTTPS : pour tester depuis un mobile, exposer le backend
(et si besoin le frontend) via un tunnel :

```bash
# Cloudflare Tunnel (aucun compte requis)
cloudflared tunnel --url http://localhost:8000

# ou ngrok
ngrok http 5173
```

L'URL du tunnel Cloudflare gratuit change à chaque redémarrage — il faut la mettre à jour
dans la configuration du frontend à chaque fois.

**Ordre de démarrage recommandé :** backend → tunnel du backend → mise à jour de l'URL du
backend dans la config frontend → frontends.

### Compilation

```bash
cd frontend-student && npm run build        # sortie dans dist/
cd frontendAdmin-Prof && npm run build      # sortie dans dist/
```

### Auteurs

- **Hanane Aissaoui**
- **Yassmina Ait-ben-Addi**
- **Maryam Chtioui**

Projet de fin d'année (PFA) — École Nationale des Sciences Appliquées d'Oujda (ENSAO).
