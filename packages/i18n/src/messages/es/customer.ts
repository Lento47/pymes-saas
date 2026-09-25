/**
 * Spanish — everything a customer sees: the feed, a storefront, a product, the cart,
 * checkout, and watching an order arrive.
 *
 * The tone that matters most is the tracking screen's. A customer staring at "en
 * preparación" for eleven minutes is deciding whether to trust the app, so the copy
 * there states what is happening and never promises a time we cannot keep. There is
 * no "¡casi listo!" anywhere below, because we do not know that.
 */
export const customer = {
	"home.greeting": "Hola, {name}",
	"home.greeting.anon": "¿Qué necesitas hoy?",
	/* The avatar's own hint. The label is the customer's name, which does not say
	 * where the tap goes — see `settings.ts`'s hint rule for a pressable that leads
	 * somewhere. */
	"home.greeting.avatar.help": "Abre tu cuenta",
	/*
	 * Why a device that asked for a role is drawing the customer stack anyway. Two
	 * sentences and never one: the read failing and the membership being gone are different
	 * problems with different next actions (`docs/architecture.md` §8). They sit in this
	 * file beside the role-resolution copy rather than in `auth.ts` with the rest of
	 * `account.profile.*`, because the only reader is the customer stack's entry — one key,
	 * one reader, one place to look.
	 */
	"account.profile.degraded.unreachable":
		"No pudimos verificar tu perfil, así que estás en la vista de cliente.",
	"account.profile.degraded.ended":
		"Tu membresía terminó, así que estás en la vista de cliente.",
	"home.categories": "Categorías",
	"home.featured": "Recomendados",
	/*
	 * The featured grid with nothing in it, on the full list behind "Ver todo". A section on
	 * the feed can be absent without explaining itself — it is one band among several and the
	 * screen still has a job — but a *page* the customer navigated to has to say something, or
	 * it reads as a failure to load.
	 *
	 * It is not a shop that is closed and not a search that found nothing, which is why it is
	 * not `catalog.search.empty.*`: nothing was asked for here and nothing is wrong. The body
	 * points at the one thing that does have content, rather than leaving the reader on a dead
	 * end they reached on purpose.
	 */
	"home.featured.empty.title": "Todavía no hay recomendados",
	"home.featured.empty.body":
		"Cuando haya negocios destacados van a aparecer acá. Mientras tanto, mirá las categorías.",
	/*
	 * The feed's heading when there is no coordinate to be near.
	 *
	 * The screen had one heading for both states, `home.nearby`, and the list under it is
	 * `catalog.feed`'s `nearby`: with a coordinate the closest shops, and without one the
	 * newest, as `(tabs)/index.tsx`'s own docblock states. So "Cerca de ti" headed a list
	 * ordered by arrival time on exactly the sessions where the app does not know where the
	 * customer is — the claim was false in the only case it appeared, and the customer had no
	 * way to tell it apart from the state where it was true. This says what the list is.
	 */
	"home.newest": "Recién llegados",
	"home.nearby": "Cerca de ti",
	"home.nearby.empty": "Todavía no hay negocios que entreguen en tu zona",
	/*
	 * The same empty state with no coordinate behind the request. `home.nearby.empty` claims a
	 * zone — "no deliver to your area" — and with no `lat`/`lng` the API filtered by no area at
	 * all, so the sentence invented a fact about a place it never asked about. This one states
	 * the fact it does have: nothing is published yet.
	 */
	"home.nearby.empty.all": "Todavía no hay negocios publicados",
	"home.nearby.enableLocation": "Activa tu ubicación para ver qué hay cerca",
	/*
	 * The affordance that makes the sentence above actionable, and why it is a separate key.
	 * `home.nearby.enableLocation` is the prompt — a full sentence, read as body copy beside
	 * the section it explains; this is the label on the button that does it. One string cannot
	 * be both: a Button whose label is "Activa tu ubicación para ver qué hay cerca" is a
	 * paragraph in a 44pt target.
	 */
	"home.nearby.enableLocation.action": "Activar ubicación",
	"home.search.placeholder": "Busca productos o negocios",
	/*
	 * The two offer rails on the feed, and the three sentences a promotion card can carry.
	 *
	 * ## Why the headings are two and not one
	 *
	 * `home.offers` heads products whose price is already lower and `home.promotions` heads
	 * shops holding a code. They are different objects with different taps behind them — one
	 * opens a product where the discount is already applied, the other opens a shop where a
	 * basket has to be filled before the code is worth anything. One heading over both would
	 * be one heading over two promises, and the card itself cannot say which is which: a
	 * struck-through price and an untyped code look equally like "a deal".
	 *
	 * ## The three promotion sentences, and why there is no fourth
	 *
	 * There are exactly three because `PROMOTION_KINDS` has exactly three members, the same
	 * way `cart.promotion.error.*` mirrors its own closed set. A fourth sentence here would
	 * be copy for a code the API cannot issue, and a missing one would be a card that renders
	 * a raw `kind` at a customer — the failure mode `keys.test.ts` cannot catch, because the
	 * key set is closed and the *branch* is what would be incomplete.
	 *
	 * What each says is what the code is *worth*, and none of them names the code — because
	 * the code is a chip of its own one line below (`home.promotion.code`), and a sentence
	 * that printed it too would put the same eleven characters on the card twice. The word
	 * for the worth is the kind's own: a percent, an amount of money, or the delivery fee.
	 *
	 * `{amount}` is pre-formatted by the client through `formatMoney`, which is the only code
	 * that knows CRC is not divided by 100 and USD is. A number formatted into a sentence here
	 * would be a second implementation of that.
	 */
	"home.offers": "Ofertas",
	"home.promotions": "Cupones",
	/* Rails the feed does not name: repeat orders, the popular sort, and the
	   free-delivery cut of nearby — all reads the API already answers. */
	"home.orderAgain": "Pide de nuevo",
	"home.popular": "Populares ahora",
	"home.freeDelivery": "Envío gratis",
	"home.activeOrder": "Pedido en curso",
	/* Under a kilometre away, and a badge rather than a chip row entry: at that
	   range the distance stops being a comparison and becomes the reason to go. */
	"home.veryClose": "Muy cerca",
	"home.promotion.percent": "{percent}% de descuento",
	"home.promotion.fixed": "{amount} de descuento",
	"home.promotion.freeDelivery": "Envío gratis",
	/*
	 * The code itself, and the one string on this card that is both drawn and spoken — the
	 * pattern `./product-row` sets for its availability line, and for the same reason: a card
	 * is a single `Pressable` whose explicit label *replaces* its children for a screen
	 * reader, so a drawn code and a separately-composed spoken one are two strings that
	 * drift. This is the whole point of the card, so it is a chip rather than the tail of the
	 * sentence above it: it is the one thing on the surface the customer is meant to carry
	 * away, and it has to be findable by looking rather than by reading.
	 *
	 * "Código" and not a bare `{code}`: `YUNTA10` alone on a chip reads as a category or a
	 * tag, and the customer has no way to know it is something they type at checkout. The
	 * word is the label and the code is the value, which is how the promo field in the cart
	 * already draws the same pair (`cart.promotion`: "Código de descuento").
	 */
	"home.promotion.code": "Código {code}",
	/*
	 * Where the card goes, for the screen reader. A card is not a chevron row and has no
	 * arrow to promise anything, so the destination is the half of the press that only a
	 * label can say — `settings.ts`'s rule for every other pressable on this platform.
	 */
	"home.promotion.help": "Abre el negocio",

	"search.title": "Buscar",
	/*
	 * "Mostrando", and not a bare "{count} resultados". `catalog.search` caps what it
	 * returns — 20 products, 10 businesses, 10 categories — so the count a client can
	 * compute is what it was *given*, not what exists. Both clients printed that number as
	 * a flat total, which said "30 resultados" about a query that may have matched a
	 * hundred. "Mostrando" is true in every case: under the cap it is everything, over it
	 * it is honestly the first page. A real total means a `total` on the procedure.
	 *
	 * A pair, read with `tp`. "Mostrando" fixed what the sentence claimed about the total;
	 * it did nothing about the noun, so a search matching exactly one thing still read
	 * "Mostrando 1 resultados" — the plural form with a count of one, which is the same
	 * defect this dictionary was just swept for. Both halves were needed.
	 */
	"search.results": "Mostrando {count} resultado",
	"search.results_plural": "Mostrando {count} resultados",
	"search.products": "Productos",
	"search.businesses": "Negocios",
	/* The third group `ProductSearchResult` carries — see the search screen's note. */
	"search.categories": "Categorías",
	"search.empty.title": "No encontramos nada con eso",
	"search.empty.body":
		"Prueba con otra palabra, o mira lo que hay cerca de ti.",
	"search.recent": "Búsquedas recientes",
	"search.clear": "Limpiar",

	"category.all": "Todo",
	/*
	 * A slug that `catalog.categories` does not carry. It is not "no results": the link is
	 * wrong, and the only honest thing to do with a wrong link is say so. No apology and no
	 * "inténtalo más tarde" — nothing is retrying, nothing is late.
	 *
	 * The body used to end with a second sentence telling the reader to look at the category
	 * strip above the panel. That instruction was never followable. `CategoryStrip` is
	 * rendered by `app/(shop)/category/[slug]/page.tsx`, and that page calls `notFound()`
	 * before it draws anything — the strip, the heading and the grid are all inside the
	 * branch the 404 replaces, so the panel carrying this sentence had no category strip
	 * anywhere on the screen, above it or below it. A sentence pointing at a control that is
	 * not there is worse than no sentence: the reader looks, finds nothing, and stops
	 * trusting the next instruction too. What is left is the half that is true.
	 */
	"category.unknown.title": "No tenemos esa categoría",
	"category.unknown.body": "Puede que el enlace esté viejo.",
	/* A category that exists with nothing in it yet. Says that, promises nothing. */
	"category.empty.title": "Todavía no hay negocios aquí",
	"category.empty.body": "Mira otra categoría, o busca por nombre.",

	"store.title": "Negocio",
	"store.open": "Abierto",
	"store.closed": "Cerrado",
	"store.closed.until": "Cerrado · abre {time}",
	"store.hours": "Horario",
	"store.hours.today": "Hoy: {range}",
	"store.hours.closedToday": "Hoy cerrado",
	/*
	 * The marker on the row that is today, in the hours table. One word, not the
	 * `store.hours.today` sentence above it: that key names the range and belongs in the
	 * line that *is* the day's hours, and this one sits beside a range that is already
	 * printed in its own column. Reusing the sentence here would print "Hoy: 09:00–18:00"
	 * next to "09:00–18:00".
	 *
	 * It is a word rather than a weight because the table marks today by *bolding* the row
	 * too, and `hours-table` is right that the emphasis is the second signal and the ink is
	 * not a signal at all — for a reader who cannot see the weight, this is the only signal
	 * there is.
	 */
	"store.today": "Hoy",
	/*
	 * One page of the shop's photo strip, spoken. The position is the one thing a static
	 * picture cannot say for itself, and the dots underneath are the only other place it is
	 * written — so a reader who cannot see them has no way to know how many there are or
	 * where this one sits.
	 *
	 * `{index}` is one-based (`index + 1` at the call site) because "Imagen 0 de 3" is a
	 * sentence no one says, and neither number is pluralised: both are counters inside a
	 * sentence whose noun is already singular, which is why there is no `_plural` sibling
	 * and why this key is read with `t` and never `tp`.
	 */
	"gallery.image.label": "Imagen {index} de {count}",
	"store.verified": "Verificado",
	/*
	 * The second badge a card can carry, beside `store.verified`. Two words because a card
	 * that said only "Verificado" left the other tier with no dictionary entry at all, so
	 * `business-card` in `packages/ui` kept the pair as a hardcoded Spanish map.
	 */
	"store.topRated": "Mejor valorado",
	"store.delivery": "Entrega",
	"store.delivery.fee": "Envío {amount}",
	"store.delivery.free": "Envío gratis",
	"store.pickup": "Retiro en el local",
	/*
	 * The chip pair beside the two sentences above. A card's fact row is four chips wide, and
	 * a sentence in that row is four chips where three would fit — `business-card` chooses
	 * between the long and the short form by *where it is drawing*, which is a branch and not
	 * a translation, so both forms have to exist as keys.
	 *
	 * The short forms are abbreviations, and an abbreviation is a locale's own: "Mín." is
	 * Spanish punctuation on a Spanish word, and neither the period nor the word survives
	 * translation. That is the whole reason these are keys rather than a `slice(0, 8)` at the
	 * call site.
	 */
	"store.pickup.short": "Retiro",
	"store.minOrder": "Pedido mínimo {amount}",
	/*
	 * The chip form of the line above — see the note on `store.pickup.short`. `{amount}` is
	 * `formatMoney`'s output and arrives already formatted, so the sentence around it is the
	 * only thing here that is a translator's.
	 */
	"store.minOrder.short": "Mín. {amount}",
	"store.prepTime": "{count} min de preparación",
	"store.deliveryRadius": "Entrega hasta {value} km",
	/*
	 * The review count under the stars, on a shop and on a product alike. The base key is the
	 * singular form and the plural is its `_plural` sibling — the convention `tp` enforces, so
	 * this pair cannot be read with `t()` again. It was, at all three call sites, and the
	 * sentence a shop with a single review printed was "1 reseñas".
	 */
	"store.rating.count": "{count} reseña",
	"store.rating.count_plural": "{count} reseñas",
	/*
	 * The sentence a screen reader hears for a star row, and the reason it is a key and not a
	 * branch in a component: an `aria-label` is *spoken*, so it is customer-visible copy, and
	 * `packages/ui` has no translator. The star row used to build "4.7 de 5, 128 reseñas" in
	 * Spanish for every reader in every language — an English product page announced it in
	 * Spanish — which is the leak `price.tsx`'s "antes" and `product-card.tsx`'s "Agregar" were.
	 *
	 * `{value}` is `formatRating`'s output, already one decimal or none. The "de 5" and the
	 * comma live here rather than being glued on at the call site, because the order of those
	 * three pieces is the translator's to choose, not the component's.
	 *
	 * `store.rating.label` is the whole sentence for a row with no count and is read with `t`;
	 * `store.rating.label.count` is the pair for a row with one and is read with `tp`, so a
	 * shop with a single review is spoken as "1 reseña".
	 */
	"store.rating.label": "{value} de 5",
	"store.rating.label.count": "{value} de 5, {count} reseña",
	"store.rating.label.count_plural": "{value} de 5, {count} reseñas",
	"store.products": "Productos",
	/*
	 * The search field inside one shop, and it says *where* because that is the whole
	 * difference from the app's own `search.placeholder`: both fields look alike, and a customer
	 * who lands in this one after using the global search has to be able to tell that this one
	 * will not leave the shop. It names the shop only as "este negocio" — the name is already in
	 * the header directly above, and a placeholder that repeated it would be a second heading.
	 */
	"store.search.placeholder": "Buscar en este negocio",
	/*
	 * How many products a category holds, beside the category's own name. `{count}` is the
	 * server's `productCount` and not the length of the page below it: the number names the
	 * group's size, so it must not shrink as the reader pages through the group. Where a search
	 * has no such field, the screen uses `search.results` instead — the two keys exist because
	 * the two numbers mean different things, one a category's size and one a response's.
	 *
	 * Two forms, because *producto* is a noun: "1 producto", "3 productos".
	 */
	"store.category.count": "{count} producto",
	"store.category.count_plural": "{count} productos",
	"store.reviews": "Reseñas",
	"store.reviews.empty": "Todavía no tiene reseñas",
	"store.reviews.reply": "Respuesta del negocio",
	"store.info": "Información",
	"store.address": "Dirección",
	"store.phone": "Teléfono",
	"store.callBusiness": "Llamar al negocio",
	"store.directions": "Cómo llegar",
	"store.notFound": "No encontramos este negocio",
	"store.notFound.body":
		"Puede que el enlace esté viejo. Busca el negocio por nombre.",
	"store.suspended": "Este negocio no está disponible por ahora",

	/*
	 * The badge words that are *words*, and the fourth that deliberately is not one.
	 *
	 * `badgesOf` (`apps/api/src/services/mappers.ts:241-269`) derives every chip from a column
	 * and sends `{ type, label }` with the label written in Spanish at the server — "Nuevo",
	 * "Popular", "-25%", "Domicilio". Three of those four are interface words *about* a product
	 * rather than the product's own name, so a screen drawing `badge.label` stays Spanish on a
	 * phone set to English. `apps/mobile/app/product/[id].tsx`'s `BADGE_KEYS` map reads exactly
	 * these three and is total over `ProductBadge["type"]`, so a fifth derived badge is a compile
	 * error there rather than an untranslated chip on a screen.
	 *
	 * The Spanish is the server's own word for each, character for character, because
	 * `apps/web/components/catalog/product-grid.tsx:96` draws the same chips from `product.badges`
	 * — two clients showing one product under two words for one badge is the drift this pair of
	 * files exists to prevent.
	 *
	 * `discount` is the fourth badge and has no key: its label is the percentage itself, built at
	 * `mappers.ts:253` from `discountPercentOf` and rendered as "-25%". That is a figure computed
	 * from two prices rather than a word, and the sentence form of it — `product.discount` below
	 * — would have to drop the number to fit in a chip.
	 */
	"product.badge.new": "Nuevo",
	"product.badge.popular": "Popular",
	"product.badge.shipping": "Domicilio",
	"product.add": "Agregar",
	/* The quick-add target names the product: a bare "Agregar" is indistinguishable
	 * between rows once a card's own label has replaced its children for a reader. */
	"product.add.named": "Agregar {name}",
	/*
	 * The confirmation toast, and it carries `{name}` because a customer who tapped twice in a
	 * row needs to know *which* tap landed. The product's own title goes in rather than a
	 * pronoun: the screen behind the toast may have scrolled since the tap.
	 *
	 * A sentence and not a fragment, because the toast is read on its own — `product.quantity`
	 * and the stepper's labels are read *inside* a control that already names the product, and
	 * the same string would arrive here with nothing to attach to.
	 */
	"product.added": "Agregaste {name}",
	"product.adding": "Agregando…",
	"product.chooseOptions": "Elegir opciones",
	/*
	 * The floor of a multi-choice group, above the choices. `{count}` is 2 or more — the group
	 * only draws this line above that threshold, because below it the required marker already
	 * says the same thing and a `SINGLE` group cannot have a floor above one.
	 *
	 * No `_plural` sibling, deliberately: the count is inside a phrase with no noun to agree
	 * with ("al menos 2", not "al menos 2 opciones"), so there is nothing for a plural form to
	 * change. A `_plural` here would be a second key with identical text.
	 *
	 * The verb was `Elegí` — the voseo imperative — and it is now `Elige`. The dictionary's own
	 * voice is *tú* everywhere else it gives an instruction, including three keys below this one
	 * ("Elige las opciones para continuar"), `category.empty.body`'s "Mira otra categoría" and
	 * `discovery.filters.empty.body`'s "Quita un filtro, o mira otra categoría" — so this was the
	 * odd one out by the file's own evidence, and voseo is not the address a Costa Rican reader
	 * expects. `home.featured.empty.body`'s "mirá las categorías" is the one other voseo in the
	 * dictionary; it is a separate defect and was reported rather than swept, because no lane
	 * supplied a replacement for it.
	 */
	"product.select.min": "Elige al menos {count}",
	"product.quantity": "Cantidad",
	/*
	 * The two directions of the quantity stepper. They are sentences rather than "+" and
	 * "−" because that is what a screen reader reads out: a glyph is a syllable nobody can
	 * act on, and "Quitar uno" is the whole instruction. Both are the *spoken* name of a
	 * control, never painted — the ink stays the +/- the eye expects.
	 */
	"product.quantity.decrease": "Quitar uno",
	"product.quantity.increase": "Agregar uno",
	/* Marks an option group the customer must choose from before the product can be added. */
	"product.required": "Obligatorio",
	"product.notes": "Notas para el negocio",
	"product.notes.placeholder": "Sin cebolla, por favor",
	"product.soldOut": "Agotado",
	/*
	 * How many of this dish have been bought — social proof, on the fact row under the title.
	 * Distinct from `product.soldOut` above and adjacent to it in spelling only: one is a state
	 * ("Agotado") and one is a count, and the screen draws the count **only when it is above
	 * zero**, because "0 vendidos" is a claim about a dish nobody has bought printed beside the
	 * button inviting the first one.
	 *
	 * Two real forms, unlike the tab badge's: *vendido* is a participle and agrees, so a single
	 * sale is "1 vendido" and three are "3 vendidos".
	 */
	"product.sold": "{count} vendido",
	"product.sold_plural": "{count} vendidos",
	"product.unavailable": "No disponible hoy",
	"product.related": "También te puede gustar",
	"product.description": "Descripción",
	"product.sku": "Código",
	"product.discount": "{percent}% de descuento",
	"product.compareAt": "antes {amount}",
	// The same word on its own, for the surfaces that draw the amount themselves and need
	// only the word in front of it — `packages/ui`'s `Price`, which has no translator.
	"product.compareAtWord": "antes",
	"product.outOfStock": "Sin existencias",
	"product.lowStock": "Queda {count}",
	/*
	 * Two real forms, and the singular is a correction: this key read "Quedan {count}" for every
	 * count, so the last unit of a dish was announced as "Quedan 1". *Quedar* agrees with what is
	 * left, which is the same shape as `product.sold` above and is why this key has a `_plural`
	 * sibling while `product.select.min` does not — there, the count sat inside a phrase with no
	 * word to agree with. Both forms are drawn, on the menu row and on the product page, wherever
	 * the count caps what can be ordered.
	 */
	"product.lowStock_plural": "Quedan {count}",
	"product.notFound": "No encontramos este producto",
	"product.notFound.body":
		"Puede que el enlace esté viejo. Busca el producto por nombre.",
	"product.requiresOptions": "Elige las opciones para continuar",
	"product.optionPrice": "+{amount}",

	/* The two words the sticky cart bar draws. They are labels and not sentences, which
	 * is why `cart.title` ("Tu carrito") and `cart.checkout` ("Continuar al pago") cannot
	 * be reused here — a bar button and a screen heading are not the same string. */
	"cart.bar.viewCart": "Ver carrito",
	"cart.bar.checkout": "Ir al pago",
	"cart.title": "Tu carrito",
	"cart.empty.title": "Tu carrito está vacío",
	"cart.empty.body": "Cuando agregues algo, aparece aquí.",
	"cart.empty.action": "Ver negocios cerca",
	"cart.item.remove": "Quitar",
	"cart.item.unavailable": "Este producto ya no está disponible y lo quitamos",
	"cart.subtotal": "Subtotal",
	"cart.discount": "Descuento",
	"cart.delivery": "Envío",
	"cart.tax": "Impuestos",
	"cart.tip": "Propina",
	"cart.total": "Total",
	"cart.checkout": "Continuar al pago",
	"cart.minOrderMissing": "Te faltan {amount} para el pedido mínimo",
	"cart.promotion": "Código de descuento",
	"cart.promotion.apply": "Aplicar",
	"cart.promotion.applied": "Código {code} aplicado",
	/*
	 * The toast after a code is taken off. It names no code, and that is deliberate: by the time
	 * this is shown the code has already gone from the cart the customer is looking at, and a
	 * sentence repeating it would ask the reader to check a value the screen no longer has. The
	 * removal is confirmed by the cart coming back *without* a code rather than by the request
	 * succeeding, so this sentence is only ever printed when it is true of what is on screen.
	 */
	"cart.promotion.removed": "Quitamos el código",
	/*
	 * The label the *remove* button carries while the removal is in flight. It exists because
	 * `state.saving` is "Guardando…" — saving something — and a customer taking a code off is not
	 * saving it. The button said "Guardando…" for a removal until this key landed: a verb that
	 * names the wrong action on the one control that is mid-flight, which is worse than a
	 * spinner because it is a sentence. Worded as a present participle to match `state.saving`
	 * and `state.loading`, and kept short because it replaces a two-word label on a button that
	 * must not change width mid-press.
	 */
	"cart.promotion.removing": "Quitando…",
	"cart.promotion.invalid": "Ese código no sirve",
	"cart.promotion.expired": "Ese código ya venció",
	"cart.clear": "Vaciar carrito",
	"cart.clear.confirm": "¿Vaciar tu carrito?",
	"cart.otherBusiness.title": "Tu carrito es de otro negocio",
	"cart.otherBusiness.body":
		"Solo puedes pedir a un negocio a la vez. ¿Empezamos un carrito nuevo?",
	"cart.otherBusiness.confirm": "Empezar de nuevo",
	"cart.otherBusiness.keep": "Mantener el actual",
	/*
	 * The heading over the "you might also want" rows at the bottom of the basket. A heading and
	 * not a sentence, because the block is a `ScreenSection` and every other section on the
	 * screen is named the same way — and because the rows under it are the shop's own menu, so
	 * the only new information is *why* they are here.
	 *
	 * It does not say "otros" or "más": a basket with one line still draws this, and a heading
	 * that promised products *other* than what is in the basket would be wrong on the one-line
	 * case, where the rows are simply the rest of the menu.
	 */
	"cart.suggestions.title": "De este negocio",

	"checkout.title": "Confirmar pedido",
	"checkout.fulfilment": "¿Cómo lo quieres?",
	"checkout.delivery": "Entrega a domicilio",
	"checkout.pickup": "Retiro en el local",
	"checkout.address": "Dirección de entrega",
	"checkout.address.add": "Agregar dirección",
	"checkout.address.none": "Necesitas una dirección para que te lo entreguen",
	"checkout.payment": "Forma de pago",
	"checkout.payment.cash": "Efectivo al recibir",
	"checkout.payment.sinpe": "SINPE Móvil",
	"checkout.payment.note":
		"El pago se coordina con el negocio. Todavía no cobramos en la app.",
	"checkout.tip": "Propina para el negocio",
	"checkout.tip.none": "Sin propina",
	"checkout.notes": "Notas del pedido",
	"checkout.place": "Hacer el pedido",
	"checkout.placing": "Enviando tu pedido…",
	"checkout.businessClosed": "El negocio está cerrado ahora mismo",
	"checkout.estimate": "Tiempo estimado: {minutes} min",
	"checkout.failed": "No pudimos hacer el pedido",

	"order.title": "Pedido",
	"order.number": "Pedido {code}",
	"order.placed": "Pedido hecho",
	"order.placedAt": "{date} a las {time}",
	"order.status.PENDING": "Esperando confirmación",
	"order.status.ACCEPTED": "Aceptado",
	"order.status.PREPARING": "En preparación",
	"order.status.READY": "Listo",
	"order.status.OUT_FOR_DELIVERY": "En camino",
	"order.status.COMPLETED": "Entregado",
	"order.status.CANCELLED": "Cancelado",
	"order.status.REJECTED": "Rechazado",
	"order.track": "Seguir pedido",
	"order.track.title": "Tu pedido",
	"order.track.eta": "Llega alrededor de las {time}",
	"order.track.courier": "Repartidor: {name}",
	"order.track.updated": "Actualizado {time}",
	/*
	 * A marker, not a time — and the key that made a screen lie.
	 *
	 * Both clients poll; neither holds a socket. The mobile app used to render this inside
	 * `order.track.updated`, whose `{time}` slot wants a timestamp, so the sentence a
	 * customer read under their live order was "Actualizado En vivo". It is kept because
	 * the socket-backed order screen is the planned surface this word belongs to, but it
	 * only ever labels *that* — never a `{time}`, never a `{count}`, never a `{name}`.
	 */
	"order.track.live": "En vivo",
	"order.track.reconnecting": "Reconectando…",
	/*
	 * The caption under a timeline step that did not happen.
	 *
	 * It is drawn for a state the wire allows and no producer sends today:
	 * `TimelineStep["state"]` is `"done" | "current" | "upcoming" | "skipped"`
	 * (`packages/shared/src/order-state.ts:150-152`) and `./order-timeline` draws all four, but
	 * `customerTimeline` — the one function the web tracker and this rail both read their steps
	 * from — only ever returns the other three. A refusal collapses the rail to two rows
	 * (`order-state.ts:173-177`) and the happy path maps each index against `currentIndex`
	 * (`:180-191`). The word is here so that the day a step does arrive skipped, the row says so
	 * instead of reading as a step still to come — which is the one wrong reading, because it
	 * promises work that is not going to happen.
	 *
	 * One word and not a sentence: it sits under the status word in a rail of up to eight rows,
	 * and the marker above it — a dash inside the ring — already carries the state for anyone who
	 * cannot read the caption.
	 */
	"order.track.skipped": "Omitido",
	"order.cancel": "Cancelar pedido",
	"order.cancel.confirm": "¿Cancelar este pedido?",
	"order.cancel.reason": "Cuéntanos por qué (opcional)",
	/*
	 * The customer's own cancel dialog. It used to read `biz.board.reject.help` — "El motivo
	 * le llega al cliente" — a sentence written for the shop that is rejecting an order, so
	 * the person typing their reason was told about themselves in the third person. The
	 * shop's half of that sentence stays where it belongs, on the shop's reason dialog.
	 */
	"order.cancel.reason.help": "El negocio lee tu motivo.",
	"order.cancel.tooLate":
		"Ya no se puede cancelar: el negocio empezó a prepararlo",
	"order.cancelled.by": "Cancelado por {actor}",
	/*
	 * Who `{actor}` may be, as a noun phrase with its article, so the sentence above reads
	 * "Cancelado por el negocio" and not "Cancelado por Negocio". These are the `actor`
	 * values the order's event log carries, which is what makes the attribution a fact
	 * rather than a guess about which side pressed the button.
	 */
	"order.actor.CUSTOMER": "el cliente",
	"order.actor.BUSINESS": "el negocio",
	"order.actor.COURIER": "el repartidor",
	"order.actor.ADMIN": "el equipo de PymesHub",
	"order.actor.SYSTEM": "el sistema",
	"order.items": "Lo que pediste",
	"order.deliveryTo": "Se entrega en",
	"order.pickupAt": "Se retira en",
	/*
	 * What the pickup code is for, drawn under the code itself.
	 *
	 * `apps/mobile/app/order/[id].tsx:455` (`{order.pickupCode ? (`) renders the block only when
	 * the order carries a `pickupCode`, with `order.pickup` ("Retiro") as its label above and this line below a code
	 * set at `title` size — the largest type on the card it sits in. Six characters with no
	 * instruction beside them is a number the customer has to guess the purpose of, and nothing
	 * else the screen says answers it: the code is not `order.number`, and the receipt below
	 * carries only the totals. It names the shop the way the rest of the dictionary does
	 * ("el negocio", `store.title`) rather than a counter or a till, because the one thing the
	 * customer does with the code is show it to whoever hands the order over.
	 */
	"order.pickupCode.help": "Muéstralo en el negocio al recoger",
	"order.callBusiness": "Llamar al negocio",
	"order.help": "¿Algo salió mal?",
	"order.empty.title": "Todavía no tienes pedidos",
	"order.empty.body": "Cuando hagas tu primer pedido, lo ves aquí.",
	"order.active": "En curso",
	"order.past": "Anteriores",
	"order.notFound": "No encontramos este pedido",
	"order.notFound.body":
		"Puede que el enlace esté viejo o que el pedido ya no esté disponible.",
	"order.reorder": "Pedir otra vez",
	/*
	 * What the reorder bar says around itself: the toast when it worked, and the line that says
	 * what the button is about to do.
	 *
	 * `order.reorder.added` is shown only when `orders.reorder` came back with nothing skipped —
	 * `apps/mobile/app/order/[id].tsx:232` and `(tabs)/orders.tsx:338` both read the same key and
	 * cannot import each other — and it names no product, unlike `product.added`: what was added
	 * is a whole order and it may be eight lines, so there is no single `{name}` to put in the
	 * slot. The construction is `cart.promotion.applied`'s ("Código {code} aplicado"), which is
	 * the same job — a toast confirming a write — in the same voice.
	 *
	 * `order.reorder.help` is the caption under the button, and it exists because the label
	 * alone misleads: "Pedir otra vez" reads as placing the order a second time, and what the
	 * procedure does is fill a cart. A customer who expects a second order and finds a cart has
	 * been misled by a button.
	 */
	"order.reorder.added": "Agregado al carrito",
	"order.reorder.help": "Se agrega a tu carrito",
	/*
	 * The heading over the lines a reorder could not bring back — and the one key in this group
	 * that is **not** a `REORDER_SKIP_REASONS` value.
	 *
	 * The three keys under it are the enum's literals verbatim, because there the value on the
	 * wire *is* the key; this one is a heading this app chose, read as a `MessageKey` and never
	 * from a `reason`. It is needed because the three reasons are fragments written to follow a
	 * line's own name ("2 Pan, ya no está disponible"), and fragments stacked under a button
	 * leave the reader to work out what the list is.
	 * `apps/mobile/components/reorder-outcome.tsx:164` draws it as the heading
	 * (`{t("order.reorder.skipped.title")}`), and the same block prefixes its one announcement for
	 * a screen reader with it — "No pudimos agregar todo: 2 Pan, ya no está disponible" is the
	 * whole spoken
	 * sentence — which is why it is a sentence and not the bare marker `order.track.skipped`.
	 */
	"order.reorder.skipped.title": "No pudimos agregar todo",
	/*
	 * Why a line did not come back when the customer asked for the order again. These three
	 * keys are the `REORDER_SKIP_REASONS` enum in `packages/shared/src/schemas/order.ts`
	 * **verbatim** — the value on the wire *is* the key, so the screen translates what it is
	 * handed and there is no second mapping table to drift from the first. That is also why
	 * they cannot be renamed to taste: renaming one here without renaming the enum breaks the
	 * lookup in a way no type can see, because both are just strings until they are compared.
	 *
	 * Each names a fact about *that line* — the product is gone, its options are gone, or the
	 * basket has no room — and none of them blames the customer. A shop that is closed is not
	 * a per-line fact and is refused before the cart is touched at all, so there is no fourth.
	 *
	 * The screen puts the line's own `name` in front of one of these; the sentence is written
	 * to follow a name and not to start a sentence.
	 */
	"order.reorder.skipped.productUnavailable": "ya no está disponible",
	"order.reorder.skipped.optionsUnavailable":
		"sus opciones cambiaron y hay que elegirlas de nuevo",
	"order.reorder.skipped.cartFull": "no cabe en el carrito",
	/*
	 * The one thing that stops a reorder outright — the shop is not taking orders — and the
	 * one `REORDER_ERROR_KEYS` entry. Same rule as the three above: the enum's literal *is* the
	 * key. It is a separate key from the `store.closed.*` family because it is a different
	 * sentence doing a different job: those describe the shop on its own page, this one tells a
	 * customer who just pressed a button why nothing happened. A refusal that reuses the shop's
	 * opening-hours line leaves the reader to work out that the two are connected.
	 */
	"order.reorder.error.businessUnavailable":
		"Este negocio no está tomando pedidos ahora mismo.",

	/*
	 * The two short fulfilment labels, for the chip on a list row. `order.deliveryTo` and
	 * `order.pickupAt` are sentences for the detail page; a chip is a word, and reusing a
	 * sentence there truncates it into something that reads like a mistake.
	 */
	"order.delivery": "Envío",
	"order.pickup": "Retiro",
	/* The list row's item count. `biz.board.items` says the same thing on the shop's board; a
	   customer screen reading a `biz.*` key is a dependency on the wrong dictionary. */
	"order.itemCount": "{count} artículo",
	"order.itemCount_plural": "{count} artículos",
	/* The courier's own card. `order.track.courier` is the sentence that names them; this is
	   the word to fall back on when the shop sent a phone number and no name. */
	"order.courier": "Repartidor",
	"order.history": "Historial",

	"review.title": "¿Cómo estuvo?",
	"review.subtitle": "Tu reseña ayuda a que otros sepan qué esperar.",
	"review.rating": "Calificación",
	"review.comment": "Comentario",
	"review.comment.placeholder": "¿Qué te pareció el pedido?",
	"review.submit": "Enviar reseña",
	"review.thanks": "¡Gracias! Ya quedó publicada.",
	"review.already": "Ya dejaste una reseña de este pedido",
	"review.onlyCompleted": "Solo puedes reseñar pedidos entregados",
	/* Spoken label for one star in the rating radio group. */
	"review.stars": "{count} de {stars} estrellas",
	"delivery.rateCourier.title": "Califica la entrega",
	"delivery.rateCourier.subtitle": "Cuéntanos cómo fue el servicio del repartidor.",
	"delivery.rateCourier.submit": "Enviar calificación",
	"delivery.rateCourier.thanks": "Calificación guardada",

	"favorites.title": "Favoritos",
	"favorites.businesses": "Negocios",
	"favorites.products": "Productos",
	"favorites.empty.title": "Sin favoritos todavía",
	"favorites.empty.body":
		"Toca el corazón en un negocio o producto para guardarlo aquí.",
	"favorites.add": "Guardar en favoritos",
	"favorites.remove": "Quitar de favoritos",

	"location.title": "Tu ubicación",
	"location.use": "Usar mi ubicación",
	"location.denied": "No pudimos obtener tu ubicación. Escribe tu dirección.",
	"location.manual": "Escribir dirección",
} as const;
