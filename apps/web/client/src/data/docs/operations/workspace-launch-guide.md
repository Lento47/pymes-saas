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
   - **Callback URL**: `https://api.pymeshub.lat/api/inbound/whatsapp/webhook`
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

1. Configura la bandeja de correo unificada en Configuración > Canales.
2. Define reglas de enrutamiento: qué mensajes van a qué departamento o agente.
3. Si usas un dominio propio, configura los registros DNS necesarios (SPF, DKIM, DMARC).

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
