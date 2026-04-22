# Webhooks

PymeHub puede recibir webhooks de servicios externos para procesar eventos en tiempo real. Actualmente soporta webhooks de **Resend** (email entrante) y **Meta Cloud API** (WhatsApp).

## Webhook de Email (Resend)

Recibe emails entrantes de clientes y los convierte en conversaciones.

### URL del webhook

```
POST https://api.pymeshub.lat/inbound/email/webhook
```

### Headers requeridos

| Header | Descripción |
|---|---|
| `svix-id` | ID único del evento Resend |
| `svix-timestamp` | Timestamp del evento |
| `svix-signature` | Firma HMAC SHA256 para validación |
| `X-Workspace-Id` | ID de tu workspace en PymeHub |
| `X-Channel-Id` | ID del canal de email configurado |

### Validación de firma

PymeHub valida cada webhook usando la firma Svix:

```
message = svix-id + "." + svix-timestamp + "." + body_raw
signature = HMAC-SHA256(webhook_secret, message)
```

Si la firma no coincide, el webhook es rechazado con `401 Unauthorized`.

### Payload de ejemplo

```json
{
  "type": "email.inbound",
  "data": {
    "from": "cliente@suempresa.com",
    "to": "soporte@tuempresa.com",
    "subject": "Consulta sobre factura #123",
    "text": "Buenos días, tengo una pregunta sobre...",
    "html": "<p>Buenos días, tengo una pregunta sobre...</p>",
    "attachments": [
      {
        "filename": "factura.pdf",
        "content_type": "application/pdf",
        "size": 204800
      }
    ]
  }
}
```

### Lo que hace PymeHub al recibir el email

1. Valida la firma Svix
2. Busca el workspace por `X-Workspace-Id`
3. Verifica que el canal (`X-Channel-Id`) esté activo
4. Busca el contacto por email del remitente (o lo crea)
5. Busca conversación abierta con ese contacto (o crea una nueva)
6. Crea el mensaje como `INBOUND`
7. Procesa adjuntos y los vincula como documentos
8. Envía notificación en tiempo real al equipo
9. Dispara automatizaciones configuradas

---

## Webhook de WhatsApp (Meta Cloud API)

Recibe mensajes de WhatsApp y los convierte en conversaciones.

### URL del webhook

```
POST https://api.pymeshub.lat/whatsapp/webhook
```

### Verificación del webhook (GET)

Meta verifica el webhook con una solicitud GET:

```
GET https://api.pymeshub.lat/whatsapp/webhook
  ?hub.mode=subscribe
  &hub.verify_token=tu-token-secreto
  &hub.challenge=12345
```

PymeHub responde con `hub.challenge` si el `hub.verify_token` coincide con el configurado.

### Eventos soportados

| Evento | Descripción |
|---|---|
| `messages` | Mensaje recibido de un usuario |
| `message_deliveries` | Confirmación de entrega |
| `message_reads` | Confirmación de lectura |

### Payload de ejemplo (mensaje de texto)

```json
{
  "object": "whatsapp_business_account",
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "50612345678",
              "phone_number_id": "PHONE_NUMBER_ID"
            },
            "contacts": [
              {
                "profile": { "name": "Juan Pérez" },
                "wa_id": "50687654321"
              }
            ],
            "messages": [
              {
                "from": "50687654321",
                "id": "wamid.xxx",
                "timestamp": "1700000000",
                "type": "text",
                "text": { "body": "Hola, me interesa saber más sobre sus servicios" }
              }
            ]
          },
          "field": "messages"
        }
      ]
    }
  ]
}
```

### Tipos de mensaje soportados

| Tipo | Descripción |
|---|---|
| `text` | Mensaje de texto simple |
| `image` | Imagen (se guarda como documento) |
| `document` | Archivo PDF u otro documento |
| `audio` | Mensaje de voz |
| `sticker` | Sticker (se registra pero sin preview) |

---

## Errores comunes en webhooks

| Error | Causa | Solución |
|---|---|---|
| `401 Unauthorized` | Firma inválida o token incorrecto | Verifica que el secret/token coincida |
| `404 Not Found` | Workspace o canal no encontrado | Revisa los headers `X-Workspace-Id` y `X-Channel-Id` |
| `422 Unprocessable Entity` | Payload inválido o faltante | Revisa el formato del body enviado |
| `503 Service Unavailable` | PymeHub temporalmente no disponible | Reintenta con backoff exponencial |

## Reintentos y idempotencia

PymeHub es idempotente para webhooks: si recibes el mismo evento dos veces (ej: Meta reintenta por timeout), PymeHub no crea conversaciones o mensajes duplicados.

Para email, la idempotencia se basa en el ID del mensaje de Resend.
Para WhatsApp, la idempotencia se basa en el `wamid` del mensaje de Meta.
