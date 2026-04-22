# Building Pymeshub Enterprise MSI Installer

This guide explains how to build the Windows MSI installer for Pymeshub Enterprise Edition.

## Prerequisites

1. **Node.js 20+** and **pnpm 10+**
   ```bash
   node --version  # v20.0.0+
   pnpm --version  # 10.0.0+
   ```

2. **Rust Toolchain** (for Tauri)
   ```bash
   rustup --version
   ```

3. **Visual Studio Build Tools** or **Visual Studio 2022**
   - Required for compiling Rust/Tauri applications on Windows
   - Download from: https://www.visualstudio.com/downloads/

4. **WiX Toolset 3.11+** (for MSI creation)
   ```bash
   # Check if installed
   heat --version
   ```
   - Download from: https://wixtoolset.org/releases/

## Build Steps

### Step 1: Install Dependencies
```bash
cd /path/to/pymes-saas
pnpm install
```

### Step 2: Generate Enterprise Database Schema
```bash
cd apps/api
pnpm run db:generate:enterprise
```

This generates:
- `prisma/schema.enterprise.sqlite.prisma`
- `prisma/schema.enterprise.sqlite.sql`

### Step 3: Build Enterprise Runtime Bundle

**On Windows (PowerShell or cmd):**
```bash
cd scripts
.\build-enterprise-bundle.bat
```

**On Linux/macOS:**
```bash
cd scripts
chmod +x build-enterprise-bundle.sh
./build-enterprise-bundle.sh
```

This creates `.enterprise-runtime-bundle/` with:
- `a/` - API (compiled Node.js app)
- `w/` - Web UI (compiled Node.js app)

### Step 4: Copy Bundle to Desktop Resources

The Tauri build expects the runtime in a specific location:

```bash
# From root directory
mkdir -p apps/desktop/src-tauri/resources/enterprise-runtime
cp -r .enterprise-runtime-bundle/* apps/desktop/src-tauri/resources/enterprise-runtime/

# Or on Windows:
xcopy .enterprise-runtime-bundle\* apps\desktop\src-tauri\resources\enterprise-runtime\ /e /i /y
```

**Important:** The directory structure should be:
```
apps/desktop/src-tauri/resources/enterprise-runtime/
├── a/                    # API
│   ├── dist/
│   ├── node_modules/
│   ├── prisma/
│   └── schema.sql        # ← Must be present
└── w/                    # Web UI
    ├── dist/
    └── node_modules/
```

### Step 5: Build MSI Installer

```bash
pnpm --filter @pymeshub/desktop tauri:build:enterprise
```

This will:
1. Build the Rust/Tauri application
2. Bundle everything into an MSI installer
3. Create output files in: `apps/desktop/src-tauri/target/release/bundle/msi/`

**Expected output:**
```
Pymeshub_0.1.0_x64_en-US.msi
```

### Step 6: (Optional) Build NSIS Installer

```bash
pnpm --filter @pymeshub/desktop tauri:build:enterprise --target nsis
```

This creates a more traditional installer with setup wizard.

## Troubleshooting

### Error: "schema.sql not found"
```
Error: "No se encontro schema.sql dentro del runtime enterprise empaquetado"
```

**Solution:** Ensure Step 3 and 4 completed successfully:
```bash
# Verify schema.sql exists
ls -la .enterprise-runtime-bundle/a/schema.sql
# or on Windows:
dir .enterprise-runtime-bundle\a\schema.sql
```

### Error: "node.exe not found"
```
Error: "Falta node.exe dentro del runtime empaquetado"
```

**Solution:** The Tauri build needs to include Node.js. Check `tauri.conf.json`:
- Ensure `bundle.active` is `true`
- Ensure target OS is correct

### Error: "Prisma engines not found"
**Solution:** The API bundle must include:
```
node_modules/prisma/node_modules/@prisma/engines/
├── query-engine-windows.dll.node
└── schema-engine-windows.exe
```

Ensure these are included in Step 3.

### Application fails at startup
Check logs in:
- **Windows:** `C:\ProgramData\Pymeshub\logs\`
- **Portable:** `%APPDATA%\Pymeshub\logs\`

Key log files:
- `prisma.log` - Database initialization
- `api.out.log` / `api.err.log` - API server logs
- `web.out.log` / `web.err.log` - Web UI logs

## Environment Variables

The installer automatically creates config files in:
- **Windows:** `C:\ProgramData\Pymeshub\config\`

Key configuration:
- `enterprise-api.env` - API settings
- `enterprise-web.env` - Web settings

To customize defaults, edit `.env.enterprise.example` before building.

## Next Steps

After building the MSI:

1. **Test Installation:**
   ```bash
   # Run the installer
   Pymeshub_0.1.0_x64_en-US.msi
   ```

2. **Sign the MSI (Optional):**
   ```bash
   # For code signing
   signtool sign /f certificate.pfx /p password /t http://timestamp.digicert.com Pymeshub_0.1.0_x64_en-US.msi
   ```

3. **Upload to Releases:**
   - Push to GitHub
   - Create a release and attach the MSI

## Development Build (Debug)

For testing before release:

```bash
# Dev build (faster, no optimization)
pnpm --filter @pymeshub/desktop tauri:build:enterprise --debug
```

Output: `apps/desktop/src-tauri/target/debug/Pymeshub.exe`

## Notes

- **Installation Path:** By default, MSI installs to `C:\Program Files\Pymeshub Enterprise`
- **Data Storage:** User data stored in `C:\ProgramData\Pymeshub\`
- **Auto-Update:** Configured to check GitHub releases (if enabled in tauri.conf.json)
- **Code Signing:** Uncomment and configure the `pubkey` in `tauri.conf.json` for updates

## Resources

- [Tauri Documentation](https://tauri.app)
- [WiX Toolset Guide](https://wixtoolset.org/documentation/)
- [Prisma Database Schema](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
