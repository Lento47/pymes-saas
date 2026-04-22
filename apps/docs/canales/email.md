# Canal de Email

El canal de Email te permite recibir y responder emails de clientes directamente desde el Inbox de PymeHub, sin necesidad de abrir tu cliente de correo.

## ¿Cómo funciona?

PymeHub usa **Resend** como proveedor de email. Cuando configuras el canal:

1. PymeHub te asigna una dirección de email de entrada
2. Los emails que llegan a esa dirección crean automáticamente una conversación en el Inbox
3. Respondes desde PymeHub y el email llega al cliente desde tu dominio

El flujo es completamente transparente: el cliente ve tu dirección de email de negocio, no la de PymeHub.

## Configurar el canal de Email

### Prerrequisitos

1. Una cuenta en [Resend](https://resend.com)
2. Un dominio verificado en Resend
3. Clave API de Resend

### Pasos

1. Ve a **Configuración → Canales → "Agregar canal"**
2. Selecciona **Email**
3. Completa los campos:
   - **Nombre del canal** — ej: "Soporte al Cliente"
   - **Email de remitente** — ej: `soporte@tuempresa.com`
   - **Clave API de Resend** — Generada en el panel de Resend
   - **Secret del webhook** — Para validar los eventos de Resend
4. PymeHub configurará automáticamente el webhook de entrada en Resend
5. Haz clic en **"Conectar"** para validar la configuración
6. Si todo está correcto, el canal queda activo ✓

### Configurar el email de entrada en Resend

Para recibir emails entrantes:

1. En el panel de Resend, ve a **"Inbound"**
2. Configura el webhook URL:
   ```
   https://api.pymeshub.lat/inbound/email/webhook
   ```
3. Agrega los headers necesarios:
   ```
   X-Workspace-Id: [tu-workspace-id]
   X-Channel-Id: [tu-channel-id]
   ```
4. Verifica la firma con el Svix secret

::: tip Encontrar tu Workspace ID y Channel ID
Ve a **Configuración → API Keys** para obtener tu Workspace ID. El Channel ID aparece en la URL al abrir la configuración del canal.
:::

## Flujo de un email entrante

```
Cliente envía email
    → Resend recibe el email
    → Resend hace POST al webhook de PymeHub
    → PymeHub valida la firma (Svix HMAC SHA256)
    → PymeHub busca el contacto por email (o lo crea)
    → PymeHub crea o actualiza la conversación
    → Notificación en tiempo real al equipo
    → Se disparan automatizaciones configuradas
```

## Seguridad del webhook

PymeHub valida cada evento de Resend usando **firma Svix** (HMAC SHA256):

- Si la firma no es válida, el evento es rechazado
- Los timestamps previenen ataques de replay
- El secret del webhook debe mantenerse confidencial

## Responder emails desde PymeHub

En la conversación de email:

1. Escribe tu respuesta en el campo de texto
2. Opcionalmente agrega adjuntos (se vinculan como documentos)
3. Haz clic en **"Enviar"**

El cliente recibe el email desde la dirección configurada en el canal (ej: `soporte@tuempresa.com`).

## Adjuntos en emails

Los adjuntos que envían los clientes por email son capturados automáticamente y almacenados en PymeHub como documentos vinculados a la conversación.

Si el adjunto es un PDF o imagen, el OCR se ejecuta automáticamente para extraer el texto.

## Múltiples cuentas de email

Puedes configurar múltiples canales de email, uno para cada propósito:

- `ventas@tuempresa.com` → Canal "Ventas"
- `soporte@tuempresa.com` → Canal "Soporte"
- `facturacion@tuempresa.com` → Canal "Facturación"

Cada canal puede tener sus propias automatizaciones y asignación de departamento.

## Límites por plan

| Plan | Canales de Email |
|---|---|
| Free | Hasta 2 canales totales |
| Starter | Hasta 5 canales totales |
| Growth | Hasta 10 canales totales |
| Enterprise | Ilimitados |

Los canales se comparten entre Email y WhatsApp (no son límites separados).

## Solución de problemas

**No llegan los emails:**
- Verifica que el webhook URL en Resend sea correcto
- Revisa que el Workspace ID y Channel ID en los headers sean los correctos
- Confirma que el dominio esté verificado en Resend

**Los emails llegan pero no se crean conversaciones:**
- Revisa el estado del canal en Configuración (debe estar en ACTIVO)
- Verifica que el secret del webhook sea el mismo en Resend y en PymeHub

**Error de firma inválida:**
- El secret del webhook no coincide entre Resend y PymeHub
- Regenera el secret en Resend y actualiza la configuración del canal
