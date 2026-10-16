# PymesHub — What is supported and what is not

- [English](#english)
- [Español](#espanol)

---

## English

**One page, one purpose: say plainly what works today, what exists but is switched off, and what PymesHub does not do at all.** Where something is not supported we say so instead of leaving it ambiguous.

### Where PymesHub runs

| Surface | Supported today |
| --- | --- |
| **Web** — storefront and business dashboard, at **pymeshub.lat** | Current versions of Chrome, Edge, Safari and Firefox on desktop and mobile. Needs JavaScript, and cookies for signing in. |
| **iOS** | The current app release from the App Store. |
| **Android** | The current app release from Google Play, plus internal preview builds used for field testing. |
| **Desktop** | A Windows application, built on Tauri 2. |
| Older app versions, older builds, and the retired application left in the repository | **Not supported.** Only the current production site and the current store releases are maintained. |

The API that all of these talk to is a single service, so a customer's order in the browser is the same row their phone sees.

### Languages and locale

- **Spanish (`es`) is the default**, and **English (`en`)** is available across the application. Those are the two languages the product ships: there is no third locale today.
- The storefront follows the language you chose and remembers it.
- Dates, money and opening hours are shown for Costa Rica (the country's own time zone), and prices are in **colones (CRC)**.
- Legal documents are published in the language the Legal Center offers; this documentation center publishes its product pages in both Spanish and English in the same document.

### What the product supports

| Area | Supported |
| --- | --- |
| Marketplace model | A customer orders from one business; pickup at the counter or delivery by a courier. |
| Payments | **Cash on delivery** and **SINPE Móvil**. |
| Pricing | Flat subscription for the business, in colones, IVA included. No commission per order. |
| Plans | `FREE` (permanent, never charged) plus four paid tiers, monthly or yearly. |
| Delivery modes | Standard and **express**, where the plan allows it. |
| Catalogue | Products with option groups, options, images, stock (inventory tracking where the plan includes it), discounts and promotions. |
| Team | Owners, managers, staff and couriers, with defined permissions. |
| Couriers | Verified profiles invited by a business; offers, live tracking, two-way ratings. |
| Reviews | One review per order, in both directions for a delivery. |
| Analytics | Business reporting with a plan-dependent look-back window. |
| Accessibility | Large text, reduced-motion, light and dark themes, screen-reader labels. |
| Languages | Spanish and English. |
| Security reporting | A private vulnerability reporting channel — see the security page. |

### What exists but is switched off

These are in the product's design but **deliberately not enabled**. They are listed so nobody promises them by accident:

| Not enabled | Why |
| --- | --- |
| **Card payments** | `CARD` exists alongside cash and SINPE, and the platform refuses it rather than accepting an order it cannot settle. No online card processing is part of the marketplace today. |
| **Nearby and ready delivery discounts** | The pricing model carries them and they are all zero: a discount that depends on a courier signal we do not have yet must not be inferred at checkout. |
| **Dynamic delivery top-ups, and a maximum customer price cap** | Present in the pricing terms, set to disabled. |
| **Preparation-time tracking as a ranking signal** | Documented, not yet fed with data. |
| **Product follow-ups in notifications** | Only order updates and review replies have producers, so only those switches exist. |
| **Guest checkout** | Placing an order requires a signed-in account. |

### What PymesHub does not do

- **It does not sell the products.** The business sells them; PymesHub is the software in between.
- **It does not provide the transport.** Couriers are independent accounts, not employees.
- **It does not handle the customer's money.** The customer pays the business for the products and the courier for the delivery, so there is no payment gateway in the flow — and there is no settlement run, because there is nothing to settle.
- **It does not charge a commission per order.**
- **It does not serve markets other than Costa Rica today.** The delivery pricing policy is defined for the Costa Rican market (`CR`) only.
- **It does not combine several businesses in one cart.** One cart belongs to one business, on purpose.
- **It does not let a courier assign orders to themselves**, and a business cannot add an arbitrary account as a courier.
- **It does not change a business's currency.** The currency is fixed when the business is created.
- **It is not for children.** Accounts are for people 18 or older.

### Devices, connectivity, and what happens without a network

| Situation | What to expect |
| --- | --- |
| No network, or airplane mode | Orders cannot be placed and the order board cannot be worked. The mobile app keeps the last thing you were looking at on screen, and a courier's most recent position is held on the device to be sent again when the connection returns — no route history is stored on the phone. |
| A slow connection | An active order updates on its own and the screen **stops asking** once the order reaches a final state, so a slow link costs less than a page that refreshes forever. |
| Background location | Used only on a courier's device, only during an order that is assigned and in progress. It stops when the run ends, when the order is reassigned, when the courier signs out, or when the permission is withdrawn. Android shows a persistent notification while it is running. |
| Notifications | Push needs permission and a reachable device. Missing one never loses an order: the app shows the state the order is actually in. |
| Desktop | Windows only today. |
| Screen size | Built for phones first; the storefront and the web dashboard adapt to tablet and desktop widths. |

### What each plan turns on

| Feature | Where it starts |
| --- | --- |
| Inventory tracking | `STARTER` and above |
| Branches | one on `FREE`, `EMPRENDE` and `STARTER`; two on `GROWTH`; five on `BUSINESS` |
| Staff accounts | one on `FREE`, up to fifteen on `BUSINESS` |
| Products | fifteen on `FREE`, up to one thousand on `BUSINESS` |
| Active promotions | none on `FREE`, up to twenty-five on `BUSINESS` |
| Express orders per day | ten on `FREE`, unlimited on `BUSINESS` |
| Analytics window | thirty days on `FREE`, up to three years on `GROWTH` and `BUSINESS` |
| Storage | 150 MB on `FREE`, up to 10 GB on `BUSINESS` |

Taking and advancing orders, shop hours, pausing a branch, reviews in both directions, seeing billing, and deleting the account are **never limited by a plan**.

### Accessibility

- **Light and dark themes**, with the storefront defaulting to light and the application tree defaulting to dark, and a stated preference always winning.
- **Large text** is respected, and contrast was corrected for it.
- **Reduced motion** is honoured rather than merely detected.
- Controls carry **labels for screen readers**, and status is not carried by colour alone.
- Accessibility questions and reports: **accesibilidad@pymeshub.lat**.

### Updates, and how a change reaches you

- **Web:** nothing to install. A fix reaches everyone at the same moment.
- **Mobile:** through the App Store and Google Play, plus over-the-air updates for the parts that can move without a store review.
- **Desktop:** the Windows application can update itself.
- A mobile build can lag the web by a release. Where a change is transport-level it is protected on the server, so an older app does not break while it waits for its update.

### Support, availability and limits

- **You are not on your own, but there is no ticket desk with a contract behind it during beta.** Help arrives by email and inside the app; the operations page explains the channels, the priority levels and what is excluded.
- **No numeric uptime target is published.** We aim to keep the service available and to tell you about planned maintenance in advance, and we do not publish a percentage we cannot stand behind.
- **Security fixes apply to the current version only.** There is no long-term support for older releases; the security page lists the response targets for reports.
- **Data handling is described in the data and privacy page**, including what is kept after an account is deleted.

### What this page does not claim

- It is a product inventory, not a roadmap. Something being absent here does not mean it is planned; something being present does not mean it is enabled.
- Availability of a platform does not guarantee any particular feature inside it — a build can lag by a release, and the web app updates first.
- This page does not replace the Legal Center documents or the security policy.

---

## Español

**Una página, un propósito: decir con claridad qué funciona hoy, qué existe pero está apagado y qué PymesHub no hace en absoluto.** Cuando algo no está soportado lo decimos, en vez de dejarlo ambiguo.

### Dónde corre PymesHub

| Superficie | Soportado hoy |
| --- | --- |
| **Web** — tienda y panel del negocio, en **pymeshub.lat** | Versiones actuales de Chrome, Edge, Safari y Firefox en escritorio y móvil. Necesita JavaScript y cookies para iniciar sesión. |
| **iOS** | La versión actual de la app en el App Store. |
| **Android** | La versión actual en Google Play, más compilaciones internas de vista previa usadas para pruebas de campo. |
| **Escritorio** | Una aplicación de Windows, construida sobre Tauri 2. |
| Versiones anteriores de la app, compilaciones viejas y la aplicación retirada que quedó en el repositorio | **No soportadas.** Solo se mantienen el sitio de producción actual y las versiones vigentes de las tiendas. |

La API con la que hablan todas es un solo servicio, así que el pedido que un cliente ve en el navegador es la misma fila que ve su teléfono.

### Idiomas y configuración regional

- **El español (`es`) es el idioma por defecto** y el **inglés (`en`)** está disponible en toda la aplicación. Son los dos idiomas que el producto ofrece: hoy no hay un tercero.
- La tienda sigue el idioma que elegiste y lo recuerda.
- Las fechas, el dinero y los horarios se muestran para Costa Rica (con la zona horaria del país), y los precios están en **colones (CRC)**.
- Los documentos legales se publican en el idioma que ofrece el Centro Legal; este centro de documentación publica sus páginas de producto en español e inglés dentro del mismo documento.

### Qué soporta el producto

| Área | Soportado |
| --- | --- |
| Modelo de marketplace | El cliente pide a un negocio; retiro en el local o entrega por un repartidor. |
| Pagos | **Efectivo contra entrega** y **SINPE Móvil**. |
| Precios | Suscripción de tarifa fija para el negocio, en colones, con IVA incluido. Sin comisión por pedido. |
| Planes | `FREE` (permanente, nunca se cobra) más cuatro niveles pagos, mensual o anual. |
| Formas de entrega | Estándar y **express**, donde el plan lo permite. |
| Catálogo | Productos con grupos de opciones, opciones, imágenes, stock (control de inventario donde el plan lo incluye), descuentos y promociones. |
| Equipo | Dueños, encargados, staff y repartidores, con permisos definidos. |
| Repartidores | Perfiles verificados invitados por un negocio; ofertas, seguimiento en vivo, calificaciones en las dos direcciones. |
| Reseñas | Una reseña por pedido, y en una entrega, en ambas direcciones. |
| Analítica | Reportes del negocio con una ventana de consulta que depende del plan. |
| Accesibilidad | Texto grande, movimiento reducido, temas claro y oscuro, etiquetas para lectores de pantalla. |
| Idiomas | Español e inglés. |
| Reporte de seguridad | Un canal privado para reportar vulnerabilidades — ver la página de seguridad. |

### Qué existe pero está apagado

Esto está en el diseño del producto pero **deliberadamente no habilitado**. Va listado para que nadie lo prometa por accidente:

| No habilitado | Por qué |
| --- | --- |
| **Pago con tarjeta** | `CARD` existe junto al efectivo y SINPE, y la plataforma lo rechaza en vez de aceptar un pedido que no puede liquidar. Hoy no hay procesamiento de tarjetas en línea en el marketplace. |
| **Descuentos de entrega por cercanía y por pedido listo** | El modelo de precios los contempla y todos están en cero: un descuento que depende de una señal de repartidor que todavía no tenemos no debe inferirse en el checkout. |
| **Recargos dinámicos y tope máximo de precio al cliente** | Están en los términos de precios, configurados como deshabilitados. |
| **Seguimiento del tiempo de preparación como señal de orden** | Está documentado y todavía no se alimenta con datos. |
| **Avisos de novedades de productos** | Solo las novedades de pedido y las respuestas a reseñas tienen quién las genere, así que solo esos interruptores existen. |
| **Compra sin cuenta** | Hacer un pedido requiere una cuenta con sesión iniciada. |

### Qué no hace PymesHub

- **No vende los productos.** Los vende el negocio; PymesHub es el software en el medio.
- **No presta el transporte.** Los repartidores son cuentas independientes, no empleados.
- **No toca el dinero del cliente.** El cliente le paga al negocio por los productos y al repartidor por la entrega, así que no hay pasarela de pago en el flujo — y no hay corrida de liquidación, porque no hay nada que liquidar.
- **No cobra comisión por pedido.**
- **Hoy no atiende mercados fuera de Costa Rica.** La política de precios de entrega está definida solo para el mercado costarricense (`CR`).
- **No combina varios negocios en un carrito.** Un carrito pertenece a un negocio, a propósito.
- **No permite que un repartidor se asigne pedidos a sí mismo**, ni que un negocio agregue una cuenta arbitraria como repartidor.
- **No cambia la moneda de un negocio.** La moneda queda fija cuando se crea el negocio.
- **No es para menores.** Las cuentas son para personas de 18 años o más.

### Dispositivos, conexión y qué pasa sin red

| Situación | Qué esperar |
| --- | --- |
| Sin red, o modo avión | No se puede hacer pedidos ni trabajar el tablero de pedidos. La app móvil mantiene en pantalla lo último que estabas viendo, y la última posición de un repartidor queda en el dispositivo para reenviarla cuando vuelva la conexión — no se guarda un historial de ruta en el teléfono. |
| Conexión lenta | Un pedido activo se actualiza solo y la pantalla **deja de preguntar** cuando el pedido llega a un estado final, así que una conexión lenta cuesta menos que una página que se refresca para siempre. |
| Ubicación en segundo plano | Se usa solo en el dispositivo de un repartidor, y solo durante un pedido asignado y en curso. Se detiene cuando el viaje termina, cuando el pedido se reasigna, cuando el repartidor cierra sesión o cuando se retira el permiso. Android muestra una notificación persistente mientras está activa. |
| Notificaciones | El push necesita permiso y un dispositivo alcanzable. Perder una nunca hace perder un pedido: la app muestra el estado en el que el pedido realmente está. |
| Escritorio | Solo Windows por ahora. |
| Tamaño de pantalla | Diseñado primero para teléfono; la tienda y el panel web se adaptan a tableta y escritorio. |

### Qué habilita cada plan

| Función | Dónde empieza |
| --- | --- |
| Control de inventario | `STARTER` y superiores |
| Sucursales | una en `FREE`, `EMPRENDE` y `STARTER`; dos en `GROWTH`; cinco en `BUSINESS` |
| Cuentas de staff | una en `FREE`, hasta quince en `BUSINESS` |
| Productos | quince en `FREE`, hasta mil en `BUSINESS` |
| Promociones activas | ninguna en `FREE`, hasta veinticinco en `BUSINESS` |
| Pedidos express por día | diez en `FREE`, sin límite en `BUSINESS` |
| Ventana de analítica | treinta días en `FREE`, hasta tres años en `GROWTH` y `BUSINESS` |
| Almacenamiento | 150 MB en `FREE`, hasta 10 GB en `BUSINESS` |

Tomar y avanzar pedidos, horarios, pausar una sucursal, reseñas en ambas direcciones, ver la facturación y eliminar la cuenta **nunca se limitan por plan**.

### Accesibilidad

- **Temas claro y oscuro**, con la tienda en claro por defecto y el árbol de la aplicación en oscuro por defecto, y una preferencia declarada siempre gana.
- **Texto grande** se respeta, y el contraste se corrigió para eso.
- **Movimiento reducido** se honra, no solo se detecta.
- Los controles llevan **etiquetas para lectores de pantalla**, y el estado no se transmite solo por color.
- Dudas y reportes de accesibilidad: **accesibilidad@pymeshub.lat**.

### Actualizaciones y cómo te llega un cambio

- **Web:** no hay nada que instalar. Una corrección llega a todos en el mismo momento.
- **Móvil:** por App Store y Google Play, más actualizaciones al aire para las partes que pueden moverse sin revisión de tienda.
- **Escritorio:** la aplicación de Windows puede actualizarse sola.
- Una versión móvil puede ir un lanzamiento atrás de la web. Cuando un cambio es de nivel de transporte, se protege del lado del servidor, así que una app vieja no se rompe mientras espera su actualización.

### Soporte, disponibilidad y límites

- **No estás solo, pero durante la beta no hay una mesa de tickets con un contrato detrás.** La ayuda llega por correo y dentro de la aplicación; la página de operación explica los canales, las prioridades y lo que queda excluido.
- **No se publica un objetivo numérico de disponibilidad.** Buscamos mantener el servicio disponible y avisarte los mantenimientos programados con antelación, y no publicamos un porcentaje que no podamos sostener.
- **Las correcciones de seguridad aplican solo a la versión actual.** No hay soporte de largo plazo para versiones anteriores; la página de seguridad lista los plazos objetivo para reportes.
- **El tratamiento de datos está descrito en la página de datos y privacidad**, incluido qué se conserva después de eliminar una cuenta.

### Lo que esta página no afirma

- Es un inventario del producto, no una hoja de ruta. Que algo no esté acá no significa que esté planificado; que algo esté, no significa que esté habilitado.
- Que una plataforma esté soportada no garantiza una función concreta dentro de ella: una versión puede ir un lanzamiento atrás, y la web se actualiza primero.
- Esta página no reemplaza los documentos del Centro Legal ni la política de seguridad.
