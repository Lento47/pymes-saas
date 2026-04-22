# Windows MSI Build Checklist

Use esta checklist para verificar que todo está configurado correctamente antes de compilar el MSI.

## Pre-Build Verification

### Database & Prisma Setup
- [ ] `schema.enterprise.sqlite.sql` existe en `apps/api/prisma/`
- [ ] `copy-schema-sql.mjs` existe en `apps/api/scripts/`
- [ ] Build script en `package.json` ejecuta `copy-schema-sql.mjs`
- [ ] `schema.sql` se genera en `dist/` después de `npm run build`
- [ ] Prisma engines están en: `node_modules/@prisma/engines/query_engine-windows.dll.node`

### File Paths (Windows Specific)
- [ ] `db-init.service.ts` valida que `process.execPath` sea un `.exe` antes de usarlo
- [ ] `main.ts` convierte barras invertidas a normales en DATABASE_URL
- [ ] Rutas en `enterprise_runtime.rs` usan forward slashes
- [ ] Búsqueda de `schema.sql` incluye `APPDATA` directory

### Environment Configuration
- [ ] `.env.enterprise.example` tiene `DATABASE_URL=file:/path/to/db.db`
- [ ] `NODE_ENV=production` está seteado
- [ ] `PYMESHUB_EDITION=enterprise` está seteado
- [ ] `PYMESHUB_STORAGE_MODE=local` está seteado
- [ ] `PORT=4000` (API) y `PORT=5000` (Web) están configurados

### Runtime Bundle Structure
```
.enterprise-runtime-bundle/
├── a/
│   ├── dist/                    ✓
│   ├── node_modules/            ✓
│   ├── prisma/                  ✓
│   ├── schema.sql               ✓ (CRITICAL)
│   └── .env.enterprise.example  ✓
└── w/
    ├── dist/                    ✓
    └── node_modules/            ✓
```

### Desktop Resources
- [ ] `.enterprise-runtime-bundle/` copiado a `apps/desktop/src-tauri/resources/enterprise-runtime/`
- [ ] Carpeta `n/` con Node.js binaries existe (creada por Tauri)
- [ ] `tauri.conf.json` tiene `"targets": ["msi", "nsis"]`

## Build Steps

### Step 1: Generate Schema (if needed)
```bash
cd apps/api
pnpm run db:generate:enterprise
```

### Step 2: Build API & Web Bundle
```bash
# From root directory
./scripts/build-enterprise-bundle.sh  # or .bat on Windows
```

**Verify:**
- [ ] `.enterprise-runtime-bundle/a/schema.sql` exists
- [ ] `.enterprise-runtime-bundle/a/node_modules` has Prisma
- [ ] `.enterprise-runtime-bundle/w/dist` has built frontend

### Step 3: Copy to Desktop Resources
```bash
mkdir -p apps/desktop/src-tauri/resources/enterprise-runtime
cp -r .enterprise-runtime-bundle/* apps/desktop/src-tauri/resources/enterprise-runtime/
```

### Step 4: Build MSI
```bash
pnpm --filter @pymeshub/desktop tauri:build:enterprise
```

**Verify:**
- [ ] Build completes without errors
- [ ] MSI file created in `apps/desktop/src-tauri/target/release/bundle/msi/`
- [ ] Size > 50MB (indicates Node.js is bundled)

## Testing the MSI

### Installation Test
```bash
# Run the MSI on a clean Windows VM
Pymeshub_0.1.0_x64_en-US.msi
```

**Verify:**
- [ ] Installer accepts language selection
- [ ] Installation completes without errors
- [ ] Files installed to `C:\Program Files\Pymeshub Enterprise`
- [ ] Config created in `C:\ProgramData\Pymeshub\config\`
- [ ] Data directory created in `C:\ProgramData\Pymeshub\data\`

### Application Startup
```bash
# Run the installed application
"C:\Program Files\Pymeshub Enterprise\Pymeshub.exe"
```

**Verify:**
- [ ] Window appears with loading screen
- [ ] Status messages show progress (Spanish text expected)
- [ ] Database initialization starts
- [ ] API server starts (port 4000)
- [ ] Web UI loads (port 5000)
- [ ] Browser window opens to localhost:5000
- [ ] Can create workspace and login

### Log Files
Check these if startup fails:
```
C:\ProgramData\Pymeshub\logs\
├── prisma.log          # Database init
├── api.out.log         # API stdout
├── api.err.log         # API errors
├── web.out.log         # Web stdout
├── web.err.log         # Web errors
└── bootstrap.probe     # Startup indicator
```

### Database Verification
```bash
# Database file should be created
dir "C:\ProgramData\Pymeshub\data\pymeshub.db"
```

**Verify:**
- [ ] File exists and has size > 0
- [ ] File is not locked by another process
- [ ] SQLite can open it: `sqlite3 pymeshub.db ".tables"`

## Common Issues & Fixes

### Issue: "schema.sql not found"
**Root Cause:** Bundle wasn't created or copied correctly
**Fix:**
1. Verify `.enterprise-runtime-bundle/a/schema.sql` exists
2. Verify copied to `apps/desktop/src-tauri/resources/enterprise-runtime/a/schema.sql`
3. Rebuild: `pnpm --filter @pymeshub/desktop tauri:build:enterprise`

### Issue: "Prisma engines not found"
**Root Cause:** Node_modules wasn't included in bundle
**Fix:**
1. Verify `node_modules/prisma` exists in bundle
2. Rebuild bundle: `./scripts/build-enterprise-bundle.sh`

### Issue: Database initialization fails
**Symptoms:** `prisma.log` shows schema errors
**Fix:**
1. Verify `schema.enterprise.sqlite.sql` is valid
2. Regenerate: `cd apps/api && pnpm run db:generate:enterprise`
3. Rebuild bundle

### Issue: Port 4000 or 5000 already in use
**Symptoms:** API or Web won't start
**Fix:**
1. Check what's using the ports: `netstat -ano | findstr :4000`
2. Kill the process or configure different ports
3. Update `enterprise_runtime.rs` constants if needed

### Issue: Wrong database path
**Symptoms:** Database created in wrong location or with wrong permissions
**Fix:**
1. Check `enterprise-api.env` in `C:\ProgramData\Pymeshub\config\`
2. Verify `DATABASE_URL` format: `file:C:/ProgramData/Pymeshub/data/pymeshub.db`
3. Check folder permissions (should be writable by user)

## Performance Notes

- First startup is slow (5-10 seconds) while initializing database
- Database file grows as data is added
- Logs are appended, rotate/clean periodically
- Node.js processes run in background

## Next Release

After successful build:
1. Sign the MSI (if required)
2. Upload to GitHub Releases
3. Configure auto-update in `tauri.conf.json`
4. Test update mechanism

---

**Last Updated:** 2026-04-22
**Built With:** Tauri 2.0, NestJS 10, SQLite 3, WiX 3.11
