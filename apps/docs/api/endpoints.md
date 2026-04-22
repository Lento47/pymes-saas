# Referencia de Endpoints

Todos los endpoints requieren autenticación con `Authorization: Bearer <token>` salvo que se indique lo contrario.

## Workspace

### Obtener workspace actual

```http
GET /api/workspaces/current
```

Retorna la información completa del workspace activo, incluyendo plan, estado y configuración.

### Estadísticas del workspace

```http
GET /api/workspaces/current/stats
```

Retorna métricas históricas: conversaciones, mensajes, tareas, documentos por período.

### Estadísticas de hoy

```http
GET /api/workspaces/current/stats/today
```

### Actualizar workspace (Admin)

```http
PATCH /api/workspaces/current
Content-Type: application/json

{
  "name": "Nuevo nombre",
  "timezone": "America/Costa_Rica",
  "locale": "es-CR"
}
```

### Exportar datos (Admin)

```http
GET /api/workspaces/current/export
```

Genera y descarga un archivo ZIP con todos los datos del workspace en formato JSON/CSV.

## Miembros

### Listar miembros

```http
GET /api/workspaces/current/members
```

### Invitar miembro (Admin)

```http
POST /api/workspaces/current/members/invite
Content-Type: application/json

{
  "email": "usuario@empresa.com",
  "role": "AGENT",
  "department_ids": ["dept_id_1"]
}
```

### Cambiar rol (Admin)

```http
PATCH /api/workspaces/current/members/{userId}/role
Content-Type: application/json

{
  "role": "ADMIN"
}
```

### Remover miembro (Admin)

```http
DELETE /api/workspaces/current/members/{userId}
```

### Gestionar permisos granulares (Admin)

```http
PATCH /api/workspaces/current/members/{userId}/permissions
Content-Type: application/json

{
  "can_delete_contacts": true,
  "can_export_data": false,
  "can_manage_invoices": true
}
```

## Contactos

### Listar contactos

```http
GET /api/contacts?type=CUSTOMER&page=1&limit=50&q=Juan
```

**Parámetros opcionales:**

| Param | Tipo | Descripción |
|---|---|---|
| `type` | string | CUSTOMER, VENDOR, LEAD, OTHER |
| `q` | string | Búsqueda por nombre, email o teléfono |
| `tags` | string | Filtrar por etiquetas (separadas por coma) |
| `page` | number | Página (default: 1) |
| `limit` | number | Resultados por página (default: 50, max: 100) |

### Crear contacto

```http
POST /api/contacts
Content-Type: application/json

{
  "name": "Juan Pérez",
  "email": "juan@empresa.com",
  "phone": "+50612345678",
  "type": "CUSTOMER",
  "company": "Empresa S.A.",
  "tags": ["vip", "norte"]
}
```

### Obtener contacto

```http
GET /api/contacts/{id}
```

### Actualizar contacto

```http
PATCH /api/contacts/{id}
Content-Type: application/json

{
  "type": "CUSTOMER",
  "tags": ["vip"]
}
```

### Eliminar contacto

```http
DELETE /api/contacts/{id}
```

Requiere permiso `can_delete_contacts`.

## Conversaciones

### Listar conversaciones

```http
GET /api/conversations?status=OPEN&channel_type=WHATSAPP&page=1
```

**Parámetros opcionales:**

| Param | Descripción |
|---|---|
| `status` | NEW, OPEN, PENDING, RESOLVED, ARCHIVED |
| `channel_type` | EMAIL, WHATSAPP, FORM, API |
| `assigned_user_id` | Filtrar por agente asignado |
| `priority` | LOW, MEDIUM, HIGH, URGENT |
| `contact_id` | Conversaciones de un contacto |

### Crear conversación

```http
POST /api/conversations
Content-Type: application/json

{
  "contact_id": "contact_id",
  "channel_id": "channel_id",
  "subject": "Consulta sobre producto",
  "priority": "MEDIUM"
}
```

### Obtener conversación

```http
GET /api/conversations/{id}
```

### Actualizar conversación

```http
PATCH /api/conversations/{id}
Content-Type: application/json

{
  "status": "PENDING",
  "priority": "HIGH"
}
```

### Asignar a agente

```http
POST /api/conversations/{id}/assign
Content-Type: application/json

{
  "user_id": "user_id"
}
```

### Resolver conversación

```http
POST /api/conversations/{id}/resolve
```

### Enviar mensaje

```http
POST /api/conversations/{id}/messages
Content-Type: application/json

{
  "body": "Hola, ¿en qué le puedo ayudar?",
  "direction": "OUTBOUND"
}
```

Para nota interna: `"direction": "INTERNAL"`

### Obtener mensajes

```http
GET /api/conversations/{id}/messages?page=1&limit=50
```

## Tareas

### Listar tareas

```http
GET /api/tasks?status=TODO&assigned_to=me&priority=HIGH
```

### Crear tarea

```http
POST /api/tasks
Content-Type: application/json

{
  "title": "Llamar a cliente Juan Pérez",
  "assigned_user_id": "user_id",
  "due_date": "2025-02-15T10:00:00Z",
  "priority": "HIGH",
  "contact_id": "contact_id",
  "description": "Seguimiento cotización enviada el lunes"
}
```

### Actualizar tarea

```http
PATCH /api/tasks/{id}
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "priority": "URGENT"
}
```

### Completar tarea

```http
POST /api/tasks/{id}/complete
```

### Tareas vencidas

```http
GET /api/tasks/overdue
```

## Documentos

### Listar documentos

```http
GET /api/documents?contact_id=xxx&page=1
```

### Subir documento

```http
POST /api/documents/upload
Content-Type: multipart/form-data

file: [archivo binario]
contact_id: contact_id (opcional)
conversation_id: conversation_id (opcional)
task_id: task_id (opcional)
```

**Límites:** 25 MB por archivo.

### Obtener documento

```http
GET /api/documents/{id}
```

Retorna metadata y URL temporal de descarga.

### Eliminar documento

```http
DELETE /api/documents/{id}
```

## Automatizaciones

### Listar automatizaciones

```http
GET /api/automations
```

### Crear automatización

```http
POST /api/automations
Content-Type: application/json

{
  "name": "Asignar WhatsApp a Ventas",
  "trigger_type": "MESSAGE_RECEIVED",
  "conditions_json": {
    "operator": "AND",
    "conditions": [
      { "field": "channel_type", "op": "eq", "value": "WHATSAPP" }
    ]
  },
  "actions_json": [
    { "type": "ASSIGN_CONVERSATION", "user_id": "user_id" }
  ]
}
```

### Activar / Desactivar

```http
POST /api/automations/{id}/toggle
```

### Historial de ejecuciones

```http
GET /api/automations/{id}/executions?page=1
```

## Facturación

### Listar facturas

```http
GET /api/invoices?status=SENT&page=1
```

### Crear factura

```http
POST /api/invoices
Content-Type: application/json

{
  "contact_id": "contact_id",
  "due_date": "2025-03-01",
  "issuance_mode": "MANUAL_ONLY",
  "lines": [
    {
      "description": "Consultoría mensual",
      "quantity": 1,
      "unit_price": 500000,
      "tax_rate": 13,
      "tax_name": "IVA"
    }
  ]
}
```

### Enviar recordatorio de cobro

```http
POST /api/invoices/{id}/send-reminder
Content-Type: application/json

{
  "channel": "EMAIL"
}
```

## Insights

### Obtener insights

```http
GET /api/insights?severity=HIGH
```

## Búsqueda global

```http
GET /api/search?q=Juan+Pérez
```

Busca en contactos, conversaciones, tareas y documentos simultáneamente.

## Paginación

Todos los endpoints de listado siguen el mismo patrón:

```http
GET /api/contacts?page=2&limit=25
```

**Respuesta:**
```json
{
  "data": [...],
  "meta": {
    "page": 2,
    "limit": 25,
    "total": 148,
    "total_pages": 6
  }
}
```
