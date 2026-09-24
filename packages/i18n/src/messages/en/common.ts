/**
 * English — the same keys as Spanish, and no others.
 *
 * The type in `../types.ts` enforces that, so this file is never "mostly done": a
 * missing key is a compile error rather than a screen showing `cart.empty.title`.
 *
 * Voice: informal too, and for the same reason. `Your order`, not `Your order, sir` —
 * a translation that turns a neighbourhood shop into a form letter has changed the
 * product, not the language. Idioms are avoided rather than translated: nothing here
 * would confuse a reader in San José, Costa Rica or one in Toronto.
 */
export const common = {
	"app.name": "PymesHub",
	"app.tagline": "What you need, from businesses near you",

	"nav.primary": "Main",
	"nav.home": "Home",
	"nav.search": "Search",
	"nav.cart": "Cart",
	"nav.orders": "Orders",
	/* The orders tab's badge in words, composed after the tab's own name — see the Spanish file's note, including why both forms read the same in Spanish and not in English. */
	"nav.orders.badge": "{count} in progress",
	"nav.orders.badge_plural": "{count} in progress",
	/* The same fact when the page came back full: `{count}` is the page size, so the count is a floor. */
	"nav.orders.badge.more": "more than {count} in progress",
	"nav.account": "Account",
	"nav.favorites": "Favorites",

	"action.retry": "Try again",
	"action.refresh": "Refresh",
	"action.cancel": "Cancel",
	"action.confirm": "Confirm",
	"action.save": "Save",
	"action.close": "Close",
	"action.back": "Back",
	/* The paging pair — see the Spanish file's note. */
	"action.previous": "Previous",
	"action.next": "Next",
	"action.edit": "Edit",
	"action.delete": "Delete",
	"action.continue": "Continue",
	"action.signIn": "Sign in",
	"action.signOut": "Sign out",
	"action.signUp": "Create account",
	"action.viewAll": "View all",

	"state.loading": "Loading…",
	"state.saving": "Saving…",
	"state.empty": "Nothing here yet",
	"state.error.title": "We couldn't load this",
	"state.error.body": "That's on our side, not yours. Try again in a moment.",
	/* The one-line form, for a failed action inside a working screen — see the Spanish
	   file's note. `On our end` rather than `our side` so the short line reads as one
	   sentence on its own and not as a truncation of the one above. */
	"state.error.inline": "Something went wrong on our end",
	"state.error.requestId":
		"If it happens again, mention this code to support: {requestId}",
	"state.offline": "No connection",
	"state.offline.body": "Still trying. What you already saw is still here.",
	/* See the Spanish file's note. `Nothing more to show` and not `No more results`: the same
	   string sits under a shop's menu and under a customer's order history, and only one of
	   those two is a set of results. */
	"state.listEnd": "Nothing more to show",

	"form.required": "This field is required",
	"form.optional": "optional",
	"form.invalidEmail": "Enter a valid email address",
	"form.tooShort": "Use at least {min} characters",
	"form.tooLong": "At most {max} characters",
	/* The pair that counts what the rule counts: digits, not characters. */
	"form.phone.tooShort": "Use at least {min} digits",
	"form.phone.tooLong": "At most {max} digits",
	"form.saveFailed": "We couldn't save your changes",

	"unit.minutes": "{count} min",
	"unit.minutes.short": "{count} min",
	"unit.minute": "min",
	"unit.hour": "h",
	"unit.day": "d",
	"unit.year": "y",
	"unit.km": "{value} km",
	"unit.km.short": "{value} km",

	"locale.es": "Español",
	"locale.en": "English",
	"locale.switch": "Change language",

	"a11y.skipToContent": "Skip to content",
	"a11y.openMenu": "Open menu",
	"a11y.closeMenu": "Close menu",
	"a11y.loading": "Loading",
	"a11y.goBack": "Go back",
	/* The toast's hint — see the Spanish file's note on why it is an instruction and not a bare verb. */
	"a11y.dismissToast": "Close the notice",
	"money.minorUnits": "minor units",
	"action.saving": "Saving…",
	"action.loadMore": "Load more",
	"action.view": "View details",
	"biz.staff.existingAccount":
		"Add someone who already has a PymesHub account. Access is assigned directly; no email is sent.",
	"auth.password.minimum": "Use at least 12 characters.",
	"address.label": "Address label",
	"address.line1": "Street address",
	"address.city": "City",
	"address.region": "Region",
	"home.hero.eyebrow": "Your neighbourhood, one tap away",
	"home.hero.title": "Good things are close.",
	"home.hero.description":
		"Discover what your community makes. Order your favourites for pickup or delivery, straight from local businesses.",
	"home.hero.action": "Explore local shops",
} as const;
