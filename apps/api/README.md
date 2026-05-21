# PymesHub API

Backend API para la plataforma SaaS de gestión empresarial costarricense. Sirve a clientes web (React), desktop (Tauri) y mobile (Flutter).

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20+ |
| Framework | NestJS 11 (Express) |
| ORM | Prisma 7 + PostgreSQL |
| Colas | BullMQ + Redis |
| Auth | JWT + Passport (Google OAuth2, SAML SSO) |
| Webhooks | WhatsApp (Meta), Telegram, Email (Resend/SMTP) |
| Facturación | Paddle Billing, Hacienda CR (XAdES-EPES) |
| Testing | Jest 29 + ts-jest |
| Monitoreo | OpenTelemetry (trazas + métricas) |

## Requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **PostgreSQL** 14+
- **Redis** 7+ (para colas, rate limiting y almacenamiento en caché)
- Variables de entorno configuradas (ver `.env.example`)

## Arranque rápido

```bash
cd apps/api

# Instalar dependencias (genera Prisma Client automáticamente)
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Base de datos
pnpm db:migrate      # Ejecutar migraciones
pnpm db:seed         # (opcional) Datos de demo

# Desarrollo
pnpm start:dev       # http://localhost:4000/api

# Health check
curl http://localhost:4000/api/health
```

## Estructura del proyecto

```
apps/api/
├── src/
│   ├── main.ts                  # Bootstrap: Helmet, CORS, ValidationPipe, body limit
│   ├── app.module.ts            # Módulo raíz — todos los módulos registrados
│   ├── auth/                    # JWT, refresh tokens, Google OAuth2, SAML SSO
│   ├── workspaces/              # Workspaces multi-tenant, miembros, invites
│   ├── contacts/                # CRM: contactos, leads, métricas
│   ├── conversations/           # Bandeja unificada: WhatsApp, Email, Telegram
│   ├── messages/                # Mensajes inbound/outbound, attachments
│   ├── channels/                # Configuración de canales (Email, WhatsApp, Telegram)
│   ├── tasks/                   # Tareas y seguimiento
│   ├── documents/               # OCR, almacenamiento S3, plantillas
│   ├── automations/             # Reglas de automatización (triggers + acciones)
│   ├── invoices/                # Facturación electrónica, pagos, recordatorios
│   ├── pipeline/                # Pipeline de ventas (deals, etapas)
│   ├── inventory/               # Inventario y stock
│   ├── billing/                 # Pagos Paddle, facturas, webhooks
│   ├── hacienda/                # Integración Hacienda CR (XML, firma XAdES)
│   ├── workers/                 # Procesadores BullMQ (clasificación, resúmenes)
│   ├── insights/                # Dashboards y métricas agregadas
│   ├── routing/                 # Reglas de ruteo por departamento
│   ├── sla/                     # Acuerdos de nivel de servicio
│   ├── webhooks/                # Eventos de webhooks entrantes
│   ├── platform/                # Panel de administración multi-workspace
│   ├── email/                   # Envío SMTP/Resend, inbound (Svix)
│   ├── whatsapp/                # WhatsApp Cloud API (Meta)
│   ├── telegram/                # Telegram Bot API
│   ├── ai/                      # Agentes de IA, triaje, resúmenes
│   ├── common/                  # Servicios compartidos
│   │   ├── prisma/              # Servicio Prisma + exception filter
│   │   ├── crypto/              # Cifrado AES-256-GCM para datos sensibles
│   │   ├── sanitize/            # Sanitización HTML (anti-XSS)
│   │   ├── plan-limits/         # Límites por plan + rate limiting
│   │   ├── storage/             # Almacenamiento (S3/local)
│   │   ├── telemetry/           # OpenTelemetry tracing
│   │   └── i18n/                # Internacionalización
│   └── health/                  # Health checks (DB, Redis, dependencias)
├── prisma/
│   ├── schema.prisma            # Schema de base de datos
│   └── migrations/              # Migraciones
├── test/                        # Tests de integración
├── package.json
├── tsconfig.json
├── eslint.config.mjs
└── .env.example
```

## Scripts

```bash
pnpm start:dev          # Desarrollo con hot-reload
pnpm build              # Compilar TypeScript → dist/
pnpm start              # Producción
pnpm test               # Tests unitarios (Jest)
pnpm test:cov           # Tests con cobertura
pnpm lint               # ESLint con auto-fix
pnpm format             # Prettier
pnpm db:migrate         # Ejecutar migraciones
pnpm db:generate        # Regenerar Prisma Client
pnpm db:seed            # Sembrar datos de demo
pnpm db:studio          # Prisma Studio (UI)
pnpm db:reset           # Resetear DB + seed
pnpm deploy:build       # Build de producción (valida, migra, compila)
```

## Módulos clave

### Auth (`auth/`)
- Login con email/password + JWT
- Refresh tokens rotativos
- Google OAuth2 (social login)
- SAML SSO para enterprise
- Invitaciones por email con token JWT

### Canales (`channels/`)
- Email (Resend API o SMTP propio)
- WhatsApp (Meta Cloud API con verificación de firma SHA-256)
- Telegram (Bot API con verificación de token y webhook)

### Conversaciones (`conversations/`)
- Bandeja unificada multi-canal
- Asignación por agente/departamento
- Filtros por estado, prioridad, canal
- SLA tracking (tiempo de primera respuesta, resolución)
- Reapertura automática en nuevo mensaje entrante

### Facturación electrónica (`invoices/`)
- Factura electrónica CR (XML firmado XAdES-EPES)
- Notas de crédito/débito
- Envío a Hacienda y consulta de estado
- Pagos parciales/totales
- Recordatorios automáticos
- Aprobaciones con firma digital (addon)

### Pipeline (`pipeline/`)
- Etapas configurables (Prospecto → Ganado/Perdido)
- Deals con valor, moneda, fecha de cierre
- Conversión a factura al ganar (transacción atómica)
- Notificaciones de asignación y cambio de etapa

## Seguridad

| Feature | Implementación |
|---------|---------------|
| **Helmet** | CSP, HSTS, frameguard, referrerPolicy |
| **CORS** | Orígenes explícitos por entorno (producción solo `pymeshub.lat`) |
| **Rate Limiting** | `PlanThrottlerGuard` con Redis: 100 req/min default, límites por plan |
| **Validación** | `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted` |
| **Sanitización HTML** | `sanitize-html` — todos los tags script/eventos removidos |
| **Cifrado** | AES-256-GCM para tokens, app secrets, contraseñas SMTP |
| **Webhook Signatures** | WhatsApp HMAC-SHA256, Paddle SDK, Svix, Telegram |
| **Body Size** | Limitado a 10 MB — previene ataques de memoria |
| **Exception Filters** | Sin leaks de stack traces en producción |

## Variables de entorno

| Variable | Descripción |
|----------|------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Clave para firmar JWT |
| `ENCRYPTION_KEY` | Clave AES-256-GCM (64 chars hex) |
| `PADDLE_API_KEY` | API key de Paddle |
| `PADDLE_WEBHOOK_SECRET` | Secreto para validar webhooks de Paddle |
| `RESEND_API_KEY` | API key de Resend (email) |
| `SVIX_WEBHOOK_SECRET` | Secreto para emails inbound |
| `AWS_ACCESS_KEY_ID` | S3 access key (documentos) |
| `AWS_SECRET_ACCESS_KEY` | S3 secret key |
| `AWS_REGION` | Región S3 |
| `AWS_S3_BUCKET` | Nombre del bucket |
| `OPENAI_API_KEY` | API key para agentes de IA |
| `CORS_ORIGIN` | Orígenes CORS (coma-separados, opcional) |
| `NODE_ENV` | `development` o `production` |
| `PORT` | Puerto HTTP (default: 4000) |

## Testing

```bash
# Todos los tests
pnpm test

# Tests específicos
npx jest src/billing
npx jest src/pipeline

# Watch mode
pnpm test:watch

# Con cobertura
pnpm test:cov
```

**Cobertura actual:** 142 tests en 10 suites, abarcando auth, workspaces, billing, pipeline, conversations, channels, invoices (pagos), WhatsApp, OCR y plan limits.

## Deployment

El proyecto está configurado para **Railway.app**. El script `deploy:build` ejecuta:

1. `prisma validate` — valida el schema
2. `prisma generate` — genera el cliente
3. `prisma migrate deploy` — aplica migraciones pendientes
4. `nest build` — compila TypeScript
5. `node dist/main` — arranca en producción

### Secrets requeridos en Railway

Todas las variables de entorno listadas arriba. Las críticas para producción:
- `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`
- `NODE_ENV=production`
- `PORT` (Railway asigna automáticamente)

## Workflow de ramas

El proyecto usa un **workflow de 2 troncos**:

- `main-api` → rama de features/fixes → PR → merge → delete branch
- `main-web` → rama de features/fixes → PR → merge → delete branch

Las ramas son efímeras y siempre vuelven a su `main-*` correspondiente.
