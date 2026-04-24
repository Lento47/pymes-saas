# Insights con IA

Los **Insights** son el motor de inteligencia de PymeHub. Analizan tus métricas mes a mes y generan alertas accionables en español que te dicen exactamente qué está pasando en tu negocio y qué debes ajustar.

## ¿Qué son los Insights?

Son observaciones automáticas generadas por IA que comparan tu operación del mes actual vs. el mes anterior. A diferencia de un reporte tradicional, los insights son **accionables**: te dicen no solo qué pasó, sino qué hacer al respecto.

Ejemplo de insight:

> ⚠️ **Tiempo de respuesta aumentó 45%**
> El tiempo promedio de primera respuesta pasó de 2h a 2h 54min esta semana. Considera asignar más agentes al inbox en horas pico (10am-12pm y 3pm-5pm).

## Tipos de análisis

Los insights cubren cuatro áreas principales:

### 📥 Conversaciones

- Volumen total (vs. mes anterior)
- Tiempo promedio de resolución
- Conversaciones sin agente asignado
- Tasa de resolución por canal (Email vs. WhatsApp)
- Conversaciones reabiertas

### ✅ Tareas

- Volumen creado y completado
- Tasa de tareas vencidas
- Productividad por agente
- Tiempo promedio de completación

### 📄 Documentos

- Archivos subidos
- Documentos procesados por OCR
- Errores de procesamiento

### 💬 Mensajes

- Volumen entrante y saliente
- Distribución por canal
- Picos de actividad horarios

## Niveles de severidad

Cada insight tiene un nivel de severidad:

| Nivel | Indicador | Qué significa |
|---|---|---|
| **Bajo** | 🔵 Azul | Observación informativa |
| **Medio** | 🟡 Amarillo | Área de mejora identificada |
| **Alto** | 🟠 Naranja | Requiere atención pronto |
| **Crítico** | 🔴 Rojo | Impacto serio en la operación |

Los insights críticos generan notificaciones inmediatas.

## ¿Dónde los veo?

### Dashboard principal

El **widget de Insights** en el dashboard muestra los insights más recientes y más críticos. Haz clic en cualquiera para ver el detalle.

### Sección de Insights

Ve a **Insights** en el menú lateral para ver todos los insights generados, con filtros por severidad y categoría.

## Frecuencia de generación

Los insights se generan **automáticamente cada día** en segundo plano. El proceso:

1. Job programado ejecuta el análisis a las 6:00 AM (zona horaria del workspace)
2. Compara métricas del período actual vs. anterior
3. IA analiza patrones y genera observaciones
4. Los insights nuevos aparecen en el dashboard
5. Si hay insights críticos, se envían notificaciones inmediatas

### Generación manual

Admins y Owners pueden generar insights bajo demanda desde **Insights → "Generar ahora"**. Útil para revisar el estado en cualquier momento del día.

## Resúmenes diarios IA

Complementando los insights, PymeHub genera un **resumen diario en español** de todo lo que ocurrió en el negocio. Se parece a esto:

---

> **Resumen del 15 de enero, 2025**
>
> Ayer fue un día de alto volumen: recibiste 34 mensajes (+18% vs. promedio). El equipo respondió 28 conversaciones con un tiempo promedio de 1h 42min.
>
> Se completaron 8 tareas, pero quedaron 3 vencidas del lunes que aún necesitan atención.
>
> Punto de atención: La conversación con Supermercados La Flora lleva 4 horas sin respuesta y tiene prioridad alta.

---

### Dónde ver los resúmenes

Ve a **Resúmenes** en el menú lateral. Puedes navegar por fecha para ver el historial de resúmenes anteriores.

## Configuración de IA

Los insights y resúmenes usan el proveedor de IA configurado en tu workspace. Puedes elegir entre:

- **OpenAI** (GPT-4o)
- **Anthropic** (Claude)
- **Google Gemini**
- **Moonshot**

Para configurar: **Ajustes → Inteligencia Artificial → Proveedor y clave API**.

Ver [Integraciones → IA](/integraciones/ia) para más detalles.

## Privacidad de los datos

::: warning Importante
Cuando se generan insights y resúmenes, los datos de tus conversaciones (sin información de pago ni secretos) se procesan por el proveedor de IA configurado. Revisa los términos del proveedor que elijas.
:::

Los datos enviados a la IA son:
- Métricas agregadas (conteos, promedios, tendencias)
- Extractos anónimos de mensajes para análisis de patrones
- **Nunca** se envían: contraseñas, claves API, datos de pago o información médica
