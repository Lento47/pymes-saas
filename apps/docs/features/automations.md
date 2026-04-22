# Automatizaciones

Las **Automatizaciones** te permiten crear reglas del tipo `Si [evento] y [condiciones] → entonces [acciones]` para automatizar flujos repetitivos sin escribir código.

## ¿Para qué sirven?

- Asignar conversaciones automáticamente al agente correcto
- Crear tareas de seguimiento al recibir ciertos mensajes
- Enviar respuestas automáticas a nuevos contactos
- Escalar conversaciones que llevan mucho tiempo sin respuesta
- Notificar al equipo cuando pasa algo importante

## Anatomía de una automatización

```
DISPARADOR + CONDICIONES → ACCIONES
```

### 1. Disparador (Trigger)

El evento que activa la regla:

| Disparador | Descripción |
|---|---|
| `MENSAJE_RECIBIDO` | Cuando llega un nuevo mensaje de un cliente |
| `CONVERSACIÓN_CREADA` | Cuando se inicia una nueva conversación |
| `ESTADO_CONVERSACIÓN_CAMBIADO` | Cuando el estado de una conversación cambia |
| `TAREA_VENCIDA` | Cuando una tarea supera su fecha límite |
| `CONTACTO_CREADO` | Cuando se registra un nuevo contacto |
| `PROGRAMADO` | En un horario específico (diario, semanal, etc.) |

### 2. Condiciones (opcionales)

Filtros adicionales para que la regla solo se active cuando se cumplen criterios específicos:

- Canal del mensaje (Email / WhatsApp)
- Prioridad de la conversación
- Rol del agente asignado
- Contenido del mensaje (contiene ciertas palabras)
- Tipo de contacto

Las condiciones se definen en formato JSON, lo que permite combinaciones complejas con operadores `AND` y `OR`.

### 3. Acciones

Lo que ocurre cuando el disparador se activa y las condiciones se cumplen:

| Acción | Descripción |
|---|---|
| **Crear tarea** | Genera una tarea asignada a un agente con deadline |
| **Asignar conversación** | Asigna la conversación a un agente o departamento |
| **Enviar email** | Envía un email al contacto o a un miembro del equipo |
| **Enviar WhatsApp** | Envía un mensaje por WhatsApp |
| **Cambiar estado** | Cambia el estado de la conversación |
| **Cambiar prioridad** | Ajusta la prioridad de la conversación |
| **Agregar etiqueta** | Agrega una etiqueta al contacto |

## Crear una automatización

1. Ve a **Automatizaciones** → **"Nueva automatización"**
2. Ponle un **nombre descriptivo**
3. Selecciona el **disparador**
4. Agrega **condiciones** (opcional)
5. Define las **acciones** a ejecutar
6. Activa la regla con el toggle **"Activa"**
7. Haz clic en **"Guardar"**

## Ejemplos prácticos

### Asignación por canal

```
Disparador: MENSAJE_RECIBIDO
Condición: canal = WhatsApp
Acción: Asignar al departamento "Ventas"
```

### Seguimiento de nuevos leads

```
Disparador: CONTACTO_CREADO
Condición: tipo = Lead
Acción: Crear tarea "Llamar a nuevo lead" [prioridad: Alta] [en: 24 horas]
```

### Auto-respuesta fuera de horario

```
Disparador: MENSAJE_RECIBIDO
Condición: horario = fuera de 8am-6pm
Acción: Enviar email "Gracias por contactarnos. Te respondemos en horario hábil."
```

### Escalación por urgencia

```
Disparador: ESTADO_CONVERSACIÓN_CAMBIADO
Condición: estado_anterior = Abierto AND tiempo_sin_respuesta > 2 horas
Acción: Cambiar prioridad a Urgente + Notificar a Supervisor
```

### Recordatorio de tarea vencida

```
Disparador: TAREA_VENCIDA
Acción: Enviar email al asignado con link a la tarea
```

## Activar y desactivar reglas

Cada automatización tiene un **toggle de activación**. Puedes desactivar una regla temporalmente sin eliminarla, útil para:

- Períodos de vacaciones o feriados
- Pruebas y ajustes
- Reglas estacionales

## Historial de ejecuciones

Cada automatización registra su historial de ejecuciones. Para verlo:

1. Abre la automatización
2. Ve a la pestaña **"Historial"**

Verás cada ejecución con:
- Fecha y hora
- Estado: `EXITOSA`, `FALLIDA` o `OMITIDA`
- Detalles del error (si falló)
- Datos de entrada que activaron la regla

Esto es útil para depurar por qué una regla no está funcionando como se espera.

## Límites por plan

| Plan | Automatizaciones |
|---|---|
| Free | 3 |
| Starter | 10 |
| Growth | Ilimitadas |
| Enterprise | Ilimitadas |

## Buenas prácticas

- **Nombra las reglas claramente**: `Asignar_WhatsApp_a_Ventas` es mejor que `Regla 1`
- **Prueba antes de activar**: Usa el modo de prueba para verificar que la lógica es correcta
- **Revisa el historial**: Si una regla no funciona, el historial de ejecuciones te dice por qué
- **No dupliques reglas**: Tener dos reglas con la misma lógica puede causar acciones duplicadas
- **Documenta las condiciones complejas**: Agrega una descripción en el campo de notas
