# Windows Build Performance Issues & Optimizations

## 🔍 Problemas Encontrados:

### 1. **Sequential npm installs (CRÍTICO)**
**Ubicación:** `tauri.enterprise.conf.json:9`
```json
"beforeBuildCommand": "npm run prepare:enterprise-runtime && npm run build"
```

**Problema:**
- `prepare:enterprise-runtime` instala deps en `.enterprise-runtime-bundle/a/` y `.enterprise-runtime-bundle/w/`
- Luego `npm run build` instala deps del frontend nuevamente
- Esto genera 3 npm installs sequenciales = **15-30 minutos**

**Solución:**
- Usar `pnpm` para caché compartido
- Paralelizar installs
- Usar `pnpm install --frozen-lockfile` (más rápido)

### 2. **WebView Download (ALTO)**
**Ubicación:** `tauri.enterprise.conf.json:43-44`
```json
"webviewInstallMode": {
  "type": "downloadBootstrapper"
}
```

**Problema:**
- En Windows, Tauri descarga WebView2 runtime en cada build
- Primera vez: ~100MB, tarda 2-5 minutos
- Sin cache: se descarga siempre

**Solución:**
```json
"webviewInstallMode": {
  "type": "offlineInstaller"
}
```
O agregar caché en CI/CD.

### 3. **Resource Bundling (MEDIO)**
**Ubicación:** `tauri.enterprise.conf.json:33-35`
```json
"resources": {
  "../../../.enterprise-runtime-release/": "enterprise-runtime/"
}
```

**Problema:**
- Copia TODO el `.enterprise-runtime-release/` recursivamente
- Incluye node_modules completos (~500MB+)
- Puede tardar 2-3 minutos en copiar

**Solución:**
- Hacer un `.tauri-bundle` pre-optimizado
- Excluir archivos innecesarios
- Usar compresión

### 4. **No Parallel Compilation (MEDIO)**
**Problema:**
- NestJS API build → Vite frontend build → Tauri Rust build (todo sequential)
- No aprovecha múltiples cores

**Solución:**
- Paralelizar API + Frontend builds
- Usar `--release` con optimizaciones correctas

### 5. **MSI + NSIS Ambos (MEDIO)**
**Ubicación:** `tauri.enterprise.conf.json:32`
```json
"targets": ["msi", "nsis"]
```

**Problema:**
- Genera AMBOS instaladores en cada build
- Casi duplica el tiempo (~20-30 minutos extra)

**Solución:**
- Usar solo MSI para producción
- NSIS para fallback

---

## 📊 Estimated Build Times (Windows):

### **Actual (No Optimizado):**
```
npm install (root):        5-10 min  ✗ Siempre
pnpm prepare:enterprise:  15-25 min  ✗ 3x npm install
npm run build (Vite):      3-5 min   
Tauri Rust build:          10-20 min
WebView download:          2-5 min   ✗ Sin caché
MSI + NSIS generation:    10-15 min  ✗ Ambos
TOTAL:                    45-80 min  🔴 MUY LENTO
```

### **Optimizado:**
```
pnpm install --frozen-lock: 2-3 min  ✓ Caché
pnpm prepare:enterprise:    5-8 min   ✓ Paralelo + caché
pnpm build:                 2-3 min   ✓ Paralelo
Tauri Rust build:           8-12 min  ✓ Incremental
WebView (cached):           0 min     ✓ Caché CI
MSI only:                   5-8 min   ✓ Un solo target
TOTAL:                      20-35 min 🟢 2x MÁS RÁPIDO
```

---

## 🔧 Optimizaciones a Implementar:

### 1. Usar pnpm para todo
```bash
pnpm install --frozen-lockfile  # 2-3 min (vs 5-10)
```

### 2. Paralelizar builds
```bash
# En lugar de:
npm run prepare:enterprise-runtime && npm run build

# Hacer:
pnpm -r --parallel run build
```

### 3. Offline WebView
```json
"webviewInstallMode": {
  "type": "offlineInstaller"
}
```

### 4. Solo MSI para producción
```json
"targets": ["msi"]  // No NSIS
```

### 5. Optimizar recursos
```json
"resources": {
  "../../../.enterprise-runtime-bundle/": "enterprise-runtime/"
}
// Previamente procesado y minimizado
```

### 6. CI/CD Optimizations
- Caché de target/
- Caché de npm packages
- Caché de WebView downloads
- Build matrix para paralelización

---

## 📝 Recomendación:

**Para ahora:**
- Cambiar a pnpm
- Dejar solo MSI
- Caché de WebView en CI

**Para futuro:**
- Optimizar bundle de recursos
- Considerar pre-built binaries
- Distribuciones pre-compiladas

---

## ⚠️ Notas:

- El build actual es **normal para un Tauri app grande**
- Windows es más lento que Linux (Rust compilation)
- Primera build siempre es más lenta (descarga toolchains)
- Builds subsecuentes son más rápidos con caché

**El principal culprit:** 3 npm installs sequenciales en `prepare:enterprise-runtime`
