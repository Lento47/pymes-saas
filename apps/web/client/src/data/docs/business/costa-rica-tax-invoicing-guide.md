# Guia Fiscal y de Facturacion para PymeHub en Costa Rica

## 1. Proposito

Esta guia documenta el marco operativo minimo que PymeHub debe seguir para facturar servicios SaaS en Costa Rica con orden fiscal, trazabilidad documental y coherencia entre producto, pricing, facturacion y soporte.

## 2. Alcance

Aplica a:

- suscripciones mensuales y anuales;
- servicios de onboarding, soporte adicional e implementacion;
- descuentos, promociones y ajustes comerciales;
- comprobantes, notas de credito y resguardo de XML;
- coordinacion entre operacion, producto y contabilidad.

## 3. Reglas base

- No se debe vender una linea comercial que no pueda facturarse con un concepto y tratamiento fiscal razonablemente claro.
- Todo evento comercial relevante debe poder conciliarse con un evento operativo y con un comprobante o decision de no facturar.
- Los conceptos de factura deben mantenerse coherentes con pricing, plan contratado y servicio efectivamente prestado.
- Toda decision final sobre IVA, CAByS y obligaciones tributarias debe validarse con contador.

## 4. Requisitos previos a facturar

Antes de emitir comprobantes, `Otnel` debe:

- estar inscrita correctamente ante Tributacion;
- contar con la actividad economica adecuada para software/SaaS y servicios relacionados;
- tener definida su figura operativa y capacidad de facturacion;
- acordar con contador la redaccion de conceptos facturables;
- validar el tratamiento de suscripciones, servicios adicionales y descuentos.

## 5. Facturacion electronica

PymeHub debe operar con el esquema vigente de facturacion electronica aplicable en Costa Rica y adaptar sus flujos a la version tecnica exigida en el momento del lanzamiento. La emision debe contemplar:

- identificacion del emisor;
- identificacion del receptor cuando corresponda;
- detalle del concepto facturable;
- impuestos aplicables;
- moneda y tipo de cambio cuando aplique;
- referencia al periodo o servicio cubierto;
- resguardo de XML y metadatos de emision.

## 6. Casos comerciales que deben estar contemplados

La operacion fiscal debe contemplar, como minimo:

- alta inicial de plan mensual;
- alta inicial de plan anual;
- renovacion automatica o manual;
- upgrade de plan;
- downgrade de plan;
- descuentos promocionales;
- periodo de prueba con conversion;
- onboarding cobrado aparte;
- soporte premium;
- almacenamiento adicional o add-ons;
- anulacion, devolucion o error de cobro.

## 7. Reglas por tipo de evento

### Alta inicial

Debe existir correspondencia entre:

- fecha de activacion del workspace;
- plan contratado;
- fecha de inicio del periodo;
- comprobante emitido.

### Renovacion

La renovacion debe poder demostrar:

- fecha de renovacion;
- nuevo periodo cubierto;
- importe aplicable;
- continuidad o cambio de plan.

### Upgrade o downgrade

Antes de ejecutar un cambio de plan, debe estar definido:

- desde cuando surte efecto;
- si existe prorrateo;
- si se emite ajuste inmediato o al siguiente corte;
- como se refleja fiscalmente el cambio.

### Descuentos y promociones

Todo descuento debe quedar documentado con:

- motivo comercial;
- periodo de vigencia;
- responsable que lo autorizo;
- forma en que se refleja en la factura o ajuste posterior.

## 8. Notas de credito y ajustes

Cuando exista error de cobro, devolucion, anulacion parcial, descuento posterior o correccion necesaria, el ajuste debe:

- vincularse a la factura original;
- documentar su causa;
- emitirse mediante el instrumento fiscal correcto;
- quedar conciliado con el estado de cuenta y el historial comercial.

## 9. Resguardo de comprobantes y evidencia

PymeHub debe conservar evidencia suficiente de:

- comprobante emitido;
- XML generado y enviado;
- acuse o respuesta cuando aplique;
- nota de credito asociada, si existio;
- correlacion con cliente, plan, pago y estado del servicio.

El repositorio de resguardo debe tener control de acceso y ubicacion definida.

## 10. Suscripciones y coherencia con producto

La logica comercial del producto debe alinearse con la logica fiscal. En particular:

- cada periodo facturable debe tener inicio y fin identificables;
- las suspensiones por impago deben poder correlacionarse con la situacion de cobro;
- el historial de cambios de plan debe coincidir con el historial de facturacion;
- las pruebas gratis no deben generar promesas confusas sobre la fecha de cobro.

## 11. Coordinacion con contador

Antes del lanzamiento y luego ante cambios materiales, el contador debe validar:

- actividad economica;
- CAByS de trabajo;
- IVA esperado;
- textos de lineas facturables;
- tratamiento de servicios exportados o clientes extranjeros;
- procedimiento de cierre mensual y resguardo de evidencia.

## 12. Evidencia interna recomendada

La operacion fiscal debe sostenerse con:

- libro maestro de clientes y planes;
- historial de cambios de plan;
- correlacion entre factura, pago, suspension y cancelacion;
- repositorio controlado de XML y comprobantes;
- matriz CAByS actualizada;
- registro de descuentos y ajustes excepcionales.

## 13. Relacion con otros documentos

Esta guia debe leerse junto con:

- [`cabys-tax-matrix.md`](./cabys-tax-matrix.md)
- [`pricing-billing-policy.md`](./pricing-billing-policy.md)
- [`pre-launch-compliance-checklist-cr.md`](./pre-launch-compliance-checklist-cr.md)
- [`../templates/invoice-line-examples.md`](../templates/invoice-line-examples.md)
