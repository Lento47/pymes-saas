# Inteligencia Artificial

PymeHub usa IA en múltiples funcionalidades para automatizar análisis, generar resúmenes y mejorar la productividad de tu equipo. Puedes elegir qué proveedor de IA usar y configurar tu propia clave API.

## ¿Dónde usa PymeHub la IA?

| Funcionalidad | Cómo usa la IA |
|---|---|
| **Insights automáticos** | Analiza métricas y genera alertas accionables en español |
| **Resúmenes diarios** | Resume en lenguaje natural lo que pasó en el negocio |
| **Borradores de recordatorios** | Genera el texto de recordatorios de cobro |
| **Sugerencia de tareas** | Analiza mensajes y sugiere tareas de seguimiento |

## Proveedores soportados

PymeHub soporta cuatro proveedores de IA:

| Proveedor | Modelos principales | Mejor para |
|---|---|---|
| **OpenAI** | GPT-4o, GPT-4o-mini | Calidad y velocidad balanceada |
| **Anthropic (Claude)** | Claude Haiku, Sonnet | Instrucciones complejas, análisis detallado |
| **Google Gemini** | Gemini 2.0 Flash | Velocidad y costo |
| **Moonshot** | Moonshot v1 | Alternativa para mercados específicos |

## Configurar tu proveedor de IA

Ve a **Configuración → Inteligencia Artificial**:

1. Selecciona el **proveedor** que prefieres
2. Ingresa tu **clave API**
3. Opcionalmente, selecciona el **modelo** específico
4. Haz clic en **"Guardar y probar"**

PymeHub enviará un mensaje de prueba para verificar que la clave funciona correctamente.

### Cómo obtener claves API

**OpenAI:**
1. Crea cuenta en [platform.openai.com](https://platform.openai.com)
2. Ve a API Keys → Create new secret key
3. Copia la clave (no se vuelve a mostrar)

**Anthropic:**
1. Crea cuenta en [console.anthropic.com](https://console.anthropic.com)
2. Ve a API Keys → Create Key
3. Copia la clave

**Google Gemini:**
1. Accede a [aistudio.google.com](https://aistudio.google.com)
2. Get API key → Create API key
3. Copia la clave

## Modelo por defecto

Si no configuras un modelo específico, PymeHub usa:

| Proveedor | Modelo por defecto |
|---|---|
| OpenAI | `gpt-4o-mini` |
| Anthropic | `claude-haiku-4-5-20251001` |
| Gemini | `gemini-2.0-flash` |
| Moonshot | `moonshot-v1-8k` |

Los modelos por defecto están seleccionados para balancear calidad y costo. Si requieres análisis más detallados, considera cambiar a modelos más avanzados (ej: `gpt-4o` o `claude-sonnet-4-6`).

## Seguridad de las claves API

Tu clave API **nunca se almacena en texto plano**. PymeHub la encripta con `AES-256` antes de guardarla en la base de datos. Solo se desencripta en el momento de hacer la llamada a la IA.

::: tip Clave propia vs. clave de PymeHub
Si no configuras una clave API, PymeHub puede usar su propia clave con límites de uso. Para producción, recomendamos usar tu propia clave para tener control total del uso y el costo.
:::

## ¿Qué datos se envían a la IA?

Para mantener tu privacidad, PymeHub es selectivo con los datos que comparte:

### Se envía:
- Métricas agregadas (conteos, promedios, porcentajes)
- Extractos anónimos de mensajes (sin nombres completos ni datos de pago)
- Resumen de estados de tareas y conversaciones

### Nunca se envía:
- Contraseñas ni tokens de acceso
- Datos completos de tarjetas de crédito
- Claves API de integraciones
- Documentos completos (solo el texto extraído si es relevante)
- Información médica o sensible identificada

::: warning Términos del proveedor de IA
Al configurar tu proveedor de IA, aceptas sus términos de servicio. Cada proveedor tiene políticas diferentes sobre retención y uso de datos. Revisa los términos de tu proveedor elegido.
:::

## Frecuencia y costo estimado

Los insights y resúmenes se generan **una vez al día** por workspace. El costo estimado por día con los modelos por defecto:

| Proveedor | Costo estimado por día |
|---|---|
| OpenAI (gpt-4o-mini) | ~$0.01 USD |
| Anthropic (claude-haiku) | ~$0.01 USD |
| Gemini (2.0 Flash) | Gratis en tier gratuito |

Estos son valores estimados y pueden variar según el volumen de datos de tu workspace.

## Generación bajo demanda

Además de la generación automática diaria, puedes generar insights y resúmenes en cualquier momento desde:

- **Insights → "Generar ahora"**
- **Resúmenes → "Generar resumen de hoy"**

Cada generación manual consume tokens de tu clave API.

## Desactivar la IA

Si prefieres no usar IA, simplemente no configures ninguna clave API. Las secciones de Insights y Resúmenes no estarán disponibles, pero el resto de la plataforma funciona con normalidad.
