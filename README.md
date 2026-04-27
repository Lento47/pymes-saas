<div align="center">

# PymeHub

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
