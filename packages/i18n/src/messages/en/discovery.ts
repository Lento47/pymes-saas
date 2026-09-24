/**
 * Discovery — the browse surface: home, search, category, filters.
 *
 * Split out of `customer.ts` when that surface was rebuilt. These are the words a person
 * reads while they are still *looking* — a section heading, a filter, a "see all" — as
 * opposed to the words on a shop or in a cart, which the other domains own. Grouping them
 * here keeps the browse copy in one place rather than spread through a file that three
 * other surfaces also write to.
 *
 * Key for key with `es/discovery.ts`. The split by domain matches `es/` exactly, so a
 * translator or an agent working on one surface edits one pair of files and cannot collide
 * with another working on a different one.
 *
 * ## What is deliberately not here
 *
 * The words the browse screens already had keep their keys: `home.search.placeholder`,
 * `search.businesses`, `category.all`, `action.viewAll`, `action.close` are all read from
 * the files that own them, because a second spelling of "Businesses" is how one screen ends
 * up saying "Businesses" and another "Shops". What is below is only what had no word yet.
 *
 * `discovery.filters.distance.noLocation` exists because the API silently ignores
 * `radiusKm` when the caller sends no coordinate (`businesses.list` builds its bounding box
 * from `lat`/`lng`, and there is nothing to build one from) — a radius control that moves
 * and changes nothing is the exact "a control that does nothing is a lie" case, so the
 * control is not drawn and this sentence says why. `discovery.filters.empty.*` exists for
 * the same family of reason: an empty list under active filters is a different fact from an
 * empty category. `discovery.sort.*` has one label per member of `businessListInput`'s `sort`
 * enum — five — so an option here is always a request the server can honour. `best` is the
 * marketplace's own blended ordering, and its label is a claim rather than a rule: "Recommended"
 * and not "Best", which would promise a fact the scoring cannot support.
 */
export const discovery = {
	/*
	 * The home header's context line: the lead of the coordinate's meta line, the quiet word
	 * that says what the place is *for*. "Deliver to" is the shape the delivery surfaces use
	 * and it is true whichever fulfilment kind the customer ends up choosing: this is the
	 * coordinate every distance on the screen is measured from, and the one a delivery
	 * address defaults to. The value beside it is a fact we hold — we have either got a fix
	 * or we have not — and never a guess at a street. Without a fix the value is
	 * `location.use` instead: the same sentence shape, an action in the value's seat, and
	 * the row announces itself as a button.
	 */
	"discovery.hero.deliverTo": "Deliver to",
	"discovery.hero.currentLocation": "Your current location",
	"discovery.hero.noLocation": "No location",

	/*
	 * The map band under the hero — the picture of the sentence above it. `label` is the
	 * whole of what a screen reader announces for the map surface; `attribution` is a licence
	 * condition rather than copy, which is why it is identical in both locales: it names a
	 * copyright holder and a licence, and neither is translated. See `es/discovery.ts` for
	 * the full reasoning, and `apps/mobile/components/map.tsx` for where it is drawn.
	 */
	"discovery.map.label": "Map of your area",
	"discovery.map.attribution": "© OpenStreetMap contributors · ODbL",

	/*
	 * The hint on a section's "See all". The label is `action.viewAll`, which is the
	 * dictionary's one word for it; this says out loud where that goes, which is the search
	 * tab — the phone's only unfiltered browse surface.
	 */
	"discovery.seeAll.hint": "Opens search",

	/* The search result switcher's group name for a screen reader. */
	"discovery.search.mode": "Filter results",

	"discovery.filters.button": "Filters",
	/*
	 * `active` is a count of filters, not a noun that pluralises, so this is read with `t`
	 * and not `tp`, and it deliberately has no `_plural` sibling.
	 */
	"discovery.filters.button.active": "Filters · {count}",
	"discovery.filters.title": "Filters",
	/* The two booleans `businessListInput` accepts, each named the way it is set. */
	"discovery.filters.openNow": "Open now",
	"discovery.filters.deliveryOnly": "Delivery only",
	"discovery.filters.distance": "Distance",
	"discovery.filters.distance.noLocation":
		"Turn on your location to filter by distance",
	"discovery.filters.sort": "Sort by",
	"discovery.filters.clear": "Clear filters",
	/* The state of the sheet when nothing is narrowing the list. */
	"discovery.filters.none": "No filters",
	/* The sheet's one action, after which the list behind it is already up to date. */
	"discovery.filters.done": "Done",
	/*
	 * A category whose list is empty *because of a filter* is not a category with nothing in
	 * it, and `category.empty.*` says the second thing.
	 */
	"discovery.filters.empty.title": "No shops match those filters",
	"discovery.filters.empty.body":
		"Remove a filter, or look at another category.",

	"discovery.sort.best": "Recommended",
	"discovery.sort.distance": "Nearest",
	"discovery.sort.rating": "Best rated",
	"discovery.sort.popular": "Most popular",
	"discovery.sort.newest": "Newest",
} as const;
