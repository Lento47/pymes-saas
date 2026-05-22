# Hermes — Agente de PymesHub

> **Auto-carga:** Este archivo se inyecta al inicio de cada sesión. No requiere carga manual.
> **Última actualización:** 2026-05-22

---

## Stack Canónico

| Capa | Tecnología | Host |
|------|-----------|------|
| Backend | NestJS 11, Express, Prisma 7, BullMQ, Redis | Railway |
| Frontend | React 18, Vite 7, Tailwind 3, wouter, shadcn/ui | Cloudflare Pages |
| DB | PostgreSQL 16 | Railway |
| Cache/Queue | Redis (BullMQ) | Railway |
| Storage | MinIO/R2 | Cloudflare |
| Edge | Cloudflare Worker (WebSocket proxy, KV cache) | Cloudflare |
| Desktop | Tauri 2 | — |
| Mobile | Flutter | — |

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
| 2026-05 | Unified `master` branch | Simplificar deploys, un solo source of truth |
| 2026-05 | Prisma v7.8+ en Railway, v5.22 local | Railway usa `prisma.config.ts`, local requiere `url` temporal |
| 2026-04 | Railway para backend, Cloudflare Pages para frontend | Separación clara de responsabilidades |
| 2026-04 | Cloudflare Worker solo para edge (WS proxy, KV) | No lógica de negocio en Workers |
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

## Diseño — Fintech Institucional

| Regla | Valor |
|-------|-------|
| Fondo | `#05091d` (navy oscuro) |
| Acento | `#F59E0B` (ámbar) — solo CTAs y KPIs |
| Tarjetas | `rgba(255,255,255,0.03)` + border `rgba(255,255,255,0.06)` |
| Tipografía | Manrope (marketing), Inter (app) |
| Profundidad | Bordes, no sombras |
| Anti-patrones | Sin mock data, sin neón, sin emoji UI, sin iconos en KPI cards |
