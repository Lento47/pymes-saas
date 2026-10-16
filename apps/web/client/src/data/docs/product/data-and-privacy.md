# PymesHub — Data and privacy

- [English](#english)
- [Español](#espanol)

---

## English

**What PymesHub stores, where it lives, who can see it, how long it stays, and how you get rid of it.** This page is written for people, not for lawyers: it lists what the product actually does today, in plain language. The legal documents that govern the relationship live in the Legal Center.

### The short version

- We store what an order needs in order to happen: who you are, where the delivery goes, who makes it, who carries it, what was paid, and how it ended.
- We do **not** process card payments, we do **not** sell anyone's data, and we do **not** run advertising.
- Your live location is only shared **while you are carrying an order**, only with the people in that order, and only the latest point is kept.
- You can delete your account from inside the app. It takes effect after a **seven-day** window you can cancel, and what remains afterwards has no direct link to you.

### What we store

| Category | What it includes |
| --- | --- |
| **Account** | Name, email, phone, profile picture, and the record that you accepted the terms and confirmed you are 18 or older. Passwords and sign-in credentials are handled by our identity provider, not kept in the marketplace database. |
| **Notifications and preferences** | Whether you want order updates and replies to your reviews, and whether your picture is shown next to your reviews. Push tokens from the devices you signed in on. |
| **Addresses** | The label, the street details you typed, a map pin when you dropped one, a contact phone and any delivery instructions. |
| **Business profile** | Name, category, description, logo and cover, address, phone, opening hours, delivery settings and plan. |
| **Catalogue** | Products, options, prices, stock counts and the pictures you uploaded. |
| **Team** | Who belongs to a business, in what role, and the invitations you sent (including whether they were accepted). |
| **Orders** | The items and the options chosen, the prices as they were at checkout, the totals, the tip, your notes, the delivery address and the fulfilment point, the status history, and who moved each step. |
| **Payments** | The method chosen (cash or SINPE Móvil), the amount and purpose of each payment, its review state, the SINPE account (a Costa Rican phone number and the recipient's name) and any proof image uploaded. |
| **Deliveries** | The pickup and drop-off stops, the timestamps of each step, the measured route when checkout priced it, and the two ratings at the end. |
| **Live location** | While a courier is carrying an order, the latest position, its accuracy and — when the device provides them — heading and speed. |
| **Courier profile** | Display name, service area, work zone, bio, vehicle details, availability, review state of the profile and the reviews received. |
| **Verification** | What a business submits when it asks for the verified badge: legal name, tax identification, support email, domain and supporting documents. |
| **Support and feedback** | Support conversations, the ideas you send us, and crash reports (what failed, where, and the app version that produced it). |
| **Site analytics** | Aggregate usage of the public website, measured with consent settings that start **denied**. |

### Where it lives

- **In our cloud provider's network.** The marketplace runs on a global cloud platform: one database for the marketplace data, a separate object store for the pictures and files you upload, a cache for short-lived values, queues that carry order events between services, and a coordination service that keeps the live order screens in sync.
- **The website and the API are served from the same provider's edge**, behind encrypted connections.
- **Files you upload** (product photos, business images, review images, payment proofs, verification documents) are kept in a private store and served through the application; they are not publicly listed.
- **Identity** is handled by a specialised identity provider, so sign-in credentials are not stored by the marketplace database.
- **Push notifications** travel through Expo to Apple's and Google's push services.
- **Error monitoring** may receive technical information about a failure (including the originating IP address), never your messages or order contents.
- **Site analytics** is provided by Google Analytics, with analytics and advertising storage **denied by default** until you consent.
- **Processing outside Costa Rica:** the providers above operate internationally, so data may be processed outside the country. We choose providers with contractual confidentiality and security obligations, and we tell you who they are in the Subprocessor Notice.

### How long it stays

| Data | How long |
| --- | --- |
| Delivery price quotes | **2 minutes** — they exist to bind a price to a route at checkout and are removed once expired. |
| Delivery offers to couriers | **2 minutes** — an unanswered offer expires and the run goes back to the pool. |
| Live courier position | Kept as the **latest point only** for the active run, and removed or anonymised when the run ends, when it is reassigned, when the courier signs out, or when location permission is withdrawn. We do not keep a route history. |
| Addresses, carts, push tokens, courier profile | Kept while the account exists, and deleted when it is removed. |
| Orders, order status history and financial records | Kept after account deletion **without a direct identity**: the account reference is replaced by an anonymised record and the address, notes and coordinates that are no longer needed are removed. This is what lets a receipt, a dispute or a tax obligation still be answered. |
| Crash reports and product ideas | Kept after account deletion **detached from the account**, because they exist to fix the bug or build the feature — they no longer point at a person. |
| Backups | Held by the provider on its ordinary rotation cycle. A backup is not restored in order to bring a deleted account back. |
| Business analytics | How far back a report looks is part of the plan: 30 days on FREE, up to three years on GROWTH and BUSINESS. That is a view limit, not a deletion of older orders. |

### Who can see what

- **Only the people in an order.** A business sees the orders placed with it; a courier sees the run assigned to them; a customer sees their own orders. The live location of a run is visible only to that run's courier, its customer and the business fulfilling it — never on profiles, catalogues or other orders.
- **The public storefront shows a shop's card**, not its contact details: no phone, no email, no street address. A marketplace that publishes every business's contact details is a scraper's directory.
- **Reviews show a display name and, if the author allows it, their picture** — never an email or a phone number.
- **Verification evidence is never returned.** A business's own view of its application has no field for the legal name, tax identification, support email or documents it submitted, and the internal review note is not exposed in any way to the applicant.
- **An invitation link tells a stranger almost nothing:** which shop, as what role, invited by whom, and whether it is still open — not the invited email address.
- **Everyone else sees nothing.** Signing in on another device does not reveal an account, and asking for someone else's order, address or delivery answers as though it did not exist.

### Your controls

- **Notification switches** for order updates and review replies, and a switch for showing your picture next to your reviews.
- **Location permission** is yours to refuse or withdraw at any time in your device settings; refusing it means you cannot run tracked deliveries.
- **Addresses** can be edited or deleted individually.
- **Leaving a team** is done from inside the app, and removing a member requires a reason.
- **Account deletion** starts inside the app and is described below.
- Privacy questions and requests: **privacidad@pymeshub.lat**.

### Deleting your account

1. Open **Settings → Account → Delete account**. You can also write to privacidad@pymeshub.lat if you cannot sign in.
2. The request is scheduled with a **seven-day** window, and the same screen lets you cancel it.
3. When the window closes, the deletion may be postponed if you have an active order as a customer or as a courier, so that a delivery in progress is not interrupted.
4. The last owner of a business must hand over ownership or close that business first.
5. Then credentials and sessions, name, email, phone, picture and preferences, saved addresses and carts, push tokens and pending notifications, courier profile, memberships, favourites, and the exact courier location and personal files that are no longer needed are deleted or detached.
6. Orders, audit events and records that must be kept for security, fraud prevention, accounting, compliance or defending claims stay **without a direct personal identity**.

### Consent and age

- PymesHub is for people **18 or older**. Creating an account requires confirming your age and accepting the terms, and both are recorded, with the date, against your account.
- That record is revocable: a revocation is stored alongside the original consent rather than overwriting it, so there is always something to point at.
- We do not design the marketplace for children, and we do not knowingly hold accounts for minors. If you believe a minor has an account, write to privacidad@pymeshub.lat.

### What we do not collect

- We never ask for a card number, and there is no card processor in the marketplace to send one to.
- Buying does not require documents: a customer account is a name, an email and a phone number, and nothing else.
- We do not read your messages, your contacts, your photo library or your files. A photo is uploaded only when you pick one — a product picture, a review photo, a payment receipt, a verification document.
- We do not follow you in the background unless you are a courier with an assigned order in progress, and never to build an advertising profile.
- We do not sell data, and we do not serve advertising in the product.

### Cookies and on-device storage

| What | Where it lives | Why | How long |
| --- | --- | --- | --- |
| Sign-in session | A cookie set by the platform | Keeps you signed in between visits | Until it expires, or until you sign out |
| Theme (light or dark) and language | Your own device's local storage | Remembers what you chose; the site reads it before anything is drawn so the page does not flash | Until you clear it |
| Site analytics | Google Analytics cookies | Counting visits and seeing which pages work | As published by Google Analytics, and **denied by default** |

Analytics and advertising storage start **denied**. The public website asks; until you answer, measurement stays off, and declining removes no feature.

### Who processes data for us

- **Cloud hosting** — the platform, the database, the file storage, the short-lived cache and the queues that carry order events.
- **An identity provider** — sign-in credentials and sessions.
- **Push delivery** — through Expo to Apple's and Google's push services, on the devices you signed in on.
- **Error monitoring** — technical information about failures, including the originating IP address.
- **Site analytics** — aggregate website usage.

Saying this plainly is the point. The same list is published with each provider's role and region in the Subprocessor Notice, and material changes to it are announced in advance.

### Your rights, and how to use them

- **See and correct.** Your profile, addresses, catalogue, hours and preferences are editable in the app.
- **Ask what we hold.** Write to privacidad@pymeshub.lat and we will tell you what we have about you and how to get it.
- **Delete.** From Settings, with a seven-day window you can cancel — described below.
- **Object or restrict.** Tell us what and why at the same address; if it is something we cannot do, we will say which rule stops it rather than leaving it unanswered.
- **Complain.** A privacy claim is handled as a case, not as feedback, and it is answered with what we did.

### How we protect it

- **Encrypted in transit** between the app and the service.
- **A role check on every request**, against your membership of a business — not against a token that keeps working after the membership ends.
- **Isolation between businesses**: one shop's orders, catalogue and customers are not visible to another.
- **Only the latest position** of a live delivery is kept, and tracking stops by itself when the run does.
- **Append-only order history**: a status change is a new event, so a past state cannot be quietly rewritten.
- **Rate limiting** on the API, and short validity windows on prices and offers so a stale quote cannot be replayed.
- **Least privilege by default**: a courier cannot assign orders, a staff member cannot delete a business, and a shop cannot clear a suspension the platform applied.
- None of it is perfect, and the security page is where a problem gets reported — privately.

### What this page does not claim

- It describes what the product does; it is not the legal text. The Privacy Policy, the Subprocessor Notice, the Location Use notice and the Account Deletion notice in the Legal Center are the binding documents.
- Some of those Legal Center documents are still written for the earlier SaaS stage of PymesHub (they mention workspaces, an inbox, CRM and OCR, and providers the marketplace does not use). They are **being updated**; where this page and those documents disagree about what the marketplace does today, **this page describes the product** and the Legal Center text is the one that is out of date. We would rather say that plainly than leave two answers standing.
- No security measure is absolute, and no availability guarantee is implied by this page.

---

## Español

**Qué guarda PymesHub, dónde vive, quién lo ve, cuánto dura y cómo se elimina.** Esta página está escrita para personas, no para abogados: cuenta lo que el producto hace hoy, en lenguaje claro. Los documentos legales que rigen la relación están en el Centro Legal.

### La versión corta

- Guardamos lo que un pedido necesita para poder ocurrir: quién sos, a dónde va la entrega, quién la prepara, quién la lleva, qué se pagó y cómo terminó.
- **No** procesamos pagos con tarjeta, **no** vendemos datos de nadie y **no** hacemos publicidad.
- Tu ubicación en vivo se comparte **solo mientras estás llevando un pedido**, solo con las personas de ese pedido, y se guarda únicamente el último punto.
- Podés eliminar tu cuenta desde la aplicación. Se ejecuta después de una ventana de **siete días** que podés cancelar, y lo que queda después no tiene un vínculo directo con vos.

### Qué guardamos

| Categoría | Qué incluye |
| --- | --- |
| **Cuenta** | Nombre, correo, teléfono, foto de perfil y el registro de que aceptaste los términos y confirmaste que tenés 18 años o más. Las contraseñas y credenciales las maneja nuestro proveedor de identidad; no quedan en la base de datos del marketplace. |
| **Avisos y preferencias** | Si querés recibir novedades del pedido y respuestas a tus reseñas, y si tu foto se muestra junto a tus reseñas. Los tokens de los dispositivos donde iniciaste sesión. |
| **Direcciones** | La etiqueta, los datos de calle que escribiste, el pin del mapa cuando lo pusiste, un teléfono de contacto y las instrucciones de entrega. |
| **Perfil del negocio** | Nombre, categoría, descripción, logo y portada, dirección, teléfono, horarios, ajustes de entrega y plan. |
| **Catálogo** | Productos, opciones, precios, stock y las fotos que subiste. |
| **Equipo** | Quién pertenece a un negocio, con qué rol, y las invitaciones que enviaste (incluido si se aceptaron). |
| **Pedidos** | Los productos y las opciones elegidas, los precios tal como estaban en el checkout, los totales, la propina, tus notas, la dirección de entrega y el punto de retiro, el historial de estados y quién movió cada paso. |
| **Pagos** | El método elegido (efectivo o SINPE Móvil), el monto y el concepto de cada pago, su estado de revisión, la cuenta SINPE (un teléfono de Costa Rica y el nombre de quien recibe) y la imagen de comprobante que se haya subido. |
| **Entregas** | Los puntos de retiro y entrega, la marca de tiempo de cada paso, la ruta medida cuando el checkout puso precio, y las dos calificaciones al final. |
| **Ubicación en vivo** | Mientras un repartidor lleva un pedido: la última posición, su precisión y — cuando el dispositivo los aporta — el rumbo y la velocidad. |
| **Perfil de repartidor** | Nombre visible, zona de servicio, zona de trabajo, bio, datos del vehículo, disponibilidad, estado de revisión del perfil y reseñas recibidas. |
| **Verificación** | Lo que un negocio envía cuando pide la insignia de verificado: razón social, identificación fiscal, correo de soporte, dominio y documentos de respaldo. |
| **Soporte y opiniones** | Conversaciones de soporte, las ideas que nos mandás y reportes de fallos (qué falló, dónde, y la versión de la app que lo produjo). |
| **Analítica del sitio** | Uso agregado del sitio público, medido con un consentimiento que arranca **denegado**. |

### Dónde vive

- **En la red de nuestro proveedor de nube.** El marketplace corre sobre una plataforma de nube global: una base de datos para los datos del marketplace, un almacén de objetos aparte para las imágenes y archivos que subís, una caché para valores de vida corta, colas que llevan los eventos de pedido entre servicios, y un servicio de coordinación que mantiene sincronizadas las pantallas del pedido en vivo.
- **El sitio y la API se sirven desde el borde del mismo proveedor**, detrás de conexiones cifradas.
- **Los archivos que subís** (fotos de productos, imágenes del negocio, imágenes de reseñas, comprobantes de pago, documentos de verificación) se guardan en un almacén privado y se sirven a través de la aplicación; no están listados públicamente.
- **La identidad** la maneja un proveedor especializado, así que las credenciales de acceso no las guarda la base de datos del marketplace.
- **Las notificaciones push** viajan por Expo hasta los servicios de notificaciones de Apple y de Google.
- **El monitoreo de errores** puede recibir información técnica de una falla (incluida la IP de origen), nunca tus mensajes ni el contenido de tus pedidos.
- **La analítica del sitio** la provee Google Analytics, con almacenamiento de analítica y publicidad **denegado por defecto** hasta que des tu consentimiento.
- **Tratamiento fuera de Costa Rica:** los proveedores de arriba operan internacionalmente, así que los datos pueden tratarse fuera del país. Elegimos proveedores con obligaciones contractuales de confidencialidad y seguridad, y te decimos quiénes son en el Aviso de Subencargados.

### Cuánto dura

| Dato | Cuánto dura |
| --- | --- |
| Cotizaciones de entrega | **2 minutos** — existen para atar un precio a una ruta en el checkout y se eliminan al vencer. |
| Ofertas de viaje a repartidores | **2 minutos** — una oferta sin respuesta vence y el viaje vuelve al grupo. |
| Ubicación en vivo del repartidor | Se guarda **solo el último punto** del viaje activo y se elimina o anonimiza cuando el viaje termina, cuando se reasigna, cuando el repartidor cierra sesión o cuando se retira el permiso de ubicación. No guardamos un historial de ruta. |
| Direcciones, carritos, tokens de notificación, perfil de repartidor | Se guardan mientras exista la cuenta y se eliminan cuando se elimina. |
| Pedidos, historial de estados y registros financieros | Se conservan después de eliminar la cuenta **sin identidad directa**: la referencia de la cuenta se reemplaza por un registro anonimizado y se eliminan la dirección, las notas y las coordenadas que ya no hacen falta. Esto es lo que permite responder por un recibo, un reclamo o una obligación fiscal. |
| Reportes de fallos e ideas | Se conservan después de eliminar la cuenta **desvinculados de ella**, porque existen para arreglar el fallo o construir la función: ya no apuntan a una persona. |
| Respaldos | Los mantiene el proveedor según su ciclo ordinario de rotación. Un respaldo no se restaura para revivir una cuenta eliminada. |
| Analítica del negocio | Hasta dónde mira un reporte es parte del plan: 30 días en FREE, hasta tres años en GROWTH y BUSINESS. Es un límite de vista, no un borrado de pedidos anteriores. |

### Quién puede ver qué

- **Solo las personas de un pedido.** Un negocio ve los pedidos que se le hicieron; un repartidor ve el viaje que tiene asignado; un cliente ve sus propios pedidos. La ubicación en vivo de un viaje solo la ven el repartidor de ese viaje, su cliente y el negocio que lo prepara — nunca en perfiles, catálogos ni otros pedidos.
- **La tienda pública muestra la tarjeta de un negocio**, no sus datos de contacto: sin teléfono, sin correo, sin dirección de calle. Un marketplace que publica los datos de contacto de todos los negocios es un directorio para scrapers.
- **Las reseñas muestran un nombre visible y, si la persona lo permite, su foto** — nunca un correo ni un teléfono.
- **La evidencia de verificación nunca se devuelve.** La vista que un negocio tiene de su propia postulación no tiene campo para la razón social, la identificación, el correo de soporte ni los documentos que envió, y la nota interna de revisión no se expone de ninguna forma a quien aplica.
- **Un enlace de invitación casi no dice nada a un desconocido:** qué negocio, con qué rol, quién invitó y si sigue vigente — no el correo de la persona invitada.
- **Nadie más ve nada.** Iniciar sesión en otro dispositivo no revela una cuenta, y pedir el pedido, la dirección o la entrega de otra persona responde como si no existiera.

### Tus controles

- **Interruptores de avisos** para novedades del pedido y respuestas a reseñas, y un interruptor para mostrar tu foto junto a tus reseñas.
- **El permiso de ubicación** es tuyo: podés negarlo o retirarlo cuando quieras desde los ajustes del dispositivo. Negarlo significa que no podés hacer entregas con seguimiento.
- **Las direcciones** se editan o se eliminan una por una.
- **Salir de un equipo** se hace desde la aplicación, y quitar a alguien exige un motivo.
- **Eliminar la cuenta** se inicia desde la aplicación y se explica abajo.
- Dudas y solicitudes de privacidad: **privacidad@pymeshub.lat**.

### Eliminar tu cuenta

1. Abrí **Ajustes → Cuenta → Eliminar cuenta**. También podés escribir a privacidad@pymeshub.lat si no podés iniciar sesión.
2. La solicitud se programa con una ventana de **siete días**, y la misma pantalla permite cancelarla.
3. Al cerrarse la ventana, la eliminación puede posponerse si tenés un pedido activo como cliente o como repartidor, para no interrumpir una entrega en curso.
4. La última persona propietaria de un negocio debe transferir la propiedad o cerrar ese negocio primero.
5. Después se eliminan o desvinculan credenciales y sesiones, nombre, correo, teléfono, foto y preferencias, direcciones y carritos guardados, tokens de notificación y avisos pendientes, perfil de repartidor, membresías, favoritos, y la ubicación exacta y los archivos personales que ya no hacen falta.
6. Los pedidos, los eventos de auditoría y los registros que deban conservarse por seguridad, prevención de fraude, contabilidad, cumplimiento o defensa de reclamos se mantienen **sin identidad personal directa**.

### Consentimiento y edad

- PymesHub es para personas **mayores de 18 años**. Crear una cuenta exige confirmar tu edad y aceptar los términos, y ambas cosas quedan registradas con su fecha contra tu cuenta.
- Ese registro es revocable: una revocación se guarda al lado del consentimiento original en vez de sobrescribirlo, así siempre hay algo a lo que apuntar.
- No diseñamos el marketplace para menores y no tenemos cuentas de menores de forma consciente. Si creés que una persona menor tiene una cuenta, escribí a privacidad@pymeshub.lat.

### Qué no recogemos

- Nunca pedimos un número de tarjeta, y no hay ningún procesador de tarjetas en el marketplace al que mandarlo.
- Comprar no exige documentos: una cuenta de cliente es un nombre, un correo y un teléfono, y nada más.
- No leemos tus mensajes, tus contactos, tu galería de fotos ni tus archivos. Una foto se sube solo cuando la elegís: una imagen de producto, una foto de reseña, un comprobante de pago, un documento de verificación.
- No te seguimos en segundo plano salvo que seas repartidor con un pedido asignado en curso, y nunca para armar un perfil publicitario.
- No vendemos datos y no mostramos publicidad dentro del producto.

### Cookies y almacenamiento en tu dispositivo

| Qué | Dónde vive | Para qué | Cuánto dura |
| --- | --- | --- | --- |
| Sesión iniciada | Una cookie que pone la plataforma | Mantiene tu sesión entre visitas | Hasta que expire o hasta que cerrés sesión |
| Tema (claro u oscuro) e idioma | El almacenamiento local de tu propio dispositivo | Recuerda lo que elegiste; el sitio lo lee antes de dibujar nada para que la página no parpadee | Hasta que lo borres |
| Analítica del sitio | Cookies de Google Analytics | Contar visitas y ver qué páginas funcionan | Lo que publica Google Analytics, y **denegado por defecto** |

El almacenamiento de analítica y de publicidad arranca **denegado**. El sitio público pregunta; hasta que respondas, la medición queda apagada, y negarte no te quita ninguna función.

### Quién procesa datos por nosotros

- **Alojamiento en la nube** — la plataforma, la base de datos, el almacenamiento de archivos, la caché de vida corta y las colas que llevan los eventos de pedido.
- **Un proveedor de identidad** — credenciales y sesiones de inicio de sesión.
- **Envío de notificaciones push** — por Expo hacia los servicios de Apple y de Google, en los dispositivos donde iniciaste sesión.
- **Monitoreo de errores** — información técnica de las fallas, incluida la IP de origen.
- **Analítica del sitio** — uso agregado del sitio.

Decirlo claramente es el punto. La misma lista se publica con el rol y la región de cada proveedor en el Aviso de Subencargados, y los cambios materiales se anuncian con antelación.

### Tus derechos, y cómo ejercerlos

- **Ver y corregir.** Tu perfil, tus direcciones, tu catálogo, tus horarios y tus preferencias se editan en la app.
- **Preguntar qué tenemos.** Escribí a privacidad@pymeshub.lat y te decimos qué tenemos sobre vos y cómo obtenerlo.
- **Eliminar.** Desde Ajustes, con una ventana de siete días que podés cancelar — explicada abajo.
- **Oponerte o limitar.** Contanos qué y por qué en la misma dirección; si es algo que no podemos hacer, decimos qué regla lo impide en vez de dejarlo sin respuesta.
- **Reclamar.** Un reclamo de privacidad se trata como un caso, no como una opinión, y se responde con lo que hicimos.

### Cómo lo protegemos

- **Cifrado en tránsito** entre la app y el servicio.
- **Un control de rol en cada petición**, contra tu pertenencia a un negocio — no contra un token que sigue funcionando después de que la membresía terminó.
- **Aislamiento entre negocios**: los pedidos, el catálogo y los clientes de un negocio no son visibles para otro.
- **Solo la última posición** de una entrega en vivo, y el seguimiento se detiene solo cuando termina el viaje.
- **Historial de pedido de solo agregar**: un cambio de estado es un evento nuevo, así que un estado pasado no se puede reescribir en silencio.
- **Límites de tasa** en la API, y ventanas cortas de validez en precios y ofertas para que una cotización vieja no se pueda repetir.
- **Mínimo privilegio por defecto**: un repartidor no puede asignar pedidos, un miembro del staff no puede borrar un negocio, y un negocio no puede levantar una suspensión que aplicó la plataforma.
- Nada de esto es perfecto, y la página de seguridad es donde se reporta un problema — en privado.

### Lo que esta página no afirma

- Describe lo que hace el producto; no es el texto legal. La Política de Privacidad, el Aviso de Subencargados, el aviso de Uso de Ubicación y el de Eliminación de Cuenta del Centro Legal son los documentos vinculantes.
- Algunos de esos documentos del Centro Legal todavía están escritos para la etapa SaaS anterior de PymesHub (mencionan workspaces, inbox, CRM y OCR, y proveedores que el marketplace no usa). Están **en proceso de actualización**; donde esta página y esos documentos se contradigan sobre lo que el marketplace hace hoy, **esta página describe el producto** y el texto del Centro Legal es el que está desactualizado. Preferimos decirlo claramente antes que dejar dos respuestas en pie.
- Ninguna medida de seguridad es absoluta, y esta página no implica ninguna garantía de disponibilidad.
