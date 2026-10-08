/**
 * Spanish — everything that is not a screen of its own: the app's frame, its
 * buttons, its failures, and the words a customer reads when something went wrong.
 *
 * Voice: **second person, informal** (`tu pedido`, not `su pedido`). A marketplace
 * serving a neighbourhood shop talks like the shop does; `usted` reads like a bank,
 * and the whole point of the product is that the shop is around the corner.
 *
 * Never blame the reader in a message. `"Revisa tu conexión"` is a guess about their
 * network; `"No pudimos cargar esto"` is a fact about us.
 */
export const common = {
	"app.name": "PymesHub",
	"app.tagline": "Lo que necesitas, de negocios cerca de ti",

	/**
	 * The navigation landmark's own name, for a screen reader's landmark list.
	 *
	 * "Inicio" was used here first and is wrong: the landmark and the tab would both be
	 * announced as "Inicio", so the list reads "Inicio, Inicio" and a reader cannot tell
	 * the container from the first item in it.
	 */
	"nav.primary": "Principal",
	"nav.home": "Inicio",
	"nav.search": "Buscar",
	"nav.cart": "Carrito",
	"nav.orders": "Pedidos",
	/*
	 * The orders tab's badge, in words. The number is drawn on the tab; this is what a screen
	 * reader is given instead, because a badge is a picture of a number and the tab's name has
	 * to be repeated around it — the call site composes `"Pedidos" + ", " + this`, since setting
	 * `tabBarAccessibilityLabel` replaces the composed label rather than adding to it.
	 *
	 * Both forms read the same, and that is Spanish rather than an oversight: *en curso* is a
	 * prepositional phrase with no noun to agree with, so "1 en curso" and "3 en curso" are both
	 * correct. The `_plural` sibling is not optional anyway — `tp` only accepts a key that has
	 * one (`PluralKey`), which is exactly what stops a translator from being handed a language
	 * whose plural rule nobody wrote down.
	 */
	"nav.orders.badge": "{count} en curso",
	"nav.orders.badge_plural": "{count} en curso",
	/*
	 * The same fact when the page came back full, so the count is a floor and not a number:
	 * the badge draws `20+` and this says why. `{count}` is the page size the read asked for,
	 * so it is the *limit* and never the total — a total would be a second query for a tab
	 * label, which is what `docs/design-mobile.md` means by a badge that needs a cheap count.
	 */
	"nav.orders.badge.more": "más de {count} en curso",
	"nav.account": "Cuenta",
	"nav.favorites": "Favoritos",

	"action.retry": "Reintentar",
	/*
	 * Not a synonym of `action.retry` above: retrying is what you do after something
	 * failed, refreshing is what you do when the screen is fine and you want it newer. A
	 * control that says "Reintentar" on a working screen is telling the customer something
	 * went wrong when nothing did.
	 */
	"action.refresh": "Actualizar",
	"action.cancel": "Cancelar",
	"action.confirm": "Confirmar",
	"action.save": "Guardar",
	"action.close": "Cerrar",
	"action.back": "Volver",
	/*
	 * The two arrows of a paged list, and a pair rather than one key: `action.next` existed
	 * alone and nothing read it, so every table that paged spelled the other direction itself
	 * — `TablePagination` in `packages/ui` falls back to these same two words, and the admin
	 * footer passed neither, which put "Anterior" and "Siguiente" in an English console.
	 */
	"action.previous": "Anterior",
	"action.next": "Siguiente",
	"action.edit": "Editar",
	"action.delete": "Eliminar",
	/*
	 * The word that takes a write back, and the toast's only action — interface.md
	 * §46's trailing `Undo`. Never drawn on a write that cannot be reversed:
	 * `components/toast`'s `show()` takes the callback beside the sentence or takes
	 * nothing, so a toast carrying this word always has a button that does the thing.
	 */
	"action.undo": "Deshacer",
	"action.continue": "Continuar",
	"action.signIn": "Iniciar sesión",
	"action.signOut": "Cerrar sesión",
	"action.signUp": "Crear cuenta",
	"action.viewAll": "Ver todo",
	/*
	 * The photo pair, and the way out of one. "Subir" and "Tomar" are two different
	 * acts and the buttons say which: a gallery pick and a camera capture are not
	 * synonyms, and a single "Agregar foto" leaves the owner to discover which one
	 * the tap opened. `biz.products.photo.add` still exists for the empty state's
	 * own invitation; these two are the controls.
	 */
	"action.uploadPhoto": "Subir foto",
	"action.takePhoto": "Tomar foto",
	"action.removePhoto": "Quitar foto",
	/*
	 * When the camera is off-limits, not when we broke. "Algo salió mal de nuestro lado"
	 * would blame the app for a choice the reader made in a system dialog, and the fix is
	 * in the phone's settings rather than a retry. The sentence names where, because that
	 * is the only thing left to do.
	 */
	"state.error.cameraDenied":
		"Sin acceso a la cámara. Puedes activarlo en los ajustes del teléfono.",

	"state.loading": "Cargando…",
	"state.saving": "Guardando…",
	"state.empty": "Aquí no hay nada todavía",
	"state.error.title": "No pudimos cargar esto",
	"state.error.body":
		"Es de nuestro lado, no tuyo. Intenta de nuevo en un momento.",
	/*
	 * Para una negativa que la*petición*se ganó — un `BAD_REQUEST` o un `CONFLICT`, donde la
	 * API decidió la respuesta en vez de fallar al producirla. Pedir un pedido a las 22:07 en
	 * una tienda que cierra a las 20:00 es un `ValidationError`: no se rompió nada, la
	 * respuesta es "ahora no", y no es cosa nuestra disculparse. Decir "es de nuestro lado"
	 * ahí mandó al cliente a soporte con un código de petición por una tienda cerrada — ver
	 * `apps/mobile/lib/api-error.ts` y su `DEFAULT_KEYS`.
	 */
	"state.error.rejected":
		"No pudimos hacer eso. Revisa los detalles e inténtalo de nuevo.",
	/*
	 * The one-line sibling of `state.error.body`, for a failed *action* rather than a failed
	 * screen: it sits under the button that did not work, in a screen that is otherwise fine.
	 * "Es de nuestro lado, no tuyo. Intenta de nuevo en un momento." is the right sentence
	 * when the page itself is the error and too much of one when one tap failed.
	 *
	 * The words are deliberately the same ones `apps/api`'s `InternalError` carries, so a
	 * reader sees one sentence for "we broke" whether it came over the wire or was chosen
	 * here — that path is reached when the API wrote no message at all (a dropped
	 * connection, a body the client never parsed), which is the same fact the API's own
	 * sentence states.
	 */
	"state.error.inline": "Algo salió mal de nuestro lado",
	"state.error.requestId":
		"Si vuelve a pasar, menciónale este código a soporte: {requestId}",

	/*
	 * `crash.*` — the screen after a render error, and the only screen in the app that
	 * cannot use the theme or the dictionary provider.
	 *
	 * It is rendered by `Sentry.GlobalErrorBoundary` around `RootLayout` itself, so
	 * `ThemeModeProvider`, `I18nProvider` and everything below them are *not* above it:
	 * `useTheme()` throws rather than guess (`theme/scope.tsx`) and `useT()` does the same
	 * (`lib/i18n.tsx`). The words therefore still come from here — through a translator built
	 * from `deviceLocale()` instead of from context — because a hard-coded Spanish string on a
	 * crash screen is the one string in the app a customer in English is guaranteed to meet.
	 *
	 * `crash.reported` is conditional and means what it says: the boundary only draws it when
	 * `reportCrash` resolved. A reporter that fails open would otherwise put "we've got it"
	 * in front of a person whose report went nowhere, which is worse than saying nothing.
	 */
	"crash.title": "Se nos rompe algo",
	"crash.body":
		"Volvé a intentarlo. Si sigue igual, ya lo registramos para arreglarlo.",
	"crash.retry": "Intentar de nuevo",
	"crash.reported": "Ya lo registramos. Gracias.",

	"state.offline": "Sin conexión",
	"state.offline.body": "Sigue intentando. Lo que ya viste sigue disponible.",
	/* Where a paginated list ends. Six lists in this app stop the same way — the four browse
	   lists, the storefront's two, and the customer's own order history — and each of them used
	   to render `null` at the end, which made "that was everything" and "the next page never
	   came" the same empty space. Not a `discovery.*` key and not an `order.*` one: it is a
	   statement about a list, and it is the same statement on all six. */
	"state.listEnd": "No hay más que mostrar",

	"form.required": "Este campo es obligatorio",
	"form.optional": "opcional",
	"form.invalidEmail": "Escribe un correo válido",
	"form.tooShort": "Escribe al menos {min} caracteres",
	"form.tooLong": "Máximo {max} caracteres",
	/** El par que cuenta lo mismo que la regla: dígitos, no caracteres. */
	"form.phone.tooShort": "Escribe al menos {min} dígitos",
	"form.phone.tooLong": "Máximo {max} dígitos",
	"form.saveFailed": "No pudimos guardar los cambios",

	"unit.minutes": "{count} min",
	"unit.minutes.short": "{count} min",
	"unit.minute": "min",
	"unit.hour": "h",
	"unit.day": "d",
	"unit.year": "a",
	"unit.km": "{value} km",
	"unit.km.short": "{value} km",

	"locale.es": "Español",
	"locale.en": "English",
	"locale.switch": "Cambiar idioma",

	"a11y.skipToContent": "Saltar al contenido",
	"a11y.openMenu": "Abrir menú",
	"a11y.closeMenu": "Cerrar menú",
	"a11y.loading": "Cargando",
	"a11y.goBack": "Volver atrás",
	/*
	 * The dismiss hint on the toast. A *hint* and not a label, which is the distinction the
	 * surface already draws: `components/toast.tsx` puts `accessibilityRole="alert"` and
	 * `accessibilityLiveRegion="polite"` on the pressable, so the message itself is announced
	 * when it appears. A label here would make that announcement happen twice — once as the
	 * message, once as the thing you are standing on.
	 *
	 * An instruction rather than a bare verb. The hint is read *after* the message and has to
	 * say what the tap does to it, and "Descartar" on its own leaves the reader to work out
	 * what is being discarded — the toast is not a named object on the screen, it is the
	 * sentence that was just spoken. Naming it is what makes the hint stand alone.
	 */
	"a11y.dismissToast": "Cierra el aviso",
	/*
	 * La pista del aviso de pedido nuevo. No se descarta, se abre: la orden sigue ahí
	 * detrás y el control lleva al operador hasta ella. Por eso es una instrucción con
	 * objeto y no un verbo suelto — la misma razón que `a11y.dismissToast`.
	 */
	"a11y.reviewNewOrder": "Abre el pedido",
	"money.minorUnits": "unidades mínimas",
	"action.saving": "Guardando…",
	"action.loadMore": "Cargar más",
	"action.view": "Ver detalle",
	"biz.staff.existingAccount":
		"Agrega a una persona que ya tenga cuenta en PymesHub. El acceso se asigna directamente; no se envía un correo.",
	"auth.password.minimum": "Usa al menos 12 caracteres.",
	"auth.password.show": "Mostrar contraseña",
	"auth.password.hide": "Ocultar contraseña",
	"address.label": "Nombre de la dirección",
	"address.line1": "Calle y número",
	"address.city": "Ciudad",
	"address.region": "Provincia",
	"home.hero.eyebrow": "Tu barrio, a un toque",
	"home.hero.title": "Lo bueno está cerca.",
	"home.hero.description":
		"Descubre lo que hacen los negocios de tu comunidad. Pide tus favoritos, recógelos o recíbelos donde estés.",
	"home.hero.action": "Explorar negocios",
} as const;
