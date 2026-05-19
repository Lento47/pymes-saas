# Cloudflare — Outage Worker

## Qué hace

`outage-worker.js` es un Cloudflare Worker que se pone **delante de Railway**.
Cada request pasa por él:

- Si Railway responde normalmente → el Worker lo deja pasar sin tocar nada.
- Si Railway devuelve un error 5xx **o** la conexión falla (timeout, unreachable) → el Worker devuelve la página de outage directamente, sin que Cloudflare muestre su error genérico.

## Cómo deployar (primera vez)

1. Entrá a **Cloudflare Dashboard → Workers & Pages → Create Worker**
2. Pegá todo el contenido de `outage-worker.js` y hacé **Save & Deploy**
3. Andá a **Settings → Triggers → Add Route**:
   - `tudominio.com/*`
   - `www.tudominio.com/*`
4. Listo. El Worker queda activo permanentemente.

## Personalizar antes de deployar

Al inicio del archivo hay tres constantes:

```js
const CONTACT_WHATSAPP = "";    // ej: "50612345678"
const APP_NAME = "PymesHub";
const STATUS_PAGE_URL = "";     // ej: "https://status.pymeshub.com"
```

Completalas con los datos reales antes de deployar.

## Forzar el outage manualmente (mantenimiento planificado)

1. En el Worker, andá a **Settings → Variables → Environment Variables**
2. Agregá `FORCE_OUTAGE = true`
3. Guardá y deploá
4. Cuando termina el mantenimiento, borrá la variable o cambiá a `false`

## Actualizar la página de outage

La página está embebida como template literal en `OUTAGE_HTML` dentro del mismo archivo `.js`.
Editala y volvé a deployar el Worker.

## Para el outage de AHORA (solución inmediata sin Worker)

Si todavía no tenés el Worker deployado y necesitás mostrar algo ya:

1. **Cloudflare Dashboard → tu dominio → Custom Pages**
2. Seleccioná `502 Bad Gateway` y `503 Service Unavailable`
3. Pegá la URL de cualquier página estática que tengas (o usá la de abajo)

Alternativa más rápida: activá **"Under Attack Mode"** o **"I'm Under Attack"** en el dashboard de Cloudflare para bloquear tráfico mientras resolvés el problema.
