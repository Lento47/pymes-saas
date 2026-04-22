# Pymeshub Desktop

Shell de escritorio para Windows basado en Tauri 2 + WebView2. Se distribuye en dos perfiles:

- `cloud`: cliente fino para el SaaS de PymeHub
- `enterprise`: cliente opcional para un despliegue self-hosted del cliente

La URL la determina `PYMESHUB_REMOTE_URL`. Si no se define, usa `http://127.0.0.1:5000`.

## Requisitos

- Windows 10/11
- Node.js 20+
- pnpm 10+
- Rust toolchain estable
- WebView2 Runtime

## Desarrollo local

```bash
pnpm install
pnpm --filter @pymeshub/desktop tauri:dev:cloud
```

Para enterprise:

```bash
pnpm --filter @pymeshub/desktop tauri:dev:enterprise
```

## Build local

Cloud:

```bash
set PYMESHUB_REMOTE_URL=https://tu-saas
pnpm --filter @pymeshub/desktop tauri:build:cloud
```

Enterprise:

```bash
set PYMESHUB_REMOTE_URL=https://cliente.interno
pnpm --filter @pymeshub/desktop tauri:build:enterprise
```

Esto genera instaladores Windows (`.msi` y `.exe`/NSIS) en `src-tauri/target/release/bundle/`.

## Updater y firma

- `cloud` usa updater con GitHub Releases.
- `enterprise` deja el updater desactivado por defecto; la actualización se controla por canal privado del cliente o reinstalación.
- Antes de habilitar releases firmados hay que reemplazar `REPLACE_WITH_TAURI_SIGNING_PUBKEY` en `src-tauri/tauri.cloud.conf.json`.
- Secrets esperados en GitHub Actions:
  - `TAURI_SIGNING_PRIVATE_KEY`
  - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

## SmartScreen en MVP

El MVP no incluye code signing EV. En una instalación limpia de Windows puede aparecer la advertencia azul de SmartScreen. Mientras no exista certificado EV, el flujo operativo documentado es:

1. Clic en `Más información`
2. Clic en `Ejecutar de todos modos`

## Deep links soportados

- `pymeshub://accept-invite?token=...`
