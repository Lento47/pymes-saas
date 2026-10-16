# PymesHub — Delivering on PymesHub

- [English](#english)
- [Español](#espanol)

---

## English

**How a courier gets verified, gets offered a run, performs it, and gets paid.** PymesHub does not employ couriers: a courier is an independent account that shops invite to their team, and the platform's job is to offer each run to someone who can actually take it.

### Becoming a courier

A courier account is **not** a courier membership, and the states are kept apart on purpose — it is what stops a shop from adding an arbitrary account by knowing its email.

1. The account fills a **profile**: display name, service area, an optional work zone (a centre and a radius of **1–30 km**), a bio of up to 300 characters, an optional vehicle (name or model, plate, photo), and an availability flag that defaults to available.
2. The platform **reviews** the profile: `PENDING`, `VERIFIED` or `REJECTED`. Only a **verified** profile can be found in a shop's directory search, and that search needs at least two characters.
3. A business **invites** the profile. The invitation carries its own statuses — `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED` — and the business may cancel its own.
4. **Only the courier's acceptance creates the membership.**

Source: `packages/shared/src/schemas/courier.ts`.

### What the courier may do

The `COURIER` role holds exactly two capabilities: **`orders:read`** and **`orders:advance`**. Everyone else in a shop has more.

- A courier reads the board to find their runs and advances the ones assigned to them.
- **Assignment itself is `staff:manage`, which a courier deliberately lacks**, so a courier cannot hand orders to themselves or to anyone else.

Source: `packages/shared/src/schemas/user.ts` (`ROLE_CAPABILITIES`).

### Being offered a run

When a delivery order needs a courier, the delivery enters `SEARCHING` and the platform looks for someone who can take it.

| Rule | Value |
| --- | --- |
| How far a courier may be from the pickup | **15 km** |
| How long an offer stands | **2 minutes** |
| How long a device position counts as "live" | **2 minutes** |
| Fairness window for recent offers | **7 days** |

- **The 15 km is a square-then-circle.** SQL narrows by a bounding box and a haversine check then rejects the corners — without the second step, a courier at the edge of a 15 km box would get runs 21 km away.
- The pool is **every verified courier on the platform**, not just that shop's members. A courier a shop has worked with before is **preferred — a rank, not a permission**: a preferred candidate is offered first, and nothing about who *may* accept reads that flag.
- Candidates are ordered by **pickup ETA**; affinity only breaks a competitive gap (up to four minutes). Ties fall back to the fewest recent offers and then the **oldest last offer**, so the pool rotates instead of starving.
- **A pinned work zone is never treated as a courier's position.** Presence has to be a fresh device position, so what makes a courier eligible is where the device is — not where the profile says the courier works.
- An offer carries the pickup stop, the drop-off **area** (not the full address), the distance to the pickup, the courier's fee, the customer's delivery fee, whether the merchant covers the delivery, and when the offer expires.
- Offer statuses: `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`.

Source: `packages/shared/src/dispatch.ts`, `packages/trpc-api/src/services/delivery-dispatch.ts`, `packages/shared/src/schemas/delivery.ts`.

### Performing the run

A delivery has its own statuses, distinct from the order's:

`SEARCHING → OFFERED → ACCEPTED → TO_PICKUP → AT_PICKUP → PICKED_UP → DELIVERED`, plus `CANCELLED`.

The courier's moves are four named actions: **start to pickup**, **arrive at pickup**, **confirm pickup**, **complete**. Each one is timestamped (`acceptedAt`, `arrivedPickupAt`, `pickedUpAt`, `deliveredAt`).

Two loops run in parallel and the order's status follows the delivery's:

| Delivery | Order moves to |
| --- | --- |
| Accepted | `READY` (waiting to leave the shop) |
| Picked up | `OUT_FOR_DELIVERY` |
| Delivered | `COMPLETED` |

- The delivery detail shows the shop (name and phone), the customer (name and phone), the pickup and drop-off stops with any instructions, the order reference and total, and — when checkout measured the route — the **stored road distance and duration** with the route geometry.
- Only the courier assigned to the run advances it. The delivery router exposes no cancel action of its own — `CANCELLED` exists in the delivery machine, and what an operator cancels is the order.

Source: `packages/shared/src/schemas/delivery.ts`, `packages/shared/src/order-state.ts`.

### Location during a run

The courier's phone reports position, and the server **keeps only the newest point for the active run**. Each report carries the coordinates and, when newer builds supply them, the accuracy, heading and speed; `recordedAt` is optional so older app builds (which did not send it) still work, and for those the platform uses receipt time.

That single newest point is what the customer's tracker reads — it is the same data the customer sees, not a second copy.

Source: `packages/shared/src/schemas/order.ts` (`reportLocationInput`, `orderTrackingSchema`).

### How the courier gets paid

- The **courier's payout is the delivery fee quoted from the route at checkout**. The published tariff is **₡850 base + ₡230 per kilometre + ₡45 per estimated driving minute**, rounded once after both components are added, under policy version `express-v1`.
- The customer's fee is that same amount, unless the **merchant covers delivery** — in which case the customer's fee is **0** and the merchant funds the payout. The breakdown records who funded it (`CUSTOMER` or `MERCHANT`).
- If the merchant's own courier fee is **more** than the customer paid, the difference is recorded as a separate payment **from the merchant to the courier**.
- The courier's payout is never affected by the tip: **the tip belongs to the business**.
- Discounts and top-ups that would move the fee — nearby, ready, dynamic — exist in the pricing model and are **all disabled** (`0` or `false`) in the current rollout, and the breakdown carries them as zeroes rather than omitting them.

#### Cash on delivery

When the customer chose cash, **the courier collects at the door**:

| Line | Amount |
| --- | --- |
| What the courier collects from the customer | The **whole order total** |
| What the courier hands to the business | The order total **minus** the customer's delivery fee |
| What the courier keeps | The delivery fee |

Those two numbers are shown on the offer before it is accepted, so the courier knows the cash they will be carrying.

Source: `packages/trpc-api/src/services/delivery-pricing.ts`, `packages/trpc-api/src/services/deliveries.ts`, `packages/shared/src/schemas/order-payment.ts`.

### Ratings, both ways

A finished run can be rated **in both directions**: customer → courier, and courier → customer. Each is 1–5 with an optional comment of up to 500 characters.

A courier's own numbers are one read:

- completed runs all time, and completed runs in the **last 30 days**;
- the date of the first completed run, or nothing if there is none;
- the **average rating and how many ratings it is over**.

Every count there is a real `COUNT(*)` over the deliveries table rather than a count of a capped list, because a count taken from a list capped at 30 would silently become a lie somewhere in a courier's first month. The average is **`null` before the first rating, never `0`** — a courier nobody has rated yet is not a badly rated courier.

Source: `packages/shared/src/schemas/courier.ts` (`courierStatsSchema`), `packages/shared/src/schemas/delivery.ts`.

### Related pages

- [PymesHub: product overview](/documentation/product-overview)
- [Ordering, paying and tracking](/documentation/ordering-and-tracking)
- [Selling on PymesHub](/documentation/selling-on-pymeshub)
- [Finding shops: search, categories and the "best" order](/documentation/how-discovery-and-ranking-work)

### What this page does not claim

- It describes dispatch, delivery and payout rules as the repository writes them. It is not an offer of work, a rate card for a specific date, or a statement that the flows are verified in production.
- The platform does not employ couriers and takes no share of the delivery fee.
- The route tariff is the published default; the pricing policy is versioned (`express-v1`) and can be revised, and a quote is bound to the route it was measured on.

---

## Español

**Cómo un repartidor se verifica, recibe un viaje, lo hace y cobra.** PymesHub no emplea repartidores: un repartidor es una cuenta independiente a la que los negocios invitan a su equipo, y el trabajo de la plataforma es ofrecer cada viaje a alguien que realmente pueda tomarlo.

### Ser repartidor

Una cuenta de repartidor **no** es una membresía de repartidor, y los estados se mantienen separados a propósito — es lo que evita que un negocio agregue una cuenta arbitraria sabiendo su correo.

1. La cuenta llena un **perfil**: nombre visible, zona de servicio, una zona de trabajo opcional (un centro y un radio de **1 a 30 km**), una bio de hasta 300 caracteres, un vehículo opcional (nombre o modelo, placa, foto) y una marca de disponibilidad que por defecto queda en disponible.
2. La plataforma **revisa** el perfil: `PENDING`, `VERIFIED` o `REJECTED`. Solo un perfil **verificado** puede aparecer en la búsqueda de un negocio, y esa búsqueda necesita al menos dos caracteres.
3. Un negocio **invita** al perfil. La invitación tiene sus propios estados — `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED` — y el negocio puede cancelar la suya.
4. **Solo la aceptación del repartidor crea la membresía.**

Fuente: `packages/shared/src/schemas/courier.ts`.

### Qué puede hacer el repartidor

El rol `COURIER` tiene exactamente dos capacidades: **`orders:read`** y **`orders:advance`**. Cualquier otro rol del negocio tiene más.

- Un repartidor lee el tablero para encontrar sus viajes y avanza los que le fueron asignados.
- **La asignación en sí es `staff:manage`, que el repartidor deliberadamente no tiene**, así que un repartidor no puede pasarse pedidos a sí mismo ni a nadie más.

Fuente: `packages/shared/src/schemas/user.ts` (`ROLE_CAPABILITIES`).

### Cómo llega una oferta de viaje

Cuando un pedido a domicilio necesita repartidor, la entrega entra en `SEARCHING` y la plataforma busca a alguien que pueda tomarla.

| Regla | Valor |
| --- | --- |
| A qué distancia máxima del retiro puede estar el repartidor | **15 km** |
| Cuánto dura una oferta | **2 minutos** |
| Cuánto cuenta como "en vivo" la posición del dispositivo | **2 minutos** |
| Ventana de equidad para ofertas recientes | **7 días** |

- **Los 15 km son un cuadrado y después un círculo.** SQL filtra por una caja y luego una verificación de haversine descarta las esquinas — sin el segundo paso, un repartidor en el borde de una caja de 15 km recibiría viajes a 21 km.
- El grupo es **todo repartidor verificado de la plataforma**, no solo los miembros de ese negocio. Un repartidor con el que el negocio ya trabajó está **preferido — un rango, no un permiso**: se le ofrece primero, y nada de quién *puede* aceptar lee esa marca.
- Los candidatos se ordenan por **ETA al retiro**; la afinidad solo rompe una diferencia competitiva (hasta cuatro minutos). Los empates caen a quien tenga menos ofertas recientes y después a la **oferta más vieja**, para que el grupo rote en vez de quedarse sin trabajo.
- **Una zona de trabajo fijada nunca se trata como la posición del repartidor.** La presencia tiene que ser una posición fresca del dispositivo, así que lo que hace elegible a un repartidor es dónde está el dispositivo, no dónde dice el perfil que trabaja.
- Una oferta lleva el punto de retiro, la **zona** de entrega (no la dirección completa), la distancia al retiro, el pago del repartidor, el costo para el cliente, si el negocio cubre la entrega y cuándo vence la oferta.
- Estados de la oferta: `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`.

Fuente: `packages/shared/src/dispatch.ts`, `packages/trpc-api/src/services/delivery-dispatch.ts`, `packages/shared/src/schemas/delivery.ts`.

### Hacer el viaje

Una entrega tiene sus propios estados, distintos de los del pedido:

`SEARCHING → OFFERED → ACCEPTED → TO_PICKUP → AT_PICKUP → PICKED_UP → DELIVERED`, más `CANCELLED`.

Los movimientos del repartidor son cuatro acciones con nombre: **empezar hacia el retiro**, **llegar al retiro**, **confirmar retiro**, **completar**. Cada una queda con su marca de tiempo (`acceptedAt`, `arrivedPickupAt`, `pickedUpAt`, `deliveredAt`).

Corren dos circuitos en paralelo y el estado del pedido sigue al de la entrega:

| Entrega | El pedido pasa a |
| --- | --- |
| Aceptada | `READY` (esperando salir del negocio) |
| Recogida | `OUT_FOR_DELIVERY` |
| Entregada | `COMPLETED` |

- El detalle de la entrega muestra el negocio (nombre y teléfono), el cliente (nombre y teléfono), los puntos de retiro y entrega con sus instrucciones, la referencia y el total del pedido y — cuando el checkout midió la ruta — la **distancia y duración guardadas** con la geometría de la ruta.
- Solo el repartidor asignado al viaje lo avanza. El router de entregas no expone una acción de cancelar propia — `CANCELLED` existe en la máquina de la entrega, y lo que cancela un operador es el pedido.

Fuente: `packages/shared/src/schemas/delivery.ts`, `packages/shared/src/order-state.ts`.

### Ubicación durante el viaje

El teléfono del repartidor reporta posición y el servidor **guarda solo el punto más nuevo del viaje activo**. Cada reporte lleva las coordenadas y, cuando las versiones nuevas de la app las mandan, la precisión, el rumbo y la velocidad; `recordedAt` es opcional para que las versiones viejas (que no lo mandaban) sigan funcionando, y para esas la plataforma usa la hora de recepción.

Ese único punto más nuevo es lo que lee el rastreador del cliente: son los mismos datos que ve el cliente, no una segunda copia.

Fuente: `packages/shared/src/schemas/order.ts` (`reportLocationInput`, `orderTrackingSchema`).

### Cómo cobra el repartidor

- El **pago del repartidor es el costo de entrega cotizado desde la ruta en el checkout**. La tarifa publicada es **₡850 base + ₡230 por kilómetro + ₡45 por minuto estimado de manejo**, redondeada una sola vez después de sumar los dos componentes, bajo la versión de política `express-v1`.
- El costo para el cliente es ese mismo monto, salvo que el **negocio cubra la entrega** — en ese caso el costo para el cliente es **0** y el negocio financia el pago. El desglose registra quién lo financió (`CUSTOMER` o `MERCHANT`).
- Si el costo de reparto propio del negocio es **mayor** que lo que pagó el cliente, la diferencia queda registrada como un pago aparte **del negocio al repartidor**.
- El pago del repartidor nunca se ve afectado por la propina: **la propina es del negocio**.
- Los descuentos y recargos que moverían el costo — cercanía, pedido listo, dinámico — existen en el modelo de precios y están **todos deshabilitados** (`0` o `false`) en el despliegue actual, y el desglose los lleva en cero en vez de omitirlos.

#### Efectivo contra entrega

Cuando el cliente eligió efectivo, **el repartidor cobra en la puerta**:

| Concepto | Monto |
| --- | --- |
| Lo que el repartidor cobra al cliente | El **total completo del pedido** |
| Lo que el repartidor le entrega al negocio | El total **menos** el costo de entrega del cliente |
| Lo que el repartidor se queda | El costo de la entrega |

Esos dos números se muestran en la oferta antes de aceptarla, para que el repartidor sepa el efectivo que va a llevar.

Fuente: `packages/trpc-api/src/services/delivery-pricing.ts`, `packages/trpc-api/src/services/deliveries.ts`, `packages/shared/src/schemas/order-payment.ts`.

### Calificaciones, en las dos direcciones

Un viaje terminado se puede calificar **en ambas direcciones**: cliente → repartidor, y repartidor → cliente. Cada una es de 1 a 5 con un comentario opcional de hasta 500 caracteres.

Los números propios del repartidor son una sola lectura:

- viajes completados históricos y viajes completados en los **últimos 30 días**;
- la fecha del primer viaje completado, o nada si no hay ninguno;
- el **promedio de calificación y sobre cuántas calificaciones es**.

Cada conteo de ahí es un `COUNT(*)` real sobre la tabla de entregas y no el conteo de una lista topeada, porque un conteo tomado de una lista cortada en 30 se vuelve una mentira en silencio en algún punto del primer mes de un repartidor. El promedio es **`null` antes de la primera calificación, nunca `0`** — un repartidor al que nadie calificó todavía no es un repartidor mal calificado.

Fuente: `packages/shared/src/schemas/courier.ts` (`courierStatsSchema`), `packages/shared/src/schemas/delivery.ts`.

### Páginas relacionadas

- [PymesHub: descripción general del producto](/documentation/product-overview)
- [Pedir, pagar y seguir un pedido](/documentation/ordering-and-tracking)
- [Vender en PymesHub](/documentation/selling-on-pymeshub)
- [Encontrar negocios: búsqueda, categorías y el orden "best"](/documentation/how-discovery-and-ranking-work)

### Lo que esta página no afirma

- Describe las reglas de despacho, entrega y pago tal como las escribe el repositorio. No es una oferta de trabajo, ni una tarifa de una fecha concreta, ni una afirmación de que los flujos estén verificados en producción.
- La plataforma no emplea repartidores y no toma parte del costo de entrega.
- La tarifa de ruta es el valor publicado por defecto; la política de precios está versionada (`express-v1`) y puede revisarse, y una cotización queda atada a la ruta que se midió.
