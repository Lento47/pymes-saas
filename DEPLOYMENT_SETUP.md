# Deployment Setup Guide - Cloudflare Pages + Railway

## Prerequisites

1. **GitHub Account** - Repository ready
2. **Cloudflare Account** - With a domain
3. **Railway Account** - For backend deployment
4. **PostgreSQL Database** - Via Railway or external provider

---

## Step 1: Setup Cloudflare Pages

### 1.1 Create Cloudflare Account
- Go to https://dash.cloudflare.com
- Sign up or login
- Add your domain (or use existing)

### 1.2 Create Pages Project
```bash
# Option A: Via CLI
npm install -g wrangler
wrangler login
wrangler pages project create pymeshub-web

# Option B: Via Cloudflare Dashboard
# Go to Workers & Pages > Pages > Create application > Connect to Git
```

### 1.3 Connect GitHub Repository
1. Go to Cloudflare Dashboard > Pages
2. Click "Create application" > "Connect to Git"
3. Select your `pymes-saas` repository
4. Configure build settings:
   - **Production branch**: `cloud`
   - **Build command**: `cd apps/web && pnpm install && pnpm run build`
   - **Build output directory**: `dist/public`
   - **Root directory**: (leave blank)

### 1.4 Add Environment Variables
In Cloudflare Pages settings:
```
API_URL = https://api.pymeshub.com
VITE_API_URL = https://api.pymeshub.com
VITE_WEBSOCKET_URL = wss://api.pymeshub.com
VITE_APP_NAME = PymeHub
VITE_APP_URL = https://pymeshub.com
```

---

## Step 2: Setup Railway Backend

### 2.1 Create Railway Account
- Go to https://railway.app
- Sign up with GitHub
- Create new project

### 2.2 Add Database
1. In Railway dashboard: New > Database > PostgreSQL
2. Copy `DATABASE_URL` from variables

### 2.3 Connect GitHub Repository
1. New > GitHub Repo
2. Select `pymes-saas`
3. Railway auto-detects `Dockerfile`

### 2.4 Add Environment Variables
In Railway project settings > Variables:

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
FRONTEND_URL=https://pymeshub.com
```

### 2.5 Configure Health Check
1. Go to Railway Project > Service Settings
2. Set health check path: `/api/health`
3. Health check timeout: 100

### 2.6 Get API URL
- Railway will assign: `https://yourservice.railway.app` or custom domain
- Update this as `API_URL` in Cloudflare Pages

---

## Step 3: Configure API Health Check

Add health endpoint to NestJS (`apps/api/src/main.ts`):

```typescript
// Add after app.use() calls
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});
```

---

## Step 4: GitHub Secrets

Add these to GitHub repository settings > Secrets:

```
CLOUDFLARE_API_TOKEN = (from Cloudflare > My Profile > API Tokens > Create Token)
CLOUDFLARE_ACCOUNT_ID = (from Cloudflare > Accounts > Account ID)
RAILWAY_TOKEN = (from Railway > Account Settings > API Tokens)
```

---

## Step 5: Database Migrations

### Option A: Auto-run migrations on deploy
Update `Dockerfile` to include:
```dockerfile
# ... after npm run build ...
RUN cd apps/api && npx prisma migrate deploy
CMD ["node", "apps/api/dist/main"]
```

### Option B: Manual migration
```bash
# After connecting to Railway database
DATABASE_URL=postgresql://... npx prisma migrate deploy
```

---

## Step 6: DNS Configuration

Update your domain's DNS records (in Cloudflare):

```
@ (root)          A    → Auto (Cloudflare)
www                CNAME → pymeshub.com (Cloudflare)
api                CNAME → yourservice.railway.app
```

Cloudflare will auto-provision SSL certificates.

---

## Step 7: Test the Deployment

### 7.1 Test Frontend
```bash
curl https://pymeshub.com
# Should return HTML from React app
```

### 7.2 Test API
```bash
curl https://api.pymeshub.com/api/health
# Should return: {"status":"ok","timestamp":"2024-..."}
```

### 7.3 Test Database Connection
```bash
# Check Railway logs
railway logs
# Should see: "Database connection successful"
```

### 7.4 Test Full Workflow
1. Go to https://pymeshub.com
2. Login / Create account
3. Test inbox, contacts, invoices
4. Check API calls in browser DevTools

---

## Step 8: GitHub Actions Workflows

The workflows are configured to:

**On every push to `cloud` branch:**
1. Build and test API
2. Deploy frontend to Cloudflare Pages
3. Deploy backend to Railway

**Automatic deployments happen on:**
- Changes to `apps/api/**`
- Changes to `Dockerfile`
- Changes to `railway.toml`
- Changes to `package.json`

Monitor deployments at:
- Cloudflare Dashboard > Pages > Deployments
- Railway Dashboard > Deployments

---

## Troubleshooting

### Cloudflare Pages Build Fails
```bash
# Check build logs
wrangler pages deployment list

# Verify build locally
cd apps/web
pnpm run build
ls -la dist/public
```

### Railway Deployment Fails
```bash
# Check logs
railway logs

# Verify Docker build
docker build -t pymeshub-api .
docker run -p 4000:4000 pymeshub-api
```

### API Connection Issues
- Check `API_URL` environment variable in Cloudflare Pages
- Verify CORS configured in `apps/api/src/main.ts`
- Check firewall rules in Railway

### Database Connection Errors
- Verify `DATABASE_URL` in Railway
- Run migrations: `railway run npx prisma migrate deploy`
- Check connection pooling in Prisma

### SSL/Certificate Issues
- Cloudflare auto-provisions (wait 5-10 minutes)
- Force refresh: Cloudflare > SSL/TLS > Origin Server > Regenerate

---

## Monitoring & Logs

### Cloudflare Pages Logs
```bash
wrangler pages deployment list
wrangler pages deployment info <deployment-id>
```

### Railway Logs
```bash
railway logs  # View live logs
railway logs -n 100  # Last 100 lines
```

---

## Cost Estimation

- **Cloudflare Pages**: Free (includes free domain)
- **Railway**: $5-20/month (Pro plan recommended)
- **Domain**: $10-15/year
- **S3 Storage**: ~$0.023/GB
- **Total**: ~$50/month

---

## Next Steps

1. ✅ Create Cloudflare & Railway accounts
2. ✅ Connect GitHub repositories
3. ✅ Add environment variables
4. ✅ Test deployments
5. ✅ Monitor logs
6. ✅ Launch! 🚀

---

## Support

For issues:
1. Check GitHub Actions logs
2. Check Cloudflare Pages deployment logs
3. Check Railway logs
4. Review environment variables
5. Verify DNS configuration
