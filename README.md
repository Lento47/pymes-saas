<div align="center">

# PymesHub

**El marketplace de delivery local de tu barrio.**  
Pedí de los comercios que tenés cerca — sodas, pulperías, farmacias, ferreterías, panaderías — sin llamar a nadie.

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Hono](https://img.shields.io/badge/Hono-4-E36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev)
[![tRPC](https://img.shields.io/badge/tRPC-11-2596BE?style=flat-square&logo=trpc&logoColor=white)](https://trpc.io)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black)](https://orm.drizzle.team)
[![D1](https://img.shields.io/badge/Cloudflare-D1-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1)
[![Better Auth](https://img.shields.io/badge/Better-Auth-000000?style=flat-square)](https://better-auth.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Expo](https://img.shields.io/badge/Expo-57-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?style=flat-square&logo=tauri&logoColor=black)](https://tauri.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)

</div>

---

## ¿Qué es PymesHub?

Un marketplace de cercanía. El **consumidor** abre la app, ve los comercios de su zona, arma el carrito y pide a domicilio o para recoger. El **comercio** recibe el pedido, lo prepara y lo entrega, con su propio catálogo, precios y horarios.

El modelo es simple y no esconde nada:

- El consumidor le paga **al comercio** por los productos y **al repartidor** por el envío.
- PymesHub **no cobra comisión por pedido** y no toca un colón del pago del cliente: no hay pasarela en medio y el pago se hace **contra entrega**.
- El comercio paga a PymesHub una **tarifa plana** por usar la app — ver [Planes](#planes).

> Un solo backend sirve a la web, iOS y Android. Un pedido que el cliente ve en el navegador es la misma fila que ve su teléfono, porque hay un solo escritor.

---

## Cómo funciona

**Consumidor**
1. Elige una categoría o busca un comercio o producto cerca.
2. Entra a la tienda, arma el carrito y elige entrega a domicilio o para recoger.
3. Confirma el pedido (pago contra entrega) y sigue el estado en vivo: recibido → en preparación → en camino → entregado.
4. Deja reseña, guarda favoritos y vuelve a pedir.

**Comercio**
1. Registra el comercio y publica su perfil, horarios y zona de entrega.
2. Carga el catálogo con categorías, opciones (tamaños, extras), fotos y stock.
3. Recibe y avanza los pedidos desde el panel; ve reportes y promociones.
4. Elige un plan (`WEEKLY` o `MONTHLY`); si deja de pagar, entra en gracia antes de que se degrade su alcance.

---

## Arquitectura

Monorepo **pnpm**. Un solo backend — un **Cloudflare Worker** con D1 detrás — sirviendo web, iOS y Android. Los clientes nativos no mandan `Origin`, así que el acceso a la API lo gobierna `CORS_ORIGINS` para el navegador y las sesiones de Better Auth para todos.

```text
pymes-saas/
├── apps/
│   ├── web/                    # Storefront + panel — React 19 + Vite 7 + Tailwind
│   ├── mobile/                 # iOS / Android — Expo + React Native + expo-router
│   ├── desktop/                # Windows — Tauri 2
│   └── api/                    # LEGADO — NestJS/Prisma de la etapa SaaS. No sirve el marketplace
├── packages/
│   ├── trpc-api/               # El backend — Worker: Hono + tRPC (nombre de paquete: `api`)
│   ├── db/                     # Drizzle + D1: schema, migrations, seed
│   ├── auth/                   # Better Auth sobre las tablas de packages/db
│   ├── shared/                 # Tipos, dinero, ids, planes y estado de pedido
│   ├── i18n/                   # Mensajes es / en
│   ├── ui/                     # Componentes compartidos (React 19)
│   ├── env/                    # Validación de variables de entorno
│   ├── shared-types/           # Tipos heredados
│   └── typescript-config/      # tsconfig compartidos
├── docs/                       # Arquitectura, negocio, legal, operaciones, riesgo
├── e2e/                        # Playwright
└── scripts/                    # Helpers de CI
```

### Flujo de datos

```text
Consumidor / Comercio
  └── Cloudflare Pages (pymeshub.lat)  ·  Expo (iOS / Android)  ·  Tauri
        └── HTTPS → Cloudflare Worker (api.pymeshub.lat)
              ├── tRPC  → routers de negocio
              ├── D1 (SQLite)         — única fuente de verdad
              ├── KV                  — caché y rate-limit (recomputable desde D1)
              ├── R2                  — imágenes de productos y comercios
              ├── Queues              — eventos de pedido (con DLQ)
              └── Durable Object      — sala en vivo por pedido (`/orders/:id/live`)
```

---

## Stack

| Capa | Tecnología |
|------|-----------|
| **API** | Cloudflare Worker — Hono 4 + tRPC 11 |
| **Base de datos** | Cloudflare D1 (SQLite) + Drizzle ORM |
| **Caché / límites** | Cloudflare KV |
| **Media** | Cloudflare R2 (`pymeshub-media`, privado; se sirve por `/files/:id`) |
| **Eventos** | Cloudflare Queues (`pymeshub-order-events` + DLQ) |
| **Tiempo real** | Durable Objects (clase `OrderRoom`) |
| **Auth** | Better Auth (+ Supabase como proveedor de identidad) |
| **Storefront** | React 19 + Vite 7 + Tailwind + Radix/shadcn + wouter + TanStack Query |
| **Mobile** | Expo 57 + React Native 0.86 + expo-router + MapLibre |
| **Desktop** | Tauri 2 |
| **i18n** | `@pymeshub/i18n` (es / en) |
| **Monorepo** | pnpm 10 + Turbo |
| **Edge / DNS** | Cloudflare (Workers custom domains, Pages) |

---

## API (`packages/trpc-api/src/routers`)

| Router | Responsabilidad |
|--------|-----------------|
| `catalog` | Feed principal, categorías y taxonomía, búsqueda |
| `businesses` | Comercios, tienda pública, horarios, zona de entrega |
| `business` | Panel del comercio: perfil, configuración |
| `products` | Catálogo del comercio: productos, opciones, stock |
| `cart` | Carrito por sesión/consumidor |
| `orders` | Crear pedido, listar, avanzar estado, seguimiento |
| `favorites` | Comercios y productos guardados |
| `reviews` | Reseñas de consumidores y respuestas del comercio |
| `promotions` | Promociones activas del comercio |
| `subscription` | Plan del comercio, estado y límites |
| `couriers` | Repartidores |
| `notifications` | Avisos in-app |
| `uploads` | Subida de media a R2 |
| `users` | Identidad y perfil |
| `admin` | Administración de la plataforma |
| `health` | Health check y versión |

---

## Planes

El comercio paga **una tarifa plana** por la app — sin comisión por pedido y con IVA incluido. El precio vive en la tabla `price_book`; subirlo es insertar una fila, no publicar una versión, y una suscripción conserva el libro con el que entró, así que un aumento nunca alcanza a un comercio que ya está dentro.

| Plan | Precio (libro de lanzamiento, IVA incluido) | Alcance |
|------|---------------------------------------------|---------|
| **WEEKLY** | ₡2 000 / semana | 1 local · 1 cuenta de staff · 25 productos · 250 MB · 1 promoción · 90 días de historial |
| **MONTHLY** | ₡10 000 / mes | 1 local · 3 cuentas · 150 productos · 2 GB · 5 promociones · inventario · 730 días de historial |

Estados de suscripción: `ACTIVE` (acceso completo) → `GRACE` (pago atrasado, conserva el plan) → `PAST_DUE` (degrada a los límites del `WEEKLY`, **sigue visible en el feed**) → `SUSPENDED` (sin listar, último recurso).

**Nunca se limita, en ningún plan:** tomar y avanzar pedidos, horarios y pausar el local, reseñas en ambas direcciones, ver pagos y eliminar la cuenta.

> La tabla anterior es el modelo canónico de `packages/shared/src/plans.ts` (lo que el código aplica en tiempo real). Si la página de precios del sitio muestra otro esquema, trátala como copy y reconciliala con este módulo.

---

## Páginas del storefront (`apps/web`)

`home` · `categories` · `category` · `search` · `store` · `product` · `cart` · `checkout` · `orders` · `order` · `favorites` · `sign-in`

Alrededor: landing pública, páginas de marketing (`/platform`, `/ai-agents`, `/billing-workflows`, `/security`), SEO landings verticales, `/solutions/*`, `/pricing`, legal y ayuda.

---

## Requisitos

- Node.js **22+**
- pnpm **10+**
- [Bun](https://bun.sh) — lo usan los paquetes (`packages/db`, `packages/trpc-api`, `packages/shared`) para scripts y tests
- Cuenta/Wrangler con acceso a D1, KV, R2 y Queues (o `CLOUDFLARE_API_TOKEN`)

---

## Getting Started

```bash
git clone https://github.com/lento47/pymes-saas.git
cd pymes-saas
pnpm install
```

### 1. Base de datos local (D1 en Miniflare)

```bash
pnpm --filter @pymeshub/db db:migrate:local   # aplica migrations
pnpm --filter @pymeshub/db db:seed            # datos demo (local y solo local)
```

El seed carga comercios, productos, pedidos y usuarios ficticios. Tras `db:seed`, cualquier cuenta sembrada entra con la clave pública `pymeshub-demo-2026`. Las credenciales **nunca** se aplican contra remoto: `db:seed:remote` solo sube `seed.sql`, no `seed-credentials.sql`.

### 2. API (Worker)

```bash
cp packages/trpc-api/.dev.vars.example packages/trpc-api/.dev.vars   # define AUTH_SECRET (>= 32 chars)
pnpm --filter api dev                                                 # wrangler dev
```

Los deploys usan `pnpm --filter api deploy:staging` o `deploy`. Recuerda que `[vars]` no se hereda entre entornos: todo nombre que el Worker lee en runtime debe estar en cada bloque.

### 3. Clientes

```bash
pnpm --filter rest-express dev    # Storefront web
pnpm --filter mobile start        # Expo (iOS / Android / o --web)
pnpm dev:desktop                  # Tauri 2
```

El storefront lee la URL de la API desde `VITE_MARKETPLACE_API_URL` (en producción apunta a `api.pymeshub.lat`).

---

## Migraciones y seed

`drizzle-kit generate` escribe el SQL y `wrangler` lo aplica. No hay `drizzle-kit push` ni `migrate`: D1 no es un archivo SQLite que una herramienta local abra, y lo único que debe escribir es `wrangler d1 migrations apply`, cuyo plan es un archivo revisable.

```bash
pnpm --filter @pymeshub/db db:generate         # escribe migrations/000N_*.sql desde el schema
pnpm --filter @pymeshub/db db:migrate:local    # D1 local
pnpm --filter @pymeshub/db db:migrate:staging  # D1 de staging
pnpm --filter @pymeshub/db db:migrate:remote   # D1 de producción
```

**Revisá el SQL generado antes de aplicarlo.** SQLite no puede quitar ni cambiar el tipo de una columna in situ: Drizzle emite un rebuild de tabla (crear, copiar, borrar, renombrar), y un rebuild de `order` es un rebuild de la tabla donde está el dinero.

Bases: producción `pymhubdb`, staging `pymeshub-staging` (ids distintos a propósito).

---

## Pruebas

```bash
pnpm --filter api test              # bun test — Worker
pnpm --filter @pymeshub/db test     # bun test — geohash
pnpm --filter rest-express test     # vitest — storefront
pnpm test:e2e                       # Playwright
pnpm typecheck                      # tsc en todos los paquetes
```

---

## Referencias del repo

- `AGENTS.md` — contexto canónico para agentes (stack, reglas, ramas)
- `DESIGN.md` — dirección de diseño de la app
- `docs/` — arquitectura, negocio, legal, operaciones y riesgo
- `packages/db/README.md` — modelo de datos, migraciones y seed en detalle
- `.agents/skills/` — skills locales del proyecto

---

## Contribuir

1. Trabajá sobre `import/mobile-app` / `master` según indique el proyecto; el usuario maneja PRs y merges.
2. Commits descriptivos: `feat(api):`, `fix(web):`, `refactor(db):`.
3. `git pull --rebase` antes de push — nunca force-push.
4. Verificá tipos y build antes de empujar.

Los cambios que tocan D1, R2 o Queues (`wrangler.toml`, migraciones) van con cuidado: un id de base o de namespace mal pegado apunta a producción.

---

<div align="center">

Hecho para los comercios de barrio y la gente que los tiene cerca.

</div>
