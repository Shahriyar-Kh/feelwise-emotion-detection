# FeelWise Free Deployment Plan

## Goal

Deploy the project with the lowest possible cost while keeping login, signup, profile, progress tracking, and the main frontend publicly accessible.

Because this project has:

- one static frontend,
- one Node.js API gateway,
- multiple FastAPI services,
- MongoDB Atlas,
- heavy ML workloads for face and speech,

the best free plan is **phased deployment**, not deploying every service at once on always-on free compute.

## Recommended Free Architecture

### Phase 1: Deploy the Core Product

Deploy these parts first:

- Frontend: static hosting
- Node.js main server: auth, progress, proxy gateway
- MongoDB Atlas: database
- Text analysis API: deployable on small free compute
- Journal API: deployable on small free compute

Do **not** deploy these in phase 1 unless you confirm enough RAM and CPU:

- Face analysis API
- Speech analysis API

Reason:

- face analysis uses DeepFace/OpenCV/PyTorch and is heavy for free web instances
- speech analysis loads Transformers/Wav2Vec2 and is heavy for free memory limits
- these two services are the most likely to fail, cold start slowly, or exceed free quotas

## Free Hosting Split

### Frontend

Use one of these free static hosting providers:

- Cloudflare Pages
- Netlify
- GitHub Pages

Recommended choice:

- Cloudflare Pages for simple static hosting and stable free limits

### Database

Use:

- MongoDB Atlas free tier

This is already aligned with the current project.

### Backend Compute

Use a free web-service provider for:

- Node.js main server
- Python text analysis API
- Python journal API

Examples of free-friendly providers that are commonly used for this kind of setup:

- Render-like web service hosting
- Railway-like usage-credit hosting
- Koyeb-like free service hosting
- Fly.io-like small app hosting

Free plans change often. Before committing to one provider, confirm:

- whether free web services are still available,
- RAM limit,
- sleep/cold-start behavior,
- monthly execution quota,
- outbound network access to MongoDB Atlas.

## Recommended Service Layout

### Publicly Deployed

#### 1. Frontend

- Host the `Frontend/` folder as a static site

#### 2. Node.js Main Server

- Deploy `FastAPI_Backend/main-server.js`
- Responsibilities:
  - authentication
  - profile routes
  - progress routes
  - CORS
  - proxying to text and journal services

#### 3. Text Analysis Service

- Deploy `FastAPI_Backend/text-analysis-api.py`

#### 4. Journal API

- Deploy `FastAPI_Backend/journal_api.py`

### Keep Local or Deploy Later

#### 5. Face Analysis Service

- Keep local during first public deployment
- Optional later target:
  - Hugging Face Space
  - separate GPU-capable service
  - paid instance if needed

#### 6. Speech Analysis Service

- Keep local during first public deployment
- Optional later target:
  - Hugging Face Space
  - separate higher-memory instance
  - paid instance if needed

## Minimum Code Changes Before Deployment

### 1. Make Frontend API URLs Configurable

Current frontend files use hardcoded localhost URLs such as:

- `http://localhost:5000/api/auth`

Before deployment, replace hardcoded API bases with one shared config pattern.

Recommended approach:

- add one frontend config file that defines the backend base URL
- use relative or environment-based URLs in all frontend JS files

Example target pattern:

```js
window.APP_CONFIG = {
  API_BASE: "https://your-main-server-domain.com"
};
```

Then frontend code should use:

```js
const API_BASE = `${window.APP_CONFIG.API_BASE}/api/auth`;
```

### 2. Move CORS to Environment-Driven Production Config

Your backend already supports configurable origins. For production, set:

- `ALLOWED_ORIGINS=https://your-frontend-domain.pages.dev`

Add local origins only for development.

### 3. Rotate Exposed Secrets

The repository currently contains live-looking secrets in `.env` values. Before any public deployment:

- rotate MongoDB credentials
- rotate Gmail app password
- rotate JWT secret

Do not publish real secrets to GitHub.

### 4. Separate Development and Production Startup

Current scripts use `--reload`, which is for local development.

Production should use:

- Node: `node main-server.js`
- FastAPI: `uvicorn module:app --host 0.0.0.0 --port <PORT>`

without `--reload`.

### 5. Decide on External Service URLs in Production

The Node gateway currently proxies to fixed local service addresses.

Move these to environment variables such as:

- `TEXT_SERVICE_URL`
- `JOURNAL_SERVICE_URL`
- `FACE_SERVICE_URL`
- `SPEECH_SERVICE_URL`

Then production can point to deployed services instead of `127.0.0.1`.

## Best Free Deployment Path

### Option A: Recommended

#### Frontend

- Cloudflare Pages

#### Main API

- one free Node.js web service

#### Text API

- one free Python web service

#### Journal API

- one free Python web service

#### Database

- MongoDB Atlas free tier

#### Face and Speech

- local only for now

Why this is the best path:

- login and database features work publicly
- text analysis and journal features remain usable
- you avoid the two heavy ML services that are most likely to break on free instances

### Option B: Single Backend Simplification

If you want the cheapest and simplest public deployment, merge these into one backend:

- Node auth/progress routes
- text analysis route
- journal route

That gives you:

- one static frontend
- one backend service
- one MongoDB Atlas database

This is the easiest long-term free deployment model.

## Suggested Production Environment Variables

### Node Main Server

```env
PORT=5000
NODE_ENV=production
MONGODB_URI=<atlas-uri>
JWT_SECRET=<new-secret>
ALLOWED_ORIGINS=https://your-frontend-domain.pages.dev
TEXT_SERVICE_URL=https://your-text-service-domain.com
JOURNAL_SERVICE_URL=https://your-journal-service-domain.com
FACE_SERVICE_URL=
SPEECH_SERVICE_URL=
ENABLE_FALLBACK_ANALYSIS=true
EMAIL_USER=<your-email>
EMAIL_PASSWORD=<new-app-password>
FRONTEND_URL=https://your-frontend-domain.pages.dev
```

### Text API

```env
PORT=8001
```

### Journal API

```env
MONGODB_URI=<atlas-uri>
PORT=8004
```

## Deployment Steps

### Step 1

Prepare production-safe config:

- remove hardcoded localhost-only URLs
- rotate secrets
- confirm MongoDB Atlas network access allows your hosting provider

### Step 2

Deploy MongoDB Atlas first:

- verify database user
- verify IP/network rules
- verify database name

### Step 3

Deploy the Node.js main server:

- add production env vars
- verify `/health`
- verify `/api/auth/register`
- verify `/api/auth/login`

### Step 4

Deploy text and journal Python services:

- confirm startup logs
- test service URLs directly
- test Node proxy integration through the main server

### Step 5

Deploy the frontend:

- point frontend to production backend URL
- verify login
- verify signup
- verify profile page
- verify progress page

### Step 6

Enable optional services later:

- face analysis
- speech analysis

## What Will Work on a Free Deployment

Most likely reliable on free hosting:

- landing page
- signup/login
- JWT auth
- user profile
- progress tracking
- text analysis
- journal features

Most likely problematic on free hosting:

- always-on speech model inference
- always-on face model inference
- fast cold starts for ML-heavy services

## Recommended Success Criteria

Call the deployment successful when these work publicly:

- frontend loads from a public URL
- user can register
- user can log in
- MongoDB data is saved correctly
- text analysis works through the main server
- journal entry save/read works through the main server

After that, treat face and speech as phase 2.

## Practical Recommendation

For this project, the most realistic free deployment plan is:

1. Deploy frontend on Cloudflare Pages.
2. Keep MongoDB Atlas free tier.
3. Deploy Node main server as one public backend service.
4. Deploy text and journal as separate lightweight Python services.
5. Leave face and speech local until you are ready for higher-memory hosting.

If you want the cleanest long-term result, simplify the architecture later so the public deployment has fewer services.