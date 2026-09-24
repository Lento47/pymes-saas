/**
 * Settings — the account surface: profile, saved addresses, language, admin.
 *
 * The last of the customer's own screens. It is here rather than in `customer.ts` because
 * almost none of these strings are about *content* — they are control labels ("save",
 * "default", "delete"), and a control label is the kind of string that gets reused by a
 * screen nobody thought to check.
 *
 * ## The two hints, and why a label was not enough
 *
 * `account.addresses.row.help` and `account.addresses.seeAll.help` are both hints on
 * controls whose *label* is already a word the dictionary owns — the address's own name, and
 * `action.viewAll`. What they add is where the control goes, which is the one thing neither
 * label says: a row announces "Casa, Predeterminada, botón" and its chevron is decoration a
 * screen reader never hears, and "Ver todo" beside the word "Direcciones" is a link whose
 * destination is a guess. `discovery.seeAll.hint` is the same idea for the browse surface
 * and is deliberately not reused here — it says "abre la búsqueda", which is where *that*
 * one goes.
 *
 * ## The one admin string, in a file that is not `admin.ts`
 *
 * `admin.overview.users.admins` is the meta line on the console's third metric card. It is
 * here because the mobile settings surface owns that card and `admin.ts` is written by
 * whoever owns the operator's web console; two workers on one file is the conflict this
 * package's per-domain split exists to avoid, and a key added to the wrong domain is a
 * conflict that resolves silently into whichever spread ran last. The shape follows
 * `admin.overview.businesses.active`, which is already there: a count, its noun, and the
 * plural as its own sibling.
 */
export const settings = {
	"settings.device": "Permisos y accesibilidad",
	"settings.location": "Ubicación",
	"settings.location.help":
		"Para mostrar tiendas cercanas. Puedes explorar sin compartir tu ubicación.",
	"settings.permission.granted": "Permitida",
	"settings.permission.denied": "No permitida",
	"settings.permission.unasked": "Sin solicitar",
	"settings.permission.unknown": "Sin verificar",
	"settings.device.open":
		"Abre los permisos de la app en los ajustes del teléfono",
	"settings.device.error": "No pudimos abrir los ajustes. Inténtalo de nuevo.",
	"settings.motion": "Reducir movimiento",
	"settings.motion.help": "Sigue el ajuste de accesibilidad de tu teléfono.",
	"account.addresses.row.help": "Abre el formulario para editarla",
	"account.addresses.seeAll.help": "Abre tus direcciones guardadas",

	"settings.fulfilment": "Entrega predeterminada",
	"settings.haptics": "Vibración",
	"settings.haptics.help": "Una respuesta al tocar, añadir y confirmar.",
	"settings.haptics.on": "Activada",
	"settings.haptics.off": "Desactivada",
	"settings.about": "Sobre la app",
	"settings.version": "Versión",
	"settings.notifications": "Avisos",
	"settings.notifications.orders": "Pedidos",
	"settings.notifications.orders.help":
		"Te avisamos cuando tu pedido cambie de estado.",
	"settings.notifications.replies": "Respuestas a reseñas",
	"settings.notifications.replies.help":
		"La tienda respondió lo que escribiste.",
	"settings.privacy": "Privacidad",
	"settings.privacy.photo": "Foto en reseñas",
	"settings.privacy.photo.help":
		"Tu nombre siempre aparece; esto es solo la foto.",
	"settings.switch.on": "Activado",
	"settings.switch.off": "Desactivado",

	"admin.overview.users.admins": "{count} administrador",
	"admin.overview.users.admins_plural": "{count} administradores",
} as const;
