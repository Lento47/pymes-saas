# Plan de Producto: PymesHub iOS

## Objetivo

Crear una app nativa iOS para que equipos de PymesHub puedan operar conversaciones, contactos, tareas, facturas y notificaciones desde el telefono, conectada al API existente de PymesHub sin duplicar logica de negocio en el cliente.

## Principios

- El API de `apps/api` sigue siendo la fuente de verdad.
- La app iOS debe consumir endpoints existentes antes de pedir endpoints nuevos.
- La app debe respetar `workspace` como contenedor operativo de usuarios/departamentos, no como entidad fiscal o negocio separado.
- Los cambios de backend requeridos deben ir a `main-api`; cualquier cambio web/admin debe ir a su rama correspondiente. La app iOS se planifica como superficie independiente.
- La seguridad de sesion debe usar almacenamiento seguro del sistema, no almacenamiento plano.

## MVP 1

### Inicio de sesion y contexto

- Login con email, password y `workspace_slug`.
- Rotacion de refresh token usando `POST /api/auth/refresh`.
- Vista de usuario actual con `GET /api/auth/me`.
- Cambio de workspace con `POST /api/auth/switch-workspace`.
- Sesion persistida en Keychain.

### Inbox operativo

- Lista de conversaciones con filtros basicos.
- Detalle de conversacion con mensajes paginados.
- Envio de respuesta por conversacion.
- Acciones: asignar, resolver, actualizar estado.
- Soporte inicial para estados de carga, error, vacio y reintento.

### Contactos

- Lista y busqueda de contactos.
- Vista detalle.
- Crear y editar contacto.
- Si el contacto ya existe, la app debe favorecer edicion sobre creacion duplicada.

### Tareas

- Lista de tareas.
- Crear, actualizar, completar.
- Vista de vencidas.

### Notificaciones

- Conteo de no leidas.
- Lista simple de notificaciones.
- Marcar como leidas.

## MVP 2

### Facturacion

- Lista y detalle de facturas.
- Estados de factura, pagos parciales y recordatorios.
- Acciones sensibles como envio a Hacienda deben requerir confirmacion explicita.
- No hacer cambios destructivos desde iOS; cualquier anulacion o nota debe seguir el flujo existente del API.

### Documentos

- Lista de documentos.
- Subida desde Files/Photos donde aplique.
- Descarga/preview.

### Busqueda global

- Busqueda en contactos, conversaciones, tareas y facturas usando `/api/search`.

## MVP 3

### Tiempo real

- Evaluar Socket.IO nativo para eventos de inbox y workspace.
- Alternativa inicial: polling controlado en pantallas activas.
- Push notifications via APNs solo despues de definir el modelo de permisos y tokens de dispositivo.

### Observabilidad

- Reporte de errores de cliente iOS hacia una ruta equivalente a error reports.
- Captura de version de app, build, modelo de dispositivo, version de iOS y endpoint afectado.
- Medicion cuantitativa de recursos: latencia API, tamano de payload, uso de memoria en pantallas criticas y tiempo de arranque.

## Pantallas iniciales

- Auth: login, selector/cambio de workspace, recuperacion futura.
- Shell: tabs para Inbox, Contactos, Tareas, Facturas, Mas.
- Inbox: lista, detalle, composer, acciones.
- Contactos: lista, detalle, editor.
- Tareas: lista, detalle/editor.
- Facturas: lista, detalle, pagos/recordatorios.
- Mas: perfil, workspace, configuracion, cerrar sesion.

## Decisiones abiertas

- Nombre del bundle id: por ejemplo `com.PymesHub.ios`.
- Version minima de iOS. Recomendacion inicial: iOS 17+ para usar Observation moderna.
- Si la app se publica en App Store, TestFlight interno o distribucion empresarial.
- Si el primer proyecto vive en este monorepo (`apps/ios`) o en un repo separado.
- Estrategia de push notifications y permisos por workspace.
