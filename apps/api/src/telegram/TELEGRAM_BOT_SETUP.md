# Configuración del Bot de Telegram para PyMesHub

## Requisitos previos

1. Una cuenta de Telegram
2. Un bot creado en Telegram (si no tienes uno, ver sección "Crear un bot")
3. El API token del bot

## Crear un Bot de Telegram

1. Abre Telegram y busca `@BotFather`
2. Usa el comando `/newbot`
3. Sigue las instrucciones:
   - Ingresa el nombre del bot (ej: "PyMesHub Bot")
   - Ingresa un username único que termine en `_bot` (ej: `pymeshub_bot`)
4. BotFather te dará un **API Token** similar a:
   ```
   123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   ```

## Configuración en PyMesHub

### 1. Crear un canal de Telegram

```bash
POST /channels
{
  "type": "TELEGRAM",
  "name": "Mi Bot de Telegram",
  "provider": "telegram"
}
```

**Respuesta:**
```json
{
  "id": "uuid-del-canal",
  "type": "TELEGRAM",
  "name": "Mi Bot de Telegram",
  "status": "PENDING_SETUP",
  "config": {}
}
```

### 2. Configurar el token del bot

```bash
POST /channels/{channelId}/configure-telegram
{
  "bot_token": "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
}
```

El webhook se registrará automáticamente.

### 3. Verificar el estado del webhook

```bash
GET /inbound/telegram/{channelId}/webhook-status
```

**Respuesta esperada:**
```json
{
  "url": "https://api.pymeshub.lat/api/inbound/telegram/webhook/{channelId}",
  "has_custom_certificate": false,
  "pending_update_count": 0,
  "ip_address": "123.45.67.89",
  "last_error_date": null,
  "last_error_message": null,
  "last_synchronization_error_date": null,
  "max_connections": 40,
  "allowed_updates": []
}
```

## Configuración Manual del Webhook

Si el webhook no se registró automáticamente, puedes registrarlo manualmente:

```bash
POST /inbound/telegram/{channelId}/register-webhook
```

## Flujo de Mensajes

### Recibir mensajes

1. El usuario envía un mensaje al bot en Telegram
2. Telegram envía el update al webhook configurado
3. El webhook procesa el mensaje y lo crea como conversación en PyMesHub
4. El mensaje aparece en el módulo de conversaciones

**Tipos de mensajes soportados:**
- Texto
- Fotos
- Documentos
- Videos
- Audios

### Enviar mensajes

Los mensajes se envían automáticamente al usar la funcionalidad de respuesta en PyMesHub.

## Resolución de Problemas

### El webhook no se registra

1. Verifica que `APP_URL` esté configurado correctamente en `.env`
2. Verifica que el token sea válido
3. Comprueba que el servidor esté accesible desde internet
4. Revisa los logs de la aplicación

### No llegan mensajes

1. Verifica el estado del webhook con `GET /inbound/telegram/{channelId}/webhook-status`
2. Prueba enviando un mensaje al bot
3. Revisa los logs para errores de procesamiento

### El bot no responde

1. Verifica que el canal esté en estado `ACTIVE`
2. Verifica que la configuración del bot sea correcta
3. Revisa que las respuestas se envíen desde el módulo de conversaciones

## Variables de Entorno

En `.env` o `.env.production`:

```env
# URL base de la aplicación (necesaria para webhooks)
APP_URL=https://api.pymeshub.lat

# El token del bot se configura por canal en la UI, no en variables de entorno
```

## API Endpoints

### Crear canal Telegram
- **POST** `/channels`
- Body: `{ "type": "TELEGRAM", "name": "..." }`

### Configurar bot
- **POST** `/channels/{id}/configure-telegram`
- Body: `{ "bot_token": "..." }`

### Registrar webhook manualmente
- **POST** `/inbound/telegram/{channelId}/register-webhook`

### Ver estado del webhook
- **GET** `/inbound/telegram/{channelId}/webhook-status`

### Webhook de entrada (automático)
- **POST** `/inbound/telegram/webhook/{channelId}`
- Esta ruta es llamada por Telegram automáticamente

## Seguridad

- Los tokens se encriptan en la base de datos
- Los webhooks solo aceptan requests de Telegram
- Cada canal tiene su propio webhook URL único
