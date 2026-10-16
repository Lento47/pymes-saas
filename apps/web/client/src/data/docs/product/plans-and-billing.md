# PymesHub — Plans and billing for businesses

- [English](#english)
- [Español](#espanol)

---

## English

**What a business pays, when it pays, what happens if it stops paying, and what a plan never takes away.** This page is about billing mechanics. The full table of limits per tier is on the [product overview](/documentation/product-overview); the prices are repeated here because they are the subject.

### What the fee is for

- A business pays PymesHub a **flat fee for using the application**, and nothing else. There is **no commission per order**, no share of the sale, and no charge on the customer's payment.
- The customer pays **the business** for the products and **the courier** for the delivery. PymesHub never holds that money, which is why there is no settlement run and nothing for the platform to reconcile.
- Prices are in **colones (CRC)** and **include Costa Rican IVA (13%)**, which the platform absorbs and remits.

### Prices and cadences

| Plan | Monthly | Yearly |
| --- | --- | --- |
| `FREE` | ₡0 | ₡0 |
| `EMPRENDE` | ₡10 900 | ₡109 000 |
| `STARTER` | ₡19 900 | ₡199 000 |
| `GROWTH` | ₡29 900 | ₡299 000 |
| `BUSINESS` | ₡59 900 | ₡599 000 |

- Two cadences exist: **`MONTHLY`** and **`YEARLY`**, and a yearly subscription costs **ten months** of the monthly price — two months are the difference.
- **Limits follow the tier alone.** An annual `STARTER` has exactly the same numbers as a monthly `STARTER`. The cadence says when money moves and nothing else, which is why the two are separate fields rather than one plan name.
- **`FREE` is permanent, not a trial**, and is never charged. It has no cadence at all, because a plan that is never charged has no period.
- The current price list is the launch book, labelled **`launch-2026`**, and it is what appears on an invoice.

### What happens if a subscription stops paying

The status is **derived from the subscription's own dates**, not read from a stored column, so it is correct at the moment it is asked — including the day a payment is late, without waiting for a background job.

| Status | Access | Listed to customers |
| --- | --- | --- |
| `ACTIVE` | Full plan limits | Yes |
| `GRACE` — up to **30 days** | Full plan limits | Yes |
| `PAST_DUE` | Falls back to `FREE` limits | **Yes** |
| `SUSPENDED` — after **90 days** | Falls back to `FREE` limits | **No** |

Two things that table is saying on purpose:

- A business that is late **keeps its customers**. Losing tools and losing customers are different events, and being ordered below the paid tier should not make a shop vanish from the feed.
- A shop that is behind by 90 days stops being listed, and that is the only step that affects whether a customer can find it.

### What a plan never takes away

Some things must keep working even when a business is behind, and they are never limited, on any plan:

- taking and advancing orders;
- shop hours, and pausing a branch;
- reviews, in both directions;
- seeing its own billing;
- deleting the account.

A merchant must always be able to stop taking work and to leave.

### Reaching a limit

A refusal at a limit is not phrased as "you may not": it names the plan that would lift the cap. When **no plan reaches the number**, the answer is to talk to us rather than to name a plan that would not help — a ceiling that exists in the product, not in the pricing.

The plan gates exactly four capabilities: products, business settings (branches), staff accounts and the analytics window.

### Invoicing

- Every figure a business sees is **IVA-inclusive**, because that is what it is invoiced. The **net amount and the IVA are carried beside it**, so a merchant asking "what am I actually paying" gets both numbers instead of one plus a division to trust.
- An invoice identifies the **price book** the subscription was priced under.
- **Raising a price is a new price book, not a release.** A subscription keeps the book it joined under, so an increase never reaches a business that is already in.

### Changing plan

- The plan picker quotes **each (tier, cadence) pair**, marks the one the business is currently on, and flags when no available plan reaches what the business needs — the reason to write to us.
- Changing the cadence changes when money moves; it does not change the numbers.
- The **legal side of billing and refunds** is the Billing and Refunds Policy in the Legal Center. This page describes how the product behaves; it does not replace that document.

### What this page does not claim

- It is not an invoice, a quote or a contract. Prices shown are the current published ones and can change for new subscriptions, as described above.
- No card payment is processed in the marketplace; the subscription is not paid with a card inside the product.
- No refund, credit or proration amount is promised here — those are defined by the Billing and Refunds Policy, and proration is not stated anywhere in the product.

---

## Español

**Qué paga un negocio, cuándo lo paga, qué pasa si deja de pagar y qué no le quita nunca un plan.** Esta página trata de la mecánica de facturación. La tabla completa de límites por nivel está en la [descripción general del producto](/documentation/product-overview); los precios se repiten acá porque son el tema.

### Para qué es la tarifa

- Un negocio le paga a PymesHub una **tarifa fija por usar la aplicación**, y nada más. **No hay comisión por pedido**, ni parte de la venta, ni cobro sobre el pago del cliente.
- El cliente le paga **al negocio** por los productos y **al repartidor** por la entrega. PymesHub nunca retiene ese dinero, y por eso no hay corrida de liquidación ni nada que la plataforma tenga que conciliar.
- Los precios están en **colones (CRC)** e **incluyen el IVA (13%)** de Costa Rica, que la plataforma absorbe y entera.

### Precios y periodicidades

| Plan | Mensual | Anual |
| --- | --- | --- |
| `FREE` | ₡0 | ₡0 |
| `EMPRENDE` | ₡10 900 | ₡109 000 |
| `STARTER` | ₡19 900 | ₡199 000 |
| `GROWTH` | ₡29 900 | ₡299 000 |
| `BUSINESS` | ₡59 900 | ₡599 000 |

- Existen dos periodicidades: **`MONTHLY`** y **`YEARLY`**, y una suscripción anual cuesta **diez meses** del precio mensual — dos meses son la diferencia.
- **Los límites dependen solo del nivel.** Un `STARTER` anual tiene exactamente los mismos números que un `STARTER` mensual. La periodicidad dice cuándo se mueve el dinero y nada más, y por eso son dos campos separados en vez de un solo nombre de plan.
- **`FREE` es permanente, no una prueba**, y nunca se cobra. No tiene periodicidad, porque un plan que nunca se cobra no tiene período.
- La lista de precios actual es el libro de lanzamiento, rotulado **`launch-2026`**, y es lo que aparece en una factura.

### Qué pasa si una suscripción deja de pagar

El estado se **deriva de las fechas de la propia suscripción**, no se lee de una columna guardada, así que es correcto en el momento en que se pregunta — incluido el día en que un pago se atrasa, sin esperar a un proceso en segundo plano.

| Estado | Acceso | Aparece a los clientes |
| --- | --- | --- |
| `ACTIVE` | Límites completos del plan | Sí |
| `GRACE` — hasta **30 días** | Límites completos del plan | Sí |
| `PAST_DUE` | Baja a los límites de `FREE` | **Sí** |
| `SUSPENDED` — a los **90 días** | Baja a los límites de `FREE` | **No** |

Dos cosas que esa tabla dice a propósito:

- Un negocio atrasado **conserva sus clientes**. Perder herramientas y perder clientes son hechos distintos, y quedar por debajo del nivel pago no debería hacer desaparecer una tienda del catálogo.
- Una tienda con 90 días de atraso sale del listado, y ese es el único paso que afecta si un cliente puede encontrarla.

### Qué no quita nunca un plan

Hay cosas que tienen que seguir funcionando aunque un negocio esté atrasado, y no se limitan en ningún plan:

- tomar y avanzar pedidos;
- los horarios, y pausar una sucursal;
- las reseñas, en ambas direcciones;
- ver su propia facturación;
- eliminar la cuenta.

Un comerciante siempre tiene que poder dejar de recibir trabajo y poder irse.

### Llegar a un límite

Un rechazo en un límite no se redacta como "no podés": nombra el plan que levantaría el tope. Cuando **ningún plan alcanza el número**, la respuesta es hablar con nosotros en vez de nombrar un plan que no ayudaría — un techo que existe en el producto y no en el precio.

El plan limita exactamente cuatro capacidades: productos, ajustes del negocio (sucursales), cuentas de staff y la ventana de analítica.

### Facturación

- Cada cifra que ve un negocio **incluye IVA**, porque es lo que se le factura. El **monto neto y el IVA van al lado**, así que quien pregunta "cuánto estoy pagando de verdad" recibe los dos números en vez de uno más una división que tiene que creer.
- Una factura identifica el **libro de precios** con el que se fijó la suscripción.
- **Subir un precio es un libro de precios nuevo, no un despliegue.** Una suscripción conserva el libro con el que entró, así que un aumento nunca alcanza a un negocio que ya está dentro.

### Cambiar de plan

- El selector de planes cotiza **cada par (nivel, periodicidad)**, marca el que el negocio tiene hoy y avisa cuando ningún plan disponible alcanza lo que el negocio necesita — el motivo para escribirnos.
- Cambiar la periodicidad cambia cuándo se mueve el dinero; no cambia los números.
- El **lado legal de facturación y reembolsos** es la Política de Facturación y Reembolsos del Centro Legal. Esta página describe cómo se comporta el producto; no reemplaza ese documento.

### Lo que esta página no afirma

- No es una factura, una cotización ni un contrato. Los precios mostrados son los publicados actuales y pueden cambiar para suscripciones nuevas, como se describe arriba.
- No se procesa pago con tarjeta en el marketplace; la suscripción no se paga con tarjeta dentro del producto.
- Acá no se promete ningún monto de reembolso, crédito ni prorrateo — eso lo define la Política de Facturación y Reembolsos, y el prorrateo no está declarado en ninguna parte del producto.
