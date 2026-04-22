# Gestión de Tareas

PymeHub incluye un gestor de tareas integrado que se conecta directamente con tus conversaciones, contactos y documentos — sin necesidad de otra herramienta.

## ¿Para qué sirve?

- Crear y asignar tareas a miembros del equipo
- Establecer fechas límite con alertas automáticas
- Vincular tareas a contactos o conversaciones
- Detectar tareas vencidas y recibir alertas en el dashboard
- Automatizar la creación de tareas basada en eventos

## Estados de una tarea

```
POR HACER → EN PROGRESO → BLOQUEADA → COMPLETADA
                                    ↘ ARCHIVADA
```

| Estado | Descripción |
|---|---|
| **Por hacer** | Tarea creada, aún no iniciada |
| **En progreso** | Alguien está trabajando en ella |
| **Bloqueada** | Detenida por dependencia externa |
| **Completada** | Finalizada exitosamente |
| **Archivada** | Guardada para referencia sin estar activa |

## Prioridades

Las tareas tienen cuatro niveles de prioridad:

| Prioridad | Indicador | Uso recomendado |
|---|---|---|
| **Urgente** | 🔴 Rojo | Requiere atención inmediata |
| **Alta** | 🟠 Naranja | Debe resolverse hoy o mañana |
| **Media** | 🟡 Amarillo | Esta semana |
| **Baja** | ⚪ Gris | Cuando haya tiempo |

## Crear una tarea

Ve a **Tareas** → **"Nueva tarea"**:

1. **Título** — Descripción clara y accionable
2. **Asignado a** — Selecciona el miembro responsable
3. **Fecha límite** — Cuándo debe estar completada
4. **Prioridad** — Urgente / Alta / Media / Baja
5. **Contacto** — Vincula a un cliente, proveedor o lead (opcional)
6. **Conversación** — Vincula a un hilo de mensajes (opcional)
7. **Descripción** — Contexto adicional o instrucciones

## Origen de las tareas

Las tareas pueden crearse de diferentes formas:

| Origen | Descripción |
|---|---|
| **Manual** | Creada directamente por un usuario |
| **Automatización** | Creada por una regla automática |
| **Mensaje** | Sugerida por IA al analizar un mensaje |
| **Documento** | Generada al procesar un documento con OCR |
| **Resumen IA** | Propuesta en el resumen diario |

## Tareas vencidas

PymeHub monitorea constantemente las fechas límite. Cuando una tarea vence:

1. Se marca visualmente como **vencida** en la lista
2. Aparece en el widget de **"Tareas vencidas"** del dashboard
3. El agente asignado recibe una **notificación**
4. Se registra en los **insights** si el volumen de vencidas es alto

Para ver todas las tareas vencidas: **Tareas → "Vencidas"**.

## Completar una tarea

Haz clic en el ícono de check (✓) junto a la tarea, o abre la tarea y selecciona **"Marcar como completada"**.

Al completarla:
- Se registra la fecha de finalización
- Se notifica al creador de la tarea
- Se actualiza el historial del contacto vinculado

## Vista de tareas

El listado de tareas soporta:

### Filtros
- **Por estado**: Por hacer, En progreso, Bloqueada, Completada
- **Por prioridad**: Urgente, Alta, Media, Baja
- **Por asignado**: Mis tareas / Tareas del equipo
- **Por vencimiento**: Vencidas, Vence hoy, Esta semana

### Ordenamiento
- Por fecha límite (más próxima primero)
- Por prioridad
- Por fecha de creación

## Tareas en el perfil de contacto

Desde el perfil de cualquier contacto puedes ver todas sus tareas asociadas y crear nuevas directamente. Esto permite dar seguimiento completo a lo prometido a cada cliente.

## Automatizar la creación de tareas

Puedes crear reglas para generar tareas automáticamente. Ejemplos:

```
Si [conversación creada] y [canal = WhatsApp]
→ Crear tarea "Hacer seguimiento por WhatsApp" [asignada a: equipo ventas] [en: 2 días]
```

```
Si [mensaje recibido] y [contiene "cotización"]
→ Crear tarea "Preparar cotización" [prioridad: Alta]
```

Consulta [Automatizaciones →](/features/automations) para más detalles.
