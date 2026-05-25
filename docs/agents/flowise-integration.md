# Flowise Integration

## Overview

PymesHub integra Flowise Community Edition como motor externo de agentes IA.
Flowise corre como un servicio independiente; PymesHub se comunica con él vía la REST API `/api/v1/prediction/:chatflowId`.

**Principio clave:** Flowise genera texto. PymesHub decide si enviarlo y por qué canal.
Flowise nunca tiene acceso directo a WhatsApp, Telegram ni credenciales de canales.

---

## Arquitectura

```
Canal externo (WhatsApp, Telegram, Web)
  ↓
Webhook / Endpoint de PymesHub
  ↓
AgentRuntimeService.run()
  ↓
FlowiseClient.predict()   →   Flowise (servicio externo)
  ↓
AgentGuardrailsService.apply()
  ↓
AgentUsageService.record()
  ↓
Respuesta segura al cliente
```

---

## Desarrollo Local

### 1. Levantar Flowise

```bash
docker compose -f infra/flowise/docker-compose.yml up -d
```

Flowise UI disponible en: `http://localhost:3001`

Credenciales por defecto:
- Usuario: `admin`
- Contraseña: `changeme`

### 2. Configurar variables en `apps/api/.env`

```dotenv
FLOWISE_ENABLED=true
FLOWISE_BASE_URL=http://localhost:3001
FLOWISE_API_KEY=              # dejar vacío en dev local sin autenticación
FLOWISE_TIMEOUT_MS=30000
FLOWISE_MAX_OUTPUT_CHARS=4000
```

### 3. Crear un chatflow en Flowise

1. Abrir `http://localhost:3001` → **Chatflows** → **Add new**
2. Agregar nodos (ej. `ChatOpenAI` + `BufferMemory`)
3. Configurar el nodo con tu `OPENAI_API_KEY`
4. Guardar → copiar el UUID del chatflow desde la URL

### 4. Registrar el agente en PymesHub

```http
POST /api/agents
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Mi primer agente",
  "chatflow_id": "<uuid-de-flowise>",
  "channel_scope": "ALL"
}
```

El agente se crea en estado `DRAFT`. Activar con:

```http
POST /api/agents/:id/activate
```

### 5. Probar el agente

```http
POST /api/agents/:id/test
Content-Type: application/json

{
  "question": "Hola, ¿cómo me puedes ayudar?",
  "channel": "WEB"
}
```

Respuesta:
```json
{
  "text": "¡Hola! Soy el asistente de...",
  "flowise_session_id": "uuid",
  "session_id": "uuid"
}
```

Para continuar la misma sesión de conversación, pasar `flowise_session_id` en la siguiente llamada.

---

## Despliegue en Railway

### Servicio Flowise

1. En tu proyecto Railway → **New Service** → **Docker Image**
2. Imagen: `flowiseai/flowise:latest`
3. Agregar plugin **PostgreSQL** al servicio (base de datos dedicada para Flowise, separada de la de PymesHub)
4. Variables de entorno del servicio Flowise:

```
PORT=3000
DATABASE_TYPE=postgres
DATABASE_HOST=<host-interno-postgres>
DATABASE_PORT=5432
DATABASE_USER=flowise
DATABASE_PASSWORD=<password>
DATABASE_NAME=flowise_db
FLOWISE_USERNAME=<usuario-ui>
FLOWISE_PASSWORD=<password-ui>
FLOWISE_SECRETKEY_OVERWRITE=<openssl rand -hex 32>
```

### Configurar PymesHub para usar Flowise en Railway

En las variables de entorno de `apps/api` en Railway:

```
# URL interna Railway (sin exponer puerto público)
FLOWISE_ENABLED=true
FLOWISE_BASE_URL=http://flowise.railway.internal:3000
FLOWISE_API_KEY=<api-key-creada-en-flowise-ui>
FLOWISE_TIMEOUT_MS=30000
FLOWISE_MAX_OUTPUT_CHARS=4000
```

Para obtener el `FLOWISE_API_KEY`: en la UI de Flowise → **Settings** → **API Keys** → **Add new key**.

---

## Endpoints de la API

| Método | Ruta | Rol mínimo | Descripción |
|--------|------|-----------|-------------|
| `GET` | `/api/agents` | VIEWER | Listar agentes del workspace |
| `POST` | `/api/agents` | ADMIN | Crear agente |
| `GET` | `/api/agents/templates` | VIEWER | Listar plantillas del catálogo |
| `POST` | `/api/agents/templates/:id/install` | ADMIN | Instalar plantilla |
| `GET` | `/api/agents/:id` | VIEWER | Obtener agente |
| `PATCH` | `/api/agents/:id` | ADMIN | Actualizar agente |
| `POST` | `/api/agents/:id/test` | AGENT | Enviar mensaje de prueba |
| `POST` | `/api/agents/:id/activate` | ADMIN | Activar agente |
| `POST` | `/api/agents/:id/deactivate` | ADMIN | Desactivar agente |

---

## Modelos de datos

### AgentInstance
Chatflow de Flowise registrado a un workspace. Campos clave:
- `chatflow_id`: UUID del chatflow en Flowise (debe completarse tras instalar una plantilla)
- `status`: `DRAFT` → `ACTIVE` → `INACTIVE`
- `channel_scope`: `ALL` o un canal específico

### AgentConversationSession
Mapea una conversación de PymesHub a una sesión de Flowise. El `flowise_session_id` es el UUID enviado a Flowise para mantener el contexto.

### AgentUsageEvent
Registro no-fatal de consumo por llamada. Si falla el guardado, no afecta la respuesta al usuario.

### AgentTemplate
Catálogo de plantillas a nivel plataforma. No tiene `workspace_id`. Al instalar, se crea una `AgentInstance` con `status: DRAFT` y `chatflow_id` vacío.

---

## Invariantes de seguridad

- **Multi-tenancy**: toda query a `AgentInstance` filtra `{ id, workspace_id }`. Nunca solo por `id`.
- **Flowise no toca canales**: solo genera texto. El envío siempre pasa por PymesHub.
- **Guardrails**: el output de Flowise se trunca y redacta patrones sensibles antes de retornarlo.
- **`FLOWISE_API_KEY` nunca en código**: solo en variables de entorno del servidor.
- **`AgentUsageService.record()` es no-fatal**: usa fire-and-forget, no degrada la UX si falla.

---

## Migración de base de datos

```bash
# Crear migración
pnpm --filter saas-api exec prisma migrate dev --name add_flowise_agents

# Generar cliente Prisma
pnpm --filter saas-api exec prisma generate

# Correr seed (crea plantilla "Soporte PyME")
pnpm --filter saas-api run db:seed
```
