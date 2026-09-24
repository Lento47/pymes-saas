/**
 * Discovery — the browse surface: home, search, category, filters.
 *
 * Split out of `customer.ts` when that surface was rebuilt. These are the words a person
 * reads while they are still *looking* — a section heading, a filter, a "see all" — as
 * opposed to the words on a shop or in a cart, which the other domains own. Grouping them
 * here keeps the browse copy in one place rather than spread through a file that three
 * other surfaces also write to.
 *
 * ## What is deliberately not here
 *
 * The words the browse screens already had keep their keys: `home.search.placeholder`,
 * `search.businesses`, `category.all`, `action.viewAll`, `action.close` are all read from
 * the files that own them, because a second spelling of "Negocios" is how one screen ends
 * up saying "Negocios" and another "Tiendas". What is below is only what had no word yet.
 *
 * ## The two filter words that had to be invented, and why they are careful
 *
 * `discovery.filters.distance.noLocation` exists because the API silently ignores
 * `radiusKm` when the caller sends no coordinate (`businesses.list` builds its bounding box
 * from `lat`/`lng`, and there is nothing to build one from). A radius control on a phone
 * that has not granted location would therefore move and change nothing — the exact "a
 * control that does nothing is a lie" case — so the control is not drawn and this sentence
 * says why. `discovery.filters.empty.*` exists for the same family of reason: an empty
 * list under active filters is a different fact from an empty category, and the category's
 * own sentence would state the wrong one.
 *
 * `discovery.sort.*` is the `sort` enum `businessListInput` accepts, one label per member and
 * five of them, because the enum has five. The four that name a rule a customer can predict
 * ("cercanos", "valorados", "populares", "nuevos") came first; `best` is the marketplace's own
 * blended ordering and is the only one whose label is a claim rather than a rule — so it is
 * "Recomendados", which is what it is, and not "Mejores", which would promise a fact the
 * scoring cannot support.
 */
export const discovery = {
	/*
	 * The home header's context line: the lead of the coordinate's meta line, the quiet word
	 * that says what the place is *for*. "Entregar en" is the shape the delivery surfaces use
	 * and it is true whichever fulfilment kind the customer ends up choosing: this is the
	 * coordinate every distance on the screen is measured from, and the one a delivery
	 * address defaults to. The value beside it is a fact we hold — we have either got a fix
	 * or we have not — and never a guess at a street. Without a fix the value is
	 * `location.use` instead: the same sentence shape, an action in the value's seat, and
	 * the row announces itself as a button.
	 */
	"discovery.hero.deliverTo": "Entregar en",
	"discovery.hero.currentLocation": "Tu ubicación actual",
	"discovery.hero.noLocation": "Sin ubicación",

	/*
	 * The map band under the hero — the picture of the sentence above it.
	 *
	 * `label` is the whole of what a screen reader announces for the map surface. One
	 * sentence, because the alternative is VoiceOver walking MapLibre's own view tree and
	 * reading a label position by label position; the map is decoration here and the fact it
	 * draws is already in the hero's line.
	 *
	 * `attribution` is **not copy**. OpenStreetMap's ODbL §4.3 attaches the credit to the
	 * *Produced Work* rather than to whoever runs the tile server, so hosting the archive
	 * ourselves discharges nothing, and the OSMF's own guidelines add that the credit must
	 * not require an interaction to be seen. That is why it is text drawn on the map surface
	 * and not only the SDK's ⓘ button, and why it is the same string in both locales: it
	 * names a licence and its copyright holder, and neither is translated. "OpenStreetMap"
	 * and "ODbL" are spelled exactly as the guidelines spell them.
	 */
	"discovery.map.label": "Mapa de tu zona",
	"discovery.map.attribution": "© OpenStreetMap contributors · ODbL",

	/*
	 * The hint on a section's "Ver todo". The label is `action.viewAll`, which is the
	 * dictionary's one word for it; this says out loud where that goes, which is the search
	 * tab — the phone's only unfiltered browse surface (`./category-rail` sends its "Todo"
	 * chip to the same place, for the same reason).
	 */
	"discovery.seeAll.hint": "Abre la búsqueda",

	/* The search result switcher's group name for a screen reader. */
	"discovery.search.mode": "Filtrar resultados",

	"discovery.filters.button": "Filtros",
	/*
	 * `active` is a count of filters, not a noun that pluralises — "Filtros · 1" and
	 * "Filtros · 3" read the same way — so this is read with `t` and not `tp`, and it
	 * deliberately has no `_plural` sibling.
	 */
	"discovery.filters.button.active": "Filtros · {count}",
	"discovery.filters.title": "Filtros",
	/* The two booleans `businessListInput` accepts, each named the way it is set. */
	"discovery.filters.openNow": "Abierto ahora",
	"discovery.filters.deliveryOnly": "Solo con entrega",
	"discovery.filters.distance": "Distancia",
	"discovery.filters.distance.noLocation":
		"Activa tu ubicación para filtrar por distancia",
	"discovery.filters.sort": "Ordenar por",
	"discovery.filters.clear": "Quitar filtros",
	/* The state of the sheet when nothing is narrowing the list. */
	"discovery.filters.none": "Sin filtros",
	/* The sheet's one action, after which the list behind it is already up to date. */
	"discovery.filters.done": "Listo",
	/*
	 * A category whose list is empty *because of a filter* is not a category with nothing
	 * in it, and `category.empty.*` says the second thing.
	 */
	"discovery.filters.empty.title": "Ningún negocio con esos filtros",
	"discovery.filters.empty.body": "Quita un filtro, o mira otra categoría.",

	"discovery.sort.best": "Recomendados",
	"discovery.sort.distance": "Más cercanos",
	"discovery.sort.rating": "Mejor valorados",
	"discovery.sort.popular": "Más populares",
	"discovery.sort.newest": "Nuevos",
} as const;
