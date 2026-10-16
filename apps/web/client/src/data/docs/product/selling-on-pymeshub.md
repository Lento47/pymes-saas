# PymesHub — Selling on PymesHub

- [English](#english)
- [Español](#espanol)

---

## English

**What a business gets when it sells here, and what the platform expects of it.** This page documents the merchant side as the repository enforces it: the shop's own states, its catalogue, its team, its couriers and its billing.

### Publishing a shop

| Shop status | Meaning |
| --- | --- |
| `DRAFT` | Created, not published |
| `ACTIVE` | Trading and visible to customers |
| `CLOSED` | Visible to customers, but not taking orders |
| `SUSPENDED` | A platform decision — hidden from customers |

- **Customers see `ACTIVE` and `CLOSED` only.** `DRAFT` and `SUSPENDED` are invisible in the feed, and an owner may set only `ACTIVE` or `CLOSED`; `SUSPENDED` is set by an admin and cannot be cleared by the shop.
- The **category is required and must be a leaf** of a two-level taxonomy. A shop filed on a sector would answer for every child under it, so the API refuses a sector, an inactive row and an id that does not exist.
- The **currency is fixed at creation and never editable**: a shop that switched currency would have to re-price every product, and reading yesterday's orders in today's currency is a way to charge the wrong amount with no error anywhere.
- A new shop's owner is written as the one `ACTIVE` membership; everyone else joins by invitation.

Source: `packages/shared/src/schemas/business.ts`, `packages/trpc-api/src/services/businesses.ts`, `packages/trpc-api/src/services/helpers.ts`.

### Hours, branches and pausing

- Opening hours are **per branch, per weekday, as wall-clock minutes**, stored as a whole. A day may hold **several windows**, each with a kind: `open` (trading), `break` or `unavailable` (a gap inside the day — lunch, a pause). A week holds at most **42 entries**, closing must be later than opening, and rows written before the kind existed are read as `open`.
- A branch's operational status is one of `open`, `closed_schedule`, `paused_manual`, `paused_capacity`, `paused_platform`, `offline` or `suspended`.
- A merchant pause carries a **reason** (`manual` or `capacity`) and optionally a duration of **15, 30 or 60 minutes**; leaving the duration out means the branch stays paused until someone resumes it explicitly.
- The three "not now" states — past hours, a paused branch, an offline branch — are deliberately **one sentence to the customer** ("come back later"), because three keys with identical wording would be a distinction nobody can act on.
- The dashboard's today line comes from the server, which resolves the branch's own hours against the shop's timezone rather than trusting the device.

Source: `packages/shared/src/schemas/business.ts`, `packages/shared/src/schemas/location.ts`, `packages/shared/src/schemas/cart.ts`.

### Delivery settings

- The shop decides whether it offers **pickup**, **delivery** or both.
- `deliveryPricingMode` is `EXPRESS` (the platform's road tariff, quoted at checkout) or `AFFILIATED`. The settings read also carries `canSetDeliveryFee`, which says whether this particular shop may set its own fee.
- **Two different radii exist and they are not the same number.** The shop's `deliveryRadiusKm` (0–80, default 6) is how far *this shop* will deliver to a *buyer*. The platform's **15 km** is how far a *courier* may be from the pickup and still be offered the run. Nothing links them, and the merchant's location screen draws the platform number as a ring around the shop so the merchant sees how far a courier has to be and no further.
- `prepTimeMinutes` (default 25) is the shop's own promise, and it is what the ranking's on-time signal is measured against.
- `minOrderMinor` is the order minimum, and the cart tells the customer exactly what is still missing.
- `merchantCoversDelivery` is the switch that moves the delivery fee from the customer to the shop: when it is on, the customer's fee is **0** and the shop funds the courier's payout.

Source: `packages/shared/src/schemas/business.ts`, `packages/shared/src/dispatch.ts`, `packages/trpc-api/src/services/delivery-pricing.ts`.

### Catalogue

- A product carries its own status; **only `ACTIVE` products appear in the storefront**.
- Products support **option groups** (sizes, extras), each with its own options, and images — the counts are plan limits (see the [product overview page](/documentation/product-overview) for the full table).
- **Inventory tracking is a paid feature** and is off on `FREE` and `EMPRENDE`.
- Prices are handled in the currency's minor unit as an integer, and the storefront's prices are what the server returns; the client does not compute a total.
- The shop's own promotions are `PERCENT`, `FIXED` or `FREE_DELIVERY`. A code is stored **uppercase**, because the cart looks it up with an exact match after trimming and upper-casing: a code saved as `save10` would work for a customer typing `save10` and fail for one typing `SAVE10`. A code is 3–40 characters, its description at most **40 words / 280 characters**, it can carry a minimum order, a total redemption cap and a validity window, and a window may not end before it starts. Opening and closing a live code is a separate action from editing its terms — the switch on the row is its own moment.
- Reaching a plan limit is not phrased as "you may not": the refusal says the shop has reached what its plan buys and **carries the plan that would lift it**. When no plan reaches the number, the answer is to contact us rather than a named plan that would not help.
- Plan gating is by **capability**: `products:write` (products), `business:settings` (locations), `staff:manage` (staff accounts) and `analytics:read` (analytics window). The module also names what it **never** gates: taking and advancing orders, reading the catalogue, writing and reading reviews, seeing billing, deleting the account, and — stated on the module itself — shop hours and pausing a branch. A merchant must always be able to stop taking work and to leave.

Source: `packages/shared/src/schemas/promotions.ts`, `packages/shared/src/plans.ts` (`NEVER_GATED`, `GATED_CAPABILITIES`), `packages/trpc-api/src/services/plan-limits.ts`.

### The team and its roles

A business has four membership roles and one table of what each may do:

| Capability | `OWNER` | `MANAGER` | `STAFF` | `COURIER` |
| --- | --- | --- | --- | --- |
| `orders:read` | ✓ | ✓ | ✓ | ✓ |
| `orders:advance` | ✓ | ✓ | ✓ | ✓ |
| `products:read` | ✓ | ✓ | ✓ | — |
| `products:write` | ✓ | ✓ | ✓ | — |
| `business:settings` | ✓ | ✓ | — | — |
| `staff:manage` | ✓ | ✓ | — | — |
| `analytics:read` | ✓ | ✓ | — | — |
| `payouts:read` | ✓ | — | — | — |
| `business:delete` | ✓ | — | — | — |

- **Invitations cover `OWNER`, `MANAGER` and `STAFF` — never `COURIER`.** That is a contract, not a permission check: two procedures that both grant the same role is how one of them ends up skipping the review the other performs.
- An invitation is valid for **14 days**, deliberately not configurable per plan ("an invitation is not a resource the platform sells").
- **The raw invitation link is returned exactly once**, by the call that creates it, because what is stored is a digest — no later read can recover it.
- A row past its window is reported as `expired` **computed at read time, never stored**, so the list can never show an Accept button that the server would refuse.
- Removing somebody requires a **reason**, checked both on the wire and in the service, and every such action is written to the audit log.

Source: `packages/shared/src/schemas/user.ts`, `packages/shared/src/schemas/affiliation.ts`.

### Working with couriers

- A **courier account is not a courier membership**. The account holder fills a profile (display name, service area, an optional work zone with a radius of 1–30 km, a bio, a vehicle, availability), the platform reviews it — `PENDING`, `VERIFIED` or `REJECTED` — and only a **verified** profile can be found in a business's directory search.
- A business invites a profile; the invitation has its own states (`PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`) and the business may cancel its own. **Only the courier's acceptance creates the membership**, which is what stops a shop from adding an arbitrary account by knowing its email.
- A courier **cannot assign themselves orders**: assignment is `staff:manage`, which the `COURIER` role deliberately lacks.
- A dispatch point may carry the courier's position, accuracy, heading and speed; a **pinned work zone is never treated as a courier's position**.

Source: `packages/shared/src/schemas/courier.ts`, `packages/trpc-api/src/services/delivery-dispatch.ts`.

### The order board

- The board's headline numbers are **active orders**, **orders placed today** (midnight in Costa Rica) and **revenue grouped by currency** — grouped rather than summed, so a migration or a repricing can never produce a total across currencies that means nothing. Today's completed revenue is a separate field from all-time revenue, because a card labelled "today" showing all time is the number that teaches an owner to distrust the screen.
- Advancing an order is **optimistically concurrent**: the write names the status it expects, so two staff on two phones both tapping "Listo" do not both win and the customer is not notified twice.
- A shop delivering its own order uses the guarded self-delivery action. Handing a ready delivery to a courier names a **member with the `COURIER` role by id** — never a typed name, because a free-text name is a different person every time it is spelled differently.
- Rejecting or cancelling can carry a reason, which is what the customer is told.
- The merchant home screen is one branch-scoped read: settings, the selected branch, the operational pulse, a list of alerts (`new_order`, `order_delay`, `inventory_low`, `inventory_zero`, `store_offline`, `payment_issue`, `settlement_issue`, `catalog_issue`, each with a severity and an action), insights (estimated margin, top product, average preparation minutes, projected payout) and the current orders.

Source: `packages/shared/src/schemas/order.ts`, `packages/shared/src/schemas/merchant-home.ts`.

### Getting the verified badge

A shop may apply with a legal name, country, tax id, support email, a domain with a URL proving it, and up to **8 uploaded documents** — every field optional, because an applicant fills in what they have and the reviewer decides with what arrived.

- **Private evidence travels in and never comes back.** The applicant's own read of their application has no field for the legal name, tax id, support email or documents.
- The **internal review note appears in no schema the applicant can reach**; what the shop is told is the separate `decisionReason`.
- The shop sees the **effective** status, with expiry applied, so a lapsed approval shows no badge on its own storefront — the only answer that cannot disagree with what customers see.

Source: `packages/shared/src/schemas/affiliation.ts`.

### Billing and money

- **The platform charges a flat fee and no share of any sale.** The subscription shape a merchant reads has no gross and no platform fee, because the customer pays the merchant for the products and the courier for the delivery — there is nothing to settle.
- **There are no settlement runs.** The procedure that listed them was replaced by the merchant's own billing; the capability name `payouts:read` survives only as the name of "see my own billing", and it is `OWNER`-only.
- Every figure on that screen is **IVA-inclusive**, because that is what the merchant is invoiced; `netMinor` and `ivaMinor` are carried beside it so a merchant asking "what am I actually paying" gets both numbers rather than one plus a division they have to trust.
- A subscription records the **price book it was priced under**. Raising a price is a new price book, not a release, so an increase never reaches a shop that is already in.

Source: `packages/shared/src/schemas/subscription.ts`, `packages/trpc-api/src/routers/index.ts`, `packages/trpc-api/src/services/subscription.ts`.

### Related pages

- [PymesHub: product overview](/documentation/product-overview)
- [Ordering, paying and tracking](/documentation/ordering-and-tracking)
- [Delivering on PymesHub](/documentation/delivering-on-pymeshub)
- [Finding shops: search, categories and the "best" order](/documentation/how-discovery-and-ranking-work)

### What this page does not claim

- It describes the merchant surface as the repository writes it, not a promise about a specific account's state.
- The plan tables, prices and limits live on the product overview page; this page does not repeat them.
- `docs/legal/contracts/privacy-policy.md` and `cancellation-refund-policy.md` in the repository still describe the retired SaaS product (workspaces, inbox, CRM, OCR) and are **not** the source of anything here.

---

## Español

**Qué recibe un negocio cuando vende acá y qué le pide la plataforma.** Esta página documenta el lado del comerciante tal como lo aplica el repositorio: los estados del negocio, su catálogo, su equipo, sus repartidores y su facturación.

### Publicar un negocio

| Estado del negocio | Significado |
| --- | --- |
| `DRAFT` | Creado, sin publicar |
| `ACTIVE` | Operando y visible para los clientes |
| `CLOSED` | Visible para los clientes, pero sin tomar pedidos |
| `SUSPENDED` | Decisión de la plataforma — oculto para los clientes |

- **Los clientes ven solo `ACTIVE` y `CLOSED`.** `DRAFT` y `SUSPENDED` son invisibles en el feed, y un dueño solo puede poner `ACTIVE` o `CLOSED`; `SUSPENDED` lo pone un admin y el negocio no puede quitarlo.
- La **categoría es obligatoria y debe ser una hoja** de una taxonomía de dos niveles. Un negocio archivado en un sector respondería por cada hijo debajo, así que la API rechaza un sector, una fila inactiva y un id que no existe.
- La **moneda se fija al crear y no se edita nunca**: un negocio que cambiara de moneda tendría que repreciar cada producto, e interpretar los pedidos de ayer en la moneda de hoy es una forma de cobrar el monto equivocado sin ningún error a la vista.
- El dueño de un negocio nuevo se escribe como la única membresía `ACTIVE`; los demás entran por invitación.

Fuente: `packages/shared/src/schemas/business.ts`, `packages/trpc-api/src/services/businesses.ts`, `packages/trpc-api/src/services/helpers.ts`.

### Horarios, sucursales y pausas

- El horario es **por sucursal y por día de la semana, en minutos de reloj de pared**, guardado completo. Un día puede tener **varias ventanas**, cada una con un tipo: `open` (operación), `break` o `unavailable` (un hueco dentro del día — almuerzo, una pausa). Una semana lleva como máximo **42 entradas**, el cierre debe ser posterior a la apertura, y las filas escritas antes de que existiera el tipo se leen como `open`.
- El estado operativo de una sucursal es uno de `open`, `closed_schedule`, `paused_manual`, `paused_capacity`, `paused_platform`, `offline` o `suspended`.
- Una pausa del comerciante lleva un **motivo** (`manual` o `capacity`) y opcionalmente una duración de **15, 30 o 60 minutos**; si se omite la duración, la sucursal queda en pausa hasta que alguien la reanude explícitamente.
- Los tres estados de "no ahora" — fuera de horario, sucursal en pausa, sucursal desconectada — son a propósito **una sola frase para el cliente** ("volvé después"), porque tres claves con el mismo texto serían una distinción que nadie puede accionar.
- La línea de hoy del panel viene del servidor, que resuelve el horario de la sucursal contra la zona horaria del negocio en vez de confiar en el dispositivo.

Fuente: `packages/shared/src/schemas/business.ts`, `packages/shared/src/schemas/location.ts`, `packages/shared/src/schemas/cart.ts`.

### Ajustes de entrega

- El negocio decide si ofrece **retiro**, **entrega a domicilio** o ambos.
- `deliveryPricingMode` es `EXPRESS` (la tarifa de ruta de la plataforma, cotizada en el checkout) o `AFFILIATED`. La lectura de ajustes también trae `canSetDeliveryFee`, que dice si este negocio en particular puede fijar su propio costo.
- **Existen dos radios distintos y no son el mismo número.** El `deliveryRadiusKm` del negocio (0 a 80, por defecto 6) es hasta dónde *este negocio* entrega a un *comprador*. Los **15 km** de la plataforma son hasta dónde puede estar un *repartidor* del punto de retiro para que se le ofrezca el viaje. Nada los vincula, y la pantalla de ubicación del comerciante dibuja el número de la plataforma como un anillo alrededor del negocio, para que vea hasta dónde tiene que estar un repartidor y no más.
- `prepTimeMinutes` (por defecto 25) es la promesa del propio negocio, y es contra eso que se mide la señal de puntualidad del ranking.
- `minOrderMinor` es el mínimo de pedido, y el carrito le dice al cliente exactamente cuánto falta.
- `merchantCoversDelivery` es el interruptor que mueve el costo de la entrega del cliente al negocio: cuando está activo, el costo para el cliente es **0** y el negocio financia el pago del repartidor.

Fuente: `packages/shared/src/schemas/business.ts`, `packages/shared/src/dispatch.ts`, `packages/trpc-api/src/services/delivery-pricing.ts`.

### Catálogo

- Un producto tiene su propio estado; **solo los productos `ACTIVE` aparecen en la tienda**.
- Los productos admiten **grupos de opciones** (tamaños, extras), cada uno con sus opciones, e imágenes — los números son límites del plan (la tabla completa está en la [página de descripción general del producto](/documentation/product-overview)).
- El **control de inventario es una función paga** y está apagado en `FREE` y `EMPRENDE`.
- Los precios se manejan como entero en la unidad menor de la moneda, y los precios de la tienda son los que devuelve el servidor; el cliente no calcula un total.
- Las promociones del negocio son `PERCENT`, `FIXED` o `FREE_DELIVERY`. Un código se guarda **en mayúsculas**, porque el carrito lo busca con coincidencia exacta después de recortar y pasar a mayúsculas: un código guardado como `save10` funcionaría para quien escribe `save10` y fallaría para quien escribe `SAVE10`. Un código tiene de 3 a 40 caracteres, su descripción como máximo **40 palabras / 280 caracteres**, puede llevar un mínimo de compra, un tope total de canjes y una ventana de vigencia, y una ventana no puede terminar antes de empezar. Abrir y cerrar un código vivo es una acción aparte de editar sus términos — el interruptor de la fila es su propio momento.
- Llegar al límite de un plan no se redacta como "no podés": el rechazo dice que el negocio llegó a lo que compra su plan y **trae el plan que lo levantaría**. Cuando ningún plan alcanza el número, la respuesta es escribirnos, no nombrar un plan que no ayudaría.
- El plan limita por **capacidad**: `products:write` (productos), `business:settings` (sucursales), `staff:manage` (cuentas de staff) y `analytics:read` (ventana de analítica). El módulo también nombra lo que **nunca** limita: tomar y avanzar pedidos, leer el catálogo, escribir y leer reseñas, ver la facturación, eliminar la cuenta y — dicho por el propio módulo — horarios y pausar una sucursal. Un comerciante siempre tiene que poder dejar de recibir trabajo y poder irse.

Fuente: `packages/shared/src/schemas/promotions.ts`, `packages/shared/src/plans.ts` (`NEVER_GATED`, `GATED_CAPABILITIES`), `packages/trpc-api/src/services/plan-limits.ts`.

### El equipo y sus roles

Un negocio tiene cuatro roles de membresía y una sola tabla de lo que puede hacer cada uno:

| Capacidad | `OWNER` | `MANAGER` | `STAFF` | `COURIER` |
| --- | --- | --- | --- | --- |
| `orders:read` | ✓ | ✓ | ✓ | ✓ |
| `orders:advance` | ✓ | ✓ | ✓ | ✓ |
| `products:read` | ✓ | ✓ | ✓ | — |
| `products:write` | ✓ | ✓ | ✓ | — |
| `business:settings` | ✓ | ✓ | — | — |
| `staff:manage` | ✓ | ✓ | — | — |
| `analytics:read` | ✓ | ✓ | — | — |
| `payouts:read` | ✓ | — | — | — |
| `business:delete` | ✓ | — | — | — |

- **Las invitaciones cubren `OWNER`, `MANAGER` y `STAFF` — nunca `COURIER`.** Eso es un contrato, no una validación de permisos: dos procedimientos que otorgan el mismo rol es cómo uno de ellos termina saltándose la revisión que hace el otro.
- Una invitación vale **14 días**, a propósito no configurable por plan ("una invitación no es un recurso que la plataforma venda").
- **El enlace crudo de invitación se devuelve exactamente una vez**, en la llamada que lo crea, porque lo que se guarda es un digest — ninguna lectura posterior puede recuperarlo.
- Una fila pasada de su ventana se reporta como `expired` **calculada al leer, nunca guardada**, así la lista no puede mostrar un botón de Aceptar que el servidor rechazaría.
- Quitar a alguien exige un **motivo**, validado tanto en el cable como en el servicio, y cada acción así queda en el registro de auditoría.

Fuente: `packages/shared/src/schemas/user.ts`, `packages/shared/src/schemas/affiliation.ts`.

### Trabajar con repartidores

- Una **cuenta de repartidor no es una membresía de repartidor**. Quien la tiene llena un perfil (nombre visible, zona de servicio, una zona de trabajo opcional con radio de 1 a 30 km, una bio, un vehículo, disponibilidad), la plataforma lo revisa — `PENDING`, `VERIFIED` o `REJECTED` — y solo un perfil **verificado** puede aparecer en la búsqueda de un negocio.
- Un negocio invita a un perfil; la invitación tiene sus propios estados (`PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `CANCELLED`) y el negocio puede cancelar la suya. **Solo la aceptación del repartidor crea la membresía**, y eso es lo que evita que un negocio agregue una cuenta arbitraria sabiendo su correo.
- Un repartidor **no puede asignarse pedidos a sí mismo**: la asignación es `staff:manage`, que el rol `COURIER` deliberadamente no tiene.
- Un punto de despacho puede llevar posición, precisión, rumbo y velocidad del repartidor; una **zona de trabajo fijada nunca se trata como la posición de un repartidor**.

Fuente: `packages/shared/src/schemas/courier.ts`, `packages/trpc-api/src/services/delivery-dispatch.ts`.

### El tablero de pedidos

- Los números principales del tablero son **pedidos activos**, **pedidos de hoy** (medianoche en Costa Rica) e **ingresos agrupados por moneda** — agrupados y no sumados, así una migración o un cambio de precios nunca produce un total entre monedas que no signifique nada. Los ingresos completados de hoy son un campo aparte de los ingresos históricos, porque una tarjeta rotulada "hoy" que muestra todo el historial es el número que le enseña a un dueño a desconfiar de la pantalla.
- Avanzar un pedido es **optimista y concurrente**: la escritura nombra el estado que espera, así dos personas en dos teléfonos tocando "Listo" no ganan las dos y el cliente no recibe dos avisos.
- Un negocio que entrega su propio pedido usa la acción protegida de auto-entrega. Pasar un pedido listo a un repartidor nombra a un **miembro con el rol `COURIER` por id** — nunca un nombre escrito a mano, porque un nombre en texto libre es una persona distinta cada vez que se escribe distinto.
- Rechazar o cancelar puede llevar un motivo, y eso es lo que se le dice al cliente.
- La pantalla de inicio del comerciante es una sola lectura por sucursal: ajustes, la sucursal elegida, el pulso operativo, una lista de alertas (`new_order`, `order_delay`, `inventory_low`, `inventory_zero`, `store_offline`, `payment_issue`, `settlement_issue`, `catalog_issue`, cada una con severidad y una acción), indicadores (margen estimado, producto top, minutos promedio de preparación, pago proyectado) y los pedidos actuales.

Fuente: `packages/shared/src/schemas/order.ts`, `packages/shared/src/schemas/merchant-home.ts`.

### Obtener la insignia de verificado

Un negocio puede postularse con razón social, país, cédula/identificación fiscal, correo de soporte, un dominio con una URL que lo pruebe y hasta **8 documentos** subidos — todos los campos son opcionales, porque quien aplica llena lo que tiene y quien revisa decide con lo que llegó.

- **La evidencia privada entra y no vuelve.** La lectura propia de la postulación no tiene campo para la razón social, la identificación, el correo de soporte ni los documentos.
- La **nota interna de revisión no aparece en ningún esquema que el postulante pueda alcanzar**; lo que se le dice es el `decisionReason`, que es aparte.
- El negocio ve el estado **efectivo**, con la expiración aplicada, así que una aprobación vencida no muestra insignia en su propia tienda — la única respuesta que no puede contradecir lo que ven los clientes.

Fuente: `packages/shared/src/schemas/affiliation.ts`.

### Facturación y dinero

- **La plataforma cobra una tarifa fija y ninguna parte de la venta.** La suscripción que lee un comerciante no tiene bruto ni comisión de plataforma, porque el cliente le paga al negocio por los productos y al repartidor por la entrega: no hay nada que liquidar.
- **No hay corridas de liquidación.** El procedimiento que las listaba fue reemplazado por la facturación propia del comerciante; el nombre de la capacidad `payouts:read` sobrevive solo como el nombre de "ver mi propia facturación", y es solo para `OWNER`.
- Cada cifra de esa pantalla **incluye IVA**, porque es lo que se le factura al comerciante; `netMinor` e `ivaMinor` van al lado para que quien pregunta "cuánto estoy pagando de verdad" reciba los dos números y no uno más una división que tiene que creer.
- Una suscripción registra el **libro de precios con el que se fijó**. Subir un precio es un libro nuevo, no un despliegue, así que un aumento nunca alcanza a un negocio que ya está dentro.

Fuente: `packages/shared/src/schemas/subscription.ts`, `packages/trpc-api/src/routers/index.ts`, `packages/trpc-api/src/services/subscription.ts`.

### Páginas relacionadas

- [PymesHub: descripción general del producto](/documentation/product-overview)
- [Pedir, pagar y seguir un pedido](/documentation/ordering-and-tracking)
- [Repartir en PymesHub](/documentation/delivering-on-pymeshub)
- [Encontrar negocios: búsqueda, categorías y el orden "best"](/documentation/how-discovery-and-ranking-work)

### Lo que esta página no afirma

- Describe la superficie del comerciante tal como la escribe el repositorio, no promete el estado de una cuenta concreta.
- Las tablas de planes, precios y límites están en la página de descripción general del producto; esta página no las repite.
- `docs/legal/contracts/privacy-policy.md` y `cancellation-refund-policy.md` del repositorio todavía describen el producto SaaS retirado (workspaces, inbox, CRM, OCR) y **no** son fuente de nada de lo de arriba.
