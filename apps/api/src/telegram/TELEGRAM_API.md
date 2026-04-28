# Telegram Bot Integration — API Reference

## Overview

PyMesHub integrates with Telegram Bot API to receive and send messages. The bot automatically processes incoming messages and creates conversations in the platform.

## Architecture

```
User sends message to Telegram bot
         ↓
   Telegram Servers
         ↓
webhook: POST /api/inbound/telegram/webhook/{channelId}
         ↓
TelegramService.processUpdate()
         ↓
MessagesService.receiveInbound()
         ↓
Conversation created in PyMesHub
```

## Endpoints

### 1. Webhook Receiver (Public)

**Endpoint:** `POST /api/inbound/telegram/webhook/{channelId}`

Called by Telegram servers when messages arrive. Should return 200 OK immediately.

**No Authentication Required** (Telegram doesn't support custom headers)

**Request Body:**
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 987654321,
      "is_bot": false,
      "first_name": "John",
      "last_name": "Doe",
      "username": "johndoe",
      "language_code": "es"
    },
    "chat": {
      "id": 987654321,
      "first_name": "John",
      "last_name": "Doe",
      "username": "johndoe",
      "type": "private"
    },
    "date": 1234567890,
    "text": "Hello, bot!"
  }
}
```

**Response (200 OK):**
```json
{
  "ok": true
}
```

**Status Codes:**
- `200 OK` - Update processed (or queued async)
- Errors are logged, not returned (Telegram expects 200)

**Supported Message Types:**
- `text` - Plain text messages
- `caption` - Text from photos/videos
- `photo` - Images (largest resolution)
- `document` - Files, PDFs, etc.
- `video` - Videos
- `audio` - Audio files
- `voice` - Voice messages

---

### 2. Register/Update Webhook

**Endpoint:** `POST /api/inbound/telegram/:channelId/register-webhook`

Register or update the webhook for a Telegram channel. Called automatically when configuring bot token, but can be called manually if needed.

**Authentication:** JWT (Admin role required)

**Response (200 OK):**
```json
{
  "ok": true,
  "message": "✓ Webhook de Telegram registrado exitosamente",
  "channelId": "uuid-of-channel",
  "timestamp": "2026-04-28T12:34:56.789Z"
}
```

**Error Response (400 Bad Request):**
```json
{
  "message": "Invalid or expired Telegram bot token",
  "statusCode": 400
}
```

**Errors:**
- `400` - Invalid token, missing config, or registration failed
- `404` - Channel not found
- `403` - Unauthorized (not admin)

---

### 3. Get Webhook Status

**Endpoint:** `GET /api/inbound/telegram/:channelId/webhook-status`

Get detailed webhook status and debug info.

**Authentication:** JWT (Admin role required)

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "url": "https://api.pymeshub.lat/api/inbound/telegram/webhook/uuid",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "ip_address": "192.0.2.1",
    "last_error_date": null,
    "last_error_message": null,
    "max_connections": 40,
    "allowed_updates": ["message", "edited_message", "callback_query"]
  }
}
```

**Error Response (200 OK with error flag):**
```json
{
  "ok": false,
  "error": "No se pudo obtener el estado del webhook",
  "possible_causes": [
    "Token inválido o expirado",
    "Canal no configurado",
    "Webhook no registrado aún"
  ]
}
```

**Useful for debugging:**
- Check if webhook is registered
- See pending updates
- Check for errors (last_error_message)
- Verify allowed_updates

---

### 4. Get Bot Information

**Endpoint:** `GET /api/inbound/telegram/:channelId/bot-info`

Get bot details like name, username, and capabilities.

**Authentication:** JWT (Admin role required)

**Response (200 OK):**
```json
{
  "ok": true,
  "data": {
    "id": 123456789,
    "is_bot": true,
    "first_name": "PyMesHub Bot",
    "username": "pymeshub_bot",
    "can_join_groups": true,
    "can_read_all_group_messages": false,
    "supports_inline_queries": false
  }
}
```

**Error Response (200 OK with error flag):**
```json
{
  "ok": false,
  "error": "No se pudo obtener la información del bot"
}
```

---

### 5. Send Test Message

**Endpoint:** `POST /api/inbound/telegram/:channelId/send-test-message`

Send a test message to verify the bot is working.

**Authentication:** JWT (Admin role required)

**Request Body:**
```json
{
  "chatId": "123456789",
  "message": "✓ Webhook de Telegram funciona correctamente"  // optional
}
```

**Response (200 OK):**
```json
{
  "ok": true,
  "message": "Mensaje de prueba enviado",
  "channelId": "uuid-of-channel",
  "chatId": "123456789"
}
```

**Error Response:**
```json
{
  "message": "Failed to send message: Invalid chat ID",
  "statusCode": 400
}
```

---

## Message Processing Flow

### Incoming Message

```
1. Telegram sends update to webhook
2. TelegramController receives update
3. Returns 200 OK immediately
4. Async processing:
   - TelegramService.processUpdate()
   - Extract message data (sender, text, attachments)
   - Call MessagesService.receiveInbound()
   - Conversation is created/updated
   - Message is stored
```

### Message Data Extracted

```typescript
{
  body_text: "Message text",
  sender_name: "John Doe",
  sender_ref: "tg:987654321",  // Telegram user ID
  external_id: "1",             // Telegram message ID
  conversation_ref: "tg:987654321",  // Telegram chat ID
  raw_payload: {...},           // Full Telegram update
  attachments: [                // Only if media present
    {
      type: "photo|document|video|audio|voice",
      file_id: "...",
      // type-specific fields...
    }
  ],
  metadata: {                   // Telegram-specific info
    telegram_user_id: 987654321,
    telegram_chat_id: 987654321,
    telegram_chat_type: "private",
    is_edited: false
  }
}
```

---

## Webhook Security

### No Authentication Header
Telegram API doesn't support custom headers. Security relies on:
1. **URL Token** - Webhook URL includes channelId (random UUID)
2. **HTTPS Only** - Telegram requires HTTPS
3. **Update Validation** - Verify update comes from Telegram

### Validation (Recommended)
```typescript
// Verify update signature (if implemented)
const hash = crypto
  .createHmac('sha256', bot_token)
  .update(JSON.stringify(update))
  .digest('hex');
```

---

## Error Handling

### Token Issues
- **Invalid Format**: Token must be `123456:ABC-DEF...` format
- **Expired**: Bot may be deleted or deactivated
- **Permission Error**: Bot may not have required permissions

### Webhook Issues
- **Already Set**: Telegram allows 1 webhook per bot
- **URL Not Accessible**: Telegram can't reach webhook
- **Invalid URL**: Must be HTTPS, valid domain
- **Timeout**: Response must be < 30 seconds

### Chat Issues
- **Invalid Chat ID**: Chat doesn't exist or bot not in chat
- **No Permission**: Bot can't send messages in chat
- **User Blocked**: User blocked the bot

---

## Configuration

### Environment Variables

```env
# Base URL for webhook URLs
APP_URL=https://api.pymeshub.lat

# Bot token is configured per-channel (stored encrypted)
# Not stored as env var for security
```

### Per-Channel Configuration

```json
{
  "bot_token_encrypted": "encrypted_token_here",
  // Can add more settings later:
  // "allowed_chat_types": ["private"],
  // "auto_respond": true,
  // "response_template": "..."
}
```

---

## Rate Limiting

Telegram limits:
- **Messages**: 30 per second per chat
- **Webhook**: 100 connections concurrent
- **API Calls**: ~30 per second per token

PyMesHub will:
- Queue excess messages in BullMQ
- Retry failed sends with exponential backoff
- Log rate limit errors

---

## Monitoring & Debugging

### Check Webhook Status
```bash
curl -X GET \
  https://api.pymeshub.lat/api/inbound/telegram/channel-uuid/webhook-status \
  -H "Authorization: Bearer JWT_TOKEN"
```

### Get Bot Info
```bash
curl -X GET \
  https://api.pymeshub.lat/api/inbound/telegram/channel-uuid/bot-info \
  -H "Authorization: Bearer JWT_TOKEN"
```

### Send Test Message
```bash
curl -X POST \
  https://api.pymeshub.lat/api/inbound/telegram/channel-uuid/send-test-message \
  -H "Authorization: Bearer JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "987654321",
    "message": "Test message"
  }'
```

### View Logs
```bash
docker logs pymes-api | grep -i telegram
```

---

## Troubleshooting

### "Webhook not registered"
- Check `webhook-status` endpoint
- Verify APP_URL is correct and accessible from internet
- Bot token may be invalid - try registering again

### "No messages arriving"
- Check webhook status (pending_update_count)
- Verify bot token is correct
- Ensure webhook is HTTPS
- Check last_error_message in webhook status

### "Can't send messages"
- Verify bot has permission to send messages
- Check chat_id format (should be number)
- Ensure bot was added to chat (for groups)

### "Token invalid"
- Verify token format: `123456:ABC-DEF...`
- Check bot still exists in @BotFather
- Bot may have been deleted
- Try creating new bot with @BotFather

---

## Examples

### Sending a Reply

```typescript
// In messagesService or conversation handler
await this.telegramService.sendMessage(
  channelId,
  conversationRef.replace('tg:', ''),  // Chat ID
  'Response message'
);
```

### Checking Connection

```typescript
const status = await this.telegramService.getWebhookStatus(channelId);
if (status?.pending_update_count > 0) {
  console.log(`${status.pending_update_count} updates waiting`);
}
```

---

## Performance Considerations

- **Async Processing**: Updates return 200 OK immediately
- **Message Queuing**: Outgoing messages queued in BullMQ
- **Webhook Cache**: Recent webhooks cached for quick access
- **Bot Instance Pooling**: Reuse Telegraf instances

---

## Future Enhancements

- [ ] Group/channel message support
- [ ] Callback query handling (buttons)
- [ ] Message editing
- [ ] Inline keyboard support
- [ ] File download capability
- [ ] Custom sticker packs
- [ ] Payment integration
- [ ] Scheduled messages

---

## Support

For issues:
1. Check `webhook-status` endpoint
2. Check `bot-info` endpoint
3. Review logs for errors
4. Verify webhook URL is accessible from internet
5. Contact support with logs and channel ID
