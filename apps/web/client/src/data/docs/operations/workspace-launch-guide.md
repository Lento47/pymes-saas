# Guía de Lanzamiento de Workspace

Última actualización: [FECHA]

## 1. Objetivo

Esta guía proporciona una ruta clara para que equipos nuevos activen su workspace de PymesHub con la estructura, roles, canales y documentación necesaria para operar desde el primer día.

## 2. Antes de empezar

Antes de crear el workspace, asegúrate de tener definido lo siguiente:

- **Dueño del workspace**: persona con autoridad para decidir roles, accesos, plan y facturación. Normalmente liderazgo o fundador.
- **Equipo inicial**: al menos 2-3 personas que usarán la Plataforma en el día a día (ventas, soporte, finanzas, operaciones).
- **Canales activos**: define cuáles canales de comunicación usarás primero (WhatsApp, correo) y si ya tienes números o direcciones configurados.
- **Flujo de trabajo deseado**: entiende cómo se mueve una conversación típica en tu negocio —desde el primer contacto hasta la factura pagada— para configurar el workspace de forma coherente.
- **Expectativas del cliente**: revisa los documentos de confianza aplicables para tu equipo y, si corresponde, compártelos con stakeholders internos antes del go-live.

## 3. Paso 1 — Crear el workspace

1. Accede a [URL_PLATAFORMA] y selecciona «Crear workspace».
2. Define el slug del workspace (identificador único, por ejemplo `mi-empresa`).
3. Proporciona el nombre comercial visible para tu equipo.
4. Configura el idioma predeterminado del workspace (español / inglés).

## 4. Paso 2 — Configurar roles y accesos

Invita a los miembros del equipo inicial y asigna el rol correcto desde el principio:

| Rol | Acceso |
|-----|--------|
| **OWNER** | Control total: configuración, facturación, miembros, roles, canales, eliminación de datos. Normalmente una sola persona. |
| **ADMIN** | Administración operativa: canales, departamentos, miembros con rol AGENT o VIEWER, automatizaciones. No puede cambiar de OWNER ni eliminar el workspace. |
| **AGENT** | Operación diaria: gestionar conversaciones, contactos, tareas, documentos, facturas y pipeline. |
| **VIEWER** | Solo lectura: ver bandeja, contactos, pipeline e informes sin modificar datos. |

**Recomendación**: empieza con un OWNER, un ADMIN y los AGENTS necesarios. Añade VIEWERS solo cuando necesites visibilidad sin capacidad de edición.

## 5. Paso 3 — Configurar canales

### 5.1 WhatsApp

WhatsApp se integra vía **WhatsApp Business Platform** (Cloud API de Meta). El proceso tiene dos partes: una en Meta y una en PymesHub.

**Antes de empezar**

- Una cuenta de **Meta Business** verificada (no es la cuenta personal de Facebook). Verificá tu negocio en `business.facebook.com → Configuración → Información del negocio`. La verificación puede tomar de 1 a 3 días si Meta solicita documentos.
- Un **número de teléfono dedicado** para WhatsApp Business. No puede tener una cuenta de WhatsApp personal o Business activa en el celular — Meta lo migra a la Cloud API y deja de funcionar en la app móvil.
- Tarjeta corporativa cargada en Meta Business para el método de pago de WhatsApp (las primeras 1.000 conversaciones de servicio al cliente cada mes son gratis; las plantillas de marketing/utilidad y servicio se cobran por conversación según el país).

**Paso 1 — Crear la WhatsApp Business Account (WABA) en Meta**

1. En `business.facebook.com → Configuración del negocio → Cuentas → Cuentas de WhatsApp`, dale **Agregar → Crear una cuenta nueva de WhatsApp**.
2. Asociá la WABA a tu **App de Meta** (Type: *Business*). Si todavía no tenés App, creala en `developers.facebook.com → Mis apps → Crear app → Business`.
3. Agregá el producto **WhatsApp** dentro de la App. Esto te da las pantallas de *API Setup*, *Configuration* y *Webhooks*.
4. En *API Setup* agregá tu número de teléfono dedicado y verificalo por SMS o llamada. Anotá el **Display name** (debe coincidir con tu marca) y esperá la aprobación de Meta — toma de minutos a unas horas.

**Paso 2 — Recopilar las credenciales que pide PymesHub**

Necesitás cuatro valores. Los primeros tres están en `developers.facebook.com → Tu App → WhatsApp → API Setup`:

- **WhatsApp Business Account ID** (`WABA_ID`) — identifica la WABA. Aparece bajo el selector de número.
- **Phone Number ID** (`PHONE_NUMBER_ID`) — identifica el número específico. Es un entero de ~15 dígitos, **no** el número telefónico humano.
- **App Secret** (Configuration → Basic). Se usa para verificar la firma `X-Hub-Signature-256` de cada webhook entrante; sin él, PymesHub rechaza la llamada.
- **Access Token permanente** — el token temporal que Meta muestra en *API Setup* expira a las 24h y no sirve para producción. Generá uno permanente con un **System User**:
  1. `business.facebook.com → Configuración del negocio → Usuarios → Usuarios del sistema → Agregar`. Tipo *Admin*.
  2. **Asignar activos** al system user: tu App de Meta y la WABA, ambas con permisos *Manage*.
  3. **Generate New Token** → seleccioná la App → marcá los permisos `whatsapp_business_management` y `whatsapp_business_messaging` → expiración *Never* → copiá el token. Guardalo en un gestor de secretos: Meta no lo vuelve a mostrar.

**Paso 3 — Configurar el webhook en Meta**

1. En `developers.facebook.com → Tu App → WhatsApp → Configuration → Webhook`, dale **Edit** y completá:
   - **Callback URL**: `https://api.PymesHub.lat/api/inbound/whatsapp/webhook`
   - **Verify Token**: una cadena aleatoria que te inventás; tiene que coincidir exactamente con el `WHATSAPP_WEBHOOK_VERIFY_TOKEN` que PymesHub espera. Si tu workspace está en cuenta managed, pediselo al admin de plataforma; si autoalojás PymesHub, lo definís vos en la variable de entorno.
   - **Verify and Save**: Meta hace un GET de prueba contra el endpoint. Si responde con el challenge correcto, queda verificado.
2. **Suscribite** a los eventos. Como mínimo: `messages` (mensajes entrantes y estados de entrega). Los demás (`message_template_status_update`, `account_alerts`) son opcionales pero recomendados para que PymesHub te avise si una plantilla queda rechazada.
3. **App Secret**: copiá el valor de *App → Settings → Basic → App Secret* y guardalo: PymesHub lo usa internamente como `WHATSAPP_APP_SECRET` para validar la firma HMAC-SHA256 de cada webhook.

**Paso 4 — Pegar las credenciales en PymesHub**

1. Iniciá sesión en tu workspace y andá a **Configuración → Canales → WhatsApp → Conectar**.
2. Pegá: `Phone Number ID`, `WABA ID`, `Access Token permanente`. El sistema valida en el momento haciendo una llamada de prueba a `/me` de Meta.
3. Si la cuenta es managed, el admin de plataforma carga `WHATSAPP_APP_SECRET` y `WHATSAPP_WEBHOOK_VERIFY_TOKEN` en la configuración del workspace. Si autoalojás, los definís como variables de entorno del API.
4. Mandá un mensaje de prueba al número desde otro WhatsApp; debería aparecer en el inbox en menos de 5 segundos.

**Paso 5 — Plantillas de mensaje**

WhatsApp **no permite** iniciar una conversación con un cliente si pasaron más de 24 h desde su último mensaje, salvo usando una **plantilla aprobada**. Para recordatorios, bienvenidas y seguimientos:

1. Creá la plantilla en `business.facebook.com → Cuentas de WhatsApp → tu WABA → Plantillas de mensaje → Crear plantilla`.
2. Categoría: *Utilidad* (notificaciones operativas), *Marketing* (promociones — más caras y con consentimiento explícito) o *Autenticación* (OTPs).
3. Esperá la revisión de Meta — usualmente 1 hora a 24 h. Las plantillas rechazadas se pueden corregir y reenviar.
4. Una vez aprobada, sincronizá las plantillas en PymesHub desde **Configuración → Canales → WhatsApp → Sincronizar plantillas**.

**Cumplimiento y opt-in**

- Asegurate de tener **opt-in documentado** de cada cliente antes de enviarle mensajes proactivos. Sirve un check explícito en formulario, una respuesta por email, o una conversación previa donde el cliente acepte recibir notificaciones por WhatsApp.
- Revisá la [Política de WhatsApp e IA](/legal/whatsapp-ai-policy) de PymesHub para las reglas operativas del canal y los usos permitidos del agente AI.
- Meta puede suspender la WABA por *quality rating low* si un porcentaje alto de tus envíos resulta en bloqueos o reportes. Monitoreá la calidad en Meta Business → Insights.

### 5.2 Correo electrónico

PymesHub envía correo a través de **Resend** (API moderna sobre HTTPS) y opcionalmente recibe correo entrante vía webhook. La configuración tiene tres partes: dominio en Resend, API key, y conexión en PymesHub.

**Antes de empezar**

- Una cuenta en `resend.com` (plan free incluye 3.000 envíos/mes y un dominio).
- Si usás un dominio propio (`tuempresa.com`), acceso al panel de DNS de tu registrador (Cloudflare, GoDaddy, Namecheap, etc.). Si todavía no tenés dominio, podés empezar con la dirección compartida `onboarding@resend.dev` y migrar después.
- Una dirección "from" decidida (ej. `notificaciones@tuempresa.com`, `soporte@tuempresa.com`). Usá una dirección no-personal — el correo sale firmado con esa dirección y los clientes responden ahí.

**Paso 1 — Agregar y verificar el dominio en Resend**

1. En `resend.com → Domains → Add Domain`, ingresá tu dominio raíz (`tuempresa.com`, sin `www` y sin protocolo).
2. Resend te muestra **3 registros DNS** que debés copiar a tu registrador. Los nombres exactos varían pero siempre son del tipo:
   - `MX` para enrutar inbound a los servidores de Resend (sólo si vas a recibir correo entrante).
   - `TXT` con un valor que empieza por `v=spf1 include:amazonses.com ~all` (registro **SPF**).
   - `TXT` con prefijo `resend._domainkey` y un valor largo (registro **DKIM**).
3. **Recomendado**: agregar también un registro **DMARC** (`TXT` en `_dmarc.tuempresa.com` con `v=DMARC1; p=quarantine; rua=mailto:tu@correo.com`). No es obligatorio para enviar pero mejora la entregabilidad y evita que tus correos terminen en spam.
4. Esperá la verificación. Resend reintenta cada minuto y suele tardar 5–60 minutos según la propagación DNS de tu registrador. El estado en `Domains` cambia a `Verified` cuando todos los registros validan.

**Paso 2 — Crear la API key**

1. En `resend.com → API Keys → Create API Key`, dale un nombre descriptivo (`PymesHub-prod`).
2. Permiso: `Sending access` (es el que usa PymesHub para enviar). Si vas a usar inbound, también necesitás `Full access`.
3. Restringí la API key a tu dominio verificado (campo *Domain*) para limitar el blast radius si la key se filtra.
4. Copiá la key (`re_...`) en el momento — Resend no la vuelve a mostrar. Guardala en un gestor de secretos.

**Paso 3 — Conectar el canal en PymesHub**

1. **Configuración → Canales → Email → Conectar**.
2. Pegá:
   - **API Key**: la `re_...` del paso 2.
   - **From email**: la dirección de envío (debe ser de un dominio verificado en Resend, p. ej. `notificaciones@tuempresa.com`).
   - **From name**: el nombre que ven los destinatarios (`Soporte PymesHub`, `Ventas TuEmpresa`).
   - **Inbound email** (opcional): la dirección a donde reenviás los correos entrantes (`hola@tuempresa.com`).
3. PymesHub guarda la API key cifrada con `ENCRYPTION_KEY` y hace una llamada de prueba a `/domains` de Resend para validar.
4. Mandá un correo de prueba desde **Configuración → Canales → Email → Enviar prueba**. Te debe llegar en menos de 1 minuto.

**Paso 4 — Recibir correo entrante (opcional)**

Para que las respuestas de tus clientes lleguen al inbox de PymesHub:

1. En `resend.com → Webhooks → Add Webhook`:
   - **Endpoint URL**: `https://api.PymesHub.lat/api/inbound/email/webhook`
   - **Events**: marcá `email.delivered`, `email.bounced`, `email.complained`, y los de inbound (`email.received` si tu plan lo incluye).
2. Resend te muestra un **Webhook Signing Secret** (formato `whsec_...`). PymesHub lo verifica con la firma Svix (headers `svix-signature`, `svix-id`, `svix-timestamp`) — sin firma válida la llamada se rechaza con 401.
3. Si tu workspace es managed, el admin de plataforma carga `RESEND_WEBHOOK_SECRET` en la config del workspace. Si autoalojás, definilo como variable de entorno del API.
4. Configurá el reenvío de tu dirección entrante hacia Resend según la guía de Resend Inbound. Para dominios en Cloudflare Email Routing, agregás una regla que reenvía a la dirección que Resend te asigna.

**Paso 5 — Reglas de enrutamiento**

Una vez conectado, definí en **Configuración → Canales → Email → Reglas**:

- Qué dirección recibe qué tipo de correo (soporte, ventas, finanzas).
- A qué departamento o agente se asigna automáticamente.
- Etiquetas auto-aplicadas según asunto, remitente o palabras clave.

**Cumplimiento**

- Incluí siempre un link de baja en correos de marketing (Resend lo agrega automáticamente si activás *Add unsubscribe headers*).
- En Costa Rica, los correos comerciales no solicitados están limitados por Ley 8968. Documentá el opt-in igual que con WhatsApp.

### 5.3 Telegram

Telegram es el canal más simple de los tres: no requiere verificación de empresa ni cuenta de pago. Toda la configuración la hace PymesHub automáticamente una vez que pegás el token del bot.

**Paso 1 — Crear el bot con BotFather**

1. Abrí Telegram (web, móvil o desktop) y buscá `@BotFather` → start.
2. Mandá el comando `/newbot`.
3. BotFather te pide:
   - **Display name** del bot (`Soporte TuEmpresa`).
   - **Username** terminado en `bot` (`tuempresa_soporte_bot`). Debe ser único en todo Telegram.
4. BotFather responde con un mensaje que incluye el **token** (formato `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`). **Copialo** — es la única credencial que necesitás.

**Paso 2 — Configurar el bot (opcional pero recomendado)**

Mientras seguís en el chat con BotFather:

- `/setdescription` → texto corto que aparece arriba del bot cuando un usuario lo abre por primera vez.
- `/setabouttext` → texto que aparece en el perfil del bot.
- `/setuserpic` → foto de perfil del bot (logo de tu empresa, mínimo 512×512 px).
- `/setcommands` → lista de comandos visibles. Para soporte, suele ser:
  ```
  start - Iniciar conversación
  ayuda - Ver opciones de ayuda
  agente - Hablar con una persona
  ```
- `/setprivacy` → `Disable` si querés que el bot reciba todos los mensajes en grupos. Para soporte 1-a-1 (DM con el bot) no importa.

**Paso 3 — Conectar el canal en PymesHub**

1. **Configuración → Canales → Telegram → Conectar**.
2. Pegá el **token** del bot. PymesHub lo guarda cifrado.
3. Al guardar, PymesHub **automáticamente**:
   - Llama a `setWebhook` de Telegram apuntando a `https://api.PymesHub.lat/api/inbound/telegram/webhook/{channelId}`.
   - Genera un secret aleatorio por canal y lo registra como `secret_token` en Telegram. Cada update entrante debe traer ese mismo secret en el header `X-Telegram-Bot-Api-Secret-Token` o se rechaza con 401.
   - Suscribe a los tipos de update relevantes (`message`, `edited_message`, `callback_query`).
4. PymesHub muestra el estado del webhook en **Configuración → Canales → Telegram → Estado del webhook** (URL registrada, últimos errores reportados por Telegram, conteo de updates pendientes).

No tenés que tocar nada más en el lado de Telegram — toda la configuración del webhook la maneja el server.

**Paso 4 — Probar el bot**

1. Buscá tu bot en Telegram por su username (`@tuempresa_soporte_bot`).
2. Mandá `/start`. El mensaje debería aparecer en el inbox de PymesHub en menos de 5 segundos.
3. Respondé desde PymesHub. La respuesta llega al chat de Telegram.

**Cumplimiento y buenas prácticas**

- Telegram **no** tiene restricciones tan estrictas como WhatsApp para iniciar conversaciones, pero el bot solo puede mandar mensajes a usuarios que primero le hayan escrito a él. No podés agregarlo a chats no solicitados.
- Si un usuario bloquea el bot, los mensajes posteriores fallan con `403 Forbidden: bot was blocked by the user`. PymesHub marca esa conversación como cerrada automáticamente.
- Para soporte multi-agente, conviene crear **un solo bot por workspace** y dejar que PymesHub se encargue de la asignación interna; un bot por agente fragmenta la conversación.

## 6. Paso 4 — Organizar departamentos

Crea departamentos que reflejen la estructura real de tu operación:

- **Ventas**: prospectos, cotizaciones, pipeline, cierre de negocios.
- **Soporte**: dudas, incidencias, seguimiento post-venta.
- **Finanzas**: facturación, cobros, conciliación, notas de crédito.
- **Operaciones**: onboarding, documentación, procesos internos.

Cada departamento puede tener reglas de enrutamiento automático y SLAs internos de respuesta.

## 7. Paso 5 — Configurar pipeline

1. Define las etapas de tu proceso comercial en Configuración > Pipeline.
2. Etapas sugeridas: Nuevo Lead → Calificado → Propuesta Enviada → Negociación → Cerrado Ganado / Perdido.
3. Asigna responsables y tiempos esperados por etapa.
4. Configura automatizaciones para mover leads entre etapas o crear tareas al cambiar de fase.

## 8. Paso 6 — Revisar documentación de confianza

Antes del go-live, asegúrate de que tu equipo y stakeholders conozcan los siguientes materiales:

- **Términos de Servicio**: rigen la relación contractual. Deben ser aceptados al crear la cuenta.
- **Política de Privacidad**: explica cómo PymesHub trata datos personales propios del servicio.
- **Data Processing Addendum**: regula el tratamiento de los datos que cargas en la Plataforma.
- **SLA Base**: define expectativas de disponibilidad y manejo de incidentes.
- **Política de Soporte**: canales, prioridades y tiempos orientativos de atención.
- **Aviso de Subencargados**: terceros que pueden tratar datos en la cadena del servicio.

## 9. Paso 7 — Activar el workspace

1. Revisa que todos los miembros invitados hayan aceptado y configurado su acceso.
2. Verifica que los canales estén recibiendo mensajes correctamente.
3. Realiza una prueba de flujo completo: mensaje entrante → asignación → respuesta → tarea o factura → cierre.
4. Confirma que las automatizaciones disparen correctamente (recordatorios, handoffs, notificaciones).
5. Activa el workspace para producción.

## 10. Post-lanzamiento

### Semana 1
- Monitorea los primeros mensajes y handoffs.
- Corrige enrutamiento o asignaciones si es necesario.
- Confirma que los tiempos de respuesta se alinean con tus expectativas.

### Primer mes
- Revisa el pipeline y ajusta etapas según datos reales.
- Evalúa si necesitas nuevos roles, departamentos o canales.
- Programa un checkpoint con el equipo para recoger feedback.

### Trimestral
- Revisa la lista de miembros y elimina accesos inactivos.
- Actualiza automatizaciones según nuevos patrones de operación.
- Revisa los documentos de subencargados y legales por si hubo cambios materiales.
- Ejecuta una exportación de datos si tu política interna lo requiere.

## 11. Referencias rápidas

| Necesidad | Recurso |
|-----------|---------|
| Problema técnico | Política de Soporte — canal y prioridad |
| Incidente de seguridad | Reportar a [CORREO_SEGURIDAD] |
| Cambio de plan o facturación | Configuración > Facturación |
| Nuevo miembro del equipo | Configuración > Miembros > Invitar |
| Revisión de cumplimiento | Trust Center y Centro Legal |
| Exportación de datos | Soporte o funcionalidad de exportación del workspace |
