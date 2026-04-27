<div align="center">

# PymesHub

**La plataforma de operaciones todo-en-uno para pequeñas y medianas empresas.**  
Gestiona conversaciones, tareas, documentos y clientes — con Insights Automáticos que te dicen exactamente qué está pasando en tu negocio.

[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://prisma.io)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?style=flat-square&logo=tauri&logoColor=black)](https://tauri.app)

</div>

---

## ¿Qué es PymeHub?

PymeHub es un SaaS multi-tenant diseñado para que los dueños de PyMEs tengan **un solo lugar** donde ver todo lo que pasa en su negocio: conversaciones con clientes, tareas del equipo, documentos, automatizaciones — y encima de todo eso, **Insights Automáticos** que analizan tus datos mes a mes y te dicen directamente qué ajustar.

No es solo un software de gestión. Es el socio inteligente que le dice al dueño de la tienda:

> *"Oye, este mes tienes un 35% más de conversaciones sin resolver. Te sugiero activar respuestas automáticas o reforzar tu equipo de atención."*

---

## Features principales

### Insights Automáticos
El motor de análisis compara el mes actual contra el anterior y genera alertas accionables en español:

| Severidad | Ejemplo |
|-----------|---------|
| **Peligro** | "El 42% de tus tareas activas están vencidas — redistribuye la carga." |
| **Alerta** | "Hay 7 conversaciones abiertas sin agente asignado." |
| **Positivo** | "¡Completaste un 22% más de tareas que el mes pasado!" |
| **Info** | "El volumen de mensajes subió un 28% — considera respuestas rápidas." |

### Inbox Unificado
- Centraliza Email, WhatsApp, formularios y API en un solo inbox
- Recepción de email inbound configurable por canal con Resend webhook
- Asignación de conversaciones a agentes o departamentos
- Prioridades (LOW / MEDIUM / HIGH / URGENT) con badges visuales
- Resolución y archivado con trazabilidad completa

### Gestión de Tareas
- Crea tareas desde conversaciones, documentos o manualmente
- Fechas límite, prioridades y asignación por agente
- Detección automática de tareas vencidas

### Gestión de Documentos
- Upload a S3/MinIO con OCR automático
- Vinculación a contactos o conversaciones
- Límites de almacenamiento por plan

### Automatizaciones
- Reglas con triggers: mensaje recibido, conversación creada, tarea vencida, etc.
- Condiciones configurables via JSON
- Historial de ejecución con logs de errores

### CRM de Contactos
- Clientes, proveedores, leads y otros
- Última interacción, etiquetas libres, historial completo
- Conversaciones, tareas y documentos vinculados por contacto

### Resúmenes IA Diarios
- Resumen en español generado automáticamente al cierre del día
- Métricas de conversaciones, mensajes, tareas y documentos

### HubbyAgent — Asistente IA
- Chat inteligente con streaming en tiempo real via `POST /api/agent/stream`
- **22 tools** CRUD: contactos, tareas, pipeline, facturas, documentos, automatizaciones, insights
- Instrucciones blindadas al contexto PyMesHub — nunca sugiere herramientas externas
- Forms embebidos en el chat: crear contacto, tarea, o deal sin salir del chat
- Visualización de tool calls en tiempo real (spinner → check verde)
- **LandingHubby**: asistente público en la landing page para visitantes no autenticados
- **Onboarding Tour**: HubbyBuddy mascota animada que guía al usuario nuevo por la plataforma
- Respuestas cortas (max 200 tokens) para visitantes, completas para usuarios autenticados

### Routing Interno de WhatsApp
- **1 número, N departamentos**: los clientes ven 1 WhatsApp, internamente se rutea a Ventas, Soporte, Facturación, etc.
- Reglas de enrutamiento por keyword o menú (ej: `factura` → Billing, `1` → Ventas)
- UI de administración en Settings → Enrutamiento con tabla CRUD y toggle activo/inactivo
- Integrado en el flujo inbound: cada mensaje nuevo se asigna automáticamente al departamento correcto

### Billing & Subscriptions (Paddle)
- Checkout integrado vía Paddle SDK con precios en USD y CRC
- Webhook de Paddle para sincronización automática de suscripciones
- Portal de cliente para gestionar método de pago y facturas
- Generación de facturas PDF con PDFKit
- Envío de facturas por email vía Resend
- Sync manual y auto-detección por email del workspace owner

### SAML 2.0 SSO (Service Provider)
- Integración como Service Provider para Azure AD, Okta, PingOne, AWS SSO, etc.
- Endpoints: `/api/auth/saml/:slug/login`, `/callback`, `/metadata`
- Auto-provision: usuarios SAML sin membresía existente se crean como AGENT
- Configuración por workspace en `settings_json.saml_idp_config`

### API Keys & Tokens
- Generación de tokens `pym_*` para acceso programático (Enterprise)
- UI en Settings → API Keys con crear, listar, revocar y copiar al portapapeles
- Rate limiting distribuido con Redis (ioredis) — límites por plan:
  - FREE: 60 req/min, STARTER: 120, GROWTH: 300, ENTERPRISE: 1000

### Feature Gates por Plan
- Límites de recursos aplicados server-side (no solo frontend)
- Gates: Automations avanzado → GROWTH+, WhatsApp → GROWTH+, AI → ENTERPRISE, Pipeline → STARTER+
- Internal notes en conversaciones (textarea en sidebar con guardado async)

### i18n / Bilingüe EN-ES
- Frontend: dashboard, settings, landing, login, pricing, inbox con traducción completa
- Backend: `I18nModule` global con `I18nService` — errores en inglés y español
- Detección automática vía `Accept-Language` header

---

## Arquitectura

PymeHub es un **monorepo pnpm** con un backend canónico (NestJS + PostgreSQL) y múltiples clientes que lo consumen:

```
pymes-saas/
├── apps/
│   ├── api/                    # Backend — NestJS 10 + PostgreSQL (fuente de verdad)
│   ├── web/                    # Cliente SaaS — React 18 + Vite (proxy → API)
│   └── desktop/                # Cliente Windows — Tauri 2 + React (conecta al mismo API)
├── packages/
│   └── shared-types/           # Enums de dominio compartidos entre apps
├── docs/                       # Documentación de negocio, legal, seguridad, operaciones
├── .github/
│   └── workflows/              # CI/CD — build, tests, deploy
├── package.json                # Workspace root (scripts de monorepo)
└── pnpm-workspace.yaml
```

### Flujo de datos

```
Usuario (navegador)
  └── puerto 5000 (apps/web — Express)
        ├── /           → React SPA (Vite build)
        └── /api/*      → proxy → NestJS en puerto 4000

Usuario (Windows)
  └── apps/desktop (Tauri shell nativo)
        └── fetch /api/* → NestJS en la nube
```

Una sola base de datos PostgreSQL es la fuente de verdad para ambos clientes.

### Módulos del API (`apps/api/src/`)

| Módulo | Responsabilidad |
|--------|----------------|
| `auth` | JWT + refresh token rotation + SAML SSO |
| `workspaces` | Multi-tenancy, stats, miembros, billing |
| `contacts` | CRM: clientes, proveedores, leads |
| `channels` | Configuración de canales (Email, WhatsApp, Form, API) |
| `conversations` | Threads + mensajes + inbox + internal notes |
| `tasks` | Gestión de tareas con deadlines |
| `documents` | Upload a S3/MinIO + OCR |
| `automations` | Reglas, triggers, historial de ejecución |
| `insights` | Motor de Insights Automáticos |
| `summaries` | Resúmenes IA diarios |
| `departments` | Equipos y enrutamiento |
| `notifications` | In-app + WebSockets |
| `invoices` | Facturación + recordatorios |
| `hacienda` | Facturación electrónica CR (Ministerio de Hacienda) |
| `pipeline` | Gestión de pipeline de ventas con feature gates |
| `routing` | Enrutamiento de WhatsApp por keyword/menú a departamentos |
| `billing` | Paddle — checkout, webhooks, portal, facturas PDF |
| `api-tokens` | Tokens de API `pym_*` para acceso programático enterprise |
| `ai` | HubbyAgent — 22 tools CRUD con @openai/agents SDK |
| `workers` | BullMQ — jobs asíncronos (OCR, IA, email, sync) |
| `audit` | Logs de auditoría por workspace |
| `search` | Búsqueda full-text vía Prisma |
| `common` | PrismaService, CryptoService, PlanLimitsService, I18nModule, RedisThrottler |

---

## Stack Técnico

| Capa | Tecnología |
|------|-----------|
| **Backend** | NestJS 10 — DI, Guards, Decorators, WebSockets |
| **Base de datos** | PostgreSQL 16 + Prisma ORM |
| **Jobs async** | BullMQ + Redis 7 |
| **Storage** | AWS S3 / MinIO |
| **Cliente web** | React 18 + Vite + TypeScript |
| **UI web** | Radix UI + TailwindCSS + Lucide React |
| **Routing web** | Wouter |
| **Estado servidor** | TanStack Query (React Query) |
| **Formularios** | React Hook Form + Zod |
| **Cliente desktop** | Tauri 2 + React + Vite (Windows nativo) |
| **Auth** | JWT + Refresh Token Rotation (reuse detection) |
| **Real-time** | Socket.IO |
| **Email** | Resend (outbound + inbound webhook) |
| **AI** | OpenAI Agents SDK (@openai/agents), GPT-5.4 / GPT-4.1 |
| **Observabilidad** | OpenTelemetry + Jaeger |
| **SSO** | SAML 2.0 SP (@node-saml/node-saml) |
| **Billing** | Paddle (@paddle/paddle-node-sdk) + Resend |
| **Rate Limiting** | Redis-backed distributed throttling (ioredis) |
| **i18n** | Zod v4, TypeScript 5 |
| **Tipos compartidos** | `packages/shared-types` — enums de dominio |

---

## Recursos, licencias y cumplimiento etico open source

PymeHub combina tres tipos de recursos:

1. **Software open source** embebido o desplegado por el equipo.
2. **Infraestructura self-hosted o de terceros** con obligaciones de licencia que dependen de la version o del modo de uso.
3. **APIs y servicios propietarios** que **no** deben presentarse como open source, aunque se integren con el producto.

### Resumen del inventario actual

- El monorepo declara **143 dependencias directas** entre `apps/api`, `apps/web`, `apps/desktop` y `packages/shared-types`.
- En esas dependencias directas predominan licencias permisivas: **114 MIT**, **18 Apache-2.0**, **5 MIT OR Apache-2.0**, **2 Apache-2.0 OR MIT**, **2 Unlicense**, **1 BSD-2-Clause** y **1 ISC**.
- La capa desktop agrega dependencias Rust/Tauri bajo esquemas permisivos o duales MIT/Apache-2.0.
- Los servicios de IA, correo y pagos deben tratarse como **proveedores externos bajo terminos comerciales**, no como componentes OSS del producto.

### Recursos open source principales usados por el programa

| Recurso | Uso en PymeHub | Licencia / modelo |
| --- | --- | --- |
| NestJS | Backend API | MIT |
| React, Express, Vite, Socket.IO | Cliente web y shell de desarrollo | MIT |
| Radix UI, TailwindCSS, React Hook Form, Zod, Framer Motion, BullMQ | UI y flujo de aplicacion | Mayoritariamente MIT |
| TypeScript, Prisma, OpenTelemetry, AWS SDK JS | Tooling, ORM, observabilidad e integraciones | Apache-2.0 |
| Tauri 2 + plugins oficiales | App desktop nativa | MIT o Apache-2.0 segun paquete |
| PostgreSQL | Base de datos principal | PostgreSQL License |
| MinIO | Storage S3-compatible local/self-hosted | GNU AGPLv3 |
| Wouter | Routing ligero | Unlicense |
| Lucide React | Iconografia | ISC |
| dotenv | Variables de entorno | BSD-2-Clause |

### Recursos que requieren lectura especial de cumplimiento

| Recurso | Estado de cumplimiento etico/open source | Implicacion practica |
| --- | --- | --- |
| Redis | **Depende de la version**. Redis `<= 7.2` sigue bajo `BSD-3-Clause`; Redis Community Edition `7.4` a `7.8` usa `RSALv2` o `SSPLv1`; Redis `8+` agrega opcion `AGPLv3`. | Si el objetivo es permanecer en software OSI-only, conviene fijar `Redis 7.2.x` o evaluar una alternativa como Valkey antes de distribuir o vender una solucion administrada. |
| MinIO | Open source bajo `AGPLv3`. | Antes de redistribuir, modificar o empaquetar MinIO con oferta comercial, revisar obligaciones AGPL con asesoria legal. |
| Tauri desktop | El codigo base es open source, pero la **distribucion del instalador** exige conservar avisos, terminos y evidencia de aceptacion. | Ver `docs/product-compliance/windows-installer-license-requirements.md`. |
| AI providers (`OpenAI`, `Anthropic`, `Gemini`, `Moonshot`) | **No son open source**; se consumen por API bajo terminos del proveedor. | Deben declararse como terceros, con disclosure al cliente y minimizacion de datos. |
| Resend | Servicio externo propietario para correo transaccional/inbound. | Debe mantenerse en listas de subprocesadores, privacidad y vendor review. |
| AWS S3 / hosting / pasarela de pago | Pueden involucrar software OSS debajo, pero para PymeHub operan como **servicios comerciales**. | El cumplimiento depende de contrato, DPA, privacidad, retencion y seguridad, no solo de licencia de codigo. |

### Referencias oficiales recomendadas

- Redis licensing: <https://redis.io/legal/licenses/>
- PostgreSQL License: <https://www.postgresql.org/about/licence/>
- MinIO licensing overview: <https://charts.min.io/>
- Tauri repository licensing: <https://github.com/tauri-apps/tauri>
- OpenAI legal/policies: <https://openai.com/policies/>
- Resend legal: <https://resend.com/legal>

### Criterios de cumplimiento etico que este repo ya reconoce

- **No confundir OSS con SaaS propietario**: el mapa de servicios de terceros ya separa IA, correo, storage, hosting y pagos en [`docs/architecture/third-party-services-map.md`](./docs/architecture/third-party-services-map.md).
- **Disclosure de IA y revision humana**: el producto ya documenta minimizacion, advertencias y supervision humana en [`docs/product-compliance/ai-usage-and-disclosure.md`](./docs/product-compliance/ai-usage-and-disclosure.md).
- **Registro de subprocesadores**: los proveedores que traten datos del cliente deben reflejarse en [`docs/security/subprocessors-list.md`](./docs/security/subprocessors-list.md).
- **Requisitos de instalacion Windows**: cualquier build desktop distribuida debe mostrar licencia, privacidad y avisos relevantes segun [`docs/product-compliance/windows-installer-license-requirements.md`](./docs/product-compliance/windows-installer-license-requirements.md).

### Obligaciones minimas recomendadas antes de distribuir

- Añadir un archivo `LICENSE` en la raiz para dejar claro bajo que terminos se publica **el codigo propio de este repositorio**.
- Generar un `THIRD_PARTY_NOTICES.md` o equivalente para builds desktop/enterprise con avisos de dependencias y licencias aplicables.
- Congelar y documentar la version exacta de Redis que se autoriza en despliegues para evitar caer accidentalmente en una licencia no alineada con la politica OSS deseada.
- Revisar cualquier uso de MinIO en distribuciones comerciales o appliance/self-hosted con criterio AGPL, no solo tecnico.
- Completar los campos pendientes (`[POR_CONFIRMAR]`, `[FECHA]`) en `subprocessors-list.md` antes de produccion con datos reales de region, estado y revision.
- Mantener el principio de minimizacion de datos en prompts, OCR, email y observabilidad.

### Estado actual y brechas visibles

- Este repositorio **todavia no expone una licencia raiz visible** para el codigo propio.
- No existe aun un archivo consolidado de `NOTICE`, SBOM o inventario legal versionado para distribucion.
- El cumplimiento de proveedores externos esta documentado, pero varios registros siguen como plantilla y requieren cierre operativo.
- Este README resume el estado tecnico/documental del repo, pero **no sustituye revision legal profesional** para una salida comercial o enterprise.

---

## Getting Started

### Prerrequisitos

- Node.js 20+
- pnpm 10+
- PostgreSQL 16
- Redis 7
- (Opcional) MinIO para storage local

### 1. Clona el repositorio

```bash
git clone https://github.com/lento47/pymes-saas.git
cd pymes-saas
```

### 2. Instala dependencias

```bash
pnpm install
```

### 3. Variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
```

Variables requeridas en `apps/api/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/pymeshub"

JWT_SECRET="tu-secreto-super-seguro"
JWT_REFRESH_SECRET="otro-secreto-para-refresh"

REDIS_HOST=localhost
REDIS_PORT=6379

STORAGE_DRIVER=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pymeshub

ENCRYPTION_KEY="clave-larga-para-cifrar-secretos"

# Opcional — habilita IA e email
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
```

### 4. Base de datos

```bash
cd apps/api
pnpm exec prisma migrate dev
pnpm exec prisma db seed
```

### 5. Levanta el stack completo (Docker — recomendado)

```bash
cd apps/api
docker compose up -d
```

Esto levanta PostgreSQL 16, Redis 7, MinIO y el API de NestJS con health checks.

### 6. Levanta en modo desarrollo (sin Docker)

```bash
# Terminal 1 — API (puerto 4000)
pnpm dev:api

# Terminal 2 — Web (puerto 5000)
pnpm dev:web
```

Abre [http://localhost:5000](http://localhost:5000) y regístrate con tu workspace.

---

## App Desktop (Windows)

PymeHub tiene una app nativa para Windows basada en [Tauri 2](https://tauri.app). Consume el mismo API de NestJS — no tiene base de datos propia.

### Prerrequisitos adicionales

- Rust (https://rustup.rs)
- Dependencias de Tauri para tu OS: https://tauri.app/start/prerequisites

### Desarrollo

```bash
cd apps/desktop
cp .env.example .env
# Edita VITE_API_URL=http://localhost:4000
pnpm install
pnpm tauri:dev
```

### Build para distribución

```bash
cd apps/desktop
pnpm tauri:build
# El instalador queda en src-tauri/target/release/bundle/
```

---

## Modelos de datos

```
Workspace (tenant)
  ├── Users + WorkspaceUsers (roles)
  ├── WorkspaceTaxProfile (datos fiscales CR)
  ├── WorkspaceSubscription (billing)
  ├── Contacts (customers, vendors, leads)
  ├── Channels (Email, WhatsApp, Form, API)
  ├── Conversations → Messages
  │     ├── Tasks
  │     └── Documents
  ├── AutomationRules → AutomationExecutions
  ├── DailySummaries
  ├── Insights
  ├── Departments → DepartmentMembers
  ├── Notifications
  ├── Invoices → InvoicePayments
  ├── HaciendaDocuments
  ├── PipelineStages → Deals
  ├── RefreshTokens
  └── AuditLogs
```

Cada modelo está aislado por `workspace_id` — multi-tenancy completo a nivel de base de datos.

---

## Planes

| Plan | Usuarios | Automatizaciones | Contactos | Facturas/mes | Almacenamiento | Rate Limit |
|------|----------|-----------------|-----------|-------------|----------------|------------|
| **FREE** | 3 | 5 | 500 | 50 | 100 MB | 60 req/min |
| **STARTER** | 10 | 25 | 5,000 | 200 | 1 GB | 120 req/min |
| **GROWTH** | 50 | 100 | 50,000 | 1,000 | 10 GB | 300 req/min |
| **ENTERPRISE** | ∞ | ∞ | ∞ | ∞ | ∞ | 1,000 req/min |

> **Business** y **Business+** en el frontend mapean a `ENTERPRISE` en la base de datos.

Los límites se aplican en tiempo real via `PlanLimitsService` antes de cada operación de creación, con feature gates server-side por plan.

---

## API Reference (resumen)

```
# Auth + SSO
POST   /api/auth/:workspace/login
POST   /api/auth/register
GET    /api/auth/me
GET    /api/auth/saml/:slug/login
POST   /api/auth/saml/:slug/callback
GET    /api/auth/saml/:slug/metadata

# Workspace
GET    /api/workspaces/current
GET    /api/workspaces/current/stats
GET    /api/workspaces/current/stats/today
GET    /api/workspaces/current/members
GET    /api/workspaces/current/subscription
GET    /api/workspaces/current/api-tokens

# HubbyAgent
POST   /api/agent/stream          # SSE streaming chat
POST   /api/agent/execute         # Tool execution (JWT)
POST   /api/agent/public          # Public landing chat
POST   /api/agent/tool            # Tool execution (API key)

# Conversations
GET    /api/conversations
POST   /api/conversations/:id/messages
PATCH  /api/conversations/:id      # status, priority, notes, assigned_user_id

# Billing
POST   /api/billing/checkout
POST   /api/billing/webhook
GET    /api/billing/portal
GET    /api/billing/invoices
GET    /api/billing/invoices/:id/pdf
POST   /api/billing/sync

# Routing
GET    /api/routing-rules
POST   /api/routing-rules
PATCH  /api/routing-rules/:id
DELETE /api/routing-rules/:id

# Core
GET    /api/insights
GET    /api/contacts
GET    /api/tasks
POST   /api/documents/upload
GET    /api/automations
POST   /api/summaries/generate
GET    /api/notifications
GET    /api/invoices
GET    /api/pipeline/stages
GET    /api/search
```

Todos los endpoints requieren `Authorization: Bearer <token>`.

---

## Email Inbound con Resend

1. Ve a `Configuración > Canales`
2. Crea o abre un canal `EMAIL`
3. Configura API Key, email remitente y nombre
4. Copia la `Webhook URL`, `X-Workspace-Id` y `X-Channel-Id` generados
5. Configura esos valores en Resend inbound webhook

Los mensajes inbound crean o reutilizan contacto y entran al inbox como conversación real.

---

## Tests

```bash
cd apps/api
pnpm test           # unit tests
pnpm test:watch     # modo watch
pnpm test:cov       # con coverage
```

Los tests unitarios usan mocks de `PrismaService` — no requieren base de datos.

---

## CI/CD

Los workflows están en `.github/workflows/`:

| Workflow | Trigger | Qué hace |
|----------|---------|----------|
| `api-ci.yml` | push/PR a `main` | lint, build, tests con PostgreSQL real |
| `pr-checks.yml` | apertura de PR | valida descripción + build TypeScript |
| `api-deploy.yml` | push a `main` | build imagen Docker → push a ghcr.io → deploy SSH |

---

## Documentación del repo

```
docs/
├── architecture/     # Decisiones de arquitectura
├── business/         # Modelo de negocio, pricing
├── legal/            # Términos, privacidad, compliance
├── operations/       # Runbooks, deployment, backups
├── security/         # Políticas y controles de seguridad
├── product-compliance/
└── templates/
```

---

## Ramas y Deploy

| Rama | Propósito | Deploy |
|------|-----------|--------|
| `main` | Referencia estable — nunca modificar directamente | — |
| `main-api` | Backend NestJS | Railway |
| `main-web` | Frontend React SPA | Cloudflare Pages |

**Regla estricta**: backend solo en `main-api`, frontend solo en `main-web`. Nunca mezclar.

## Contribuir

1. Identifica si tu cambio es backend (`main-api`) o frontend (`main-web`)
2. Cambiate al worktree correspondiente
3. Commit con mensaje descriptivo
4. Push al branch respectivo

---

<div align="center">

Hecho para los dueños de PyMEs que merecen herramientas de nivel enterprise.

</div>
