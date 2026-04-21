<div align="center">

# 🏪 PymeHub

**La plataforma de operaciones todo-en-uno para pequeñas y medianas empresas.**  
Gestiona conversaciones, tareas, documentos y clientes — con Insights Automáticos que te dicen exactamente qué está pasando en tu negocio.

[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs&logoColor=white)](https://nestjs.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://prisma.io)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

## ¿Qué es PymeHub?

PymeHub es un SaaS multi-tenant diseñado para que los dueños de PyMEs tengan **un solo lugar** donde ver todo lo que pasa en su negocio: conversaciones con clientes, tareas del equipo, documentos, automatizaciones — y encima de todo eso, **Insights Automáticos** que analizan tus datos mes a mes y te dicen directamente qué ajustar.

No es solo un software de gestión. Es el socio inteligente que le dice al dueño de la tienda:

> *"Oye, este mes tienes un 35% más de conversaciones sin resolver. Te sugiero activar respuestas automáticas o reforzar tu equipo de atención."*

---

## ✨ Features principales

### 🧠 Insights Automáticos
El motor de análisis compara el mes actual contra el anterior y genera alertas accionables en español:

| Severidad | Ejemplo |
|-----------|---------|
| 🔴 **Peligro** | "El 42% de tus tareas activas están vencidas — redistribuye la carga." |
| 🟡 **Alerta** | "Hay 7 conversaciones abiertas sin agente asignado." |
| 🟢 **Positivo** | "¡Completaste un 22% más de tareas que el mes pasado!" |
| 🔵 **Info** | "El volumen de mensajes subió un 28% — considera respuestas rápidas." |

### 💬 Inbox Unificado
- Centraliza Email, WhatsApp, formularios y API en un solo inbox
- Recepción de email inbound configurable por canal con Resend webhook
- Asignación de conversaciones a agentes o departamentos
- Prioridades (LOW / MEDIUM / HIGH / URGENT) con badges visuales
- Resolución y archivado con trazabilidad completa

### 📋 Gestión de Tareas
- Crea tareas desde conversaciones, documentos o manualmente
- Fechas límite, prioridades y asignación por agente
- Detección automática de tareas vencidas

### 📁 Gestión de Documentos
- Upload a S3/MinIO con OCR automático
- Vinculación a contactos o conversaciones
- Límites de almacenamiento por plan

### 🤖 Automatizaciones
- Reglas con triggers: mensaje recibido, conversación creada, tarea vencida, etc.
- Condiciones configurables via JSON
- Historial de ejecución con logs de errores

### 👥 CRM de Contactos
- Clientes, proveedores, leads y otros
- Última interacción, etiquetas libres, historial completo
- Conversaciones, tareas y documentos vinculados por contacto
- Edición del contacto vinculado directamente desde el inbox

### 📊 Resúmenes IA Diarios
- Resumen en español generado automáticamente al cierre del día
- Métricas de conversaciones, mensajes, tareas y documentos

### 💳 Cobro y Facturación
- Recordatorios y envío de facturas desde la conversación
- Base de billing por workspace para desbloqueo por plan
- Preparación de facturación electrónica CR desde Workspace

### ⚖️ Ayuda y Cumplimiento
- Centro de ayuda dentro del producto
- Centro legal público con documentos del servicio
- Paquete documental maestro en `docs/` para operación, seguridad y compliance

### 🏢 Departamentos & Roles
- Organiza canales y conversaciones por departamento
- Roles granulares: OWNER / ADMIN / AGENT / VIEWER
- Visibilidad filtrada por departamento para los agentes

### 🔔 Notificaciones en Tiempo Real
- WebSockets (Socket.IO) para actualizaciones instantáneas
- Notificaciones in-app con tipos: tarea vencida, mensaje recibido, mención, etc.

---

## 🏗️ Arquitectura

```
pymes-saas/
├── apps/
│   ├── api/                    # Backend — NestJS 10
│   │   ├── src/
│   │   │   ├── auth/           # JWT + refresh token rotation
│   │   │   ├── workspaces/     # Multi-tenancy, stats, miembros
│   │   │   ├── contacts/       # CRM
│   │   │   ├── channels/       # Email, WhatsApp, Form, API
│   │   │   ├── conversations/  # Threads + mensajes
│   │   │   ├── tasks/          # Gestión de tareas
│   │   │   ├── documents/      # Upload + OCR
│   │   │   ├── automations/    # Reglas y ejecuciones
│   │   │   ├── insights/       # ⭐ Motor de Insights Automáticos
│   │   │   ├── summaries/      # Resúmenes IA diarios
│   │   │   ├── departments/    # Equipos y enrutamiento
│   │   │   ├── notifications/  # In-app + WebSockets
│   │   │   ├── workers/        # BullMQ — jobs asíncronos
│   │   │   ├── ai/             # OpenAI integration
│   │   │   └── common/         # Prisma, Storage, Crypto, PlanLimits
│   │   └── prisma/
│   │       └── schema.prisma   # Schema PostgreSQL completo
│   │
│   └── web/                    # Frontend — React 18 + Vite
│       ├── client/src/
│       │   ├── pages/          # dashboard, inbox, contacts, tasks...
│       │   ├── components/
│       │   │   ├── shared/     # InsightsWidget, StatusBadge, PageHeader...
│       │   │   └── ui/         # Radix UI primitives
│       │   ├── hooks/          # useAuth, useToast...
│       │   └── lib/
│       │       └── api.ts      # Cliente HTTP tipado
│       └── server/             # Express — proxy + static serving
```

---

## 🛠️ Stack Técnico

| Capa | Tecnología |
|------|-----------|
| **Backend framework** | NestJS 10 (DI, Guards, Decorators) |
| **Base de datos** | PostgreSQL + Prisma ORM |
| **Frontend** | React 18 + Vite + TypeScript |
| **UI** | Radix UI + TailwindCSS |
| **Routing** | Wouter (hash-based) |
| **Estado servidor** | TanStack Query (React Query) |
| **Formularios** | React Hook Form + Zod |
| **Auth** | JWT + Refresh Token Rotation |
| **Real-time** | Socket.IO |
| **Jobs async** | BullMQ + Redis |
| **Storage** | AWS S3 / MinIO |
| **Email** | Resend |
| **AI** | OpenAI, Anthropic, Gemini, Moonshot |
| **Iconos** | Lucide React |
| **Fechas** | date-fns (locale `es`) |

---

## 🚀 Getting Started

### Prerrequisitos

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- (Opcional) MinIO para storage local

### 1. Clona el repositorio

```bash
git clone https://github.com/lento47/pymes-saas.git
cd pymes-saas
```

### 2. Variables de entorno

```bash
cp apps/api/.env.example apps/api/.env
```

```env
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/pymeshub"

# JWT
JWT_SECRET="tu-secreto-super-seguro"
JWT_REFRESH_SECRET="otro-secreto-para-refresh"

# Redis (BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Storage (S3 o MinIO)
STORAGE_DRIVER=minio
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pymeshub

# OpenAI (para Resúmenes IA e Insights)
OPENAI_API_KEY=sk-...

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...

# Cifrado de secretos guardados en DB
ENCRYPTION_KEY="clave-larga-para-cifrar-secretos"
```

### 3. Instala dependencias

```bash
# API
cd apps/api && npm install

# Web
cd apps/web && npm install
```

### 4. Base de datos

```bash
cd apps/api
npx prisma migrate dev
npx prisma db seed
```

### 5. Levanta el proyecto

```bash
# Terminal 1 — API (puerto 4000)
cd apps/api && npm run start:dev

# Terminal 2 — Web (puerto 5000)
cd apps/web && npm run dev
```

Abre [http://localhost:5000](http://localhost:5000) y regístrate con tu workspace.

---

## 📐 Modelos de datos principales

```
Workspace (tenant)
  ├── Users + WorkspaceUsers (roles)
  ├── Contacts (customers, vendors, leads)
  ├── Channels (Email, WhatsApp, Form, API)
  ├── Conversations → Messages
  │     └── Tasks, Documents
  ├── AutomationRules → AutomationExecutions
  ├── DailySummaries
  ├── Departments → DepartmentMembers
  ├── Notifications
  └── AuditLogs
```

Cada modelo está aislado por `workspace_id` — multi-tenancy completo a nivel de base de datos.

---

## 🔑 Planes

| Plan | Límites |
|------|---------|
| **FREE** | Funcionalidades básicas, límites estrictos |
| **STARTER** | Más miembros, canales y almacenamiento |
| **GROWTH** | Automatizaciones avanzadas, más integraciones |
| **ENTERPRISE** | Sin límites, soporte dedicado |

Los límites se aplican en tiempo real via `PlanLimitsService` antes de cada operación de creación.

---

## 📡 API Reference (resumen)

```
POST   /api/auth/login
GET    /api/auth/me
GET    /api/workspaces/current/stats/today
GET    /api/insights                        ← Insights Automáticos
GET    /api/conversations
POST   /api/conversations/:id/messages
GET    /api/contacts
GET    /api/tasks
POST   /api/documents/upload
GET    /api/automations
POST   /api/summaries/generate
GET    /api/notifications
```

Todos los endpoints requieren `Authorization: Bearer <token>` y `x-workspace-slug: <slug>`.

---

## 📬 Email Inbound con Resend

PymeHub ya soporta envío y recepción de correos por canal `EMAIL`.

Configuración dentro del producto:

1. Ve a `Configuración > Canales`
2. Crea o abre un canal `EMAIL`
3. Configura:
   - `API Key de Resend`
   - `Email remitente`
   - `Nombre remitente`
   - `Email receptor inbound` (opcional, recomendado si el buzón receptor es distinto)
4. Copia desde PymeHub:
   - `Webhook URL`
   - `X-Workspace-Id`
   - `X-Channel-Id`
5. Configura esos valores en Resend inbound webhook

Notas operativas:

- Si `inbound_email` está definido, PymeHub lo usa para enrutar correos entrantes a ese canal.
- Si no está definido, usa `from_email` como fallback.
- Si tienes varios buzones por workspace, usa también `X-Channel-Id` para evitar ambigüedad.
- Los mensajes inbound crean o reutilizan contacto y entran al inbox como conversación real.

---

## 📚 Documentación del repo

La documentación maestra del proyecto vive en `docs/` e incluye:

- `docs/legal/`
- `docs/business/`
- `docs/security/`
- `docs/operations/`
- `docs/product-compliance/`
- `docs/architecture/`
- `docs/templates/`

El producto también expone:

- `Ayuda` dentro de la aplicación
- `Centro legal` para documentos públicos

---

## 🤝 Contribuir

1. Fork del repo
2. Crea tu rama: `git checkout -b feat/mi-feature`
3. Commit con mensaje descriptivo
4. Push y abre un Pull Request

---

<div align="center">

Hecho con 🧠 para los dueños de PyMEs que merecen herramientas de nivel enterprise.

</div>
