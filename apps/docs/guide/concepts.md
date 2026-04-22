# Conceptos clave

Antes de profundizar en cada funcionalidad, es útil entender los conceptos fundamentales de PymeHub.

## Workspace

Un **workspace** es el espacio de trabajo de tu empresa. Todo en PymeHub vive dentro de un workspace: tus contactos, conversaciones, tareas, documentos y configuraciones.

- Cada empresa tiene su propio workspace completamente aislado
- Un usuario puede pertenecer a múltiples workspaces (ej: consultor que trabaja con varias empresas)
- El workspace tiene un **slug** único (ej: `mi-empresa`) que lo identifica
- El plan de suscripción se asigna por workspace

## Roles y permisos

PymeHub usa un sistema de roles con permisos granulares:

### Roles base

| Rol | Nivel de acceso |
|---|---|
| **Owner** | Acceso total. Puede eliminar el workspace. Solo uno por workspace. |
| **Admin** | Gestión completa: miembros, canales, automatizaciones, configuración |
| **Agent** | Operación diaria: conversaciones, contactos, tareas, documentos |
| **Viewer** | Solo lectura en todas las secciones |

### Permisos granulares

Adicionalmente, los Admins pueden otorgar permisos específicos a usuarios individuales:

- `can_delete_contacts` — Eliminar contactos del CRM
- `can_export_data` — Exportar datos del workspace
- `can_send_bulk_email` — Envío masivo de emails
- `can_manage_invoices` — Crear y gestionar facturas
- `can_manage_automations` — Crear y modificar automatizaciones
- `can_view_audit_log` — Ver el registro de auditoría
- `can_manage_billing` — Gestionar suscripción y pagos
- `can_manage_integrations` — Configurar integraciones externas

## Contactos

Un **contacto** es cualquier persona u organización con la que interactúas. Pueden ser de 4 tipos:

- **Cliente** (`CUSTOMER`): Quien compra tus productos/servicios
- **Proveedor** (`VENDOR`): Quien te vende a ti
- **Lead** (`LEAD`): Prospecto en proceso de conversión
- **Otro** (`OTHER`): Cualquier otra relación

Cada contacto tiene un historial completo: todas sus conversaciones, tareas asociadas y documentos vinculados.

## Canales

Un **canal** es el medio a través del cual recibes (o envías) mensajes de tus clientes.

| Tipo | Descripción |
|---|---|
| **Email** | Emails entrantes y salientes vía Resend |
| **WhatsApp** | Mensajes vía Meta Cloud API |
| **Formulario** | Formulario web embebible en tu sitio |
| **API** | Integración directa vía API REST |

Cada canal tiene su propio estado de conexión y configuración.

## Conversaciones

Una **conversación** es un hilo de mensajes entre tu equipo y un contacto, en un canal específico.

### Estados de conversación

```
NUEVO → ABIERTO → PENDIENTE → RESUELTO → ARCHIVADO
```

- **Nuevo**: Mensaje entrante sin atender
- **Abierto**: En proceso, asignado a un agente
- **Pendiente**: Esperando respuesta del cliente
- **Resuelto**: Caso cerrado satisfactoriamente
- **Archivado**: Guardado para referencia

### Prioridades

Cada conversación tiene una prioridad: **Baja**, **Media**, **Alta** o **Urgente**. Las conversaciones urgentes aparecen destacadas en el inbox.

## Mensajes

Dentro de cada conversación hay mensajes que pueden ser:

- **Entrante** (`INBOUND`): Enviado por el cliente
- **Saliente** (`OUTBOUND`): Enviado por tu equipo
- **Interno** (`INTERNAL`): Nota interna, solo visible para el equipo

## Automatizaciones

Las **automatizaciones** son reglas del tipo `Si [evento] y [condiciones] → entonces [acciones]`.

### Disparadores (triggers)

| Trigger | Cuándo se activa |
|---|---|
| `MESSAGE_RECEIVED` | Al recibir un mensaje nuevo |
| `CONVERSATION_CREATED` | Al crear una nueva conversación |
| `CONVERSATION_STATUS_CHANGED` | Al cambiar el estado de una conversación |
| `TASK_OVERDUE` | Cuando una tarea vence |
| `CONTACT_CREATED` | Al crear un nuevo contacto |
| `SCHEDULED` | En un horario programado |

### Acciones posibles

- Crear una tarea automáticamente
- Asignar la conversación a un agente
- Enviar un email o WhatsApp
- Cambiar el estado o prioridad
- Agregar etiqueta al contacto

## Insights

Los **insights** son alertas y recomendaciones generadas automáticamente por IA. PymeHub analiza tus métricas mes a mes y genera observaciones accionables como:

- "El tiempo de resolución de conversaciones aumentó 40% este mes"
- "Tienes 12 tareas vencidas sin atender"
- "Las conversaciones de email tienen mayor tasa de resolución que WhatsApp"

Los insights tienen niveles de severidad: **Bajo**, **Medio**, **Alto** y **Crítico**.

## Planes

Cada workspace tiene un **plan de suscripción** que define los límites de uso:

| Plan | Usuarios | Almacenamiento | Canales | Automatizaciones |
|---|---|---|---|---|
| Free | 3 | 100 MB | 2 | 3 |
| Starter | 10 | 5 GB | 5 | 10 |
| Growth | 25 | 50 GB | 10 | Ilimitadas |
| Enterprise | Ilimitado | Ilimitado | Ilimitado | Ilimitadas |

PymeHub verifica los límites en tiempo real antes de crear nuevos recursos.
