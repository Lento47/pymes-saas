# Politica para Negocios

## 1. Proposito

Esta politica aplica a todo negocio que publica su catalogo en el Marketplace de PymesHub. Describe como se abre una tienda, que se puede vender, como se cumplen los pedidos y que se espera del equipo del negocio.

## 2. Abrir una tienda

Un negocio se crea con un nombre, una categoria y una direccion. Para aparecer en el catalogo publico debe:

- estar en estado `ACTIVO`;
- tener una categoria valida;
- cargar al menos un producto `ACTIVO`;
- definir su moneda al momento de crearse, que luego no se cambia.

Una tienda en estado `BORRADOR` no es visible para los clientes. Una tienda `SUSPENDIDA` o `CERRADA` deja de recibir pedidos.

## 3. Catalogo

El negocio es responsable de:

- cargar precios correctos y en su moneda;
- mantener stock y disponibilidad al dia, sobre todo cuando la venta es por unidad;
- usar imagenes y descripciones propias o autorizadas;
- retirar (`ARCHIVADO`) los productos que ya no ofrece.

Un producto `AGOTADO` no se puede agregar al carrito. Un producto archivado desaparece del catalogo.

## 4. Horario, entrega y pedido minimo

El negocio define:

- su **horario** por dia de la semana;
- si ofrece **entrega a domicilio**, su costo y su **radio**;
- si ofrece **retiro en tienda**;
- su **pedido minimo**;
- su **tiempo de preparacion** estimado.

El cliente ve todo esto antes de confirmar. Un pedido fuera del radio o por debajo del minimo no se puede completar.

## 5. Equipo y roles

Un negocio administra su equipo con roles:

- `OWNER` — control total, incluida la configuracion del negocio y los pagos;
- `MANAGER` — operacion, catalogo y equipo, sin borrar el negocio;
- `STAFF` — opera pedidos y edita productos;
- `COURIER` — ve y mueve unicamente las entregas que se le asignan.

El acceso se decide contra la pertenencia a la tienda en cada solicitud, no por un token. Retirar a alguien de la tienda le quita el acceso en su siguiente llamada.

## 6. Pedidos y cumplimiento

- El negocio acepta o rechaza cada pedido `PENDIENTE`.
- Al aceptar, se compromete a prepararlo dentro de condiciones razonables.
- Los cambios de estado se registran con quien y cuando.
- El negocio debe poder distinguir y completer un pedido de **retiro** (por codigo) de uno de **entrega**.

## 7. Promociones y resenas

El negocio puede crear codigos de descuento (porcentaje, monto fijo o envio gratis) con minimo, vigencia y limite de usos. El sistema rechaza un codigo que ya no cumple sus condiciones, incluso si se mostro en una vitrina. El negocio no puede manipular resenas ni pedir clientes falsos.

## 8. Pagos y facturacion

El precio del pedido lo cobra el negocio al cliente, segun la forma de pago que acepte. El negocio es el unico responsable de emitir la factura fiscal que su actividad requiera. Los pagos por ventas y su liquidacion se rigen por el panel de pagos y la politica comercial vigente.

## 9. Obligaciones legales

El negocio declara contar con los permisos sanitarios, comerciales y fiscales que su actividad exija, y responde por la legalidad de lo que vende. No se permite ofrecer en el Marketplace productos ilegales o restringidos.

## 10. Suspension

PymesHub puede suspender una tienda por incumplimiento material, fraude, riesgo para los clientes, resenas manipuladas u orden de autoridad competente. Cuando sea razonable, se notifica el motivo y se ofrece un canal de apelacion.

## 11. Documentos relacionados

- [Terminos del Marketplace](./marketplace-terms.md)
- [Politica de Pedidos y Entregas](./delivery-and-orders-policy.md)
- [Politica de Cancelaciones y Reembolsos](./buyer-cancellation-refunds-policy.md)
- [Politica de Uso Aceptable](./acceptable-use-policy.md)
