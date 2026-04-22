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
