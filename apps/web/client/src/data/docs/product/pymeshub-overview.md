# PymesHub — Product overview

- [English](#english)
- [Español](#espanol)

---

## English

**PymesHub is a local-commerce and delivery marketplace for Costa Rica.** A customer orders from a nearby business; the business prepares the order; the order is picked up at the counter or delivered by a courier. PymesHub is the software that connects the three — it does not sell the products, does not provide the transport, and does not process a card payment.

This page describes the product as it exists in the current repository. It is a public reference, not a certification of availability, and it deliberately leaves out the retired SaaS-era documentation (team inbox, CRM, OCR, WhatsApp/Telegram assistants, workspaces) that no longer describes this marketplace.

### Who uses it

| Audience | What they do | Surface |
| --- | --- | --- |
| Customer | Finds nearby businesses, orders, tracks the order, keeps favourites, writes reviews | Web (`pymeshub.lat`) and the mobile app |
| Business | Publishes a catalogue, works a live order board, answers reviews, manages staff and locations | Web dashboard and the mobile app |
| Courier | Accepts delivery offers, shares location during a delivery, gets paid for the run | Mobile app |
| Platform operator | Administration: businesses, orders, categories, payouts and an audit log | Admin area of the web app |

### How money works

- The customer pays **the business** for the products and **the courier** for the delivery.
- PymesHub charges the business a **flat fee** for the app. There is **no per-order commission** and no share of the customer's payment, and the platform never handles the customer's money — which is why there is no payment gateway in the flow.
- The enabled payment methods are **cash on delivery** (`CASH`) and **SINPE Móvil** (`SINPE_MOVIL`). `CARD` exists in the data model but is not enabled.
- Payment is a **separate axis from fulfilment**: an order can be completed and paid in the same moment (cash) or paid before the business accepts (SINPE).

Source: `packages/shared/src/plans.ts`, `packages/shared/src/order-state.ts`.

### Plans and prices

Prices are in **colones (CRC)** and include Costa Rican **IVA (13%)**, which the platform absorbs and remits. The launch price book is `launch-2026`. There are five tiers and two cadences (`MONTHLY`, `YEARLY`); the annual price is **ten months** of the monthly price.

| Plan | Monthly | Yearly |
| --- | --- | --- |
| FREE | ₡0 | ₡0 |
| EMPRENDE | ₡10 900 | ₡109 000 |
| STARTER | ₡19 900 | ₡199 000 |
| GROWTH | ₡29 900 | ₡299 000 |
| BUSINESS | ₡59 900 | ₡599 000 |

**Limits depend on the tier alone** — an annual subscription has exactly the same numbers as a monthly one:

| Limit | FREE | EMPRENDE | STARTER | GROWTH | BUSINESS |
| --- | --- | --- | --- | --- | --- |
| Locations | 1 | 1 | 1 | 2 | 5 |
| Staff accounts | 1 | 2 | 3 | 5 | 15 |
| Products | 15 | 60 | 250 | 600 | 1 000 |
| Option groups per product | 1 | 2 | 4 | 5 | 6 |
| Options per group | 5 | 8 | 12 | 16 | 20 |
| Images per product | 2 | 3 | 6 | 8 | 10 |
| Storage | 150 MB | 600 MB | 3 GB | 6 GB | 10 GB |
| Active promotions | 0 | 2 | 8 | 15 | 25 |
| Analytics window (days) | 30 | 90 | 730 | 1 095 | 1 095 |
| Inventory tracking | No | No | Yes | Yes | Yes |
| Express orders accepted per day | 10 | 30 | 90 | 250 | Unlimited |

- Raising a price is a **new price book**, not a release: a subscription keeps the book it joined under, so an increase never reaches a business that is already in.
- `FREE` is **permanent**, not a trial, and is never charged.

### Subscription states

| Status | Access | Listed in the marketplace |
| --- | --- | --- |
| `ACTIVE` | Full plan limits | Yes |
| `GRACE` (30 days) | Full plan limits | Yes |
| `PAST_DUE` | Falls back to `FREE` limits | Yes |
| `SUSPENDED` (after 90 days) | Falls back to `FREE` limits | No |

The status is **derived from the subscription's dates**, not read from a stored column, so it is correct whenever it is asked.

**Never limited, on any plan:** taking and advancing orders, shop hours and pausing a location, reviews in both directions, seeing payouts, and deleting the account.

Source: `packages/shared/src/plans.ts`.

### The life of an order

Statuses: `PENDING → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → COMPLETED`, plus the terminal `CANCELLED` and `REJECTED`.

- **Fulfilment** is `PICKUP` or `DELIVERY` — a separate question from speed.
- **Speed** is `STANDARD` or `EXPRESS`.
- **Actors** are `CUSTOMER`, `BUSINESS`, `COURIER`, `ADMIN` and `SYSTEM`. A transition is legal only for the actor it belongs to, and there is only one transition table, so the API and every screen agree.
- A `PICKUP` order is completed at the counter; only a `DELIVERY` goes out the door.
- Payment methods: `CASH`, `SINPE_MOVIL` (and `CARD`, not enabled). Payment statuses: `UNPAID`, `PENDING`, `PAID`, `REFUNDED`, `FAILED`.

Source: `packages/shared/src/order-state.ts`.

### Who can do what (roles)

A business has four membership roles: **`OWNER`**, **`MANAGER`**, **`STAFF`** and **`COURIER`**. Staff invitations cover `OWNER`, `MANAGER` and `STAFF`; a courier is added to a business by email and does not go through a staff invitation.

Source: `packages/shared/src/schemas/user.ts`, `packages/shared/src/schemas/affiliation.ts`.

### Platform and architecture

- **One backend.** A single **Cloudflare Worker** (`pymeshub-api`, Hono 4 + tRPC 11) is the only thing that writes to the database.
- **Data.** Cloudflare **D1** (SQLite; production database `pymhubdb`, staging `pymeshub-staging`) through **Drizzle ORM**; **KV** for cache and rate limiting; **R2** for media (`pymeshub-media`, private, served through `/files/:id`); **Queues** (`pymeshub-order-events` with a dead-letter queue) and **Durable Objects** (`OrderRoom`, `RateLimitRoom`) for live order updates.
- **Auth.** Better Auth.
- **Clients.** Web is React 19 + Vite 7 + Tailwind + Radix/shadcn + wouter + TanStack Query; mobile is Expo 57 + React Native + expo-router; desktop is Tauri 2.
- **Hosts.** Web at `pymeshub.lat`, API at `api.pymeshub.lat`.
- **Monorepo.** pnpm 10 + Turbo, languages **es / en**, and money stored as an integer in the currency's minor unit (CRC has no minor unit).
- **Legacy.** `apps/api` (NestJS + Prisma) is retired SaaS code and is **not** the marketplace API.

Source: `README.md`, `wrangler.toml`, `packages/trpc-api/wrangler.toml`, `packages/shared/src/money.ts`.

### What the API exposes

The marketplace API is organized into these tRPC routers:

`admin`, `affiliations`, `business`, `businesses`, `cart`, `catalog`, `couriers`, `crash-report`, `deliveries`, `devices`, `favorites`, `health`, `idea`, `identity`, `notifications`, `orders`, `products`, `promotions`, `reviews`, `subscription`, `support`, `uploads`, `users`.

Source: `packages/trpc-api/src/routers`.

### Repository, licence and contact

- Licence: **MIT** (`LICENSE`).
- General contact: **hola@pymeshub.com** · Privacy: **privacidad@pymeshub.lat** · Accessibility: **accesibilidad@pymeshub.lat**.

### What this page does not claim

- It describes the repository; it is not a statement that every flow is deployed or verified in production.
- No online card payment is offered, and there is no per-order commission.
- Features from the retired SaaS era (team inbox, CRM, OCR, WhatsApp/Telegram assistants, workspaces) are not part of this product.

---

## Español

**PymesHub es un marketplace de comercio local y entregas para Costa Rica.** Un cliente pide a un negocio cercano; el negocio prepara el pedido; el pedido se retira en el local o lo entrega un repartidor. PymesHub es el software que conecta a los tres: no vende los productos, no presta el transporte y no procesa el pago con tarjeta.

Esta página describe el producto tal como existe en el repositorio actual. Es una referencia pública, no una certificación de disponibilidad, y deja fuera a propósito la documentación retirada de la etapa SaaS (inbox de equipo, CRM, OCR, asistentes de WhatsApp/Telegram, workspaces), que ya no describe este marketplace.

### Para quién es

| Audiencia | Qué hace | Superficie |
| --- | --- | --- |
| Cliente | Busca negocios cercanos, pide, sigue el pedido, guarda favoritos y escribe reseñas | Web (`pymeshub.lat`) y la app móvil |
| Negocio | Publica su catálogo, trabaja el tablero de pedidos, responde reseñas y gestiona equipo y sucursales | Panel web y app móvil |
| Repartidor | Acepta ofertas de entrega, comparte su ubicación durante la entrega y cobra por el viaje | App móvil |
| Operador de la plataforma | Administración: negocios, pedidos, categorías, pagos y un registro de auditoría | Área de admin del panel web |

### Cómo funciona el dinero

- El cliente le paga **al negocio** por los productos y **al repartidor** por la entrega.
- PymesHub le cobra al negocio una **tarifa fija** por la app. **No hay comisión por pedido** ni reparto del pago del cliente, y la plataforma nunca toca ese dinero; por eso no hay una pasarela de pago en el flujo.
- Los métodos de pago habilitados son **efectivo contra entrega** (`CASH`) y **SINPE Móvil** (`SINPE_MOVIL`). `CARD` existe en el modelo de datos, pero no está habilitado.
- El pago es un **eje aparte de la entrega**: un pedido puede completarse y pagarse en el mismo momento (efectivo) o pagarse antes de que el negocio acepte (SINPE).

Fuente: `packages/shared/src/plans.ts`, `packages/shared/src/order-state.ts`.

### Planes y precios

Los precios están en **colones (CRC)** e incluyen el **IVA (13%)** de Costa Rica, que la plataforma absorbe y entera. El libro de precios de lanzamiento es `launch-2026`. Hay cinco niveles y dos periodicidades (`MONTHLY`, `YEARLY`); el precio anual es **diez meses** del mensual.

| Plan | Mensual | Anual |
| --- | --- | --- |
| FREE | ₡0 | ₡0 |
| EMPRENDE | ₡10 900 | ₡109 000 |
| STARTER | ₡19 900 | ₡199 000 |
| GROWTH | ₡29 900 | ₡299 000 |
| BUSINESS | ₡59 900 | ₡599 000 |

**Los límites dependen solo del nivel** — un plan anual tiene exactamente los mismos números que uno mensual:

| Límite | FREE | EMPRENDE | STARTER | GROWTH | BUSINESS |
| --- | --- | --- | --- | --- | --- |
| Sucursales | 1 | 1 | 1 | 2 | 5 |
| Cuentas de staff | 1 | 2 | 3 | 5 | 15 |
| Productos | 15 | 60 | 250 | 600 | 1 000 |
| Grupos de opciones por producto | 1 | 2 | 4 | 5 | 6 |
| Opciones por grupo | 5 | 8 | 12 | 16 | 20 |
| Imágenes por producto | 2 | 3 | 6 | 8 | 10 |
| Almacenamiento | 150 MB | 600 MB | 3 GB | 6 GB | 10 GB |
| Promociones activas | 0 | 2 | 8 | 15 | 25 |
| Ventana de analítica (días) | 30 | 90 | 730 | 1 095 | 1 095 |
| Control de inventario | No | No | Sí | Sí | Sí |
| Express aceptados por día | 10 | 30 | 90 | 250 | Sin límite |

- Subir un precio es un **libro de precios nuevo**, no un despliegue: la suscripción conserva el libro con el que entró, así que un aumento nunca alcanza a un negocio que ya está dentro.
- `FREE` es **permanente**, no una prueba, y nunca se cobra.

### Estados de la suscripción

| Estado | Acceso | Aparece en el marketplace |
| --- | --- | --- |
| `ACTIVE` | Límites completos del plan | Sí |
| `GRACE` (30 días) | Límites completos del plan | Sí |
| `PAST_DUE` | Baja a los límites de `FREE` | Sí |
| `SUSPENDED` (a los 90 días) | Baja a los límites de `FREE` | No |

El estado se **deriva de las fechas** de la suscripción, no se lee de una columna guardada, así que es correcto en el momento en que se pregunta.

**Nunca se limita, en ningún plan:** tomar y avanzar pedidos, horarios y pausar el local, reseñas en ambas direcciones, ver pagos y eliminar la cuenta.

Fuente: `packages/shared/src/plans.ts`.

### La vida de un pedido

Estados: `PENDING → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → COMPLETED`, más los terminales `CANCELLED` y `REJECTED`.

- La **forma de entrega** es `PICKUP` o `DELIVERY`, una pregunta aparte de la velocidad.
- La **velocidad** es `STANDARD` o `EXPRESS`.
- Los **actores** son `CUSTOMER`, `BUSINESS`, `COURIER`, `ADMIN` y `SYSTEM`. Cada transición es legal solo para el actor al que pertenece, y existe una sola tabla de transiciones, así que la API y cada pantalla coinciden.
- Un pedido `PICKUP` se completa en el mostrador; solo un `DELIVERY` sale a la calle.
- Métodos de pago: `CASH`, `SINPE_MOVIL` (y `CARD`, no habilitado). Estados de pago: `UNPAID`, `PENDING`, `PAID`, `REFUNDED`, `FAILED`.

Fuente: `packages/shared/src/order-state.ts`.

### Quién puede hacer qué (roles)

Un negocio tiene cuatro roles de membresía: **`OWNER`**, **`MANAGER`**, **`STAFF`** y **`COURIER`**. Las invitaciones de staff cubren `OWNER`, `MANAGER` y `STAFF`; a un repartidor se lo suma al negocio por correo y no pasa por una invitación de staff.

Fuente: `packages/shared/src/schemas/user.ts`, `packages/shared/src/schemas/affiliation.ts`.

### Plataforma y arquitectura

- **Un solo backend.** Un único **Cloudflare Worker** (`pymeshub-api`, Hono 4 + tRPC 11) es lo único que escribe en la base de datos.
- **Datos.** Cloudflare **D1** (SQLite; base de producción `pymhubdb`, staging `pymeshub-staging`) con **Drizzle ORM**; **KV** para caché y límites de tasa; **R2** para media (`pymeshub-media`, privado, servido por `/files/:id`); **Queues** (`pymeshub-order-events` con cola de mensajes muertos) y **Durable Objects** (`OrderRoom`, `RateLimitRoom`) para las actualizaciones en vivo del pedido.
- **Auth.** Better Auth.
- **Clientes.** La web es React 19 + Vite 7 + Tailwind + Radix/shadcn + wouter + TanStack Query; el móvil es Expo 57 + React Native + expo-router; el escritorio es Tauri 2.
- **Hosts.** Web en `pymeshub.lat`, API en `api.pymeshub.lat`.
- **Monorepo.** pnpm 10 + Turbo, idiomas **es / en**, y el dinero guardado como entero en la unidad menor de la moneda (el colón no tiene unidad menor).
- **Legado.** `apps/api` (NestJS + Prisma) es código SaaS retirado y **no** es la API del marketplace.

Fuente: `README.md`, `wrangler.toml`, `packages/trpc-api/wrangler.toml`, `packages/shared/src/money.ts`.

### Qué expone la API

La API del marketplace se organiza en estos routers de tRPC:

`admin`, `affiliations`, `business`, `businesses`, `cart`, `catalog`, `couriers`, `crash-report`, `deliveries`, `devices`, `favorites`, `health`, `idea`, `identity`, `notifications`, `orders`, `products`, `promotions`, `reviews`, `subscription`, `support`, `uploads`, `users`.

Fuente: `packages/trpc-api/src/routers`.

### Repositorio, licencia y contacto

- Licencia: **MIT** (`LICENSE`).
- Contacto general: **hola@pymeshub.com** · Privacidad: **privacidad@pymeshub.lat** · Accesibilidad: **accesibilidad@pymeshub.lat**.

### Lo que esta página no afirma

- Describe el repositorio; no afirma que cada flujo esté desplegado ni verificado en producción.
- No se ofrece pago con tarjeta en línea y no hay comisión por pedido.
- Las funciones de la etapa SaaS retirada (inbox de equipo, CRM, OCR, asistentes de WhatsApp/Telegram, workspaces) no son parte de este producto.
