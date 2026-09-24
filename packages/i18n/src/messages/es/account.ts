/**
 * The account hub, its inbox, and the two reference screens behind it.
 *
 * A domain of its own rather than an addition to `settings.ts`, and the split is the same
 * one that file's docblock draws: `settings.ts` holds *control labels* — "guardar",
 * "predeterminada" — that any screen might reuse. These are the names of destinations and
 * the sentences of two screens that exist only here, and none of them has a second caller
 * to be reused by.
 *
 * ## What is not in this file, and why that is the point
 *
 * There is no `wallet.*`, no `score.*` and no `kyc.*`. Nothing in the product has a wallet
 * balance, a reputation score or an identity-verification state — there is no column in D1
 * for any of the three and no procedure that would answer for one. A key added here for a
 * screen with no data behind it is how a button ships that leads to an empty box, which is
 * the failure `app/(tabs)/account.tsx`'s docblock already argues against at length: "a
 * button that leads to a sentence about a shop the reader does not have is worse than no
 * button". Those three need a schema, a procedure and a flow, in that order, before they
 * need a word.
 *
 * `account.inbox.*` has no *content* keys either, and that is deliberate: a notification
 * carries its own `title` and `body`, written by whoever raised it (`packages/shared/src/
 * schemas/notification.ts`), so this file names the screen and nothing the screen shows.
 *
 * There is also no `inbox.unread`, and there was one for an afternoon. `notificationSchema`
 * has a `readAt` and `app/inbox.tsx` could read it, but nothing in this app ever writes it to
 * anything but `null` — all four writes in `apps/api/src` are `readAt: null` on insert, and
 * `services/reviews.ts` resets it to `null` on purpose so a corrected reply reads as new. With
 * no mark-read mutation, an "unread" label would be a permanent mark no reader could clear, so
 * the word is gone until `notifications.markRead` exists.
 *
 * ## The three theme labels
 *
 * `settings.theme.system` is the interesting one. "Sistema" is not a colour, it is an
 * answer to "who decides" — and it is the default, so it is the label most readers will
 * ever see. It is not `locale.*`'s neighbour in `common.ts` because `locale.switch` names
 * a control and these name a value.
 */
export const account = {
	/* The hub's four groups. Each is a noun for a set of rows, so each is short: a section
	   heading is read at a glance while scrolling, and "Tu cuenta" is the only one that has
	   to disambiguate itself from the tab it is drawn on. */
	"account.section.account": "Tu cuenta",
	"account.section.activity": "Actividad",
	"account.section.preferences": "Preferencias",
	"account.section.support": "Ayuda y seguridad",

	/* The rows. Each label is the destination's own name and each hint says where it goes,
	   which is the pair `settings.ts` explains: a chevron is decoration a screen reader never
	   hears, so "Bandeja de entrada, botón" is a row whose destination is a guess without one. */
	"account.inbox": "Bandeja de entrada",
	"account.inbox.help": "Abre los avisos de tus pedidos y de tus reseñas",
	"account.history": "Historial de pedidos",
	"account.history.help": "Abre tus pedidos anteriores",
	"account.help": "Ayuda",
	"account.help.help": "Abre las preguntas frecuentes",
	"account.safety": "Seguridad",
	"account.safety.help": "Abre los consejos y cómo reportar un problema",

	/*
	 * The profile's completeness, as a signal rather than a scold.
	 *
	 * There are exactly four things a profile has, and the app knows three of them for free
	 * — `users.me` answers `name`, `phone` and `image` on every account screen render — while
	 * the fourth is whether any address is saved, which is the `addresses` read the row below
	 * already makes when it is opened. That is why the checklist is these four and not a
	 * longer one: a list of things the app cannot actually check is a progress bar that never
	 * moves.
	 *
	 * The copy names the *missing* thing rather than the missing count. "Te falta el teléfono"
	 * is a fact a reader can act on; "2 de 4" is a score, and a score with no explanation is
	 * the kind of thing that makes somebody close the screen. The count is still there, as the
	 * `{done}`/`{total}` pair, because it is the one part that is true at every value.
	 */
	"account.setup.title": "Completa tu perfil",
	"account.setup.body":
		"Así la tienda sabe a quién llamar y a dónde llevar el pedido.",
	"account.setup.progress": "{done} de {total}",
	"account.setup.name": "Tu nombre",
	"account.setup.phone": "Un teléfono de contacto",
	"account.setup.photo": "Una foto de perfil",
	"account.setup.address": "Una dirección guardada",

	/* Appearance. `settings.theme.help` is the hint on the control that is *not* a
	   destination: a segmented control announces its own label and its chosen value, but not
	   what "Sistema" means, and that is the whole question a reader has about it. */
	"settings.theme": "Tema",
	"settings.theme.system": "Sistema",
	"settings.theme.light": "Claro",
	"settings.theme.dark": "Oscuro",
	"settings.theme.help": "Sistema usa el ajuste de tu teléfono",

	/* The inbox. `inbox.empty.body` states what will appear rather than apologising for the
	   space — the reader has not lost anything, they have simply not been told anything yet. */
	"inbox.title": "Bandeja de entrada",
	"inbox.empty.title": "No tienes avisos",
	"inbox.empty.body":
		"Aquí llegan las novedades de tus pedidos y las respuestas de las tiendas.",
	/* Only on a row that actually leads somewhere — a notification whose `data` carries an
	   `orderId`. A reply to a review carries a `businessId` and no slug, so its row is not
	   pressable at all and never reads this. */
	"inbox.row.help": "Abre el pedido",

	/* Help. The four questions are the four things a customer actually asks a marketplace,
	   and each answer says what the *app* does about it rather than what a policy says — a
	   FAQ that restates terms is a document, not help. */
	"help.title": "Ayuda",
	"help.faq.title": "Preguntas frecuentes",
	"help.faq.track.title": "¿Dónde está mi pedido?",
	"help.faq.track.body":
		"En Pedidos, abre el pedido y verás en qué paso va y desde cuándo.",
	"help.faq.cancel.title": "¿Puedo cancelar un pedido?",
	"help.faq.cancel.body":
		"Sí, mientras la tienda no lo haya empezado a preparar. El botón está dentro del pedido y te dice si todavía se puede.",
	"help.faq.problem.title": "Algo salió mal con mi pedido",
	"help.faq.problem.body":
		"Abre el pedido y usa el botón para contactar a la tienda. Ahí mismo queda el registro de lo que pasó.",
	"help.faq.delivery.title": "¿Cómo funcionan el envío y el retiro?",
	"help.faq.delivery.body":
		"Cada negocio decide si entrega a domicilio, si puedes recoger, o ambas. El costo y el mínimo aparecen en su ficha antes de que pidas.",
	"help.orders": "Ver mis pedidos",
	"help.orders.help": "Abre la pestaña de pedidos",
	"help.safety": "Consejos de seguridad",
	"help.safety.help": "Abre la pantalla de seguridad",

	/*
	 * Safety.
	 *
	 * `safe.emergency.number` is a *value* and not a `common.ts` key because it is a fact
	 * about a country and not a word: Costa Rica's emergency line is 911, and a translated
	 * "911" would be a number that does not answer. It is in the dictionary anyway so the
	 * call site never holds a literal — the string is data, and data belongs with the copy.
	 *
	 * The three tips are the three that apply to a marketplace where somebody hands over
	 * money at a door, and none of them is generic advice: each one names a control that is
	 * actually in this app.
	 */
	"safe.title": "Seguridad",
	"safe.intro":
		"PymesHub conecta vecinos con negocios de su zona. Estos son los cuidados que recomendamos.",
	"safe.emergency": "Emergencias",
	"safe.emergency.number": "911",
	"safe.emergency.body":
		"Si estás en peligro, llama primero. Después cuéntanos qué pasó.",
	/* The heading over the three tips. A section name, not a destination — the three cards
	   under it are the content, and without it they are three surfaces with no reason to be
	   grouped. */
	"safe.tips.title": "Recomendaciones",
	"safe.tip.meet.title": "Revisa antes de pagar",
	"safe.tip.meet.body":
		"El nombre, el precio y el costo de envío están en la ficha del negocio. Si algo no coincide con lo que te dijeron, no confirmes el pedido.",
	"safe.tip.share.title": "Comparte el pedido",
	"safe.tip.share.body":
		"El número del pedido y su estado están en la app. Si alguien te espera, mándale esa pantalla.",
	"safe.tip.cash.title": "Paga por la app cuando puedas",
	"safe.tip.cash.body":
		"Un pedido hecho por la app queda registrado con su número y su hora. Un arreglo por fuera no lo podemos revisar.",
	"safe.report.title": "Reportar un problema",
	"safe.report.body":
		"Abre el pedido y contacta a la tienda desde ahí. Si el problema es con la tienda misma, escríbenos desde el mismo pedido y queda el registro.",
} as const;
