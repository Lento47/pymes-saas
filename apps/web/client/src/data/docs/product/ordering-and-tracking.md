# PymesHub — Ordering, paying and tracking

- [English](#english)
- [Español](#espanol)

---

## English

**How a customer places an order, pays for it, follows it, and closes it out.** This page describes the rules the API enforces, not a screenshot tour. Every number and state name below is the name the code uses.

### The cart

- **One cart belongs to one business.** Adding a product from a different business never merges the two: the call either refuses or asks to replace the existing cart, and the answer says which (`replacedCart`).
- A line holds at most **20 units** (`MAX_LINE_QUANTITY`) and a cart at most **40 lines** (`MAX_CART_LINES`). Quantity is capped rather than refused, so holding "+" past the limit stops at the limit instead of erroring.
- Options are chosen **by id, not by name**, so renaming or repricing an option cannot silently repoint an existing order. A line can also carry a **note of up to 300 characters**.
- **Totals are returned by the server, not computed by the client**, and they are the same numbers checkout stores. A cart that is below the business's minimum reports what is still missing (`missingForMinOrderMinor`).
- A product that went out of stock while it sat in the cart comes back with a reason (`unavailableReason`) instead of disappearing.
- A promo code is applied to the cart and **re-sent at checkout** so the discount is evaluated against a fresh read. A refused code is a field on a live cart (`promotionError`), not a failed request; the reasons are a closed set — not found, inactive, not yet valid, expired, exhausted, below minimum.
- Cart statuses: `OPEN`, `CHECKED_OUT`, `ABANDONED`.

Source: `packages/shared/src/schemas/cart.ts`.

### Checkout

`PENDING` is reached through `orders.place`, which takes the **fulfilment mode** (`PICKUP` or `DELIVERY`), the branch (`locationId`) and address (`addressId`) when needed, the **speed** (`STANDARD` or `EXPRESS`), the **payment method**, an optional tip, an optional note of up to 500 characters, the promo code, and a `clientRequestId`.

- The request carries **no prices and no totals**. Everything that decides the amount is read server-side from the cart; `expectedTotalMinor` exists only to refuse an order whose total moved underneath the customer, never to price it.
- `clientRequestId` is idempotency: a double-tapped "pay" must not create two orders.
- A delivery at a road-priced shop carries a **quote id** that binds the accepted price to the actual route. A quote is valid for **2 minutes**.
- `DELIVERY` requires an address; `PICKUP` refuses one.
- Waiters are separate axes: what the customer does with the goods (`FULFILMENT_KINDS`) and how fast they want it (`DELIVERY_SPEEDS`). `STANDARD` is the default on the wire, so an order placed before the column existed is not read as express.

### Why checkout can refuse an order

A refusal here is a `ValidationError` with a **message key**, not a fault of the platform. The set is closed:

| Key | What it means |
| --- | --- |
| `checkout.businessClosed` | Past the shop's hours, a paused branch, or one offline — all "come back later" |
| `checkout.refusal.shopInactive` | The shop is suspended, which is not about the hour |
| `checkout.refusal.locationNotFound` | No branch this shop can take the order at |
| `checkout.refusal.addressNotFound` | The chosen address is not the caller's |
| `checkout.refusal.addressPinRequired` | A delivery needs a map pin |
| `checkout.refusal.deliveryQuoteUnavailable` | The route could not be quoted |
| `checkout.refusal.emptyCart` | Nothing to order |
| `checkout.refusal.minOrder` | Below the business's minimum |
| `checkout.refusal.totalChanged` | The total moved after the customer saw it |
| `checkout.refusal.paymentUnavailable` | The chosen payment method is not available |

The status code cannot carry the reason: every refusal on this list is the generic `BAD_REQUEST`, so only the message tells them apart.

Source: `packages/shared/src/schemas/cart.ts` (`CHECKOUT_REFUSAL_KEYS`).

### Paying for the order

Payment is a **separate axis from fulfilment**, deliberately: cash on delivery means an order that is completed and paid in the same instant, while a SINPE transfer is often paid before the business has accepted. Enabled methods are `CASH` and `SINPE_MOVIL`; `CARD` is in the data model and **not enabled**, so a card order is refused by the API rather than accepted and left to fail.

A delivery order is not one payment but **three**, and which ones exist is arithmetic:

| Payment | Payer | Payee | Amount |
| --- | --- | --- | --- |
| `MERCHANT_ORDER` | The customer (or the courier, on cash on delivery) | The business | The order total minus the courier's charge |
| `COURIER_COLLECTION` | The customer | The courier | The delivery fee — or the whole order total on cash on delivery |
| `MERCHANT_DELIVERY` | The business | The courier | The difference, when the business's courier fee is more than the customer paid |

- On a **cash-on-delivery** order the courier **collects the whole total at the door** and settles the business's part with the business.
- **The tip belongs to the business**, not to the courier: the courier's charge is the delivery fee alone.
- A SINPE payment needs a destination account — the business's or the courier's — stored as a Costa Rican phone number (8 digits, `+506`) plus the recipient's name.
- Each payment carries a **version**; a write made against a stale version is refused (`payments.refusal.changed`), which is what stops two devices from settling the same payment twice.
- Payment review states: `AWAITING_PAYMENT` → `AWAITING_VERIFICATION` → `CONFIRMED`, or `REJECTED`, or `NOT_REQUIRED`.

A refused payment is also a closed set of keys (cancelled order, waiting on the merchant, changed, method locked, no SINPE account, bad image, reused proof, missing reason, business unpaid, collection unpaid).

Source: `packages/shared/src/schemas/order-payment.ts`, `packages/trpc-api/src/services/order-payments.ts`.

### Following the order

Statuses: `PENDING → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → COMPLETED`, plus the terminal `CANCELLED` and `REJECTED`.

- **Every status change is an event.** The event log is append-only and the order's status is a cached read of its last entry, so the customer's tracker, the business's board and an admin's dispute investigation read the same log.
- The tracker is a **subset** of the machine on purpose: a pickup shows no delivery leg, and a refusal is not the sixth step of a happy path — the timeline collapses to `PENDING` and the status that ended it.
- While a delivery is running, tracking exposes the courier's **position, accuracy, heading and speed**, plus `estimatedReadyAt` and `estimatedDeliveryAt`. The server keeps only the newest position for the active run.
- A status change is legal only for the actor it belongs to (customer, business, courier, admin, system). "Customer marks an order ready" is not a missing permission — it is a state the machine does not have.
- The order **snapshots the product**: name, unit price and chosen options are frozen at checkout, so a price rise tomorrow does not change yesterday's receipt, and deleting a product does not empty an old order.

Source: `packages/shared/src/order-state.ts`, `packages/shared/src/schemas/order.ts`.

### Cancelling

Where the customer's own cancel stops is part of the state machine, not a policy paragraph:

| Order status | Who may cancel |
| --- | --- |
| `PENDING` | The customer or an admin |
| `ACCEPTED` | The customer, the business or an admin |
| `PREPARING` | The business or an admin — the goods are being made |
| `READY` | The business or an admin |
| `OUT_FOR_DELIVERY` | An admin only |

A cancellation or rejection can carry a reason, which is what the customer is told.

Source: `packages/shared/src/order-state.ts` (`TRANSITIONS`).

### After the order

- **One review per order**, enforced by a unique index rather than a check: 1–5 stars, a comment of up to 1 000 characters, and up to 4 images. The business may reply once, in up to 1 000 characters. A review shows a display name only — never the reviewer's email or phone.
- **Reorder is additive, not idempotent**: calling it twice adds the quantities twice. A line that cannot come back is named, with a closed reason: the product is unavailable, its options are unavailable, or the cart has no room. A line can also come back short without being listed as skipped, because two caps truncate rather than refuse (`MAX_LINE_QUANTITY` and the merge into an existing line).

Source: `packages/shared/src/schemas/order.ts`.

### Related pages

- [PymesHub: product overview](/documentation/product-overview)
- [Selling on PymesHub](/documentation/selling-on-pymeshub)
- [Delivering on PymesHub](/documentation/delivering-on-pymeshub)
- [Finding shops: search, categories and the "best" order](/documentation/how-discovery-and-ranking-work)

### What this page does not claim

- It describes the checkout, payment and tracking rules as the repository writes them; it is not a statement that every flow is verified in production.
- No card payment is offered.
- Fees are quoted per route at checkout; the platform takes no share of the order.

---

## Español

**Cómo un cliente hace un pedido, lo paga, lo sigue y lo cierra.** Esta página describe las reglas que aplica la API, no un recorrido de pantallas. Cada número y cada nombre de estado de abajo es el nombre que usa el código.

### El carrito

- **Un carrito pertenece a un solo negocio.** Agregar un producto de otro negocio nunca mezcla los dos: la llamada rechaza o pide reemplazar el carrito existente, y la respuesta dice cuál de las dos cosas pasó (`replacedCart`).
- Una línea lleva como máximo **20 unidades** (`MAX_LINE_QUANTITY`) y un carrito como máximo **40 líneas** (`MAX_CART_LINES`). La cantidad se topea en vez de rechazarse: mantener "+" pasado el límite se detiene en el límite, no da error.
- Las opciones se eligen **por id, no por nombre**, para que renombrar o cambiar el precio de una opción no repunte en silencio un pedido existente. Una línea puede llevar además una **nota de hasta 300 caracteres**.
- **Los totales los devuelve el servidor, no los calcula el cliente**, y son los mismos números que el checkout guarda. Un carrito por debajo del mínimo del negocio reporta cuánto falta (`missingForMinOrderMinor`).
- Un producto que se agotó mientras estaba en el carrito vuelve con un motivo (`unavailableReason`) en vez de desaparecer.
- Un código de promoción se aplica al carrito y **se reenvía en el checkout** para evaluar el descuento contra una lectura fresca. Un código rechazado es un campo sobre un carrito vivo (`promotionError`), no una petición fallida; los motivos son un conjunto cerrado: no encontrado, inactivo, aún no válido, vencido, agotado, por debajo del mínimo.
- Estados del carrito: `OPEN`, `CHECKED_OUT`, `ABANDONED`.

Fuente: `packages/shared/src/schemas/cart.ts`.

### El checkout

Se llega a `PENDING` por `orders.place`, que recibe la **forma de entrega** (`PICKUP` o `DELIVERY`), la sucursal (`locationId`) y la dirección (`addressId`) cuando hacen falta, la **velocidad** (`STANDARD` o `EXPRESS`), el **método de pago**, una propina opcional, una nota opcional de hasta 500 caracteres, el código de promoción y un `clientRequestId`.

- La petición **no lleva precios ni totales**. Todo lo que decide el monto se lee en el servidor desde el carrito; `expectedTotalMinor` existe solo para rechazar un pedido cuyo total se movió debajo del cliente, nunca para ponerle precio.
- `clientRequestId` es idempotencia: un doble toque en "pagar" no debe crear dos pedidos.
- Una entrega en un negocio con precio por ruta lleva un **id de cotización** que ata el precio aceptado a la ruta real. Una cotización vale **2 minutos**.
- `DELIVERY` exige una dirección; `PICKUP` la rechaza.
- Son ejes distintos qué hace el cliente con lo que compra (`FULFILMENT_KINDS`) y qué tan rápido lo quiere (`DELIVERY_SPEEDS`). `STANDARD` es el valor por defecto en el cable, así que un pedido anterior a esa columna no se lee como express.

### Por qué el checkout puede rechazar un pedido

Un rechazo aquí es un `ValidationError` con una **clave de mensaje**, no una falla de la plataforma. El conjunto es cerrado:

| Clave | Qué significa |
| --- | --- |
| `checkout.businessClosed` | Fuera del horario, sucursal en pausa o desconectada — todo es "volvé después" |
| `checkout.refusal.shopInactive` | El negocio está suspendido, y eso no es cuestión de hora |
| `checkout.refusal.locationNotFound` | Ninguna sucursal de este negocio puede tomar el pedido |
| `checkout.refusal.addressNotFound` | La dirección elegida no es del solicitante |
| `checkout.refusal.addressPinRequired` | Una entrega necesita pin en el mapa |
| `checkout.refusal.deliveryQuoteUnavailable` | No se pudo cotizar la ruta |
| `checkout.refusal.emptyCart` | No hay nada que pedir |
| `checkout.refusal.minOrder` | Por debajo del mínimo del negocio |
| `checkout.refusal.totalChanged` | El total se movió después de que el cliente lo vio |
| `checkout.refusal.paymentUnavailable` | El método de pago elegido no está disponible |

El código de estado no puede llevar el motivo: todos los rechazos de esta lista son el genérico `BAD_REQUEST`, así que solo el mensaje los distingue.

Fuente: `packages/shared/src/schemas/cart.ts` (`CHECKOUT_REFUSAL_KEYS`).

### Pagar el pedido

El pago es un **eje aparte de la entrega**, a propósito: efectivo contra entrega significa un pedido completado y pagado en el mismo instante, mientras que una transferencia SINPE muchas veces se paga antes de que el negocio acepte. Los métodos habilitados son `CASH` y `SINPE_MOVIL`; `CARD` está en el modelo de datos y **no está habilitado**, así que un pedido con tarjeta lo rechaza la API en vez de aceptarlo y dejarlo fallar.

Un pedido a domicilio no es un pago sino **tres**, y cuáles existen es aritmética:

| Pago | Quién paga | Quién cobra | Monto |
| --- | --- | --- | --- |
| `MERCHANT_ORDER` | El cliente (o el repartidor, con efectivo contra entrega) | El negocio | El total del pedido menos el cobro del repartidor |
| `COURIER_COLLECTION` | El cliente | El repartidor | El costo de la entrega — o el total completo con efectivo contra entrega |
| `MERCHANT_DELIVERY` | El negocio | El repartidor | La diferencia, cuando el costo de reparto del negocio supera lo que pagó el cliente |

- Con **efectivo contra entrega**, el repartidor **cobra el total completo en la puerta** y liquida con el negocio la parte que le toca.
- **La propina es del negocio**, no del repartidor: el cobro del repartidor es solo el costo de la entrega.
- Un pago por SINPE necesita una cuenta destino — la del negocio o la del repartidor — guardada como teléfono costarricense (8 dígitos, `+506`) más el nombre de quien recibe.
- Cada pago lleva una **versión**; una escritura hecha contra una versión vieja se rechaza (`payments.refusal.changed`), y eso es lo que evita que dos dispositivos liquiden dos veces el mismo pago.
- Estados de revisión del pago: `AWAITING_PAYMENT` → `AWAITING_VERIFICATION` → `CONFIRMED`, o `REJECTED`, o `NOT_REQUIRED`.

Un pago rechazado también es un conjunto cerrado de claves (pedido cancelado, esperando al negocio, cambió, método bloqueado, sin cuenta SINPE, imagen inválida, comprobante reutilizado, falta el motivo, negocio sin pagar, cobro sin pagar).

Fuente: `packages/shared/src/schemas/order-payment.ts`, `packages/trpc-api/src/services/order-payments.ts`.

### Seguir el pedido

Estados: `PENDING → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → COMPLETED`, más los terminales `CANCELLED` y `REJECTED`.

- **Cada cambio de estado es un evento.** El registro de eventos es de solo agregar y el estado del pedido es una lectura cacheada de su última entrada, así que el rastreador del cliente, el tablero del negocio y la investigación de un reclamo por un admin leen el mismo registro.
- El rastreador es un **subconjunto** de la máquina a propósito: un pedido para retirar no muestra tramo de reparto, y un rechazo no es el sexto paso de un camino feliz — la línea de tiempo se reduce a `PENDING` y el estado que lo terminó.
- Mientras una entrega está en curso, el seguimiento expone **posición, precisión, rumbo y velocidad** del repartidor, además de `estimatedReadyAt` y `estimatedDeliveryAt`. El servidor guarda solo la posición más nueva del viaje activo.
- Un cambio de estado es legal solo para el actor al que pertenece (cliente, negocio, repartidor, admin, sistema). "El cliente marca el pedido como listo" no es un permiso que falte: es un estado que la máquina no tiene.
- El pedido **fotografía el producto**: nombre, precio unitario y opciones elegidas quedan congelados en el checkout, así que un aumento mañana no cambia el recibo de ayer, y borrar un producto no vacía un pedido viejo.

Fuente: `packages/shared/src/order-state.ts`, `packages/shared/src/schemas/order.ts`.

### Cancelar

Hasta dónde llega el propio cliente al cancelar es parte de la máquina de estados, no un párrafo de política:

| Estado del pedido | Quién puede cancelar |
| --- | --- |
| `PENDING` | El cliente o un admin |
| `ACCEPTED` | El cliente, el negocio o un admin |
| `PREPARING` | El negocio o un admin — la mercadería se está haciendo |
| `READY` | El negocio o un admin |
| `OUT_FOR_DELIVERY` | Solo un admin |

Una cancelación o un rechazo pueden llevar un motivo, y eso es lo que se le dice al cliente.

Fuente: `packages/shared/src/order-state.ts` (`TRANSITIONS`).

### Después del pedido

- **Una reseña por pedido**, impuesta por un índice único y no por una validación: 1 a 5 estrellas, un comentario de hasta 1 000 caracteres y hasta 4 imágenes. El negocio puede responder una vez, en hasta 1 000 caracteres. Una reseña muestra solo un nombre visible — nunca el correo ni el teléfono de quien la escribió.
- **Volver a pedir es aditivo, no idempotente**: llamarlo dos veces suma las cantidades dos veces. Una línea que no puede volver se nombra, con un motivo cerrado: el producto no está disponible, sus opciones no están disponibles, o el carrito no tiene espacio. Una línea también puede volver corta sin aparecer como omitida, porque dos topes recortan en vez de rechazar (`MAX_LINE_QUANTITY` y la fusión en una línea existente).

Fuente: `packages/shared/src/schemas/order.ts`.

### Páginas relacionadas

- [PymesHub: descripción general del producto](/documentation/product-overview)
- [Vender en PymesHub](/documentation/selling-on-pymeshub)
- [Repartir en PymesHub](/documentation/delivering-on-pymeshub)
- [Encontrar negocios: búsqueda, categorías y el orden "best"](/documentation/how-discovery-and-ranking-work)

### Lo que esta página no afirma

- Describe las reglas de checkout, pago y seguimiento tal como las escribe el repositorio; no afirma que cada flujo esté verificado en producción.
- No se ofrece pago con tarjeta.
- El costo se cotiza por ruta en el checkout; la plataforma no toma parte del pedido.
