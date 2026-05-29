<div align="center">

# PymesHub

**La plataforma de operaciones inteligente para pequeñas y medianas empresas.**  
Inbox unificado multicanal, CRM, facturación electrónica, pipeline de pedidos, y AI que sabe tu negocio.

[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![Railway](https://img.shields.io/badge/Railway-deploy-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-Pages-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![Tauri](https://img.shields.io/badge/Tauri-2-FFC131?style=flat-square&logo=tauri&logoColor=black)](https://tauri.app)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-API-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://developers.facebook.com/docs/whatsapp/cloud-api)

</div>

---

## ¿Qué es PymesHub?

PymesHub es un SaaS multi-tenant diseñado para dueños de PyMEs latinoamericanas. Centraliza conversaciones de **WhatsApp, Email, Telegram y formularios** en un solo inbox, gestiona contactos y pedidos, y ofrece **insights automáticos** que analizan tus datos y te dicen qué ajustar — en español, sin gráficas complicadas.

> *"Oye, este mes tienes un 35% más de conversaciones sin resolver. Te sugiero activar respuestas automáticas o reforzar tu equipo."*

---

## Arquitectura

Monorepo **pnpm** con un backend canónico (NestJS + PostgreSQL + Redis/BullMQ) y múltiples clientes. **Unified `master` branch** — backend y frontend comparten el mismo trunk. Deploy automático: Railway (API) + Cloudflare Pages (frontend).

```
pymes-saas/
├── apps/
│   ├── api/                    # Backend — NestJS 11 + Prisma 7 + BullMQ
│   ├── web/                    # Frontend SaaS — React 18 + Vite 7 + Tailwind 3
│   ├── desktop/                # Desktop Windows — Tauri 2 + React
│   └── flutter_app/            # Mobile — Flutter
├── packages/
│   └── shared-types/           # Tipos y enums compartidos (11 archivos)
├── scripts/                    # pre-push-check.sh, CI helpers
├── docs/                       # Arquitectura, negocio, legal, operaciones
└── wrangler.toml               # Cloudflare Worker (WS proxy + KV cache)
```

### Flujo de datos

```
Usuario (navegador)
  └── Cloudflare Pages (pymeshub.lat)
        ├── Static assets (React SPA)
        ├── /api/* → Worker proxy → Railway (api.pymeshub.lat)
        └── /socket.io/* → Worker WebSocket → Railway

Usuario (Windows)
  └── Tauri 2 shell nativo → Railway API

Usuario (WhatsApp/Telegram)
  └── Cloud API / Bot API → Webhook → Railway API
```

### Deploy automático

| Plataforma | Rama | Excluye | Mecanismo |
|-----------|------|---------|-----------|
| **Railway** | `master` | `apps/web/client/`, `dist/` | `.dockerignore` |
| **Cloudflare Pages** | `master` | `apps/api/`, `packages/` | `.cloudflareignore` |

---

## Stack Técnico

| Capa | Tecnología |
|------|-----------|
| **Backend** | NestJS 11 — DI, Guards, Interceptors, WebSockets |
| **ORM** | Prisma 7 + PostgreSQL 16 |
| **Jobs** | BullMQ + Redis 7 (classifier, summaries, email, OCR, sync) |
| **Storage** | MinIO / Cloudflare R2 |
| **Frontend** | React 18 + Vite 7 + TypeScript 5 |
| **UI** | Radix UI (shadcn/ui) + Tailwind CSS 3 + Lucide React |
| **Routing** | Wouter (pathname-based, no hashes) |
| **Estado** | TanStack Query 5 |
| **Formularios** | React Hook Form 7 + Zod |
| **Tiempo real** | Socket.IO 4 (WebSocket via Cloudflare Worker) |
| **Desktop** | Tauri 2 (Windows nativo) |
| **Mobile** | Flutter |
| **Email** | Resend (outbound + inbound webhook) |
| **Mensajería** | WhatsApp Cloud API, Telegram Bot API |
| **Pagos** | Paddle + PayPal |
| **Auth** | JWT + Refresh Token Rotation + SAML SSO |
| **AI** | OpenAI / Anthropic / Gemini / DeepSeek (via multi-provider adapter) |
| **AI Agents** | Flowise AgentFlow V2 (chatflows provisionados automáticamente por plan) |
| **Observabilidad** | OpenTelemetry + Jaeger |
| **Edge** | Cloudflare Worker (WebSocket proxy, KV cache) |
| **Hosting** | Railway (backend) + Cloudflare Pages (frontend) |

---

## Features principales

### Inbox Unificado
WhatsApp, Email, Telegram, formularios web y API — todo en una bandeja unificada con UX tipo mensajería:
- Burbujas de chat con estados de entrega (enviado ✓, entregado ✓✓, leído ✓✓ azul)
- WhatsApp: mensajes de texto, imágenes, video, audio, stickers, documentos, ubicación, contactos, interactivos (botones/listas)
- Adjuntos con lightbox, media viewer y preview inline
- Composición de mensajes con soporte de attachments + emoji + plantillas
- Optimistic send, auto-scroll, slide-up animations
- Indicadores de typing y recibos de lectura bidireccionales
- Asignación de conversaciones a agentes
- Prioridades (LOW / MEDIUM / HIGH / URGENT)
- Resolución, archivado y trazabilidad completa

### CRM de Contactos
- Clientes, proveedores, leads con historial completo
- Última interacción, etiquetas libres, notas privadas
- Conversaciones, tareas, documentos y pedidos vinculados por contacto
- Búsqueda y filtros avanzados

### Pipeline de Pedidos
- Ciclo completo: RECIBIDO → EN PROCESO → COMPLETADO → CANCELADO
- Transiciones con reglas de estado válidas
- Dashboard con métricas de volumen por estado
- Integración con CRM e inbox

### Facturación Electrónica (Hacienda CR)
- Facturación electrónica integrada con Ministerio de Hacienda de Costa Rica
- Catálogo CABYS de productos
- Generación de PDF y envío por WhatsApp/Email desde el inbox

### Insights Automáticos
Motor de análisis mes-a-mes que genera alertas accionables en español:

| Severidad | Ejemplo |
|-----------|---------|
| **Peligro** | "El 42% de tus tareas activas están vencidas — redistribuye la carga." |
| **Alerta** | "Hay 7 conversaciones abiertas sin agente asignado." |
| **Positivo** | "¡Completaste un 22% más de pedidos que el mes pasado!" |

### Automatizaciones
- Triggers: mensaje recibido, conversación creada, tarea vencida, pedido completado
- Condiciones configurables con editor visual
- Acciones: enviar mensaje, crear tarea, asignar agente, mover pipeline
- Historial de ejecución con logs

### Gestión de Tareas
- Creación desde conversaciones, documentos o manual
- Deadlines, prioridades, asignación por agente
- Vista kanban y lista
- Detección automática de tareas vencidas

### Inventario
- Catálogo de productos con categorías, stock y precios
- Alertas de stock bajo
- Movimientos de inventario (entradas/salidas)
- Integración con facturación y pipeline de pedidos

### Departamentos & Roles
- Organización por departamento con visibilidad filtrada
- Roles: OWNER / ADMIN / AGENT / VIEWER
- SAML SSO para empresas
- Feature flags por perfil (EMPRENDE / BUSINESS)

### Notificaciones en Tiempo Real
- WebSockets para actualizaciones instantáneas
- Notificaciones in-app: mensaje nuevo, tarea vencida, mención
- Campana de notificaciones con badge

### AI Agents (Flowise)
Motor de agentes IA sobre **Flowise AgentFlow V2**. Cada workspace puede crear y gestionar agentes independientes con alcance por canal:

- Creación de agentflows en Flowise vía API en el momento de provisión
- `channel_scope`: `ALL | WHATSAPP | TELEGRAM | EMAIL | WEB | MANUAL`
- Estado: `DRAFT → ACTIVE / INACTIVE`; solo agentes ACTIVE responden mensajes
- El LLM orquestador selecciona automáticamente el agente correcto por contexto
- Memoria multi-turno por conversación via `AgentConversationSession`
- Métricas de uso (tokens, latencia, costo) en `AgentUsageEvent`
- Endpoint de re-provisión on-demand: `POST /api/agents/admin/flowise-rebuild`

**Soporte técnico por tiers** (basado en el plan del workspace):

| Tier | Plan | Capacidades |
|------|------|-------------|
| **Tier 1** | Free | Confirma recepción, recomienda actualizar plan |
| **Tier 2** | Starter | Lee logs Railway, extrae errores, lista casos diagnóstico |
| **Tier 3** | Business | + lee código fuente GitHub, detecta regresiones, propone fixes para aprobación manual |
| **Tier 4** | Business+ | + aplica fixes automáticamente (crea branch, commit y PR en draft) |

### AI integrado en inbox
- Resúmenes diarios automáticos en español
- Clasificación de conversaciones por urgencia y categoría
- Sugerencias de respuestas y productos
- Extracción de datos de facturas (OCR + AI)

---

## Módulos del API (`apps/api/src/`)

### Módulos de negocio (33)

| Módulo | Responsabilidad |
|--------|----------------|
| `auth` | JWT + refresh rotation + SAML SSO |
| `workspaces` | Multi-tenancy, stats, miembros, facturación |
| `contacts` | CRM: clientes, proveedores, leads |
| `conversations` | Threads + mensajes + inbox unificado |
| `whatsapp` | WhatsApp Cloud API (send/receive/templates/media/interactive); billing gestionado por el cliente en Meta |
| `channels` | Configuración de canales (Email, WhatsApp, Telegram, Form, API); webhooks, tokens, estado |
| `agents` | Agentes IA: CRUD, provisión en Flowise, runtime, soporte por tiers, admin rebuild |
| `tasks` | Gestión de tareas con deadlines |
| `documents` | Upload a S3/MinIO + OCR automático |
| `automations` | Reglas, triggers, condiciones, historial |
| `invoices` | Facturación + recordatorios + pagos |
| `hacienda` | Facturación electrónica CR (Hacienda) |
| `pipeline` | Pipeline de ventas (stages + deals) |
| `orders` | Pipeline de pedidos (RECEIVED→COMPLETED→CANCELLED) |
| `inventory` | Catálogo de productos, stock, movimientos |
| `insights` | Motor de Insights Automáticos |
| `summaries` | Resúmenes IA diarios |
| `notifications` | In-app + WebSockets + push |
| `departments` | Equipos y enrutamiento |
| `templates` | Plantillas de mensajes reutilizables |
| `message-templates` | Plantillas WhatsApp Cloud API (UTILITY, MARKETING) |
| `email` | Envío y recepción de email (Resend) |
| `routing` | Reglas de enrutamiento de conversaciones |
| `ai` | Multi-provider AI adapter (OpenAI, Anthropic, Gemini, DeepSeek) |
| `feature-flags` | Feature gating por perfil (EMPRENDE/BUSINESS) |
| `billing` | Paddle subscriptions + usage metering |
| `import` | Importación CSV de contactos y productos |
| `onboarding` | Wizard de configuración inicial |
| `search` | Búsqueda full-text via Prisma |
| `sla` | Service Level Agreements y métricas |
| `enterprise` | Funcionalidades enterprise (SSO, audit avanzado) |
| `platform` | Admin panel multi-workspace |
| `demo` | Generación de datos demo para evaluación |
| `insights` | Métricas de negocio accionables |

### Módulos transversales (10)

| Módulo | Responsabilidad |
|--------|----------------|
| `common/prisma` | PrismaService — singleton ORM |
| `common/crypto` | AES-256-GCM encryption |
| `common/storage` | S3/MinIO/R2 abstraction |
| `common/sanitize` | HTML/Markdown sanitization |
| `common/plan-limits` | Enforcement de límites por plan |
| `common/i18n` | Traducciones y localización |
| `common/telemetry` | OpenTelemetry tracing |
| `common/metrics` | Métricas de producto y negocio |
| `gateways/events` | Socket.IO gateway (WebSocket events) |
| `health` | Health checks y memory monitoring |

### Workers BullMQ

| Worker | Propósito |
|--------|-----------|
| Classifier | Clasificación AI de conversaciones |
| Summaries | Resúmenes diarios |
| Email | Envío y procesamiento async |
| OCR | Extracción de texto de documentos |
| Sync | Sincronización con servicios externos |

---

## Planes

| Plan | Precio | Usuarios | Funcionalidades clave |
|------|--------|----------|-----------------------|
| **Emprende** | $15/mes | 1 | CRM, WhatsApp inbox, facturación ilimitada, pipeline de pedidos |
| **Starter** | $25/mes | 1 | + facturación avanzada, dashboard, 15 automatizaciones |
| **Growth** | $59/mes | 5 | + automatizaciones básicas, roles de usuario, migración de datos |
| **Business** | $119/mes | 15 | + múltiples ubicaciones, API, auditoría, soporte telefónico |
| **Business+** | Personalizado | Ilimitado | + SSO/SAML, SLA, contratos, onboarding dedicado, AI Tier 4 |

> **Nota de canales:** PymesHub se conecta con la WABA propia del cliente via WhatsApp Business Cloud API. Los cargos por mensajes de plantilla que aplique Meta se cobran directamente al negocio por Meta — no están incluidos en la suscripción de PymesHub. Telegram no tiene cargos adicionales en uso normal.

Los límites se aplican en tiempo real via `PlanLimitsService`. Los perfiles controlan qué features se muestran via `FeatureFlagsService`.

---

## Getting Started

### Prerrequisitos

- Node.js 20+
- pnpm 10+
- PostgreSQL 16
- Redis 7
- (Opcional) MinIO para storage local

### 1. Clonar e instalar

```bash
git clone https://github.com/lento47/pymes-saas.git
cd pymes-saas
pnpm install
```

### 2. Variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
```

Variables requeridas en `apps/api/.env`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/pymeshub"
JWT_SECRET="tu-secreto-super-seguro"
JWT_REFRESH_SECRET="otro-secreto-para-refresh"
ENCRYPTION_KEY="clave-larga-de-64-caracteres-hex"

REDIS_HOST=localhost
REDIS_PORT=6379

STORAGE_DRIVER=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pymeshub

# Opcional — habilita IA, email y mensajería
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
TELEGRAM_BOT_TOKEN=...
```

### 3. Base de datos

```bash
cd apps/api
pnpm exec prisma migrate dev
pnpm exec prisma db seed
```

### 4. Levantar en desarrollo

```bash
# Terminal 1 — API (puerto 4000)
pnpm dev:api

# Terminal 2 — Web (puerto 5000)
pnpm dev:web
```

Abre [http://localhost:5000](http://localhost:5000).

O con Docker:

```bash
cd apps/api
docker compose up -d   # PostgreSQL + Redis + MinIO
pnpm dev:api           # API en modo dev apuntando a Docker
```

---

## Estructura del Frontend (`apps/web/`)

```
apps/web/
├── client/src/
│   ├── pages/              # 53 páginas (~50 rutas)
│   │   ├── landing.tsx     # Landing page (no-auth) / dashboard (auth)
│   │   ├── login.tsx, register.tsx, pricing.tsx, product.tsx
│   │   ├── inbox.tsx, contacts.tsx, tasks.tsx, documents.tsx
│   │   ├── invoices.tsx, pipeline.tsx, inventory.tsx
│   │   ├── automations.tsx, notifications.tsx, agent.tsx
│   │   ├── settings/       # workspace, members, channels, billing, AI, integrations
│   │   ├── admin/          # Platform admin panel (multi-workspace)
│   │   └── onboarding.tsx, help.tsx, support.tsx
│   ├── components/         # 123 componentes en 15 directorios
│   │   ├── ui/             # 45 shadcn/ui primitives
│   │   ├── layout/         # Sidebar, header, mobile nav
│   │   ├── shared/         # 25 componentes transversales
│   │   └── settings/, automations/, inventory/, marketing/
│   ├── features/
│   │   └── inbox/          # 42 archivos — arquitectura modular de inbox
│   │       ├── components/conversation/   # MessageBubble, Timeline, Composer
│   │       ├── components/media/          # Image, Video, Audio, Sticker, Document
│   │       └── components/composer/       # ServiceWindowGuard, InteractiveToolbar
│   └── hooks/              # 14 custom hooks (auth, socket, feature-flags, etc.)
├── server/                 # Express proxy (Vite dev → API)
├── cloudflare-worker.js    # Edge Worker (WebSocket proxy + deploy monitoring)
├── tailwind.config.ts      # Design system: dark theme, fintech institucional
└── vite.config.ts
```

---

## Pruebas

```bash
# API (unit tests con Jest + mocks de PrismaService)
cd apps/api
pnpm test
pnpm test:watch
pnpm test:cov

# Frontend (Vitest + Testing Library)
cd apps/web
pnpm test
pnpm test:watch

# Pre-push safety check
bash scripts/pre-push-check.sh    # tsc + lint + Prisma + critical modules
```

---

## CI/CD

Deploy automático desde `master`:

| Plataforma | Trigger | Pipeline |
|-----------|---------|----------|
| **Railway** | Push a `master` | Docker build → deploy automático |
| **Cloudflare Pages** | Push a `master` | `pnpm build` → deploy automático |
| **Hermes webhook** | Railway deploy event | POST a `hermes.pymeshub.lat/webhooks/railway-deploy` |

Pre-push safety: `scripts/pre-push-check.sh` valida TypeScript, Prisma, módulos críticos y conflict markers antes de cada push.

---

## Documentación del repo

```
docs/
├── architecture/     # Decisiones de arquitectura
├── business/         # Modelo de negocio, pricing, planes
├── legal/            # Términos, privacidad, compliance
├── operations/       # Runbooks, deployment, backups
├── security/         # Políticas y controles de seguridad
└── product-compliance/
```

Referencias técnicas en el repo:
- `AGENTS.md` — Contexto canónico para el agente Hermes
- `repo-constitution.md` — Invariantes del proyecto
- `verification-recipes.md` — Comandos de verificación
- `incident-memory.md` — Incidentes y lecciones aprendidas

---

## Contribuir

1. Trabajá directamente en `master` — branch unificado
2. Commit con mensaje descriptivo: `feat(api):`, `fix(web):`, `refactor(shared):`
3. `git pull --rebase` antes de push — nunca force-push
4. Ejecutá `scripts/pre-push-check.sh` antes de cada push
5. El usuario maneja PRs y merges desde branches temporales

---

<div align="center">

Hecho para los dueños de PyMEs que merecen herramientas de nivel enterprise.

</div>
