# Hermes — Agente de PymesHub

> **Auto-carga:** Este archivo se inyecta al inicio de cada sesión. No requiere carga manual.
> **Última actualización:** 2026-10-08 — stack canónico corregido a Cloudflare-only; se
> inventarió lo que aún vive en Railway en vez de borrarlo del documento.

---

## Stack Canónico

> **Dirección canónica:** un solo proveedor. Cloudflare. Todo lo que corre es un Worker, y
> todo lo que guarda es D1, R2, KV o Queues. No hay segundo backend, ni segunda base, ni
> segunda cola.

| Capa | Tecnología | Host |
|------|-----------|------|
| Backend | Cloudflare Worker (Hono, tRPC, Drizzle) | Cloudflare |
| Frontend | React 18, Vite 7, Tailwind 3, wouter, shadcn/ui | Cloudflare Pages |
| DB | D1 (SQLite) | Cloudflare |
| Cache/Queue | KV (cache) + Queues (`pymeshub-order-events`) | Cloudflare |
| Storage | R2 (`pymeshub-media`) | Cloudflare |
| Auth | Better Auth sobre D1 (`auth_*`) | Cloudflare |
| Desktop | Tauri 2 | — |
| Mobile | React Native 0.86 / Expo 57 | — |

### Lo que queda fuera de Cloudflare hoy

**La tabla de arriba es el objetivo. El repositorio todavía no lo cumple entero.** Verificado
el 2026-10-08:

| Pieza | Dónde vive | Nota |
|-------|-----------|------|
| `apps/api` — NestJS 11, Express, Prisma 7 | Railway | **Sin migrar.** Sigue siendo el backend de la consola de plataforma y de `error_reports`. |
| PostgreSQL 16 | Railway | La segunda base. `support_ticket` y el marketplace viven en D1, no acá. |
| BullMQ + ioredis | Railway | **La segunda cola**, conviviendo con Cloudflare Queues. |
| `error_reports` | PostgreSQL vía Prisma | **No existe en D1.** Todo error de cliente de web va ahí. |

**Consecuencia práctica:** hay dos bases y dos sistemas de cola. Antes de agregar algo en
`apps/api`, preguntarse si no pertenece al Worker. El argumento ya está escrito en el repo:
`packages/trpc-api/src/routers/support.ts:39-45` rechaza un quinto nombre de capability
*"because a fifth capability name would not say anything the existing set does not"*, y eso
vale igual para un segundo backend.

**Dos tickets, dos modelos — no confundirlos:**

| | `support_ticket` | `SupportDiagnosticCase` |
|---|---|---|
| Dónde | D1 | PostgreSQL |
| Qué es | El comerciante pregunta, el operador responde | Auto-abierto desde un error de cliente |
| Ruta | `support.*` (tRPC, Worker) | `POST /api/error-reports/client` (NestJS) |

Ninguno reemplaza al otro. Consolidar en Cloudflare implica mover también el segundo, o
quedan dos sumideros de errores.

---

## Skills a cargar siempre

Antes de cualquier cambio de código, Hermes debe cargar:
1. `principal-engineer-directive` — fases obligatorias, anti-patrones, diff budgeting
2. `pymeshub-development` — patrones del monorepo, API, DB, diseño, pitfall

**Referencias permanentes** (cargar cuando aplique):
- `pymeshub-development/references/repo-constitution.md` — invariantes, forbidden patterns
- `pymeshub-development/references/verification-recipes.md` — comandos canónicos
- `pymeshub-development/references/incident-memory.md` — incidentes y lecciones

---

## Reglas Permanentes

1. **NUNCA editar un archivo sin `read_file` en la sesión actual.** No asumir contenido.
2. **NUNCA asumir el estado de la DB** sin verificar migrations y schema.
3. **NUNCA inventar APIs, archivos, o rutas.** Si no hay evidencia, investigar primero.
4. **Checkpoint cada ~10 turnos** — ver protocolo abajo.
5. **Commit a `master` directamente.** El usuario maneja PRs y merges.
6. **`git pull --rebase` antes de push.** Nunca force-push.
7. **CORRECTNESS > SPEED.** Preferir 3 cambios bien hechos sobre 10 a las corridas.
8. **No usar `#` en rutas.** Pathname-based routing exclusivamente.
9. **No mock data.** Todo debe venir de API real.
10. **Dark theme only** para landing/marketing. Ámbar (`#F59E0B`) como único acento.

---

## Protocolo de Checkpoint (cada ~10 turnos)

Hermes debe preguntar:
- ¿Cuál era el objetivo original de esta sesión?
- ¿Qué constraints siguen activos?
- ¿Qué asumí sin verificar o sin releer?

Si el usuario responde con desviación del objetivo, realinear antes de continuar.

---

## Protocolo de Feedback

| Señal | Significado | Acción de Hermes |
|-------|-------------|-----------------|
| ✅ | Correcto, seguir | Continuar |
| ⚠️ | Corrección puntual | Ajustar y continuar |
| 🔴 | Calidad pobre | Reconstruir approach desde cero |

---

## Branches

| Branch | Status | Uso |
|--------|--------|-----|
| `master` | **PRIMARY** — default para todo | API + Web |
| `main-web` | Restricted legacy | Solo emergencia frontend-only |
| `main-api` | Restricted legacy | Solo emergencia backend-only |

---

## Decisiones de Arquitectura

| Fecha | Decisión | Razón |
|-------|----------|-------|
| 2026-10 | **Cloudflare-only como dirección canónica** | Un proveedor, una base, una cola. Lo que queda en Railway está inventariado arriba y hay que vaciarlo. |
| 2026-10 | El Worker es **el** backend, no el edge | **Anula la decisión de 2026-04.** 21 routers y servicios de miles de líneas (`orders.ts` 2285, `admin.ts` 2245). "No lógica de negocio en Workers" quedó obsoleto hace tiempo. |
| 2026-05 | Unified `master` branch | Simplificar deploys, un solo source of truth |
| 2026-05 | Prisma v7.8+ en Railway, v5.22 local | Railway usa `prisma.config.ts`, local requiere `url` temporal — **anulada por el 2026-10**; Prisma se va con `apps/api` |
| 2026-04 | Railway para backend, Cloudflare Pages para frontend | **Superada.** Separación de responsabilidades que hoy son dos bases y dos colas |
| 2026-04 | Cloudflare Worker solo para edge (WS proxy, KV) | **Superada.** Ver fila 2026-10 |
| 2026-03 | Hash de identidad para servicios externos | GDPR — no pasar raw identifiers |

---

## Lo que NO funcionó (no repetir)

1. **"Simplification" anti-pattern** — borrar código agresivamente en un commit (+209/-2304 líneas) tumbó 13 métodos de WhatsAppService y producción. Regla: cambios mínimos, verificar con `pre-push-check.sh`.
2. **Editar sin leer el archivo actual** — parchar basado en memoria de otra sesión/rama causa conflictos y duplicados.
3. **Commits sin `git pull --rebase` previo** — push rechazado, doble rebase.
4. **Hash routing** — usar `#` en hrefs rompe la navegación. Pathname-only.
5. **TypeScript sin verificar que el tipo existe** — `heapSizeLimit` no existe en `MemoryUsage`. Siempre revisar tipos antes de commitear.

---

## Bugs Conocidos

| Bug | Estado |
|-----|--------|
| Cloudflare Worker KV cache bloquea refresh de conversaciones | Fix: `/api/conversations/` debe estar en bypass list |
| `refetchInterval` perdido en migración de inbox | Fix: restaurar polling 5s o WebSocket |

---

## Features en Progreso

- [x] Landing page — pulido visual (Apple/Supabase/Lovable)
- [x] Logo de workspace custom — `logo_url` en modelo, sidebar actualizado
- [ ] WhatsApp System Map — documentar inbound/outbound lifecycle
- [ ] Queue Topology Map — documentar BullMQ contracts
- [ ] Tenant Resolution Lifecycle — documentar slug resolution

---

## Diseño — producto móvil y marketing

La interfaz autenticada sigue la dirección actual de [DESIGN.md](DESIGN.md): navegación
clara, controles cómodos con una mano, perfil accesible y preferencias reales, tomando
referencias externas como Uber y PedidosYa. Los colores, densidad y componentes de
la app pueden evolucionar con el pedido del usuario; no imponerle el estilo de la landing.
Las skills locales están en `.agents/skills/`.

La siguiente tabla conserva las convenciones de **landing/marketing**:

| Regla | Valor |
|-------|-------|
| Fondo | `#05091d` (navy oscuro) |
| Acento | `#F59E0B` (ámbar) — solo CTAs y KPIs |
| Tarjetas | `rgba(255,255,255,0.03)` + border `rgba(255,255,255,0.06)` |
| Tipografía | Manrope (marketing), Inter (app) |
| Profundidad | Bordes, no sombras |
| Anti-patrones | Sin mock data, sin neón, sin emoji UI, sin iconos en KPI cards |
