# Delivery and Orders Policy / Política de Pedidos y Entregas

- [English](#english)
- [Español](#espanol)

---

## English

*(The Spanish text below is the reference version of this document. Both languages say the same thing.)*

### 1. Purpose

This policy describes how an order is created, prepared, delivered and closed in the PymesHub Marketplace. It is public and applies to customers, businesses and couriers.

### 2. The life of an order

An order moves through states, and every change is recorded with its date, who made it and a note when there is one. The state is not edited: an event is added and the order shows the latest one.

| State | What it means for the customer |
| --- | --- |
| `PENDIENTE` | The order was sent and is waiting for the business to confirm. |
| `ACEPTADO` | The business took it; preparation begins. |
| `PREPARANDO` | It is being prepared. |
| `LISTO` | It is ready for pickup or to leave for delivery. |
| `EN_ENTREGA` | It is on its way with a courier. |
| `COMPLETADO` | It was delivered or picked up. |
| `CANCELADO` | It was not prepared, with a reason. |
| `RECHAZADO` | The business did not accept it. |

An order cannot go backwards in state, and two people tapping the same button at once do not produce two changes: the second attempt is refused with the reason.

### 3. Preparation

The estimated time shown when confirming is an average for the business, not a promise. At peak hours a business can take longer. If the business needs to cancel because a product ran out, it does so from its dashboard and the customer is notified with the reason.

### 4. Home delivery

- The shipping cost is set by the business and shown before confirming. It can be zero ("free shipping").
- The business defines a radius and a minimum order. An order outside the radius can be refused.
- The address used is the one the customer saved in their account.
- When the order leaves, the state becomes `EN_ENTREGA` and the courier's name becomes visible once one is assigned.
- The courier may contact the customer on the account's phone number in order to complete the delivery.

### 5. Pickup in store

When the order is for pickup, the customer receives a **pickup code**. They present that code at the shop. A pickup order carries no delivery address, and the system refuses an order that mixes the two.

### 6. Minimum order

Each business can set a minimum amount. While the cart is below the minimum, PymesHub shows how much is missing and does not allow going on to payment.

### 7. Tracking

The customer can follow their order from **Mis pedidos**. The view updates on its own while the order is active and stops asking when it reaches a final state.

### 8. When something goes wrong

- **The order is not confirmed:** the business did not accept it within a reasonable time. The customer can cancel it at no cost.
- **A product is missing:** the business may cancel the line or the order and the customer is notified. If the order was already paid online, the refund policy applies.
- **The delivery is not completed:** the customer and the business agree on a new delivery, or the order is cancelled with a reason.

### 9. The courier's responsibility

The courier is a third party or a member of the business's team with the `COURIER` role. PymesHub does not transport the products and is not responsible for the trip, without prejudice to the assignment and tracking tools it provides.

### 10. Related documents

- [Marketplace Terms](./marketplace-terms.md)
- [Buyer Cancellations and Refunds Policy](./buyer-cancellation-refunds-policy.md)
- [Merchant Policy](./merchant-policy.md)

---

## Español

### 1. Proposito

Esta politica describe como se crea, prepara, entrega y cierra un pedido en el Marketplace de PymesHub. Es publica y aplica a clientes, negocios y repartidores.

### 2. El ciclo de un pedido

Un pedido avanza por estados, y cada cambio queda registrado con fecha, quien lo hizo y una nota cuando la hay. El estado no se edita: se agrega un evento y el pedido muestra el ultimo.

| Estado | Significado para el cliente |
| --- | --- |
| `PENDIENTE` | El pedido se envio y espera confirmacion del negocio. |
| `ACEPTADO` | El negocio lo tomo; empieza la preparacion. |
| `PREPARANDO` | Se esta preparando. |
| `LISTO` | Esta listo para retirar o para salir a entrega. |
| `EN_ENTREGA` | Va en camino con un repartidor. |
| `COMPLETADO` | Se entrego o se retiro. |
| `CANCELADO` | No se preparo, con motivo. |
| `RECHAZADO` | El negocio no lo acepto. |

Un pedido no puede retroceder de estado, y dos personas tocando el mismo boton a la vez no producen dos cambios: el segundo intento se rechaza con el motivo.

### 3. Preparacion

El tiempo estimado que se muestra al confirmar es un promedio del negocio y no una promesa. En horas pico, el negocio puede demorar mas. Si el negocio necesita cancelar por faltante de un producto, lo hace desde su panel y el cliente recibe el aviso con el motivo.

### 4. Entrega a domicilio

- El costo de envio lo fija el negocio y se muestra antes de confirmar. Puede ser cero ("envio gratis").
- El negocio define un radio y un pedido minimo. Un pedido fuera del radio puede rechazarse.
- La direccion que se usa es la que el cliente guardo en su cuenta.
- Cuando el pedido sale, el estado pasa a `EN_ENTREGA` y el nombre del repartidor queda visible cuando fue asignado.
- El repartidor puede contactar al cliente por el telefono de la cuenta para completar la entrega.

### 5. Retiro en tienda

Cuando el pedido es para retiro, el cliente recibe un **codigo de retiro**. Presenta ese codigo en el local. Un pedido de retiro no lleva direccion de entrega, y el sistema rechaza un pedido que mezcle las dos cosas.

### 6. Pedido minimo

Cada negocio puede fijar un monto minimo. Mientras el carrito no alcanza el minimo, PymesHub muestra cuanto falta y no permite avanzar al pago.

### 7. Seguimiento

El cliente puede seguir su pedido desde **Mis pedidos**. La vista se actualiza sola mientras el pedido esta activo y deja de consultar cuando llega a un estado final.

### 8. Cuando algo sale mal

- **El pedido no se confirma:** el negocio no lo acepto dentro de un tiempo razonable. El cliente puede cancelarlo sin costo.
- **Falta un producto:** el negocio puede cancelar la linea o el pedido y el cliente recibe el aviso. Si el pedido ya estaba pagado en linea, aplica la politica de reembolsos.
- **La entrega no se completa:** el cliente y el negocio acuerdan una nueva entrega o el pedido se cancela con motivo.

### 9. Responsabilidad del repartidor

El repartidor es un tercero o un miembro del equipo del negocio con rol `COURIER`. PymesHub no transporta los productos y no responde por el trayecto, sin perjuicio de las herramientas de asignacion y seguimiento que provee.

### 10. Documentos relacionados

- [Terminos del Marketplace](./marketplace-terms.md)
- [Politica de Cancelaciones y Reembolsos](./buyer-cancellation-refunds-policy.md)
- [Politica para Negocios](./merchant-policy.md)
