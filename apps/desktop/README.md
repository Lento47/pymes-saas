# Pymeshub Desktop Enterprise

Cliente opcional para la edición `Enterprise Windows Native` de PymeHub. Este build no aloja servicios dentro de Tauri: el desktop se conecta al servidor local o LAN donde corren `web` y `api`.

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
pnpm --filter @pymeshub/desktop tauri:dev:enterprise
```

## Build local

```bash
set PYMESHUB_REMOTE_URL=https://cliente.interno
pnpm --filter @pymeshub/desktop tauri:build:enterprise
```

Esto genera instaladores Windows (`.msi` y `.exe`/NSIS) en `src-tauri/target/release/bundle/`.

## Updater y firma

- El updater se deja desactivado por defecto.
- La distribución enterprise puede publicarse por canal privado, instalador manual o proceso controlado por soporte.

## SmartScreen en MVP

El MVP no incluye code signing EV. En una instalación limpia de Windows puede aparecer la advertencia azul de SmartScreen. Mientras no exista certificado EV, el flujo operativo documentado es:

1. Clic en `Más información`
2. Clic en `Ejecutar de todos modos`

## Deep links soportados

- `pymeshub://accept-invite?token=...`
