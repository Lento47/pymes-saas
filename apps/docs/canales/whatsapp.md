# Canal de WhatsApp

El canal de WhatsApp conecta PymeHub con la **Meta Cloud API** para recibir y responder mensajes de WhatsApp directamente desde el Inbox, sin usar WhatsApp Web ni el celular.

## ¿Cómo funciona?

PymeHub se conecta a tu **número de negocio de WhatsApp** vía Meta Cloud API. Cuando un cliente escribe al número:

1. Meta envía el mensaje al webhook de PymeHub
2. PymeHub crea una conversación en el Inbox
3. Tu equipo responde desde PymeHub
4. El cliente recibe la respuesta en su WhatsApp normal

## Prerrequisitos

Antes de configurar el canal necesitas:

1. **Cuenta de Meta for Business** verificada
2. **WhatsApp Business Account** aprobada
3. **Número de teléfono** registrado en Meta (puede ser un número nuevo o uno existente)
4. **Token de acceso** generado en el panel de Meta Developers
5. **App de Meta** creada con el producto "WhatsApp" habilitado

::: warning Cuenta Business de Meta
Para usar la API de WhatsApp de Meta, tu cuenta debe ser aprobada por Meta. El proceso puede tomar desde horas hasta días dependiendo de tu caso.
:::

## Configurar el canal en PymeHub

1. Ve a **Configuración → Canales → "Agregar canal"**
2. Selecciona **WhatsApp**
3. Completa los campos:
   - **Nombre del canal** — ej: "WhatsApp Ventas"
   - **Token de acceso** — Generado en Meta Developers
   - **Número de teléfono ID** — ID del número en Meta (no el número en sí)
   - **Token de verificación del webhook** — Una cadena secreta que tú defines
4. Haz clic en **"Guardar"**

## Configurar el webhook en Meta

En el panel de Meta Developers:

1. Ve a tu App → **WhatsApp → Configuración**
2. En la sección **"Webhooks"**, haz clic en **"Editar"**
3. Ingresa:
   - **URL del webhook:**
     ```
     https://api.pymeshub.lat/whatsapp/webhook
     ```
   - **Token de verificación:** El mismo que pusiste en PymeHub
4. Suscríbete a los eventos:
   - `messages` ✓
   - `message_deliveries` ✓
   - `message_reads` ✓
5. Haz clic en **"Verificar y guardar"**

Meta hará una solicitud GET al webhook de PymeHub para verificar que el token es correcto. Si todo está bien, el webhook queda configurado.

## Flujo de un mensaje entrante

```
Cliente escribe en WhatsApp
    → Meta Cloud API recibe el mensaje
    → Meta hace POST al webhook de PymeHub
    → PymeHub valida el token del webhook
    → PymeHub busca el contacto por número de teléfono (o lo crea)
    → PymeHub crea o actualiza la conversación
    → Notificación en tiempo real al equipo
    → Se disparan automatizaciones configuradas
```

## Responder mensajes de WhatsApp

En la conversación de WhatsApp:

1. Escribe tu respuesta en el campo de texto
2. Haz clic en **"Enviar"**

PymeHub enviará el mensaje vía la API de Meta y el cliente lo recibirá en WhatsApp.

::: info Ventana de 24 horas
La API de WhatsApp de Meta solo permite responder mensajes dentro de una ventana de **24 horas** desde el último mensaje del cliente. Si la ventana expiró, deberás usar una **plantilla de mensaje** aprobada por Meta.
:::

## Plantillas de mensajes

Para enviar mensajes fuera de la ventana de 24 horas o iniciar conversaciones, se requieren **plantillas** aprobadas por Meta.

Actualmente, PymeHub usa las plantillas para:
- Recordatorios de facturas enviados por WhatsApp
- Mensajes de automatización hacia el cliente

Para crear plantillas, hazlo directamente en el **Panel de Meta Business**.

## Tipos de mensajes soportados

| Tipo | Descripción |
|---|---|
| Texto | Mensajes de texto plano |
| Imagen | Imágenes JPEG/PNG (se almacenan como documentos en PymeHub) |
| Documento | PDFs y otros archivos |
| Audio | Mensajes de voz |

Los adjuntos recibidos por WhatsApp se vinculan automáticamente a la conversación como documentos.

## Múltiples números de WhatsApp

Puedes conectar múltiples números si tienes diferentes equipos o líneas de negocio:

- **+506 8888-0001** → Canal "Ventas"
- **+506 8888-0002** → Canal "Soporte Técnico"

Cada canal tiene su propia configuración y automatizaciones.

## Solución de problemas

**El webhook no se verificó:**
- El token de verificación en Meta y en PymeHub deben ser idénticos
- Verifica que la URL del webhook sea accesible desde internet

**Los mensajes no llegan:**
- Confirma que la suscripción a eventos `messages` esté activa en Meta
- Revisa que el número de teléfono esté activo en Meta Developers
- El canal en PymeHub debe estar en estado **ACTIVO**

**Error al enviar respuesta:**
- Verifica que el token de acceso no haya expirado (los tokens permanentes no expiran, los temporales sí)
- Si el error es de "plantilla requerida", la ventana de 24 horas expiró

**¿No ves los mensajes llegando?**
- Revisa los logs de webhooks en el panel de Meta Developers para ver si Meta está enviando los eventos correctamente
