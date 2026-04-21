# Pymeshub Desktop App — Plan de Implementación

**Estado:** Pendiente de ejecución
**Stack elegido:** Tauri 2 + WebView2 (Windows)
**Audiencia:** Cliente final no-técnico (pyme típica)
**Modo:** Shell de escritorio que carga el SaaS cloud remoto

---

## 1. Decisión de stack

Se eligió **Tauri 2** sobre Electron por:

| Métrica | Tauri 2 | Electron |
|---|---|---|
| Tamaño del instalador | 3-10 MB | 50-150 MB |
| RAM en uso | 20-80 MB | 100-300 MB |
| Arranque en frío | <500ms | 1-2s |
| Instalador Windows nativo | MSI + NSIS | Requiere configuración extra |

Referencias:
- [Tauri Windows Installer docs](https://v2.tauri.app/distribute/windows-installer/)
- [Electron vs Tauri 2026 comparison](https://www.pkgpulse.com/blog/electron-vs-tauri-2026)

Para una pyme que descarga el instalador, un .exe de ~5 MB es crítico para adopción.

## 2. Arquitectura

**Modo:** Shell remoto con fallback offline.

La app Tauri envuelve un WebView2 que apunta directamente a la URL de producción del SaaS. No empaca el build del frontend — siempre carga la versión viva del servidor. Esto elimina la necesidad de reconstruir la app cada vez que se actualiza el frontend.

### Responsabilidades de la app desktop (NO del frontend web)

1. Icono en escritorio / Start Menu
2. Ventana nativa con menú en español
3. Auto-updater vía GitHub Releases
4. Deep-linking `pymeshub://` para flujo de invitaciones
5. Notificaciones nativas del sistema (hook futuro)
6. Pantalla offline si no hay conexión
7. Almacenamiento seguro del refresh token en Windows Credential Manager (vía `tauri-plugin-stronghold`)

### Lo que el frontend sigue haciendo igual

Todo. El frontend no sabe que está corriendo dentro de Tauri excepto cuando detecta `window.__TAURI__` para:
- Abrir links externos con el browser del sistema (no dentro de la app)
- Disparar deep-links nativos
- Usar notificaciones nativas

## 3. Estructura de archivos a crear

```
apps/desktop/
├── package.json                          # workspace member: @pymeshub/desktop
├── src-tauri/
│   ├── Cargo.toml                        # deps: tauri, tauri-plugin-updater, tauri-plugin-deep-link, tauri-plugin-stronghold
│   ├── Cargo.lock
│   ├── build.rs
│   ├── tauri.conf.json                   # URL remota, icon, bundle config
│   ├── capabilities/
│   │   └── default.json                  # permisos: shell.open, notification, updater
│   ├── icons/
│   │   ├── 32x32.png
│   │   ├── 128x128.png
│   │   ├── 128x128@2x.png
│   │   ├── icon.ico                      # Windows
│   │   ├── icon.icns                     # macOS (futuro)
│   │   └── icon.png
│   └── src/
│       ├── main.rs                       # entry point
│       ├── deep_link.rs                  # handler para pymeshub://
│       └── updater.rs                    # check on startup
├── README.md                             # cómo buildear localmente
└── .gitignore                            # target/, *.msi, *.exe
```

## 4. Archivos del monorepo a modificar

- `pnpm-workspace.yaml` → añadir `apps/desktop`
- `package.json` raíz → añadir scripts `dev:desktop`, `build:desktop`
- `.github/workflows/desktop-release.yml` → nuevo workflow
- `apps/web/client/src/lib/platform.ts` → helper `isDesktop()` que detecta `window.__TAURI__`
- `apps/web/client/src/lib/api.ts` → abrir links externos con `shell.open` cuando es desktop

## 5. Contenido clave de archivos

### `src-tauri/tauri.conf.json` (resumen)

```json
{
  "productName": "Pymeshub",
  "version": "0.1.0",
  "identifier": "com.pymeshub.desktop",
  "build": {
    "frontendDist": "../dist-remote",
    "devUrl": "https://app.pymeshub.com"
  },
  "app": {
    "windows": [
      {
        "title": "Pymeshub",
        "width": 1280,
        "height": 800,
        "minWidth": 1024,
        "minHeight": 600,
        "resizable": true,
        "url": "https://app.pymeshub.com"
      }
    ],
    "security": {
      "csp": null,
      "capabilities": ["default"]
    }
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis"],
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico"],
    "windows": {
      "webviewInstallMode": { "type": "downloadBootstrapper" },
      "wix": { "language": ["es-ES"] },
      "nsis": {
        "installMode": "currentUser",
        "languages": ["Spanish"],
        "displayLanguageSelector": false
      }
    }
  },
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/Lento47/pymes-saas/releases/latest/download/latest.json"
      ],
      "pubkey": "PENDIENTE_GENERAR_CON_tauri_signer"
    },
    "deep-link": {
      "desktop": {
        "schemes": ["pymeshub"]
      }
    }
  }
}
```

### `src-tauri/src/main.rs` (esqueleto)

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_notification::init())
    .setup(|app| {
      #[cfg(desktop)]
      app.deep_link().register("pymeshub")?;

      let handle = app.handle().clone();
      app.deep_link().on_open_url(move |event| {
        let url = event.urls().first().cloned();
        if let Some(url) = url {
          if let Some(window) = handle.get_webview_window("main") {
            let _ = window.eval(&format!(
              "window.location.href = 'https://app.pymeshub.com/#/accept-invite?token=' + new URL('{}').searchParams.get('token')",
              url
            ));
            let _ = window.set_focus();
          }
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
```

### `.github/workflows/desktop-release.yml`

Trigger en tag `desktop-v*.*.*`. Build en `windows-latest` (y opcionalmente `macos-latest` + `ubuntu-22.04` después). Sube `.msi`, `.msi.sig`, y `latest.json` generado a GitHub Releases.

Secrets necesarios:
- `TAURI_SIGNING_PRIVATE_KEY` — generada con `tauri signer generate`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- (Opcional futuro) `WINDOWS_CERTIFICATE` + `WINDOWS_CERTIFICATE_PASSWORD` para EV cert

## 6. Auto-updater

- Al abrir la app, check silencioso contra `latest.json` en GitHub Releases
- Si hay versión nueva: popup "Hay una nueva versión de Pymeshub. ¿Actualizar ahora?" con Sí/Más tarde
- Si el usuario acepta: descarga el `.msi`, verifica firma, lanza `msiexec` en modo silent, cierra app, relanza
- Firma obligatoria (evita MITM)

## 7. Deep-linking para invitaciones

**Problema a resolver:** el email de invitación abre `https://app.pymeshub.com/#/accept-invite?token=XXX` en el browser del sistema. Si el cliente ya instaló la desktop app, queremos que abra ahí.

**Solución:**
1. El backend envía el link en dos formatos en el email: botón "Abrir en la app" (`pymeshub://accept-invite?token=XXX`) y fallback "Abrir en navegador" (`https://...`)
2. Tauri registra el handler `pymeshub://` en Windows Registry al instalar
3. Click → Windows lanza la app Tauri si está instalada, con el URL como argumento
4. `main.rs` parsea el token y navega el WebView a `/#/accept-invite?token=XXX`

**Tarea en backend:** modificar `invitations.service.ts` para incluir ambos links en el email template.

## 8. Code signing (IMPORTANTE)

Sin firma EV, Windows SmartScreen muestra "Windows protected your PC" la primera vez que el cliente ejecuta el instalador. Para una pyme no-técnica esto es fricción crítica.

**Opciones:**
1. **EV Certificate** ($300-500/año, DigiCert/Sectigo) — elimina SmartScreen inmediatamente
2. **Standard Code Signing Cert** ($100/año) — requiere "reputación" acumulada (decenas de descargas) antes de que SmartScreen lo apruebe
3. **Sin firma** — cliente ve advertencia, debe click "Más información" → "Ejecutar de todos modos". Aceptable solo si tienes soporte humano que guíe.

**Recomendación:** lanzar sin firma para MVP, documentar el workaround para el cliente ("si ves una advertencia azul, click Más información → Ejecutar de todos modos"), y comprar EV cert cuando tengas 10+ instalaciones validadas.

## 9. Decisiones pendientes antes de codear

1. **URL de producción del SaaS** — ¿`app.pymeshub.com`? ¿otro dominio? Lo necesito para hardcodear en `tauri.conf.json`.
2. **Icono corporativo** — ¿existe logo en formato vectorial (SVG, AI)? Si no, se generan placeholders con las iniciales "PH" en el color del brand. Necesito sets de 32x32, 128x128, 128x128@2x, .ico, .icns, .png.
3. **Code signing** — ¿configurar workflow asumiendo EV cert futura, o sin firma por ahora?
4. **Idioma del instalador** — solo español, o español + inglés?
5. **Scope del deep-linking** — ¿solo `/accept-invite`, o también `/reset-password`, links a facturas, etc.?

## 10. Estimación de trabajo

| Tarea | Tiempo |
|---|---|
| Bootstrap `apps/desktop/` con Tauri CLI | 30 min |
| Configurar `tauri.conf.json` + icons | 30 min |
| Implementar `main.rs` con deep-linking + updater | 1h |
| GitHub Actions workflow | 45 min |
| Generar keypair + configurar secrets | 15 min |
| Modificar `invitations.service.ts` para incluir `pymeshub://` | 20 min |
| Integrar `platform.ts` en frontend | 30 min |
| Primer build + ajustes de errores Rust/Tauri | 1-1.5h |
| Probar instalador limpio en VM Windows | 30 min |
| Documentación (README + docs/operations) | 30 min |
| **Total** | **~5-6 horas** |

Todo en una sesión nueva, enfocada, con foco 100% en esto.

## 11. Secuencia de ejecución recomendada

1. Responder las 5 preguntas pendientes en sección 9
2. Sesión 1 (~3h): bootstrap + config + main.rs + primer build local funcionando
3. Sesión 2 (~2h): GitHub Actions + updater + deep-linking end-to-end probado
4. Sesión 3 (~1h): ajustes frontend (`platform.ts`, detección de desktop) + docs

## 12. Referencias

- [Tauri 2 Windows Installer](https://v2.tauri.app/distribute/windows-installer/)
- [Tauri deep-linking plugin](https://v2.tauri.app/plugin/deep-linking/)
- [Tauri updater plugin](https://v2.tauri.app/plugin/updater/)
- [GitHub Actions for Tauri](https://github.com/tauri-apps/tauri-action)
