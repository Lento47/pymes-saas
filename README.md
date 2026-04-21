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

### Cobro y Facturación
- Recordatorios y envío de facturas desde la conversación
- Facturación electrónica CR (Hacienda) integrada desde el workspace
- Base de billing por workspace para desbloqueo por plan

### Departamentos & Roles
- Organiza canales y conversaciones por departamento
- Roles granulares: OWNER / ADMIN / AGENT / VIEWER
- Visibilidad filtrada por departamento para los agentes

### Notificaciones en Tiempo Real
- WebSockets (Socket.IO) para actualizaciones instantáneas
- Notificaciones in-app: tarea vencida, mensaje recibido, mención, etc.

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
| `auth` | JWT + refresh token rotation |
| `workspaces` | Multi-tenancy, stats, miembros, billing |
| `contacts` | CRM: clientes, proveedores, leads |
| `channels` | Configuración de canales (Email, WhatsApp, Form, API) |
| `conversations` | Threads + mensajes + inbox |
| `tasks` | Gestión de tareas con deadlines |
| `documents` | Upload a S3/MinIO + OCR |
| `automations` | Reglas, triggers, historial de ejecución |
| `insights` | Motor de Insights Automáticos |
| `summaries` | Resúmenes IA diarios |
| `departments` | Equipos y enrutamiento |
| `notifications` | In-app + WebSockets |
| `invoices` | Facturación + recordatorios |
| `hacienda` | Facturación electrónica CR (Ministerio de Hacienda) |
| `pipeline` | Gestión de pipeline de ventas |
| `workers` | BullMQ — jobs asíncronos (OCR, IA, email, sync) |
| `ai` | Adaptadores de proveedores IA (OpenAI, Anthropic, Gemini) |
| `audit` | Logs de auditoría por workspace |
| `search` | Búsqueda full-text vía Prisma |
| `common` | PrismaService, CryptoService, PlanLimitsService |

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
| **AI** | OpenAI, Anthropic, Gemini, Moonshot |
| **Observabilidad** | OpenTelemetry + Jaeger |
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

| Plan | Descripción |
|------|-------------|
| **FREE** | Funcionalidades básicas, límites estrictos |
| **STARTER** | Más miembros, canales y almacenamiento |
| **GROWTH** | Automatizaciones avanzadas, más integraciones |
| **ENTERPRISE** | Sin límites, soporte dedicado |

Los límites se aplican en tiempo real via `PlanLimitsService` antes de cada operación de creación.

---

## API Reference (resumen)

```
POST   /api/auth/:workspace/login
POST   /api/auth/register
GET    /api/auth/me

GET    /api/workspaces/current
GET    /api/workspaces/current/stats
GET    /api/workspaces/current/stats/today
GET    /api/workspaces/current/members

GET    /api/insights
GET    /api/conversations
POST   /api/conversations/:id/messages
GET    /api/contacts
GET    /api/tasks
POST   /api/documents/upload
GET    /api/automations
POST   /api/summaries/generate
GET    /api/notifications
GET    /api/invoices
GET    /api/pipeline/stages
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

## Contribuir

1. Fork del repo
2. Crea tu rama: `git checkout -b feat/mi-feature`
3. Commit con mensaje descriptivo
4. Push y abre un Pull Request — usa el template provisto

---

<div align="center">

Hecho para los dueños de PyMEs que merecen herramientas de nivel enterprise.

</div>
