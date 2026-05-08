# PymesHub SaaS - Branch-Based Deployment Guide

## 🏗️ Architecture

### Your Infrastructure
```
GitHub Branches:
├── main-web          → Cloudflare Pages (PymesHub.lat)
├── main-api          → Railway (api.PymesHub.lat)
└── main              → Stable production releases

Your Domain: PymesHub.lat
├── PymesHub.lat               → Frontend (Cloudflare Pages)
├── www.PymesHub.lat           → Frontend (Cloudflare Pages)
├── api.PymesHub.lat           → Backend API (Railway)
└── download.PymesHub.lat      → File downloads (Future: MSI installer)
```

---

## 📦 Branch Strategy

### `main-web` (Frontend)
- **Contains:** `apps/web/`, build configs, landing page
- **Deploys to:** Cloudflare Pages (PymesHub.lat)
- **Triggers on:** Push to `main-web` branch
- **Build:** `cd apps/web && pnpm run build`
- **Output:** `apps/web/dist/public`

### `main-api` (Backend)
- **Contains:** `apps/api/`, Docker file, database migrations
- **Deploys to:** Railway (api.PymesHub.lat)
- **Triggers on:** Push to `main-api` branch
- **Build:** Docker build via Dockerfile
- **Output:** Node.js container running NestJS API

### `main` (Stable Release)
- **Contains:** Everything (full codebase)
- **Purpose:** Stable reference point
- **Never deployed directly**
- **Updated after:** Both `main-web` and `main-api` are tested

---

## 🚀 Deployment Workflow

### Step 1: Deploy Frontend to Cloudflare Pages

**1.1 Setup Cloudflare Pages**
```bash
npm install -g wrangler
wrangler login
```

**1.2 Create Pages Project**
- Go to https://dash.cloudflare.com
- Select your PymesHub.lat domain
- Workers & Pages > Pages > Create application > Connect to Git
- Repository: pymes-saas
- Production branch: main-web
- Build command: `pnpm install --frozen-lockfile && cd apps/web && pnpm run build`
- Build output: `apps/web/dist/public`

**1.3 Environment Variables**
```
API_URL=https://api.PymesHub.lat
VITE_API_URL=https://api.PymesHub.lat
VITE_WEBSOCKET_URL=wss://api.PymesHub.lat
VITE_APP_NAME=PymesHub
VITE_APP_URL=https://PymesHub.lat
```

**1.4 Deploy**
```bash
git push origin main-web
# Cloudflare automatically builds and deploys
```

### Step 2: Deploy Backend to Railway

**2.1 Setup Railway**
- Go to https://railway.app
- New Project > GitHub Repo
- Select pymes-saas repository
- Railway auto-detects Dockerfile

**2.2 Add PostgreSQL Database**
- New > Database > PostgreSQL
- Copy DATABASE_URL

**2.3 Environment Variables**
```
DATABASE_URL=postgresql://... (from PostgreSQL service)
JWT_SECRET=your-generated-secret-key
JWT_EXPIRES_IN=24h
NODE_ENV=production
RESEND_API_KEY=your-resend-key
WHATSAPP_API_KEY=your-whatsapp-key
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
FRONTEND_URL=https://PymesHub.lat
```

**2.4 Health Check**
- Service Settings > Health Check Path: `/api/health`
- Timeout: 100

**2.5 Deploy**
```bash
git push origin main-api
# Railway automatically builds and deploys
```

### Step 3: Configure DNS

**In Cloudflare Dashboard:**
```
Record Type    Name              Value                    TTL
A              @                 Auto (Cloudflare)        Auto
CNAME          www               PymesHub.lat             Auto
CNAME          api               your-railway-domain      Auto
```

---

## ✅ Testing Deployment

### Test Frontend
```bash
curl https://PymesHub.lat
# Should return React app HTML
```

### Test Backend
```bash
curl https://api.PymesHub.lat/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

### Test Connection
1. Go to https://PymesHub.lat
2. Login with test credentials
3. Open DevTools > Network
4. Check API calls to api.PymesHub.lat

---

## 🔄 Deployment Workflow (Daily Development)

### When Developing Frontend
```bash
# On local machine
git checkout main-web
# ... make changes to apps/web/ ...
git add apps/web/
git commit -m "feat: update dashboard"
git push origin main-web
# ✅ Cloudflare Pages auto-deploys
```

### When Developing Backend
```bash
# On local machine
git checkout main-api
# ... make changes to apps/api/ ...
git add apps/api/
git commit -m "feat: add new API endpoint"
git push origin main-api
# ✅ Railway auto-deploys
```

### When Both Frontend and Backend Need Changes
```bash
# Develop on separate branches
git checkout -b feature/my-feature
# ... make changes ...
git push origin feature/my-feature

# Create PRs to respective branches
# PR 1: main-web (for frontend changes)
# PR 2: main-api (for backend changes)

# Review and merge independently
# Each auto-deploys to its environment
```

---

## 📋 GitHub Actions Workflows

### deploy-cloudflare.yml
- **Trigger:** Push/PR to `main-web`
- **Steps:**
  1. Checkout code
  2. Install dependencies
  3. Build web app
  4. Deploy to Cloudflare Pages

### deploy-railway.yml
- **Trigger:** Push/PR to `main-api`
- **Paths:**  Only when `apps/api/`, `Dockerfile`, or `railway.toml` change
- **Steps:**
  1. Checkout code
  2. Install dependencies
  3. Build API
  4. Run linter
  5. Deploy to Railway

---

## 🔒 GitHub Secrets Required

Set these in GitHub > Repository > Settings > Secrets:

```
CLOUDFLARE_API_TOKEN    # From Cloudflare > My Profile > API Tokens
CLOUDFLARE_ACCOUNT_ID   # From Cloudflare > Accounts page
RAILWAY_TOKEN           # From Railway > Account Settings
```

---

## 📊 Monitoring Deployments

### Cloudflare Pages
```bash
wrangler pages deployment list
wrangler pages deployment info <deployment-id>
```

### Railway
```bash
railway logs
railway logs -n 100  # Last 100 lines
```

---

## 🆘 Troubleshooting

### Frontend Deploy Fails
```bash
# Check logs
wrangler pages deployment list

# Test build locally
cd apps/web
pnpm run build
ls -la dist/public
```

### Backend Deploy Fails
```bash
# Check Railway logs
railway logs

# Test Docker build
docker build -t PymesHub-api .
docker run -p 4000:4000 PymesHub-api
```

### API Unreachable
- Verify Railway deployment is healthy
- Check API_URL in Cloudflare Pages env vars
- Verify CORS in NestJS (should allow PymesHub.lat)

### Database Connection Error
- Railway > PostgreSQL > Check connection status
- Verify DATABASE_URL is correct
- Run migrations: `npx prisma migrate deploy`

---

## 🛡️ Branch-Path Guards

CI enforces branch-path isolation on `main-web` and `main-api`:

| Branch | Forbidden paths | CI behavior |
|--------|----------------|-------------|
| `main-web` | `apps/api/**`, `pnpm-lock.yaml` | `branch-guard` job fails the build |
| `main-api` | `apps/web/**` | `branch-guard` job fails the build |

Both branches emit a CI warning (not a block) when `packages/shared-types/**` files appear in a single-branch push.

### Pre-push checklist

Before pushing to a deploy branch, run:

```bash
bash scripts/check-deploy-branch.sh
```

This validates branch-scope, runs `prisma generate` (API only), and performs a target smoke build.

## 📦 shared-types Convention

`packages/shared-types/**` changes affect both frontend and backend:

1. Push shared-types as a **separate minimal commit** to `main-api`
2. Push the **same commit** to `main-web`
3. Never bundle shared-types inside a large feature commit on one branch
4. Layer feature code on top after shared-types lands on both branches

---

## 💡 Tips

1. **Keep branches clean** - Only deploy ready code to these branches
2. **Use feature branches** - Branch from `main-web` or `main-api` for development
3. **Test locally first** - Run `pnpm run build` before pushing
4. **Monitor logs** - Always check deployment logs after pushing
5. **Roll back if needed** - Railway/Cloudflare keep deployment history

---

## 🎯 Next Steps

1. ✅ Create Cloudflare & Railway accounts
2. ✅ Setup domain (PymesHub.lat)
3. ✅ Connect GitHub (auto-deploy enabled)
4. ✅ Add environment variables
5. ✅ Configure DNS
6. ✅ Test deployments
7. ✅ Monitor logs
8. 🚀 **Launch!**
