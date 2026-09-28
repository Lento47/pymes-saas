# Uso de Ubicación en Entregas

**Última actualización:** 27 de septiembre de 2026

## Cuándo se usa

PymesHub solicita ubicación precisa y, para repartidores, permiso de ubicación en segundo plano únicamente cuando el repartidor comienza una entrega que tiene asignada. Estar conectado, abrir la aplicación o figurar como disponible no inicia el seguimiento.

Antes de pedir el permiso del sistema, la aplicación muestra un aviso que explica este uso. El repartidor puede rechazarlo; en ese caso no podrá iniciar el seguimiento requerido para esa entrega.

## Quién puede verla

Durante una entrega activa, la ubicación puede ser consultada por el repartidor, el cliente del pedido y el negocio responsable. El acceso exige una sesión autenticada y participación en ese pedido. No publicamos la ubicación en perfiles, catálogos ni pantallas de otros pedidos.

## Datos y frecuencia

La aplicación puede enviar coordenadas, hora de medición, precisión y, cuando el dispositivo los proporciona, rumbo y velocidad. La frecuencia se adapta al movimiento para mantener el pedido actualizado sin recopilar más datos de los necesarios. El servidor limita la frecuencia y descarta mediciones antiguas.

## Cuándo se detiene

El seguimiento se detiene inmediatamente cuando ocurre cualquiera de estos eventos:

- la entrega se completa o cancela;
- el pedido se reasigna a otro repartidor;
- el repartidor cierra sesión;
- se retira el permiso de ubicación; o
- ya no existe una entrega activa asignada.

Android muestra una notificación persistente mientras el servicio de ubicación está activo. iOS puede mostrar el indicador de ubicación del sistema. Si no hay red, la aplicación conserva temporalmente la medición más reciente para reintentarla; no mantiene un historial local de la ruta.

## Conservación y control

La ubicación exacta se utiliza para operar la entrega y se elimina o anonimiza cuando deja de ser necesaria, incluida la eliminación de cuenta. El usuario puede retirar el permiso desde los ajustes del dispositivo en cualquier momento. Para consultas de privacidad, escribe a [privacidad@pymeshub.lat](mailto:privacidad@pymeshub.lat).
