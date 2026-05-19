/**
 * Cloudflare Worker — Outage Guard
 *
 * Intercepts every request to the origin (Railway). When the origin returns
 * a 5xx error OR the connection times out/fails, this Worker responds with a
 * branded maintenance page instead of letting Cloudflare show its generic error.
 *
 * Deploy:
 *   1. Workers & Pages → Create Worker → paste this file → Save & Deploy
 *   2. Settings → Triggers → Add Route: yourdomain.com/* (and www.yourdomain.com/*)
 *   3. Done — future outages show your page automatically.
 *
 * To force the outage page manually (e.g. planned maintenance):
 *   Set the FORCE_OUTAGE environment variable to "true" in the Worker settings.
 */

const CONTACT_WHATSAPP = ""; // e.g. "50612345678" — leave blank to hide the button
const APP_NAME = "PymesHub";
const STATUS_PAGE_URL = ""; // e.g. "https://status.pymeshub.com" — leave blank to hide

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

addEventListener("fetch", (event) => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  // Planned / forced outage
  if ((globalThis.FORCE_OUTAGE ?? "") === "true") {
    return outageResponse();
  }

  let response;
  try {
    response = await fetch(request);
  } catch {
    // Network-level failure (Railway unreachable)
    return outageResponse();
  }

  // Origin returned a server error
  if (response.status >= 500) {
    return outageResponse(response.status);
  }

  return response;
}

function outageResponse(originStatus = 503) {
  return new Response(OUTAGE_HTML, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "60",
      "Cache-Control": "no-store",
      // Tell Cloudflare not to cache this response
      "CF-Cache-Status": "BYPASS",
    },
  });
}

// ---------------------------------------------------------------------------
// Outage page HTML (self-contained — no external dependencies)
// ---------------------------------------------------------------------------

const OUTAGE_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="30" />
  <title>${APP_NAME} — Servicio temporalmente no disponible</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:       #0d0d0f;
      --surface:  #16161a;
      --border:   rgba(255,255,255,0.07);
      --text:     #e8e8ea;
      --muted:    #6b6b7a;
      --amber:    #f59e0b;
      --amber-dim: rgba(245,158,11,0.12);
      --green:    #10b981;
      --red:      #ef4444;
      --radius:   14px;
    }

    html, body {
      min-height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
    }

    .card {
      width: 100%;
      max-width: 480px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 40px 36px;
      text-align: center;
    }

    /* Logo / wordmark */
    .wordmark {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .wordmark-dot {
      width: 7px; height: 7px;
      background: var(--amber);
      border-radius: 50%;
      display: inline-block;
    }

    /* Status indicator */
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--amber-dim);
      border: 1px solid rgba(245,158,11,0.25);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--amber);
      margin-bottom: 28px;
    }
    .pulse {
      width: 7px; height: 7px;
      background: var(--amber);
      border-radius: 50%;
      animation: pulse 1.8s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.4; transform: scale(0.75); }
    }

    /* Heading */
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.25;
      margin-bottom: 12px;
    }
    p.sub {
      font-size: 14px;
      color: var(--muted);
      line-height: 1.65;
      margin-bottom: 32px;
    }

    /* Services row */
    .services {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 32px;
      text-align: left;
    }
    .service-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(255,255,255,0.025);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 12px;
    }
    .service-name { color: var(--muted); }
    .badge-outage {
      display: flex; align-items: center; gap: 5px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
      color: var(--red);
    }
    .badge-ok {
      display: flex; align-items: center; gap: 5px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
      color: var(--green);
    }
    .dot-red   { width: 6px; height: 6px; border-radius: 50%; background: var(--red);   flex-shrink: 0; }
    .dot-green { width: 6px; height: 6px; border-radius: 50%; background: var(--green); flex-shrink: 0; }

    /* Refresh countdown */
    .refresh-note {
      font-size: 11px;
      color: var(--muted);
      margin-bottom: 24px;
    }
    #countdown { font-variant-numeric: tabular-nums; }

    /* Buttons */
    .actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
    .btn {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 13px; font-weight: 600;
      text-decoration: none;
      border: none; cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.8; }
    .btn-primary { background: var(--amber); color: #000; }
    .btn-ghost {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .btn-ghost:hover { color: var(--text); border-color: rgba(255,255,255,0.15); }

    /* Footer */
    footer {
      margin-top: 32px;
      font-size: 11px;
      color: var(--muted);
    }
    footer a { color: inherit; text-decoration: underline; text-underline-offset: 3px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="wordmark">
      <span class="wordmark-dot"></span>
      ${APP_NAME}
    </div>

    <div class="status-badge">
      <span class="pulse"></span>
      Servicio interrumpido
    </div>

    <h1>Estamos resolviendo un problema técnico</h1>
    <p class="sub">
      Nuestro equipo ya está trabajando en restaurar el servicio.
      Esta página se actualiza automáticamente.
    </p>

    <div class="services">
      <div class="service-row">
        <span class="service-name">Aplicación web</span>
        <span class="badge-outage"><span class="dot-red"></span>No disponible</span>
      </div>
      <div class="service-row">
        <span class="service-name">API</span>
        <span class="badge-outage"><span class="dot-red"></span>No disponible</span>
      </div>
      <div class="service-row">
        <span class="service-name">Datos y base de datos</span>
        <span class="badge-ok"><span class="dot-green"></span>Operacional</span>
      </div>
    </div>

    <p class="refresh-note">Actualizando en <span id="countdown">30</span> segundos&hellip;</p>

    <div class="actions">
      <button class="btn btn-primary" onclick="location.reload()">
        ↺ Reintentar ahora
      </button>
      ${
        CONTACT_WHATSAPP
          ? `<a class="btn btn-ghost" href="https://wa.me/${CONTACT_WHATSAPP}?text=Hola%2C+tengo+una+urgencia+y+la+app+no+carga" target="_blank" rel="noreferrer">
        WhatsApp urgente
      </a>`
          : ""
      }
      ${
        STATUS_PAGE_URL
          ? `<a class="btn btn-ghost" href="${STATUS_PAGE_URL}" target="_blank" rel="noreferrer">
        Ver estado del sistema
      </a>`
          : ""
      }
    </div>
  </div>

  <footer>
    Si la urgencia no puede esperar, contactanos por email o WhatsApp.
  </footer>

  <script>
    // Countdown to auto-refresh
    let secs = 30;
    const el = document.getElementById("countdown");
    setInterval(() => {
      secs--;
      if (el) el.textContent = secs;
      if (secs <= 0) location.reload();
    }, 1000);
  </script>
</body>
</html>`;
