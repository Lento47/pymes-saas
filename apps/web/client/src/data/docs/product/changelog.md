# PymesHub — Changelog

- [English](#english)
- [Español](#espanol)

---

## English

**What changed in PymesHub, when, and in the words of the person using it.** This page adds **public information only**: it lists changes anyone can see in the product, and it deliberately leaves out internal work, private customer details, and any security fix that has not been published yet.

### How this page works

- **Public information only.** If a change cannot be seen, read or felt by a customer, a business or a courier, it does not belong here. Internal refactors, infrastructure work and undisclosed security fixes are not listed.
- **User-facing wording.** Every entry describes what changed for a person using PymesHub, not what changed in the code.
- **Security fixes have their own place.** Fixes for reported vulnerabilities are published on the [security advisories](/documentation/security-advisories) page, and only once a fix is available.
- **Newest first.** Dates are the dates the change became available in the product.

### How the product is versioned

- The product carries a version tag when a milestone is published. So far there is one: **`pymeshub-v1.0.0`**, published on **22 April 2026**, together with the first desktop release (`desktop-enterprise-v1.0.0`, and `desktop-enterprise-v1.0.1` the same day).
- Between tags the product moves **continuously**: the web application is updated as changes ship, and the mobile applications follow on their store release cycle. A build can therefore lag the web by a release.
- A **major version** marks a milestone of the marketplace itself, not a cosmetic change. Because the product is in beta, features can still be adjusted between versions, and the [software policy](/documentation/software-policy) explains what that means.

### October 2026

**Merchant customization**
- A business can now personalize its storefront: brand colours, layout and cover, with a live preview of the shop header, and the choices stay readable in both light and dark themes and at large text sizes.
- Merchant navigation and dashboards were simplified: minimal by default, extra shortcuts folded away, fixed slots for the everyday operations, and a first-visit guide for shops that have not finished setting up.
- Shops gained their own **product categories**, managed from the merchant side.

**Payments between the three sides**
- Business and courier payments are now shown and handled **separately**, with cash advances verified instead of assumed.
- SINPE receipts accept the correct image formats again, and checkout now checks that the chosen payment method is actually available before taking the order.
- The merchant order header shows the business's product payment on its own.

**Delivery and pricing**
- **A delivery destination pin is required before checkout**, so a courier is never sent to an address without coordinates.
- Express tariffs were centralized in one place, and setting an agreed delivery fee is restricted to the **BUSINESS** plan.
- Fixed several dispatch issues around express pricing, ready-to-dispatch runs, road routes and delivery identities, including the daily express quota.

**Accessibility and feel**
- Reduced-motion is respected, large-text contrast was corrected, and the shop status icons were made readable at every size.
- Tap feedback was softened, navigation capsules shrink gently as you scroll, and tab highlights were made full width and rounded.
- Various fixes: merchant profile labels wrapping instead of clipping, the account menu separating customer account from courier and merchant profiles, and success feedback that does not overstay.

### September 2026

**The marketplace foundation**
- **The mobile application became part of the product.** Onboarding, home, shop, cart, orders and account flows, with a theme that works in dark mode.
- **The storefront was rebuilt in blocks**, with a light ground by default (dark still available), a category index drawn as sectors with their contents, and real paging in lists.
- **Sign-up now records consent**: creating an account requires confirming both the terms and the age, and both are written down.
- **A support desk exists in the product**: a business can raise a ticket, read the thread, answer and close it.
- **Couriers gained a directory card** as a business sees them, and dispatch opened to a **wider pool of verified couriers**.
- **A platform console** was added for administration and billing surfaces that had no screen before.
- **Promotions gained a picture** and a clearer state on their card.
- Numerous merchant-screen improvements: merchant themes and dark mode, an icon-only tab bar, a shortcut carousel in the header, an attention badge on the inbox bell, and rebuilt product creation.

### April to August 2026

- **`pymeshub-v1.0.0` was published on 22 April 2026**, the first tagged release of the product, along with the first desktop builds.
- The months around that tag were spent on the **earlier stage of PymesHub**, a different product from today's marketplace. This page does not itemize those features, because they no longer exist in the marketplace — listing them would describe something a reader cannot find. The public pages in this center describe what the product is now.

### Not listed here

- Internal work with no visible effect.
- Security fixes before they are published; those go to the [security advisories](/documentation/security-advisories) page.
- Anything specific to a single customer, business or account, including their data, contracts or support threads.
- Infrastructure, provider and pricing-policy changes that are announced through their own documents.

### What this page does not claim

- It is a summary for readers, not an exhaustive commit history, and it is not a roadmap: something not being listed does not mean it is not planned, and something listed is not a promise that it will stay unchanged during the beta.
- Dates are calendar dates of publication in the product; a mobile release can reach stores later than the change was announced.
- Where this page and a published policy disagree about what the product does, the policy and the product itself govern.

---

## Español

**Qué cambió en PymesHub, cuándo, y en las palabras de quien lo usa.** Esta página agrega **solo información pública**: lista cambios que cualquiera puede ver en el producto y deja afuera a propósito el trabajo interno, los detalles privados de clientes y cualquier corrección de seguridad que todavía no se publicó.

### Cómo funciona esta página

- **Solo información pública.** Si un cambio no lo puede ver, leer o sentir un cliente, un negocio o un repartidor, no va acá. Refactors internos, trabajo de infraestructura y correcciones de seguridad sin divulgar no se listan.
- **Redacción para el usuario.** Cada entrada describe qué cambió para una persona que usa PymesHub, no qué cambió en el código.
- **Las correcciones de seguridad tienen su lugar.** Las correcciones de vulnerabilidades reportadas se publican en la página de [avisos de seguridad](/documentation/security-advisories), y solo cuando hay una corrección disponible.
- **Lo más nuevo primero.** Las fechas son las fechas en que el cambio quedó disponible en el producto.

### Cómo se versiona el producto

- El producto lleva una etiqueta de versión cuando se publica un hito. Hasta ahora hay una: **`pymeshub-v1.0.0`**, publicada el **22 de abril de 2026**, junto con el primer lanzamiento de escritorio (`desktop-enterprise-v1.0.0`, y `desktop-enterprise-v1.0.1` el mismo día).
- Entre etiquetas el producto avanza **de forma continua**: la aplicación web se actualiza a medida que los cambios salen, y las aplicaciones móviles siguen su ciclo de publicación en tienda. Una versión puede ir un lanzamiento atrás de la web.
- Una **versión mayor** marca un hito del marketplace en sí, no un cambio cosmético. Como el producto está en beta, las funciones todavía pueden ajustarse entre versiones, y la [política de software](/documentation/software-policy) explica qué significa eso.

### Octubre 2026

**Personalización del comerciante**
- Un negocio ahora puede personalizar su tienda: colores de marca, diseño y portada, con vista previa del encabezado, y las elecciones siguen siendo legibles en tema claro y oscuro y con texto grande.
- Se simplificaron la navegación y los tableros del comerciante: minimalistas por defecto, atajos extra plegados, lugares fijos para la operación diaria y una guía de primera visita para los negocios que no terminaron de configurarse.
- Los negocios ganaron sus propias **categorías de productos**, administradas desde el lado del comerciante.

**Pagos entre las tres partes**
- Los pagos al negocio y al repartidor ahora se muestran y se manejan **por separado**, con los adelantos en efectivo verificados en vez de asumidos.
- Los comprobantes SINPE vuelven a aceptar los formatos de imagen correctos, y el checkout verifica que el método de pago elegido esté realmente disponible antes de tomar el pedido.
- El encabezado del pedido en el panel del comerciante muestra el pago del negocio por su lado.

**Entrega y precios**
- **Se exige un pin de destino antes del checkout**, para que un repartidor no salga a una dirección sin coordenadas.
- Las tarifas express se centralizaron en un solo lugar, y fijar un costo de entrega acordado quedó restringido al plan **BUSINESS**.
- Se corrigieron varios temas de despacho alrededor del precio express, los pedidos listos para despachar, las rutas por calle y las identidades de entrega, incluida la cuota diaria de express.

**Accesibilidad y sensación**
- Se respeta el movimiento reducido, se corrigió el contraste con texto grande y los íconos de estado de la tienda quedaron legibles en todos los tamaños.
- El feedback al tocar se suavizó, las cápsulas de navegación se encogen despacio al bajar y los resaltados de pestaña quedaron a ancho completo y con bordes redondeados.
- Varios arreglos: etiquetas del perfil del comerciante que se envuelven en vez de recortarse, el menú de cuenta que separa la cuenta de cliente de los perfiles de repartidor y comerciante, y avisos de éxito que ya no se quedan de más.

### Septiembre 2026

**La base del marketplace**
- **La aplicación móvil pasó a ser parte del producto.** Flujos de alta, inicio, tienda, carrito, pedidos y cuenta, con un tema que funciona en modo oscuro.
- **La tienda se reconstruyó en bloques**, con fondo claro por defecto (oscuro sigue disponible), un índice de categorías dibujado como sectores con su contenido, y paginación real en las listas.
- **El registro ahora deja constancia del consentimiento**: crear una cuenta exige confirmar tanto los términos como la edad, y las dos cosas se escriben.
- **Existe una mesa de soporte dentro del producto**: un negocio puede abrir un caso, leer el hilo, responder y cerrarlo.
- **Los repartidores ganaron una tarjeta de directorio** tal como los ve un negocio, y el despacho se abrió a un **grupo más amplio de repartidores verificados**.
- **Se agregó una consola de plataforma** para superficies de administración y facturación que antes no tenían pantalla.
- **Las promociones ganaron una imagen** y un estado más claro en su tarjeta.
- Muchas mejoras en las pantallas del comerciante: temas y modo oscuro, barra de pestañas solo con íconos, carrusel de atajos en el encabezado, insignia de pendientes en la campana de la bandeja y creación de productos reconstruida.

### Abril a agosto 2026

- **`pymeshub-v1.0.0` se publicó el 22 de abril de 2026**, el primer lanzamiento etiquetado del producto, junto con las primeras versiones de escritorio.
- Los meses alrededor de esa etiqueta se dedicaron a la **etapa anterior de PymesHub**, un producto distinto del marketplace actual. Esta página no detalla esas funciones, porque ya no existen en el marketplace: listarlas describiría algo que quien lee no puede encontrar. Las páginas públicas de este centro describen lo que el producto es hoy.

### Lo que no se lista acá

- Trabajo interno sin efecto visible.
- Correcciones de seguridad antes de publicarse; esas van a la página de [avisos de seguridad](/documentation/security-advisories).
- Cualquier cosa específica de un solo cliente, negocio o cuenta, incluidos sus datos, contratos o hilos de soporte.
- Cambios de infraestructura, de proveedores y de política de precios, que se anuncian por sus propios documentos.

### Lo que esta página no afirma

- Es un resumen para quien lee, no un historial exhaustivo de commits, y no es una hoja de ruta: que algo no esté listado no significa que no esté planificado, y que algo esté listado no es una promesa de que quede igual durante la beta.
- Las fechas son fechas de calendario de publicación en el producto; una versión móvil puede llegar a las tiendas más tarde de lo que se anunció el cambio.
- Donde esta página y una política publicada difieran sobre lo que hace el producto, mandan la política y el producto mismo.
