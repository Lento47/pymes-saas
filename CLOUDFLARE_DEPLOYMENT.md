# PymeHub Deployment to Cloudflare Pages

## Architecture Options

### Option 1: Cloudflare Pages + Cloudflare Workers (Recommended for Cloudflare)
```
Frontend: Cloudflare Pages (React SPA)
Backend: Cloudflare Workers (Node.js runtime)
Database: Cloudflare D1 (SQLite) or External PostgreSQL
Storage: Cloudflare R2 (S3-compatible)
```

**Pros:**
- Everything in Cloudflare ecosystem
- Low latency globally
- Pay-as-you-go pricing
- Easy integration

**Cons:**
- NestJS needs porting to Workers
- D1 is SQLite (not PostgreSQL)
- More refactoring work

---

### Option 2: Cloudflare Pages + External API Server (Simpler)
```
Frontend: Cloudflare Pages (React SPA)
Backend: External server (Railway, VPS, etc.) - keeps NestJS
Database: PostgreSQL (external)
Storage: S3 or Cloudflare R2
```

**Pros:**
- No NestJS refactoring
- Works with existing code
- Can use PostgreSQL
- Faster to deploy

**Cons:**
- Backend hosted separately
- More infrastructure to manage
- Slightly higher latency for API calls

---

### Option 3: Hybrid - Cloudflare Pages with API Proxy
```
Frontend: Cloudflare Pages (React SPA)
Proxy/Router: Cloudflare Workers (redirect API calls)
Backend: External NestJS server
```

**Pros:**
- Single Cloudflare entry point
- Routes to backend via Workers
- No frontend refactoring

**Cons:**
- Extra routing layer
- Still need external backend

---

## Recommended Approach: Option 2

**Why:** Fastest path to production with minimal changes

### Deployment Stack
```
┌─────────────────────────────────────────┐
│  Cloudflare Pages                       │
│  ├─ React SPA (frontend)                │
│  └─ Static assets, cache                │
└─────────────────────────────────────────┘
           ↓ (HTTPS)
┌─────────────────────────────────────────┐
│  Backend Server (Railway/VPS)           │
│  ├─ NestJS API                          │
│  ├─ Node.js runtime                     │
│  └─ WebSocket support                   │
└─────────────────────────────────────────┘
           ↓ (Connection pooling)
┌─────────────────────────────────────────┐
│  PostgreSQL Database                    │
│  └─ Your data                           │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  S3/Cloudflare R2                       │
│  └─ Files, documents, uploads           │
└─────────────────────────────────────────┘
```

---

## Step-by-Step Deployment

### 1. Prepare Frontend for Cloudflare Pages

**Create build configuration:**
```toml
# wrangler.toml
name = "pymeshub-web"
type = "javascript"
route = "example.com/*"
zone_id = "YOUR_ZONE_ID"

[env.production]
routes = [
  { pattern = "example.com", zone_name = "example.com" }
]

[build]
command = "pnpm run build"
cwd = "./apps/web"
watch_paths = ["apps/web/**/*.tsx"]

[[build.upload.rules]]
type = "CompiledContentType"
globs = ["**/*.wasm"]
fallthrough = true

[[build.upload.rules]]
type = "Text"
globs = ["**/*.{js,css,html}"]
fallthrough = true

[[env.production.routes]]
pattern = "api.example.com/*"
zone_name = "example.com"
custom_domain = true
```

**Update vite.config.ts for Cloudflare:**
```typescript
export default defineConfig({
  // ... existing config
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  // Cloudflare specific
  define: {
    'process.env.API_URL': JSON.stringify(
      process.env.NODE_ENV === 'production' 
        ? 'https://api.example.com' 
        : 'http://localhost:4000'
    ),
  },
});
```

### 2. Deploy Backend to Railway

**Create `railway.toml`:**
```toml
[build]
builder = "dockerfile"

[deploy]
startCommand = "node dist/main"
```

**Create `Dockerfile`:**
```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

RUN cd apps/api && npm run build

EXPOSE 4000

CMD ["node", "apps/api/dist/main"]
```

### 3. Setup PostgreSQL

**Options:**
- Railway PostgreSQL add-on (easiest)
- Neon (serverless PostgreSQL)
- AWS RDS
- Your own VPS

### 4. Configure Environment Variables

**Cloudflare Pages:**
```
API_URL=https://api.example.com
```

**Railway (Backend):**
```
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
NODE_ENV=production
RESEND_API_KEY=your-key
WHATSAPP_API_KEY=your-key
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

### 5. Deploy Frontend

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler deploy
```

### 6. Deploy Backend

```bash
# Push to Railway (requires Railway CLI)
railway up
```

---

## DNS Setup

**Add to your domain's DNS:**
```
example.com          → Cloudflare Pages (CNAME)
api.example.com      → Railway Backend (CNAME)
www.example.com      → Cloudflare Pages (CNAME)
```

---

## CORS Configuration

**Update API (NestJS):**
```typescript
app.enableCors({
  origin: ['https://example.com', 'https://www.example.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
});
```

---

## Production Checklist for Cloudflare

- [ ] GitHub repository connected
- [ ] Cloudflare account created
- [ ] Domain added to Cloudflare
- [ ] Pages project created
- [ ] Build command: `cd apps/web && pnpm install && pnpm run build`
- [ ] Build output directory: `dist/public`
- [ ] Railway account created
- [ ] Backend deployed to Railway
- [ ] PostgreSQL database created
- [ ] Environment variables configured (both sides)
- [ ] API_URL pointing to Railway backend
- [ ] Database migrations run
- [ ] CORS configured
- [ ] Domain DNS pointing to Cloudflare + Railway
- [ ] SSL certificates auto-provisioned
- [ ] Test API connectivity
- [ ] Monitor error logs

---

## Pricing Estimate

- **Cloudflare Pages**: Free (500 builds/month)
- **Railway**: $5-20/month (for backend + database)
- **Domain**: $10-15/year
- **Total**: ~$30-40/month

---

## Commands to Deploy

```bash
# Build frontend
cd apps/web && pnpm run build

# Deploy to Cloudflare Pages
wrangler deploy

# Deploy backend to Railway
cd apps/api && npm run build
railway up
```

---

## Need Help With?

1. **Create Cloudflare Pages project**
2. **Create Railway backend project**
3. **Set up automatic deployments** from GitHub
4. **Configure environment variables**
5. **Test production deployment**
