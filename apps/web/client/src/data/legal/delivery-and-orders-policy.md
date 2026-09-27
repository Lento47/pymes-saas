# Politica de Pedidos y Entregas

## 1. Proposito

Esta politica describe como se crea, prepara, entrega y cierra un pedido en el Marketplace de PymesHub. Es publica y aplica a clientes, negocios y repartidores.

## 2. El ciclo de un pedido

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

## 3. Preparacion

El tiempo estimado que se muestra al confirmar es un promedio del negocio y no una promesa. En horas pico, el negocio puede demorar mas. Si el negocio necesita cancelar por faltante de un producto, lo hace desde su panel y el cliente recibe el aviso con el motivo.

## 4. Entrega a domicilio

- El costo de envio lo fija el negocio y se muestra antes de confirmar. Puede ser cero ("envio gratis").
- El negocio define un radio y un pedido minimo. Un pedido fuera del radio puede rechazarse.
- La direccion que se usa es la que el cliente guardo en su cuenta.
- Cuando el pedido sale, el estado pasa a `EN_ENTREGA` y el nombre del repartidor queda visible cuando fue asignado.
- El repartidor puede contactar al cliente por el telefono de la cuenta para completar la entrega.

## 5. Retiro en tienda

Cuando el pedido es para retiro, el cliente recibe un **codigo de retiro**. Presenta ese codigo en el local. Un pedido de retiro no lleva direccion de entrega, y el sistema rechaza un pedido que mezcle las dos cosas.

## 6. Pedido minimo

Cada negocio puede fijar un monto minimo. Mientras el carrito no alcanza el minimo, PymesHub muestra cuanto falta y no permite avanzar al pago.

## 7. Seguimiento

El cliente puede seguir su pedido desde **Mis pedidos**. La vista se actualiza sola mientras el pedido esta activo y deja de consultar cuando llega a un estado final.

## 8. Cuando algo sale mal

- **El pedido no se confirma:** el negocio no lo acepto dentro de un tiempo razonable. El cliente puede cancelarlo sin costo.
- **Falta un producto:** el negocio puede cancelar la linea o el pedido y el cliente recibe el aviso. Si el pedido ya estaba pagado en linea, aplica la politica de reembolsos.
- **La entrega no se completa:** el cliente y el negocio acuerdan una nueva entrega o el pedido se cancela con motivo.

## 9. Responsabilidad del repartidor

El repartidor es un tercero o un miembro del equipo del negocio con rol `COURIER`. PymesHub no transporta los productos y no responde por el trayecto, sin perjuicio de las herramientas de asignacion y seguimiento que provee.

## 10. Documentos relacionados

- [Terminos del Marketplace](./marketplace-terms.md)
- [Politica de Cancelaciones y Reembolsos](./buyer-cancellation-refunds-policy.md)
- [Politica para Negocios](./merchant-policy.md)
