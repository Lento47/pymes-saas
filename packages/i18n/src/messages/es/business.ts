/**
 * Spanish — the business's side: the order board, the product list, the storefront's
 * settings, and whoever works here.
 *
 * The order board is the screen this whole product exists for. Someone behind a
 * counter with flour on their hands reads it at arm's length, so the actions are
 * verbs (`Aceptar`, `Marcar listo`) and never status nouns, and the next state is
 * always the label on the button — a board that says "PREPARING" and offers
 * "Advance" makes the shopkeeper translate the state machine in their head.
 *
 * Role names are the ones a shop actually uses. `Encargado`, not `Manager`.
 */
export const business = {
	"biz.dashboard.title": "Tu negocio",
	"biz.dashboard.today": "Hoy",
	"biz.dashboard.ordersToday": "Pedidos hoy",
	"biz.dashboard.revenueToday": "Ventas de hoy",
	"biz.dashboard.pending": "Por confirmar",
	"biz.dashboard.inProgress": "En curso",
	"biz.dashboard.rating": "Calificación",
	"biz.dashboard.openNow": "Abierto ahora",
	"biz.dashboard.closedNow": "Cerrado ahora",
	/*
	 * The tail of the open/closed line (interface.md §64): when the shop is open and
	 * today's hours give a closing time, the identity block writes
	 * `● Abierto ahora · Hasta 11 p.m.`. "Hasta" is the word a shop window's sign uses —
	 * the sentence is about the day's plan, not about the minute — and "Hasta las 11
	 * p.m." would read the clock twice; `{time}` arrives already formatted from
	 * `formatMinuteOfDay`.
	 */
	"biz.dashboard.until": "Hasta {time}",
	"biz.dashboard.openToggle": "Abrir el negocio",
	"biz.dashboard.closeToggle": "Cerrar el negocio",
	"biz.dashboard.closedWarning":
		"Cerrado no apareces en las búsquedas y no entran pedidos nuevos.",
	"biz.dashboard.empty.title": "Todavía no hay pedidos hoy",
	"biz.dashboard.empty.body": "Cuando entre uno, suena aquí.",
	"biz.dashboard.viewBoard": "Ver el tablero",
	"biz.dashboard.syncing": "Actualizando el panel",
	"biz.dashboard.updatedJustNow": "Actualizado hace un momento",
	"biz.dashboard.updatedRelative": "Actualizado {relative}",
	"biz.dashboard.updatedStale":
		"Los datos pueden estar desactualizados \u00b7 {relative}",
	"biz.dashboard.refresh": "Actualizar el panel",
	"biz.dashboard.refreshHelp":
		"Actualizar negocio, ubicaci\u00f3n, pedidos y anal\u00edtica",
	"biz.home.attention": "Necesita atención",
	"biz.home.attentionCount": "{count} asunto pendiente",
	"biz.home.attentionCount_plural": "{count} asuntos pendientes",
	"biz.home.newOrders": "Pedidos por confirmar",
	"biz.home.outOfStock": "Productos agotados",
	"biz.home.catalogSummary":
		"{active} publicados · {draft} borradores · {outOfStock} agotados",

	// The merchant home's operational band ("the pulse"), its section and its rail —
	// the words of the redesigned board (Downloads/interface.md §14, §25, §64). Net
	// sales, not gross: the number after the platform's cut is the one an owner banks.
	"biz.pulse.netSales": "Ventas netas",
	"biz.pulse.avgTicket": "Ticket promedio",
	"biz.pulse.vsYesterday": "vs. ayer",
	"biz.board.sectionTitle": "Pedidos ahora",
	"biz.rail.newProduct": "Nuevo producto",
	"biz.rail.menu": "Menú",
	"biz.rail.delivery": "Entrega",
	"biz.board.caughtUp": "Estás al día.",
	"biz.board.caughtUp.body":
		"Los pedidos nuevos aparecen aquí automáticamente.",
	"biz.insight.topProduct": "Más vendido",
	"biz.insight.repeat": "Clientes que repiten",
	"biz.insight.avgPreparation": "Preparación promedio",
	"biz.insight.avgOrder": "Pedido promedio",

	"biz.onboarding.title": "Termina de configurar tu negocio",
	"biz.onboarding.step.profile": "Datos del negocio",
	"biz.onboarding.step.hours": "Horario",
	"biz.onboarding.step.products": "Primeros productos",
	"biz.onboarding.step.delivery": "Entrega y pagos",
	"biz.onboarding.step.done": "Listo para vender",
	"biz.onboarding.pending": "Te falta {count} paso",
	"biz.onboarding.pending_plural": "Te faltan {count} pasos",
	"biz.onboarding.notLive": "Tu negocio todavía no está publicado",

	"biz.board.title": "Tablero de pedidos",
	"biz.board.column.new": "Nuevos",
	"biz.board.column.preparing": "En preparación",
	"biz.board.column.ready": "Listos",
	"biz.board.column.done": "Entregados",
	"biz.board.empty": "Nada por aquí",
	/*
	 * The body under the empty board. `biz.dashboard.empty.body` was the tempting reuse —
	 * "Cuando entre uno, suena aquí" — and it is a lie on this platform: neither client
	 * registers a push or asks for the notification permission, so nothing rings. This says
	 * what the board actually holds, which is the orders that have not finished yet.
	 */
	"biz.board.empty.body": "Aquí ves los pedidos que siguen en curso.",
	"biz.board.accept": "Aceptar",
	"biz.board.reject": "Rechazar",
	"biz.board.startPreparing": "Empezar a preparar",
	"biz.board.markReady": "Marcar listo",
	"biz.board.markPickedUp": "Marcar retirado",
	"biz.board.markDelivered": "Marcar entregado",
	"biz.order.dispatch.title": "Estado del reparto",
	"biz.order.dispatch.noPickupPin":
		"Este pedido no tiene punto de recogida y no llegará a los repartidores. Ubica tu negocio para empezar a buscar repartidor.",
	"biz.order.dispatch.setPickupPin": "Ubicar el negocio",
	"biz.order.dispatch.searching": "Buscando un repartidor disponible cerca.",
	"biz.order.dispatch.offered":
		"Una oferta espera la respuesta de un repartidor.",
	"biz.order.dispatch.assigned": "Un repartidor aceptó esta entrega.",
	"biz.order.dispatch.self": "Tu negocio está repartiendo este pedido.",
	"biz.order.selfDelivery.start": "Repartir nosotros",
	"biz.order.selfDelivered": "Entrega marcada como completada",
	"biz.board.sendOut": "Sale a entregar",
	"biz.board.advance": "Siguiente paso",
	"biz.board.waitingFor": "Esperando {minutes} min",
	"biz.board.waitingTooLong": "Lleva {minutes} min esperando",
	"biz.board.newOrder": "Pedido nuevo",
	"biz.board.newOrder.body": "Pedido {code} · {total}",
	/*
	 * Las tres líneas del aviso de pedido nuevo (interface.md §24). El separador vive en el
	 * diccionario y no en el código, igual que en `biz.board.movedTo` — ver la nota de esa
	 * clave. `title` lleva el numeral porque `merchant-order-row.tsx` lo imprime aparte y
	 * una referencia sin `#` no es el número que el mostrador reconoce.
	 */
	"biz.board.newOrder.title": "Pedido nuevo #{reference}",
	"biz.board.newOrder.meta": "{total} · {items}",
	/*
	 * El único control del aviso: la puerta a la orden. "Revisar" y no "Ver", porque el
	 * operador va a *hacer* algo con ese pedido, no solo a mirarlo.
	 */
	"biz.board.newOrder.review": "Revisar",
	/** El anuncio de un movimiento que sí salió: la fila lo cambió, el oído lo confirma. */
	"biz.board.movedTo": "Pedido movido a {status}",
	/** El rótulo de cada columna del tablero; el separador vive aquí, no en el código. */
	"biz.board.section": "{title} · {count}",
	"biz.board.unassigned": "Sin repartidor",
	"biz.board.delivery": "Entrega",
	"biz.board.pickup": "Retiro",
	"biz.board.items": "{count} artículo",
	"biz.board.items_plural": "{count} artículos",
	"biz.board.reject.reason": "¿Por qué no lo puedes hacer?",
	"biz.board.reject.outOfStock": "Ya no hay",
	"biz.board.reject.tooBusy": "Estamos muy llenos",
	"biz.board.reject.closing": "Ya vamos a cerrar",
	"biz.board.reject.other": "Otro motivo",
	"biz.board.reject.help": "El motivo le llega al cliente.",
	"biz.board.cancelledByCustomer": "El cliente canceló el pedido",
	"biz.board.print": "Imprimir",
	"biz.board.acceptAll": "Aceptar todos",
	"biz.board.assignCourier": "Asignar repartidor",
	"biz.board.noCouriers": "Todavía no tienes repartidores",

	"biz.order.customer": "Cliente",
	"biz.order.title": "Pedido #{reference}",
	"biz.order.address": "Dirección de entrega",
	// Las tres puertas bajo el bloque del cliente. Cada una se dibuja sólo cuando existen los
	// datos sobre los que actúa - `biz.order.call` y `biz.order.message` necesitan un
	// teléfono, `biz.order.openMap` una dirección con línea que señalar - así que las claves
	// no son `biz.order.*` porque no son sobre un pedido, sino sobre un handoff al sistema.
	"biz.order.call": "Llamar",
	"biz.order.message": "Mensaje",
	"biz.order.openMap": "Ver mapa",
	// La última línea del héroe oscuro, y el único lugar donde esta pantalla afirma una hora
	// que el payload no trae. `orderSummarySchema` no tiene `updatedAt`; el evento más nuevo
	// del log es el último cambio real del pedido, así que la copia nombra el evento en vez de
	// prometer una frescura que la API nunca envió.
	"biz.order.updated": "Actualizado {time}",
	"biz.order.items": "Artículos del pedido",
	"biz.order.total": "Total del pedido",
	"biz.order.events": "Actividad",
	"biz.order.noteEvent": "Nota",
	"biz.order.contact": "Contacto",
	"biz.order.notes": "Notas del cliente",
	"biz.order.timeline": "Historial",
	"biz.order.timeline.acceptedAt": "Aceptado {time}",
	"biz.order.timeline.readyAt": "Listo {time}",
	"biz.order.timeline.deliveredAt": "Entregado {time}",
	"biz.order.timeline.rejectedAt": "Rechazado {time}",
	"biz.order.notYours": "Este pedido no es de tu negocio",

	"biz.products.title": "Productos",
	"biz.catalog.title": "MENÚ",
	"biz.catalog.count": "{count} producto",
	"biz.catalog.count_plural": "{count} productos",
	"biz.catalog.search": "Buscar en el catálogo",
	"biz.products.add": "Agregar producto",

	/*
	 * The product form, in the commerce system: four named groups instead of one
	 * "Productos" section above fields whose own labels already say what they are.
	 * The heading line under each group is that group's one job, and the empty state
	 * on the photo surface is the sentence a photograph is being asked for.
	 */
	"biz.products.screen.add": "Publica un producto nuevo en tu tienda.",
	"biz.products.screen.edit": "Actualiza los datos de este producto.",
	"biz.products.section.basic": "Información básica",
	"biz.products.section.basic.help":
		"Dale a tu producto un nombre que se reconozca.",
	"biz.products.section.pricing": "Precios",
	"biz.products.section.pricing.help":
		"Define el precio y, si quieres, un precio anterior.",
	"biz.products.section.category.help":
		"Elige la categoría que mejor encaje con tu producto.",
	"biz.products.section.photo.help":
		"Agrega fotos para mostrar mejor tu producto.",
	"biz.products.placeholder.name": "Nombre del producto",
	"biz.products.placeholder.description": "Describe tu producto...",
	"biz.products.save": "Guardar producto",
	"biz.products.photo.module": "Agrega una foto al producto",
	"biz.products.photo.module.help":
		"Sube una foto de tu galería o toma una con la cámara.",
	"biz.products.photo.upload": "Subir de la galería",
	"biz.products.photo.camera": "Tomar foto",
	"biz.products.edit": "Editar producto",
	"biz.products.available": "Disponible",
	"biz.products.outOfStock": "Agotado",
	"biz.products.stockCount": "{count} en existencias",
	"biz.products.empty.title": "Todavía no tienes productos",
	"biz.products.empty.body":
		"Agrega el primero y aparece en tu negocio al instante.",
	"biz.products.name": "Nombre",
	"biz.products.description": "Descripción",
	"biz.products.price": "Precio",
	"biz.products.compareAt": "Precio anterior",
	"biz.products.compareAt.rule": "Tiene que ser mayor que el precio.",
	"biz.products.category": "Categoría",
	/*
	 * Bajo el selector de categoría del formulario de producto. La lista de al lado ya está
	 * acotada al giro del negocio — un negocio de comida ve categorías de comida, uno de
	 * tecnología ve las suyas — y esto nombra ese giro en voz alta, porque una lista corta
	 * sin explicación parece una lista incompleta.
	 */
	"biz.products.category.help": "El giro de tu negocio: {sector}.",
	"biz.products.photo": "Foto",
	"biz.products.photo.add": "Agregar foto",
	/*
	 * The help teaches the two controls now, not a pasted link: the picker is what the
	 * photo row offers, and a sentence about https would describe a box that is gone.
	 */
	"biz.products.photo.help":
		"Elige una de tu galería o toma una con la cámara.",
	"biz.products.photo.rule": "Elige una imagen JPEG, PNG o WebP de hasta 5 MB.",
	"biz.products.sku": "Código interno",
	"biz.products.prepTime": "Tiempo de preparación",
	"biz.products.trackStock": "Llevar inventario",
	"biz.products.stock": "Existencias",
	"biz.products.lowStockAt": "Avisarme cuando queden",
	"biz.products.options": "Opciones",
	"biz.products.options.add": "Agregar grupo de opciones",
	"biz.products.options.name": "Nombre del grupo",
	"biz.products.options.required": "Obligatorio elegir una",
	"biz.products.options.multiple": "Puede elegir varias",
	"biz.products.options.max": "Máximo {count}",
	"biz.products.status.DRAFT": "Borrador",
	"biz.products.status.ACTIVE": "Publicado",
	"biz.products.status.ARCHIVED": "Archivado",
	"biz.products.publish": "Publicar",
	"biz.products.unpublish": "Ocultar",
	"biz.products.hidden": "Oculto: no aparece en tu negocio",
	"biz.products.featured": "Destacado",
	"biz.products.markSoldOut": "Marcar agotado",
	"biz.products.markAvailable": "Marcar disponible",
	"biz.products.delete.confirm": "¿Eliminar este producto?",
	"biz.products.delete.hasOrders":
		"Tiene pedidos, así que se archiva en vez de borrarse",
	"biz.products.duplicate": "Duplicar",
	"biz.products.filter.all": "Todos",
	"biz.products.filter.hidden": "Ocultos",
	"biz.products.filter.outOfStock": "Agotados",
	/** La lista vacía con un filtro puesto: el hecho es el filtro, no la falta de todo. */
	"biz.products.filter.empty": "Ningún producto en esa categoría",
	"biz.products.filter.empty.body": "Quita el filtro para ver todo tu menú.",

	"biz.reviews.title": "Reseñas",
	"biz.reviews.empty": "Todavía no tienes reseñas",
	"biz.reviews.reply": "Responder",
	"biz.reviews.reply.placeholder": "Gracias por venir…",
	"biz.reviews.reply.edit": "Editar respuesta",
	"biz.reviews.reply.posted": "Tu respuesta quedó publicada",
	"biz.reviews.average": "Promedio",
	"biz.reviews.new": "Reseña nueva",
	"biz.reviews.breakdown": "{count} de {stars} estrellas",
	"biz.reviews.postedOn": "Publicada el {date}",
	"biz.reviews.order": "Ver el pedido",
	"biz.reviews.reply.yours": "Tu respuesta",

	"biz.settings.title": "Configuración",

	// La paleta de la consola del comercio. Los cuatro nombres son palabras de color y no
	// nombres de producto: el control elige un color, y un nombre que halaga a una paleta
	// hace que la muestra de al lado parezca mentira. `lime` es el predeterminado y es la
	// que el negocio ya veía antes de que existiera este control.
	"biz.theme.title": "Apariencia",
	"biz.theme.help": "El color de PymesHub en este dispositivo",
	"biz.theme.lime": "Lima",
	"biz.theme.amber": "Ámbar",
	"biz.theme.coral": "Coral",
	"biz.theme.sky": "Cielo",
	"biz.theme.sunset": "Atardecer",
	"biz.theme.forest": "Bosque",
	"biz.theme.ocean": "Océano",
	"biz.theme.orchid": "Orquídea",
	"biz.theme.citrus": "Cítrico",
	"biz.theme.berry": "Baya",
	"biz.theme.dune": "Duna",
	"biz.theme.harbor": "Puerto",
	"biz.theme.vine": "Vid",

	"biz.settings.profile": "Datos del negocio",
	"biz.settings.name": "Nombre",
	"biz.settings.slug": "Dirección web",
	"biz.settings.slug.help": "pymeshub.lat/{slug}",
	"biz.settings.slug.taken": "Ese nombre ya está en uso",
	"biz.settings.description": "Descripción",
	"biz.settings.logo": "Logo",
	"biz.settings.cover": "Portada",
	/*
	 * The sentence under both picture controls, and the same one
	 * `account.profile.photo.help` and `biz.products.photo.help` carry: it is the same
	 * two acts on the same kind of control, said once per place it is shown rather than
	 * borrowed across namespaces. The shape of each preview is the picture's own job —
	 * `components/photo-picker` draws the box it is given, so the cover shows as a band
	 * and the logo as a circle before a word is read.
	 */
	"biz.settings.photo.help":
		"Elige una de tu galería o toma una con la cámara.",
	"biz.settings.category": "Categoría principal",
	"biz.settings.contact": "Contacto",
	"biz.settings.phone": "Teléfono",
	"biz.settings.whatsapp": "WhatsApp",
	"biz.settings.email": "Correo de contacto",
	"biz.settings.address": "Dirección",
	"biz.settings.address.help":
		"La usamos para el retiro y para calcular la entrega.",
	"biz.settings.hours": "Horario",
	"biz.settings.hours.closed": "Cerrado",
	"biz.settings.hours.copyToAll": "Copiar a todos los días",
	"biz.settings.hours.overnight": "Cierra después de medianoche",
	"biz.settings.delivery": "Entrega",
	"biz.settings.delivery.enabled": "Ofrezco entrega a domicilio",
	"biz.settings.delivery.fee": "Pago al repartidor por entrega",
	/** La unidad es la que el API cobra: la menor de la moneda, donde ₡ va y $ lleva dos más. */
	"biz.settings.delivery.fee.help":
		"Define cuánto recibe el repartidor por entrega. El cargo al cliente puede variar según la ruta. ₡1 500 se escribe 1500; $25, 2500.",
	"biz.settings.delivery.cover": "Cubriré el envío para mis clientes",
	"biz.settings.delivery.cover.on": "Paga el comercio",
	"biz.settings.delivery.cover.off": "Paga el cliente",
	"biz.settings.delivery.cover.help":
		"El cliente no paga envío. Tu negocio sigue debiendo al repartidor el monto indicado por cada entrega.",
	"biz.settings.delivery.courierFeeRequired":
		"Define un pago al repartidor mayor que cero antes de ofrecer entregas.",
	"biz.settings.delivery.freeOver": "Envío gratis desde",
	"biz.settings.delivery.radius": "Radio de entrega",
	"biz.settings.delivery.minOrder": "Pedido mínimo",
	"biz.settings.delivery.prepTime": "Tiempo de preparación",
	"biz.settings.pickup": "Retiro en el local",
	"biz.settings.pickup.enabled": "Permito retiro",
	"biz.settings.payments": "Formas de pago",
	"biz.settings.payments.cash": "Efectivo",
	"biz.settings.payments.sinpe": "SINPE Móvil",
	"biz.settings.payments.sinpe.phone": "Número de SINPE",
	"biz.settings.notifications": "Avisos",
	"biz.settings.notifications.newOrder": "Avisarme de cada pedido nuevo",
	"biz.settings.notifications.sound": "Sonido en el tablero",
	"biz.settings.save": "Guardar cambios",
	"biz.settings.saved": "Cambios guardados",
	"biz.settings.danger": "Zona delicada",
	"biz.settings.pause": "Pausar el negocio",
	"biz.settings.pause.help":
		"Deja de aparecer en la app. Nada se borra y puedes volver cuando quieras.",
	"biz.settings.currency": "Moneda",
	"biz.settings.hours.opens": "Abre",
	"biz.settings.hours.closes": "Cierra",
	"biz.settings.hours.rule":
		"La hora de cierre tiene que ser después de la de apertura",
	"biz.settings.hours.add": "Cargar horario",
	"biz.settings.hours.help":
		"Mientras no cargues un horario, tu negocio aparece como abierto a toda hora.",
	"biz.settings.readOnly":
		"Solo el dueño o el encargado pueden guardar cambios",
	"biz.settings.suspended":
		"PymesHub suspendió este negocio. Escríbenos para revisarlo.",
	/*
	 * The four words for `BusinessStatus` (packages/shared/src/schemas/business.ts:29-34),
	 * for the shop's own screens — the owner's card on the board. Read them beside
	 * `biz.settings.suspended` above, which is the sentence explaining what SUSPENDED means
	 * to the person it happened to: this block is the word, that is the paragraph, and the
	 * two are read together (the word, then the explanation, when the word is "Suspendido").
	 *
	 * Not to be confused with `store.open`/`store.closed`. Those describe whether a shop is
	 * taking orders *right now*; these are the account's standing. A shop can be ACTIVE and
	 * closed for the night, and the pairs are read on different screens because they answer
	 * different questions.
	 *
	 * The overlap with `admin.businesses.status.*` is deliberate, and it is the same call
	 * `order.itemCount` records above about `biz.board.items`: an owner's screen reading a
	 * key out of the `admin.` dictionary is a dependency on a surface the reader does not
	 * have, and `admin.businesses.status.*` is not even the same six — it carries VERIFIED
	 * and PENDING, which are the admin's filter vocabulary and not a business status at all.
	 * One of the four does differ on purpose: the admin calls ACTIVE "Activo", naming the
	 * row's state, while the owner is told "Publicado", because the thing they need to know
	 * is whether their shop is *live* — the word `biz.onboarding.notLive` already uses.
	 */
	"biz.status.DRAFT": "Borrador",
	"biz.status.ACTIVE": "Publicado",
	"biz.status.SUSPENDED": "Suspendido",
	"biz.status.CLOSED": "Cerrado",

	"biz.staff.title": "Equipo",
	"biz.staff.add": "Invitar a alguien",
	"biz.staff.empty": "Trabajas solo por ahora",
	"biz.staff.invite.email": "Correo de la persona",
	"biz.staff.invite.role": "Qué puede hacer",
	"biz.staff.invite.send": "Enviar invitación",
	"biz.staff.invite.sent": "Invitación enviada a {email}",
	"biz.staff.invite.pending": "Invitación pendiente",
	"biz.staff.invite.revoke": "Cancelar invitación",
	"biz.staff.role.OWNER": "Dueño",
	"biz.staff.role.MANAGER": "Encargado",
	"biz.staff.role.STAFF": "Colaborador",
	/* The fourth membership role (`docs/domain.md`). Label only: a courier's own
	 * sentence is `biz.onboarding.delivery.courierHelp`, so there is no `.help` here. */
	"biz.staff.role.COURIER": "Repartidor",
	"biz.staff.role.OWNER.help": "Todo, incluido el equipo y los pagos",
	"biz.staff.role.MANAGER.help": "Pedidos y productos, sin tocar el equipo",
	"biz.staff.role.STAFF.help": "Solo ver y avanzar pedidos",
	"biz.staff.changeRole": "Cambiar rol",
	"biz.staff.owner.confirm.title": "¿Convertir a {name} en dueño?",
	"biz.staff.owner.confirm.body":
		"Podrá gestionar el equipo, la configuración del negocio y los pagos.",
	"biz.staff.owner.confirm.action": "Convertir en dueño",
	"biz.staff.remove": "Quitar del equipo",
	"biz.staff.remove.confirm": "¿Quitar a {name} del equipo?",
	"biz.staff.cantRemoveOwner": "No puedes quitarte a ti mismo como dueño",
	"biz.staff.you": "Tú",
	"biz.staff.invite.help":
		"La persona ya tiene que tener cuenta en PymesHub. Se agrega por su correo; no se envía ningún correo.",
	"biz.staff.invite.added": "{name} ya está en el equipo",
	"biz.staff.joinedAt": "En el equipo desde {date}",
	"biz.staff.lastOwner":
		"Un negocio no puede quedarse sin dueño. Dale el rol de dueño a alguien más antes de este cambio.",

	"biz.payouts.title": "Pagos y ventas",
	"biz.payouts.empty": "Todavía no hay ventas que mostrar",
	"biz.payouts.gross": "Ventas brutas",
	"biz.payouts.commission": "Comisión de PymesHub",
	"biz.payouts.net": "Te queda",
	"biz.payouts.period": "Del {from} al {to}",
	"biz.payouts.orders": "{count} pedido",
	"biz.payouts.orders_plural": "{count} pedidos",
	"biz.payouts.export": "Descargar CSV",
	"biz.payouts.note":
		"El cobro se coordina directo con tus clientes. Aquí solo llevamos la cuenta.",
	"biz.payouts.status.PENDING": "Pendiente",
	"biz.payouts.status.PAID": "Pagado",
	"biz.payouts.status.FAILED": "Falló",
	"biz.payouts.paidAt": "Pagado el {date}",
	"biz.payouts.reference": "Referencia",
	"biz.subscription.title": "Suscripción",
	"biz.subscription.note":
		"Tus ventas se pagan directamente. PymesHub cobra una tarifa fija por el uso de la plataforma.",
	"biz.subscription.empty": "Este negocio todavía no tiene una suscripción",
	"biz.subscription.empty.body":
		"El plan se mostrará aquí cuando se active la primera tarifa.",
	"biz.subscription.plan": "Plan",
	"biz.subscription.plan.FREE": "Gratis",
	"biz.subscription.plan.EMPRENDE": "Emprende",
	"biz.subscription.plan.STARTER": "Starter",
	"biz.subscription.plan.GROWTH": "Growth",
	"biz.subscription.plan.BUSINESS": "Business",
	"biz.subscription.cadence": "Periodicidad",
	"biz.subscription.cadence.MONTHLY": "Mensual",
	"biz.subscription.cadence.YEARLY": "Anual",
	"biz.subscription.status": "Estado",
	"biz.subscription.status.ACTIVE": "Al día",
	"biz.subscription.status.GRACE": "En período de gracia",
	"biz.subscription.status.PAST_DUE": "Pago atrasado",
	"biz.subscription.status.SUSPENDED": "Suspendida",
	"biz.subscription.period": "Período: {from} – {to}",
	"biz.subscription.price": "Tarifa",
	"biz.subscription.iva": "IVA incluido: {amount}",
	"biz.subscription.lastPaid": "Último pago: {date}",
	/*
	 * Lo que el plan incluye, para la pantalla de suscripción del comerciante. Las
	 * etiquetas son las de `plans.ts` dichas en voz alta: los límites son una función del
	 * tier y de nada más, así que se leen como una lista y no como una tabla.
	 */
	"biz.subscription.limit.title": "Lo que incluye tu plan",
	"biz.subscription.limit.products": "Productos",
	"biz.subscription.limit.staffAccounts": "Personas con acceso",
	"biz.subscription.limit.locations": "Sucursales",
	"biz.subscription.limit.promotions": "Promociones activas",
	"biz.subscription.limit.images": "Imágenes por producto",
	"biz.subscription.limit.storage": "Almacenamiento",
	"biz.subscription.limit.history": "Historial",
	"biz.subscription.limit.inventory": "Control de inventario",
	"biz.subscription.limit.express": "Entregas express por semana",
	"biz.subscription.limit.included": "Incluido",
	"biz.subscription.limit.notIncluded": "No incluido",
	"biz.subscription.limit.unlimited": "Sin límite",
	"biz.subscription.limit.days": "{count} días",
	"biz.subscription.limit.years": "{count} años",
	"biz.subscription.limit.megabytes": "{value} MB",
	"biz.subscription.limit.gigabytes": "{value} GB",
	"biz.subscription.plans": "Planes disponibles",
	"biz.subscription.current": "Tu plan actual",
	"biz.subscription.change": "Cambiar de plan",
	"biz.subscription.updated": "Plan actualizado",

	"biz.notifications.title": "Avisos",
	"biz.notifications.empty": "Sin avisos por ahora",
	"biz.notifications.markAllRead": "Marcar todo como leído",

	/*
	 * The business frame. Six sections, and the landmark's own name — "Principal"
	 * would be announced twice, once for the container and once for its first item,
	 * which is the mistake `nav.primary`'s comment already records.
	 */
	"biz.nav.primary": "Secciones del negocio",
	"biz.nav.orders": "Pedidos",
	"biz.nav.products": "Productos",
	"biz.nav.analytics": "Análisis",
	"biz.nav.more": "Más",
	/* The tab, which names the job rather than the stock: the screen behind it
	 * is the menu the kitchen reads, and "Productos" is what the stockroom calls
	 * the same rows. One word for the way in, another for the thing. */
	"biz.nav.menu": "Menú",
	"biz.nav.reviews": "Reseñas",
	"biz.nav.payouts": "Pagos",
	"biz.nav.staff": "Equipo",
	"biz.nav.settings": "Configuración",

	/*
	 * The two ways in are refused. Kept apart because they ask different things of the
	 * reader: `noAccess` is "you are not part of this shop" (an invite fixes it) and
	 * `permission` is "your role is too low" (a role change fixes it).
	 */
	"biz.noAccess.title": "No tienes acceso a este negocio",
	"biz.noAccess.body":
		"Tu cuenta no forma parte de este negocio. Pídele al dueño que te invite.",
	"biz.permission.title": "Tu rol no alcanza para esta sección",
	"biz.permission.body": "Pídele al dueño o al encargado que te dé acceso.",

	/**
	 * El repartidor identificado a quien ningún negocio agregó aún. La membresía no se
	 * pide en la app: llega cuando el negocio suma a la persona por correo, así que la
	 * pantalla dice el hecho y el paso, y no un permiso negado.
	 */
	"biz.courier.pending.title": "Ningún negocio te agregó todavía",
	"biz.courier.pending.body":
		"Pídele al negocio que te agregue como repartidor con el correo con el que entraste.",
	"biz.courier.location.title": "Comparte tu ubicación durante la entrega",
	"biz.courier.location.body":
		"El cliente verá tu posición mientras el pedido esté en camino. Dejamos de actualizarla al completar la entrega.",
	"biz.courier.location.unavailable":
		"Activa el GPS del teléfono para compartir tu posición durante esta entrega.",
	"biz.courier.location.action": "Permitir ubicación",
	"biz.courier.location.active": "Compartiendo ubicación",
	"biz.courier.location.starting": "Iniciando ubicación compartida…",

	/* El perfil del repartidor: identidad, vehículo y la marca de revisión. */
	"biz.courier.profile": "Perfil de repartidor",
	"biz.courier.profileTitle": "Perfil de repartidor",
	"biz.courier.profileSubtitle":
		"Tu perfil se muestra a los negocios solo cuando lo permites.",
	"biz.courier.displayName": "Nombre que ven los negocios",
	"biz.courier.serviceArea": "Dónde repartes",
	"biz.courier.zone.title": "Zona de reparto",
	"biz.courier.zone.unset": "Sin zona seleccionada",
	"biz.courier.zone.choose": "Elegir en el mapa",
	"biz.courier.zone.edit": "Editar en el mapa",
	"biz.courier.zone.hint": "Toca el mapa para marcar tu zona.",
	"biz.courier.zone.done": "Usar esta zona",
	"biz.courier.zone.help":
		"Toca el mapa para elegir el centro. El origen y el destino deben estar dentro del círculo; también debes estar cerca del origen.",
	"biz.courier.zone.radius": "Radio: {count} km",
	"biz.courier.zone.save": "Guardar zona de reparto",
	"biz.courier.zone.saved": "Zona de reparto guardada",
	"biz.courier.bio": "Sobre ti",
	"biz.courier.bio.help": "Una frase corta ayuda a que el negocio te elija.",
	"biz.courier.vehicle": "Vehículo",
	"biz.courier.vehicleName": "Nombre del vehículo",
	"biz.courier.vehiclePlate": "Placa",
	"biz.courier.vehiclePhoto": "Foto del vehículo",
	"biz.courier.vehiclePhoto.add": "Agregar foto",
	"biz.courier.vehiclePhoto.change": "Cambiar foto",
	"biz.courier.vehiclePhoto.remove": "Quitar foto",
	"biz.courier.vehiclePhoto.tooLarge":
		"Usa una foto más pequeña, de hasta 5 MB.",
	"biz.courier.availability": "Disponibilidad",
	/*
	 * La disponibilidad no espera al guardado, y esta es la frase que lo dice. `isAvailable`
	 * es el campo con el que cada negocio filtra el pool de repartidores
	 * (`services/deliveries.ts` pide `VERIFIED AND isAvailable`), así que el cambio tiene que
	 * ser el que el lector acaba de hacer y no el que Remember treinta segundos después.
	 */
	"biz.courier.availability.help":
		"Se aplica al instante. Los negocios solo te ofrecen entregas cuando estás disponible.",
	"biz.courier.available": "Disponible para invitaciones",
	"biz.courier.unavailable": "No disponible por ahora",
	"biz.courier.save": "Guardar perfil",
	"biz.courier.saved": "Perfil guardado",

	/*
	 * El precio de guardar.
	 *
	 * `services/couriers.ts` pone `verificationStatus` en PENDING ante cualquier cambio que no
	 * sea vacío — nombre, zona, bio, vehículo, placa o foto — así que un perfil verificado sale
	 * del directorio y del pool de ofertas hasta que la plataforma lo apruebe otra vez. Esta es
	 * la frase que lo dice: un guardado que empeora el perfil sin avisar es la peor clase de
	 * sorpresa, y es exactamente lo que se pasó años sin decir porque el comentario junto a la
	 * sección de vehículo nombraba un solo campo como si el resto fuera gratis.
	 *
	 * `.help` va como subtítulo de las dos secciones que la tocan, y el panel sólo se pregunta
	 * cuando el perfil está verificado: un REJECTED ya está pidiendo este guardado —su propio
	 * cuerpo dice "actualiza tus datos y envíalos a revisión de nuevo"— y un PENDING no tiene
	 * nada que perder.
	 */
	"biz.courier.reviewReset.help":
		"Guardar un cambio vuelve a poner tu perfil en revisión y te saca del directorio hasta que se apruebe.",
	"biz.courier.reviewReset.title": "¿Guardar y volver a revisión?",
	"biz.courier.reviewReset.body":
		"Tu perfil ya está verificado. Al guardar, dejas de recibir ofertas hasta que PymesHub apruebe los cambios.",
	"biz.courier.reviewReset.confirm": "Guardar y revisar",
	"biz.courier.reviewPending": "Revisión pendiente",
	"biz.courier.reviewPending.body":
		"PymesHub revisa tu perfil antes de que aparezca en el directorio.",
	"biz.courier.verified": "Perfil verificado",
	"biz.courier.rejected": "Perfil no aprobado",
	"biz.courier.rejected.body":
		"Actualiza tus datos y envíalos a revisión de nuevo.",
	"biz.courier.rejected.next":
		"Cambia lo que está mal abajo y vuelve a guardar. PymesHub revisa tu perfil de nuevo antes de devolverte al directorio.",
	"biz.courier.directoryVerified": "Verificado por PymesHub",

	// La vista previa del directorio, y el encabezado que la introduce. El texto dice lo
	// que es — "esto es lo que ven" — y no promete nada más: la tarjeta es la misma que el
	// negocio ve, con los mismos datos, así que no puede mentir por construction.
	"biz.courier.preview.title": "Cómo te ven los negocios",
	"biz.courier.preview.body":
		"Esta es tu tarjeta en el directorio de repartidores, tal como la ve un negocio que te está buscando.",
	"biz.courier.preview.pending":
		"Así te verán los negocios cuando PymesHub apruebe tu perfil. El visto bueno todavía no está.",

	/*
	 * Las invitaciones de los negocios, y la fila que las hace visibles.
	 *
	 * `couriers.myInvites` funcionaba y `/courier-invites` era una pantalla terminada con
	 * aceptar y rechazar, y nada la enlazaba desde este árbol: la única ruta era
	 * `app/account.tsx:389`, y el árbol del repartidor no llega a `/account`. Un negocio que
	 * invitaba a alguien alcanzaba a alguien sin forma de enterarse.
	 *
	 * `.pending` lleva `{count}` y usa la convención `_plural` del diccionario.
	 */
	"biz.courier.invites.help":
		"Negocios que te invitaron a repartir sus pedidos.",
	"biz.courier.invites.pending": "{count} por responder",
	"biz.courier.invites.pending_plural": "{count} por responder",

	/*
	 * A move the API refused for a reason that is not the conflict below: a transition the
	 * order is not in, a code with no sentence of its own, the network gone.
	 *
	 * There was no key for it, so the board drew the refusal under `state.error.title` —
	 * `ErrorState`'s default heading, which is "No pudimos cargar esto", the sentence for a
	 * failed *read*. On a write that is the wrong verb twice over: nothing was being loaded,
	 * and the customer had just pressed a button, so the one thing they need told is that
	 * their tap did not take effect. This says exactly that and nothing more. The *why* is
	 * still the API's message, which `ErrorState` prints underneath.
	 *
	 * The sentence stops at "no pudimos mover" on purpose — it does not offer to try again,
	 * because the board cannot know whether the same tap would be refused a second time.
	 */
	"biz.board.moveFailed": "No pudimos mover el pedido",
	/* Someone else advanced the order while this phone was looking at the board. */
	"biz.board.conflict.title": "Alguien más movió este pedido",
	"biz.board.conflict.body":
		"Ya está en {status}. Actualizamos el tablero con lo último.",

	"biz.onboarding.create": "Crear mi negocio",
	"biz.onboarding.delivery.title": "Entrega y reparto",
	"biz.onboarding.delivery.body":
		"Costos, zona y quién reparte. Puedes omitirlo y volver desde tu tablero.",
	"biz.onboarding.delivery.courier": "Correo del repartidor",
	"biz.onboarding.delivery.courierHelp":
		"Debe tener cuenta en PymesHub; lo agregamos como repartidor de tu tienda.",
	"biz.onboarding.delivery.skip": "Omitir por ahora",
	/** El estado que no es un error: una tienda de retiro simplemente no tiene envío. */
	"biz.onboarding.delivery.pickupOnly":
		"Tu negocio solo ofrece retiro en el local, así que no hay entrega que configurar.",
	"biz.new.selected": "Elegido",

	/*
	 * El formulario de creación. Los campos de dirección reutilizan `biz.settings.*` en
	 * lugar de tener etiquetas propias: dos juegos de nombres para lo mismo terminan
	 * diciendo cosas distintas.
	 */
	"biz.new.title": "Abre tu negocio",
	"biz.new.subtitle":
		"Se publica cuando agregues tus primeros productos. Todo esto se puede cambiar después.",
	"biz.new.name.help":
		"Es lo que ven los clientes, y pasa a ser tu dirección web.",
	"biz.new.category.placeholder": "Elige la tuya",
	/*
	 * La categoría del local sí es la taxonomía: es donde el negocio aparece en el
	 * marketplace, y `businesses.list` filtra por esa columna. Es obligatoria, y es una
	 * hoja — un sector no, porque entonces el local respondería por categorías que no
	 * vende. Antes era opcional, cuando la taxonomía eran las seis categorías planas del
	 * demo: ahí era un rótulo y nada dependía de él. Los productos llevan además la suya.
	 */
	"biz.new.category.help":
		"Dónde aparece tu negocio en el marketplace. Cada producto lleva además la suya.",
	"biz.new.currency": "Moneda",
	"biz.new.currency.help":
		"Queda fija cuando empiezas a vender: cambiarla re-preciaría todos tus productos.",
	"biz.new.kind.required": "Elige al menos una forma de entregar un pedido",
	"biz.new.amount.unreadable": "No podemos leer ese monto",
	"biz.new.number.unreadable": "No podemos leer ese número",
	/** La pista del renglón, que dice lo que abre y no repite el título. */
	"biz.new.currency.open": "Elige la moneda de tus precios",
	"biz.new.category.open": "Abrir las categorías de este giro",
	"biz.new.submit": "Crear negocio",

	/* The address fields, which `biz.settings.address` introduces but does not name. */
	"biz.settings.line1": "Dirección exacta",
	"biz.settings.line2": "Señas",
	"biz.settings.city": "Ciudad",
	"biz.settings.region": "Provincia",
	"biz.settings.postalCode": "Código postal",

	/* The dashboard's analytics block, over the window it read. */
	"biz.dashboard.period": "Últimos {days} días",
	"biz.dashboard.ordersByDay": "Pedidos por día",
	"biz.dashboard.topProducts": "Lo más vendido",
	"biz.dashboard.averageOrder": "Pedido promedio",
	"biz.dashboard.customers": "Clientes",
	"biz.dashboard.repeat": "Repiten",

	"biz.analytics.title": "Analítica",
	"biz.analytics.customRange": "Periodo",
	"biz.analytics.range.invalid": "Cantidad inválida: de 1 hasta 2 años.",
	"biz.analytics.loadError": "No pudimos cargar la analítica.",
	"biz.analytics.netRevenue": "VENTAS NETAS",
	"biz.analytics.gross": "{amount} brutos",
	"biz.analytics.fees": "{amount} de tarifas",
	"biz.analytics.orders": "Pedidos",
	"biz.analytics.average": "Promedio",
	"biz.analytics.customers": "Clientes",
	"biz.analytics.repeat": "Que repiten",
	"biz.analytics.accepted": "Aceptados",
	"biz.analytics.refunds": "Reembolsos",
	"biz.analytics.discounts": "Descuentos",
	"biz.analytics.avgAccept": "Aceptación promedio",
	"biz.analytics.avgPreparation": "Preparación promedio",
	"biz.analytics.revenueByDay": "Ventas por día",
	"biz.analytics.emptyOrders": "No hubo pedidos en este periodo.",
	"biz.analytics.emptyProducts": "No hubo ventas de productos en este periodo.",
	"biz.analytics.sold": "{quantity} vendido",
	"biz.analytics.sold_plural": "{quantity} vendidos",
	/** El rótulo de la gráfica, oído (la barra es la vista; la cifra es la voz). */
	"biz.analytics.chartDay": "{day}: {amount}",

	"biz.more.loading": "Cargando",
	"biz.more.title": "Más",
	"biz.more.auditHistory": "Historial de auditoría",
	"biz.more.subtitle": "Cambios y quién los hizo",
	"biz.auditHistory.emptyState": "Todavía no hay cambios registrados.",
	"biz.auditHistory.actor": "Persona",
	"biz.auditHistory.action": "Acción",
	"biz.auditHistory.targetType": "Tipo de destino",
	"biz.auditHistory.targetId": "ID del destino",
	"biz.auditHistory.timestamp": "Fecha y hora",
	"biz.auditHistory.before": "Antes",
	"biz.auditHistory.after": "Después",
	"biz.auditHistory.reason": "Motivo",
	"biz.more.business": "Negocio",
	"biz.more.signOut": "Cerrar sesión",
	// The question and its consequence, worded for the merchant. "De PymesHub" went with
	// them: the sheet is a panel inside this app, drawn on this app's canvas, and naming the
	// product in a heading two lines under a header that already says who is signed in
	// spends the reader's attention on something they are not being asked about.
	"biz.more.signOutConfirm": "¿Cerrar sesión?",
	"biz.more.signOutBody":
		"Tendrás que volver a entrar para gestionar tu negocio.",
	"biz.locations.title": "Sucursales",
	// La posición de la tienda y la catchment de repartidores dibujada alrededor. "Punto de
	// recogida" es la palabra que la pantalla de entrega ya usa para esto
	// (`biz.settings.pickup`), así que el círculo se llama igual en lugar de inventar un
	// tercer nombre para el mismo lugar.
	"biz.location.title": "Ubicación de la tienda",
	"biz.location.body":
		"Dónde está tu tienda en el mapa. Los pedidos se ofrecen a repartidores cercanos a este punto.",
	"biz.location.map": "Punto de recogida",
	"biz.location.subtitle": "Punto de recogida definido en el mapa",
	"biz.location.unset":
		"Sin definir — ningún repartidor puede recibir tus pedidos",
	"biz.location.radius":
		"Se pueden ofrecer tus pedidos a repartidores hasta {count} km de este punto.",
	"biz.location.useDevice": "Usar mi ubicación actual",
	"biz.location.noFix":
		"El mapa necesita un punto de partida. Activa la ubicación o completa la dirección de tu negocio en el perfil.",
	"biz.location.mapUnavailable":
		"El mapa no está disponible en este dispositivo. Inténtalo en la app de desarrollo.",
	"biz.locations.select": "Elegir sucursal",
	"biz.locations.current": "Actual",
	"biz.locations.allBusiness": "Todas las sucursales",
	"biz.locations.subtitle": "Apertura y pedidos por sucursal",
	"biz.locations.pause": "Pausar pedidos",
	"biz.locations.resume": "Reanudar pedidos",
	"biz.locations.pauseConfirm": "¿Pausar los pedidos de esta sucursal?",
	"biz.locations.minutes": "{count} minutos",
	"biz.locations.untilResumed": "Hasta que reanude los pedidos",
	"biz.locations.paused": "Pedidos pausados en esta sucursal",
	"biz.locations.resumed": "Pedidos reanudados en esta sucursal",
	"biz.locations.status.open": "Abierta",
	"biz.locations.status.closed_schedule": "Cerrada por horario",
	"biz.locations.status.paused_manual": "Pausada",
	"biz.locations.status.paused_capacity": "Pausada por capacidad",
	"biz.locations.status.paused_platform": "Pausada por la plataforma",
	"biz.locations.status.offline": "Sin conexión",
	"biz.locations.status.suspended": "Suspendida",
	"biz.promotions.title": "Promociones",
	"biz.promotions.subtitle": "Códigos de descuento de tu negocio",
	"biz.promotions.add": "Crear promoción",
	"biz.promotions.edit": "Editar promoción",
	"biz.promotions.empty.title": "Todavía no tienes promociones",
	"biz.promotions.empty.body":
		"Crea un código que tus clientes puedan usar al pagar.",
	"biz.promotions.code": "Código",
	"biz.promotions.code.help":
		"Lo que el cliente escribe al pagar. Se guarda en mayúsculas.",
	"biz.promotions.kind": "Tipo de descuento",
	"biz.promotions.kind.PERCENT": "Porcentaje",
	"biz.promotions.kind.FIXED": "Monto fijo",
	"biz.promotions.kind.FREE_DELIVERY": "Envío gratis",
	"biz.promotions.value": "Descuento",
	"biz.promotions.value.percent": "Del 1 al 100",
	"biz.promotions.value.fixed": "En la moneda de tu negocio",
	"biz.promotions.minOrder": "Pedido mínimo",
	"biz.promotions.minOrder.help": "Vacío: cualquier pedido.",
	"biz.promotions.maxRedemptions": "Usos máximos",
	"biz.promotions.maxRedemptions.help": "Vacío: sin límite.",
	"biz.promotions.used": "{count} uso",
	"biz.promotions.used_plural": "{count} usos",
	"biz.promotions.usedOf": "{count} de {max} usos",
	"biz.promotions.open": "Activa",
	"biz.promotions.paused": "Pausada",
	"biz.promotions.pause": "Pausar",
	"biz.promotions.resume": "Reanudar",
	"biz.promotions.pausedToast": "Promoción pausada",
	"biz.promotions.resumedToast": "Promoción reanudada",
	"biz.promotions.created": "Promoción creada",
	"biz.promotions.saved": "Promoción guardada",
	"biz.promotions.code.required": "Escribe un código de al menos 3 caracteres.",
	"biz.promotions.value.percent.rule": "El descuento debe ser entre 1 y 100.",
	"biz.promotions.value.fixed.rule": "El descuento debe ser mayor que cero.",
	"biz.promotions.number.rule": "Escribe un número válido.",
	"biz.promotions.code.taken": "Ya existe una promoción con ese código.",
	"biz.promotions.description": "Descripción",
	"biz.promotions.description.placeholder":
		"De qué trata esta oferta, en pocas palabras",
	"biz.promotions.description.help": "{remaining} de {max} palabras",
	"biz.promotions.description.rule":
		"La descripción no puede superar las 40 palabras.",
	"biz.promotions.photo.module": "Agrega una foto al anuncio",
	"biz.promotions.photo.help":
		"JPEG, PNG o WebP de hasta 5 MB. Recorte 16:9 para el anuncio.",
	"biz.more.empty.title": "Todavía no tienes un negocio",
	"biz.more.empty.body":
		"Crea un negocio para gestionar su configuración, equipo, pagos y reseñas.",
	"biz.more.empty.action": "Crear negocio",
	"biz.more.settingsDelivery": "Configuración y entrega",
	"biz.more.settingsFallback": "Configuración del negocio",
	"biz.more.shopSubtitle": "Nombre, fotos, categoría y dirección",
	"biz.more.hoursSubtitle": "Apertura y cierre cada día",
	"biz.more.catalog": "Catálogo",
	"biz.more.catalogSubtitle": "Productos, existencias y disponibilidad",
	"biz.more.moneyPeople": "Dinero y equipo",
	"biz.more.payouts": "Pagos",
	"biz.more.payoutsSubtitle": "{count} registro de pago",
	"biz.more.payoutsSubtitle_plural": "{count} registros de pago",
	"biz.more.subscription": "Suscripción",
	"biz.more.subscriptionEmpty": "Sin suscripción activa",
	"biz.more.team": "Equipo",
	"biz.more.teamSubtitle": "{count} miembro del equipo",
	"biz.more.teamSubtitle_plural": "{count} miembros del equipo",
	"biz.more.feedback": "Opiniones de clientes",
	"biz.more.viewReviews": "Ver todas las reseñas",
	"biz.more.noWrittenReview": "Sin comentario escrito",
	"biz.more.noReviews": "Todavía no hay reseñas.",
	"biz.more.account": "Cuenta",
	"biz.more.profile": "Perfil",
	"biz.more.profileSubtitle": "Ajustes de tu cuenta",
	"biz.more.settings": "Configuración",
	"biz.more.settingsSubtitle": "Tema, notificaciones y privacidad",
	"biz.more.support": "Ayuda",
	"biz.more.supportSubtitle": "Preguntas, seguridad y asistencia",

	/* The product form, which is not the business settings form. */
	"biz.products.created": "Producto agregado",
	"biz.products.saved": "Producto guardado",
	"biz.products.archived": "Producto archivado",
	"biz.products.search": "Buscar por nombre",
	"biz.products.stock.help": "Cuántos quedan hoy",
	"biz.products.options.option": "Opción",
	"biz.products.options.addOption": "Agregar opción",
	"biz.products.options.priceDelta": "Precio extra",
	"biz.products.options.remove": "Quitar grupo",

	/* Capabilities merged from master: courier, delivery and merchant operations. */
	"biz.insight.estimatedMargin": "Margen estimado",
	"biz.settings.country": "País",
	"biz.settings.country.invalid": "Escribe el código de país de 2 letras",
	"biz.settings.publish": "Publicar el negocio",
	"biz.courier.profileRequired": "Crea tu perfil para recibir invitaciones.",
	"biz.courier.invites": "Invitaciones",
	"biz.courier.invitesTitle": "Invitaciones de reparto",
	"biz.courier.invitesSubtitle": "Negocios que quieren que repartas con ellos",
	"biz.courier.invites.empty.title": "No tienes invitaciones",
	"biz.courier.invites.empty.body":
		"Cuando un negocio te invite, aparecerá aquí.",
	"biz.courier.invite.pending": "Invitación pendiente",
	"biz.courier.invite.accept": "Aceptar",
	"biz.courier.invite.decline": "Rechazar",
	"biz.courier.invite.accepted": "Ahora repartes con este negocio",
	"biz.courier.invite.declined": "Invitación rechazada",
	"biz.courier.invite.expired": "Esta invitación expiró",
	"biz.courier.search": "Buscar repartidor",
	"biz.courier.search.action": "Buscar",
	"biz.courier.search.help":
		"Busca por nombre o zona. No mostramos correos ni teléfonos.",
	"biz.courier.search.hint": "Escribe al menos dos letras.",
	"biz.courier.search.empty": "No hay repartidores verificados que coincidan.",
	"biz.courier.invite.send": "Enviar invitación",
	"biz.courier.invite.sent": "Invitación enviada a {name}",
	"biz.courier.invite.alreadyMember": "Ya está en el equipo",
	"biz.courier.invite.alreadySent": "Invitación pendiente",
	"biz.courier.invite.cancel": "Cancelar invitación",
	"biz.courier.invitesForBusiness": "Invitaciones enviadas",
	"biz.courier.noPendingInvites": "No hay invitaciones pendientes",
	"biz.analytics.period": "Últimos {unit}",
	"biz.analytics.unit.hours": "{count} hora",
	"biz.analytics.unit.hours_plural": "{count} horas",
	"biz.analytics.unit.days": "{count} día",
	"biz.analytics.unit.days_plural": "{count} días",
	"biz.analytics.unit.months": "{count} mes",
	"biz.analytics.unit.months_plural": "{count} meses",
	"biz.analytics.unit.years": "{count} año",
	"biz.analytics.unit.years_plural": "{count} años",
	"biz.analytics.revenueByHour": "Ventas por hora",
	"biz.analytics.revenueByMonth": "Ventas por mes",
	"biz.locations.status.title": "Estado de la tienda",
	"biz.more.close": "Cerrar",
	"biz.more.businessName": "Nombre del negocio",
	"biz.more.businessNameSubtitle": "Lo que ven tus clientes",
	"biz.more.switchBusiness": "Cambiar de negocio",
	"biz.more.switchBusinessSubtitle": "Elige el negocio que quieres abrir",
	"biz.more.verified": "Verificado",
	"biz.more.verification": "Verificación",
	"biz.more.verificationPending": "Verificación pendiente",
	"biz.more.storeProfile": "Perfil del negocio",
	"biz.more.storeProfileSubtitle": "Nombre, contacto y datos públicos",
	"biz.more.businessHours": "Horario del negocio",
	"biz.more.businessHoursSubtitle": "Horario de apertura semanal",
	"biz.more.operations": "Operaciones",
	"biz.more.payments": "Pagos",
	"biz.more.paymentsSubtitle": "Registros de cobros y pagos",
	"biz.more.promotions": "Promociones",
	"biz.more.promotionsSubtitle": "Códigos y ofertas visibles",
	"biz.more.settlements": "Liquidaciones",
	"biz.more.settlementsSubtitle": "Períodos, referencias y pagos",
	"biz.more.activity": "Bitácora",
	"biz.more.activitySubtitle": "Resumen y movimientos recientes",
	"biz.manage.loading": "Cargando",
	"biz.manage.loadingScope": "Cargando los datos del negocio",
	"biz.manage.merchantFallback": "Tu negocio",
	"biz.manage.activeLocation": "Sucursal activa",
	"biz.manage.noLocation": "Sin sucursal",
	"biz.manage.unavailable": "No disponible",
	"biz.manage.noLocations": "Todavía no tienes sucursales",
	"biz.manage.errorTitle": "No pudimos cargar esta sección",
	"biz.manage.errorBody": "Inténtalo de nuevo.",
	"biz.manage.editSettings": "Editar ajustes",
	"biz.manage.storeProfile": "Perfil del negocio",
	"biz.manage.brandAssets": "Imagen de marca",
	"biz.manage.notSet": "Sin configurar",
	"biz.manage.noDescription": "Sin descripción",
	"biz.manage.schedule": "Horario semanal",
	"biz.manage.day": "Día",
	"biz.manage.opens": "Abre",
	"biz.manage.closes": "Cierra",
	"biz.manage.locationOperations": "Operación de sucursales",
	"biz.manage.location": "Sucursal",
	"biz.manage.city": "Ciudad",
	"biz.manage.action": "Acción",
	"biz.manage.staffRoster": "Equipo",
	"biz.manage.member": "Miembro",
	"biz.manage.email": "Correo",
	"biz.manage.role": "Rol",
	"biz.manage.changeRole": "Cambiar rol",
	"biz.manage.noStaff": "No hay miembros del equipo",
	"biz.manage.paymentControls": "Registro de pagos",
	"biz.manage.records": "Registros",
	"biz.manage.pending": "Pendientes",
	"biz.manage.paid": "Pagados",
	"biz.manage.recentPayments": "Pagos recientes",
	"biz.manage.period": "Período",
	"biz.manage.orders": "Pedidos",
	"biz.manage.amount": "Monto",
	"biz.manage.noPayments": "Todavía no hay pagos",
	"biz.manage.settlementLedger": "Libro de liquidaciones",
	"biz.manage.reference": "Referencia",
	"biz.manage.paidOn": "Pagado",
	"biz.manage.noSettlements": "Todavía no hay liquidaciones",
	"biz.manage.promotionControls": "Promociones visibles",
	"biz.manage.active": "Activas",
	"biz.manage.scheduled": "Programadas",
	"biz.manage.promotionRecords": "Códigos de promoción",
	"biz.manage.campaign": "Código",
	"biz.manage.window": "Beneficio",
	"biz.manage.status": "Estado",
	"biz.manage.redemptions": "Usos",
	"biz.manage.noPromotions": "No hay promociones activas",
	"biz.manage.promotionReadOnly":
		"Estos son los códigos que los clientes pueden ver ahora.",
	"biz.manage.supportDesk": "Centro de ayuda",
	"biz.manage.supportQueue": "Preguntas frecuentes",
	"biz.manage.noTickets": "No hay solicitudes abiertas",
	"biz.manage.locationContext": "Contexto de la sucursal",
	"biz.manage.responseChannel": "Guía de la app",
	"biz.manage.openHelp": "Abrir la ayuda",
	/* The support desk itself — a merchant's own questions and PymesHub's answers.
	 *
	 * `biz.more.support` is a *menu row* and says "Help, safety and common questions",
	 * which is honest about the FAQ and wrong for a queue of tickets. These are the desk's
	 * own words: a merchant who came here to ask something has asked, and the screen has to
	 * sound like somewhere the answer will come back to rather than a list of reading.
	 *
	 * `biz.manage.supportQueue` was "Preguntas frecuentes" on this same surface — FAQ copy on
	 * a ticket queue — which is why this group exists instead of a few more `biz.manage.*`
	 * keys sitting under the ones they contradict. */
	"biz.support.queue": "Solicitudes abiertas",
	"biz.support.queueCount": "{count} abierta",
	"biz.support.queueCount_plural": "{count} abiertas",
	"biz.support.newTicket": "Abrir solicitud",
	"biz.support.emptyTitle": "No tenés solicitudes abiertas",
	"biz.support.emptyBody":
		"Cuando abras una, la respuesta de PymesHub aparece acá.",
	"biz.support.category": "Categoría",
	"biz.support.category.BILLING": "Cobros",
	"biz.support.category.TECHNICAL": "Técnico",
	"biz.support.category.ACCOUNT": "Cuenta",
	"biz.support.category.PRODUCT": "Productos",
	"biz.support.category.OTHER": "Otro",
	"biz.support.newTitle": "Abrir solicitud",
	"biz.support.subject": "Asunto",
	"biz.support.subjectHelp": "Una línea. Hasta 120 caracteres.",
	"biz.support.subjectRequired": "Escribí un asunto.",
	"biz.support.subjectTooLong": "El asunto puede tener hasta 120 caracteres.",
	"biz.support.body": "Descripción",
	"biz.support.bodyHelp": "Contá qué pasa. Hasta 2000 caracteres.",
	"biz.support.bodyRequired": "Contá qué necesitás.",
	"biz.support.bodyTooLong":
		"La descripción puede tener hasta 2000 caracteres.",
	"biz.support.submit": "Enviar solicitud",
	"biz.support.submitFailed": "No pudimos enviar la solicitud.",
	"biz.support.status.OPEN": "Abierta",
	"biz.support.status.WAITING": "Esperando tu respuesta",
	"biz.support.status.RESOLVED": "Resuelta",
	"biz.support.status.CLOSED": "Cerrada",
	"biz.support.thread": "Conversación",
	"biz.support.messages": "{count} mensaje",
	"biz.support.messages_plural": "{count} mensajes",
	"biz.support.lastActivity": "Último mensaje",
	"biz.support.neverActivity": "Sin actividad",
	"biz.support.replyLabel": "Tu respuesta",
	"biz.support.replySend": "Enviar respuesta",
	"biz.support.replyRequired": "Escribí una respuesta.",
	"biz.support.replyFailed": "No pudimos enviar tu respuesta.",
	"biz.support.markWaiting": "Marcar como esperando",
	"biz.support.markOpen": "Volver a abierta",
	"biz.support.waitingExplain":
		"Marcá esto cuando ya respondiste y falta que PymesHub conteste.",
	/* `support.reply` reopens a resolved ticket (`services/support.ts` sets OPEN and clears
	 * `resolvedAt` whenever the ticket was resolved). So answering is not a message on a
	 * finished question — it puts the ticket back in the queue. Said here, on the screen
	 * that carries the control, because otherwise the ticket disappears from the merchant's
	 * list with nothing on the screen having said it would. */
	"biz.support.reopenedNotice":
		"Al responder, esta solicitud vuelve a la cola: se reabre y deja de estar resuelta.",
	"biz.support.terminalNotice":
		"Esta solicitud está {status}. Podés responder igual y vuelve a la cola.",
	"biz.support.you": "Vos",
	"biz.support.fromSupport": "PymesHub",
	"biz.manage.activity": "Resumen de actividad",
	"biz.manage.activityWindow": "Últimos {count} pedidos",
	"biz.manage.activityWindow_plural": "Últimos {count} pedidos",
	"biz.manage.activityWindowTitle": "Pedidos mostrados",
	"biz.manage.activityOrders": "Pedidos cargados",
	"biz.manage.activityVolume": "Valor de pedidos",
	"biz.manage.activityAverage": "Pedido promedio",
	"biz.manage.activityOpen": "Abiertos ahora",
	"biz.manage.activityCompleted": "Completados",
	"biz.manage.activityAttention": "Requieren atención",
	"biz.manage.activityByDay": "Pedidos por día",
	"biz.manage.activityNoChart": "No hay pedidos en los últimos 7 días",
	"biz.manage.activityStatus": "Estado de pedidos",
	"biz.manage.activityFeed": "Movimientos recientes",
	"biz.manage.activityViewAll": "Ver todos los pedidos",
	"biz.manage.activityItems": "{count} pedido",
	"biz.manage.activityItems_plural": "{count} pedidos",
	"biz.manage.orderActivity": "Actividad de pedidos",
	"biz.manage.noActivity": "Todavía no hay actividad en esta vista",
	"biz.manage.time": "Hora",
	"biz.manage.actor": "Persona",
	"biz.manage.target": "Destino",
	"delivery.board.title": "Repartos",
	"delivery.board.subtitle": "Ofertas y entregas activas",
	"delivery.board.offers": "Ofertas para aceptar",
	"delivery.offer.expiresSoon": "Vence pronto",
	"delivery.offer.expiresMinutes": "Quedan {count} min",
	"delivery.board.active": "Entregas activas",
	"delivery.board.active.body":
		"Tus pedidos actuales de todos los negocios, incluidas las ofertas aceptadas y asignaciones directas.",
	"delivery.board.active.empty": "No tienes entregas activas",
	"delivery.board.active.emptyBody":
		"Aquí aparecerán los pedidos que aceptes o que un negocio te asigne.",
	"delivery.board.openRun": "Abrir entrega",
	"delivery.board.zone.title": "Elige tu zona de reparto",
	"delivery.board.zone.body":
		"Marca en el mapa dónde quieres trabajar. Hasta entonces seguirás recibiendo ofertas cercanas como ahora.",
	"delivery.board.zone.action": "Marcar zona en el mapa",
	"delivery.board.history": "Entregas terminadas recientes",
	"delivery.board.empty": "No hay ofertas nuevas por ahora",
	"delivery.board.offers.busy":
		"Termina tu entrega actual para recibir otra oferta.",
	"delivery.board.empty.body":
		"Las entregas que coincidan aparecerán aquí mientras estés disponible.",

	/*
	 * El segundo tablero, y por qué existe aparte del primero.
	 *
	 * `/delivery` lee dos flujos distintos: `deliveries.offers` (una oferta que el repartidor
	 * acepta) y `orders.list` con `assignedToMe` (un pedido que un negocio asigna por su cuenta).
	 * `services/orders.ts` escribe `order.courierUserId` y `deliveryTable.courierUserId` en la
	 * misma asignación, así que una sola entrega vive en las dos listas a la vez — con dos
	 * vocabularios de estado y dos juegos de botones distintos. Lo que faltaba era el encabezado
	 * que lo dijera, y sin él el segundo `EmptyState` se leía como la contradicción del primero
	 * en lugar de como la respuesta a otra pregunta.
	 */
	"delivery.board.assigned": "Pedidos asignados",
	"delivery.board.assigned.body":
		"Un negocio puede asignarte un pedido directamente, sin pasar por las ofertas.",
	"delivery.board.assigned.empty": "No tienes pedidos asignados",
	"delivery.board.assigned.emptyBody":
		"Aquí aparecerán los pedidos que un negocio te asigne sin pedirte que los aceptes.",

	/*
	 * Disponibilidad para ofertas en la zona marcada o cerca de la ubicación actual.
	 */
	"delivery.board.receiving.on": "Disponible para ofertas",
	"delivery.board.receiving.off": "Ofertas pausadas",
	"delivery.board.availability.change": "Cambiar estado",
	/* Sin zona marcada hace falta una ubicación cercana y reciente. */
	"delivery.board.presence.action": "Activar ubicación",
	"delivery.board.presence.body":
		"Sin tu ubicación los negocios no pueden saber que estás cerca, así que no te llegan ofertas. Actívala para volver a recibirlas.",
	"delivery.board.locationUnavailable":
		"Tu ubicación no está disponible. Revisa los servicios de ubicación para recibir ofertas.",
	"delivery.board.presenceFailed":
		"No pudimos actualizar tu ubicación para recibir ofertas.",
	"delivery.board.zoneDispatchFailed":
		"No pudimos buscar ofertas en tu zona de reparto.",

	/*
	 * Cómo llegan las ofertas, y cada frase es una condición de `candidateFor`.
	 *
	 * Se muestra mientras `mine` no tiene ninguna entrega `DELIVERED` — el propio historial del
	 * repartidor, no un flag descartado — así que no se puede cerrar y seguir siendo cierta.
	 *
	 * Los números son del servidor y no están escritos a mano: `PRESENCE_FRESH_MS` son dos
	 * minutos, `OFFER_RADIUS_KM` son 15 km y `OFFER_TTL_MS` son dos minutos. Si alguno cambia en
	 * `services/delivery-dispatch.ts`, estas frases quedan vieja y el test de esta fila es lo
	 * que debería avisar.
	 */
	"delivery.board.how.title": "Cómo te llegan las ofertas",
	"delivery.board.how.body":
		"PymesHub te busca a ti, no al revés. Un negocio abre una entrega y se ofrece al repartidor verificado y disponible que esté más cerca.",
	"delivery.board.how.detail":
		"Con zona marcada, ambos puntos deben estar dentro. Sin zona, mantén la ubicación activa a menos de 15 km. Cada oferta dura 2 minutos.",

	/*
	 * El historial del repartidor, y la única tarjeta de la pantalla que no es sobre el
	 * próximo reparto.
	 *
	 * **No se dibuja cuando no hay nada que decir.** Cero entregas y cero calificaciones es peor
	 * de leer que nada: es un marcador para alguien que todavía no ha empezado. Y la media de una
	 * sola calificación de cinco tampoco se imprime — `ratingCount` viene en la respuesta
	 * precisamente para poder omitirla, porque un número no es un juicio.
	 *
	 * **El plural de «entregas» es el mismo en las dos formas.** El inglés necesita las dos, el
	 * español no, y las dos llaves existen para que `tp()` no tenga que saber eso.
	 */
	"delivery.board.record.title": "Tu historial",
	"delivery.board.record.delivered": "{count} entregas completadas",
	"delivery.board.record.delivered_plural": "{count} entregas completadas",
	"delivery.board.record.rating": "{value} de 5, según {count} clientes",

	"delivery.offer.accept": "Aceptar entrega",
	"delivery.offer.courierFee": "Pago al repartidor: {amount}",
	"delivery.offer.payerMerchant":
		"El comercio debe pagar este monto al repartidor.",
	"delivery.offer.payerPromotion":
		"Una promoción cubre el cobro al cliente; el pago al repartidor sigue pendiente.",
	"delivery.offer.decline": "Rechazar",
	"delivery.offer.distance": "A {value} km del negocio",
	"delivery.offer.unavailable": "Esta oferta ya no está disponible.",
	"delivery.detail.title": "Detalle de la entrega",
	"delivery.map.label": "Mapa de la recogida y la entrega",
	"delivery.map.courierLocation": "Tu ubicación: {status}",
	"delivery.map.locationWaiting": "Esperando una actualización de ubicación",
	"delivery.map.locationUnavailable":
		"Ubicación no disponible. Desliza para reintentar.",
	"delivery.pickup": "Recoger en el negocio",
	"delivery.dropoff": "Entregar al cliente",
	"delivery.stop.pickup": "Recogida",
	"delivery.stop.dropoff": "Entrega",
	"delivery.navigate": "Abrir indicaciones",
	"delivery.status.SEARCHING": "Buscando repartidor",
	"delivery.status.OFFERED": "Oferta enviada",
	"delivery.status.ACCEPTED": "Aceptada",
	"delivery.status.TO_PICKUP": "En camino al negocio",
	"delivery.status.AT_PICKUP": "En el negocio",
	"delivery.status.PICKED_UP": "En camino al cliente",
	"delivery.status.DELIVERED": "Entregada",
	"delivery.status.CANCELLED": "Cancelada",
	"delivery.action.startPickup": "Ir al negocio",
	"delivery.action.arrivePickup": "Llegué al negocio",
	"delivery.action.confirmPickup": "Confirmar recogida",
	"delivery.action.complete": "Marcar como entregada",
	"delivery.complete.confirm": "¿Confirmar que entregaste el pedido?",
	"delivery.complete.body": "El cliente recibe el aviso de entrega.",
	"delivery.waitingReady": "El negocio todavía está preparando el pedido.",
	"delivery.rateCustomer.title": "Califica al cliente",
	"delivery.rateCustomer.subtitle":
		"Esta calificación se usa en las métricas de seguridad y servicio.",
	"delivery.rateCustomer.submit": "Enviar calificación",
	"delivery.rateCustomer.thanks": "Calificación guardada",
	"delivery.presence.denied":
		"Activa la ubicación para recibir ofertas cercanas.",
} as const;
