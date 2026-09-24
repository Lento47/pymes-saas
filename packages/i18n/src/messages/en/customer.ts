/**
 * English — the customer's screens. Same keys as Spanish, and no others.
 *
 * The tracking copy is translated literally on purpose. `"In preparation"` is duller
 * than `"Almost there!"` in English too, and that dullness is the point: the screen
 * reports the state the business actually set, and inventing optimism about an order
 * we cannot see would be a lie in two languages instead of one.
 */
export const customer = {
	"home.greeting": "Hi, {name}",
	"home.greeting.anon": "What do you need today?",
	/* The avatar's own hint. The label is the customer's name, which does not say
	 * where the tap goes — see `settings.ts`'s hint rule for a pressable that leads
	 * somewhere. */
	"home.greeting.avatar.help": "Opens your account",
	/* Why the customer stack is being drawn anyway — see the Spanish file's note. */
	"account.profile.degraded.unreachable":
		"We couldn't verify your profile, so this is the customer view.",
	"account.profile.degraded.ended":
		"Your membership has ended, so this is the customer view.",
	"home.categories": "Categories",
	"home.featured": "Recommended",
	/* The featured page with nothing in it — see the Spanish file's note on why it is not a search-empty state. */
	"home.featured.empty.title": "Nothing recommended yet",
	"home.featured.empty.body":
		"Featured businesses will show up here. In the meantime, browse the categories.",
	/* The feed heading when there is no coordinate to be near — see the Spanish file's note. */
	"home.newest": "New arrivals",
	"home.nearby": "Near you",
	"home.nearby.empty": "No businesses deliver to your area yet",
	/* The empty state with no coordinate behind the request — see the Spanish file's note. */
	"home.nearby.empty.all": "No shops are published yet",
	"home.nearby.enableLocation": "Turn on your location to see what's nearby",
	/* The label on the button that acts on the sentence above. `home.nearby.enableLocation`
	   is the prompt; this is the button — see the Spanish file's note. */
	"home.nearby.enableLocation.action": "Turn on location",
	"home.search.placeholder": "Search products or businesses",
	/* The two offer rails and the three promotion sentences — see the Spanish file's note,
	   which covers why the headings are two and why there are exactly three sentences. */
	"home.offers": "Deals",
	"home.promotions": "Coupons",
	"home.orderAgain": "Order again",
	"home.popular": "Popular right now",
	"home.freeDelivery": "Free delivery",
	"home.activeOrder": "Active order",
	"home.veryClose": "Very close",
	"home.promotion.percent": "{percent}% off",
	"home.promotion.fixed": "{amount} off",
	"home.promotion.freeDelivery": "Free delivery",
	/* The code, drawn and spoken as one string — see the Spanish file's note on why it is a
	   chip and why it is not a bare `{code}`. */
	"home.promotion.code": "Code {code}",
	/*
	 * Where the card goes, for the screen reader. A card is not a chevron row and has no
	 * arrow to promise anything, so the destination is the half of the press that only a
	 * label can say — `settings.ts`'s rule for every other pressable on this platform.
	 */
	"home.promotion.help": "Opens the business",

	"search.title": "Search",
	/* "Showing", not a bare "{count} results", and a pair read with `tp` — see the Spanish
	   file's note, which covers both halves of why. */
	"search.results": "Showing {count} result",
	"search.results_plural": "Showing {count} results",
	"search.products": "Products",
	"search.businesses": "Businesses",
	"search.categories": "Categories",
	"search.empty.title": "Nothing matched that",
	"search.empty.body": "Try another word, or look at what's near you.",
	"search.recent": "Recent searches",
	"search.clear": "Clear",

	"category.all": "All",
	/*
	 * A slug that `catalog.categories` does not carry. It is not "no results": the link is
	 * wrong, and the only honest thing to do with a wrong link is say so. No apology and no
	 * "try again later" — nothing is retrying, nothing is late.
	 *
	 * The body used to end with a second sentence pointing the reader at the category strip
	 * above the panel. That instruction was never followable: the strip is drawn by the
	 * category page, which calls `notFound()` before it renders, so the panel carrying the
	 * sentence had nothing above it to look at. See the Spanish file's note, which is where
	 * the reasoning lives.
	 */
	"category.unknown.title": "We don't have that category",
	"category.unknown.body": "The link may be out of date.",
	/* A category that exists with nothing in it yet. Says that, promises nothing. */
	"category.empty.title": "No businesses in here yet",
	"category.empty.body": "Look at another category, or search by name.",

	"store.title": "Business",
	"store.open": "Open",
	"store.closed": "Closed",
	"store.closed.until": "Closed · opens {time}",
	"store.hours": "Hours",
	"store.hours.today": "Today: {range}",
	"store.hours.closedToday": "Closed today",
	/* The marker on today's row — see the Spanish file's note, including why it is not `store.hours.today`. */
	"store.today": "Today",
	/* One page of the photo strip, spoken — see the Spanish file's note. One-based, and read with `t`, never `tp`. */
	"gallery.image.label": "Image {index} of {count}",
	"store.verified": "Verified",
	/* The other card badge — see the Spanish file's note. */
	"store.topRated": "Top rated",
	"store.delivery": "Delivery",
	"store.delivery.fee": "Delivery {amount}",
	"store.delivery.free": "Free delivery",
	"store.pickup": "Pick up in store",
	/* The chip forms of `store.pickup` and `store.minOrder` — see the Spanish file's note on why both forms exist. */
	"store.pickup.short": "Pickup",
	"store.minOrder": "Minimum order {amount}",
	"store.minOrder.short": "Min. {amount}",
	"store.prepTime": "{count} min to prepare",
	"store.deliveryRadius": "Delivers up to {value} km",
	/* The review count under the stars — see the Spanish file's note on the pair. */
	"store.rating.count": "{count} review",
	"store.rating.count_plural": "{count} reviews",
	/* The star row's spoken sentence — see the Spanish file's note on the three keys. */
	"store.rating.label": "{value} out of 5",
	"store.rating.label.count": "{value} out of 5, {count} review",
	"store.rating.label.count_plural": "{value} out of 5, {count} reviews",
	"store.products": "Products",
	/* The search field inside one shop — see the Spanish file's note on why it names where it searches. */
	"store.search.placeholder": "Search this business",
	/* A category's size, from the server's `productCount` and not the page — see the Spanish file's note. */
	"store.category.count": "{count} product",
	"store.category.count_plural": "{count} products",
	"store.reviews": "Reviews",
	"store.reviews.empty": "No reviews yet",
	"store.reviews.reply": "Reply from the business",
	"store.info": "Information",
	"store.address": "Address",
	"store.phone": "Phone",
	"store.callBusiness": "Call the business",
	"store.directions": "Get directions",
	"store.notFound": "We couldn't find this business",
	"store.notFound.body":
		"The link may be old. Search for the business by name.",
	"store.suspended": "This business isn't available right now",

	/* The three translated badge words, and why `discount` is not a key here — see the Spanish file's note. */
	"product.badge.new": "New",
	"product.badge.popular": "Popular",
	"product.badge.shipping": "Delivery",
	"product.add": "Add",
	/* The quick-add target names the product: a bare "Add" is indistinguishable between
	 * rows once a card's own label has replaced its children for a reader. */
	"product.add.named": "Add {name}",
	"product.adding": "Adding…",
	/* The confirmation toast — see the Spanish file's note on why it names the product. */
	"product.added": "Added {name}",
	"product.chooseOptions": "Choose options",
	/* A multi-choice group's floor. No plural form — see the Spanish file's note. */
	"product.select.min": "Choose at least {count}",
	"product.quantity": "Quantity",
	/* The spoken names of the stepper's two controls — see the Spanish file's note. */
	"product.quantity.decrease": "Remove one",
	"product.quantity.increase": "Add one",
	"product.required": "Required",
	"product.notes": "Notes for the business",
	"product.notes.placeholder": "No onion, please",
	"product.soldOut": "Sold out",
	/* The sold count under the title, drawn only above zero — see the Spanish file's note on why it is not `product.soldOut`. */
	"product.sold": "{count} sold",
	"product.sold_plural": "{count} sold",
	"product.unavailable": "Not available today",
	"product.related": "You might also like",
	"product.description": "Description",
	"product.sku": "Code",
	"product.discount": "{percent}% off",
	"product.compareAt": "was {amount}",
	// The same word on its own, for the surfaces that draw the amount themselves and need
	// only the word in front of it — `packages/ui`'s `Price`, which has no translator.
	"product.compareAtWord": "was",
	"product.outOfStock": "Out of stock",
	/* The singular and plural are the same words here — the pair exists for the Spanish file's sake, where *quedar* agrees; see `admin.overview.businesses.active` for the same shape. */
	"product.lowStock": "{count} left",
	"product.lowStock_plural": "{count} left",
	"product.notFound": "We couldn't find this product",
	"product.notFound.body":
		"The link may be old. Search for the product by name.",
	"product.requiresOptions": "Choose the options to continue",
	"product.optionPrice": "+{amount}",

	/* The two words the sticky cart bar draws — labels, not sentences, which is why
	 * `cart.title` and `cart.checkout` cannot be reused here. See the Spanish file. */
	"cart.bar.viewCart": "View cart",
	"cart.bar.checkout": "Checkout",
	"cart.title": "Your cart",
	"cart.empty.title": "Your cart is empty",
	"cart.empty.body": "Anything you add shows up here.",
	"cart.empty.action": "See businesses nearby",
	"cart.item.remove": "Remove",
	"cart.item.unavailable":
		"This product isn't available anymore, so we removed it",
	"cart.subtotal": "Subtotal",
	"cart.discount": "Discount",
	"cart.delivery": "Delivery",
	"cart.tax": "Taxes",
	"cart.tip": "Tip",
	"cart.total": "Total",
	"cart.checkout": "Continue to checkout",
	"cart.minOrderMissing": "You're {amount} away from the minimum order",
	"cart.promotion": "Promo code",
	"cart.promotion.apply": "Apply",
	"cart.promotion.applied": "Code {code} applied",
	/* The toast after a code is taken off — see the Spanish file's note on why it names no code. */
	"cart.promotion.removed": "Code removed",
	/* `state.saving` is "Saving…" and a removal is not a save. See the Spanish entry. */
	"cart.promotion.removing": "Removing…",
	"cart.promotion.invalid": "That code doesn't work",
	"cart.promotion.expired": "That code has expired",
	"cart.clear": "Empty cart",
	"cart.clear.confirm": "Empty your cart?",
	"cart.otherBusiness.title": "Your cart belongs to another business",
	"cart.otherBusiness.body":
		"You can only order from one business at a time. Start a new cart?",
	"cart.otherBusiness.confirm": "Start over",
	"cart.otherBusiness.keep": "Keep the current one",
	/* The heading over the basket's suggestion rows — see the Spanish file's note on why it does not say "other". */
	"cart.suggestions.title": "From this business",

	"checkout.title": "Confirm order",
	"checkout.fulfilment": "How do you want it?",
	"checkout.delivery": "Deliver to my address",
	"checkout.pickup": "Pick up in store",
	"checkout.address": "Delivery address",
	"checkout.address.add": "Add address",
	"checkout.address.none": "You need an address to have it delivered",
	"checkout.payment": "Payment method",
	"checkout.payment.cash": "Cash on delivery",
	"checkout.payment.sinpe": "SINPE Móvil",
	"checkout.payment.note":
		"Payment is arranged with the business. We don't charge in the app yet.",
	"checkout.tip": "Tip for the business",
	"checkout.tip.none": "No tip",
	"checkout.notes": "Order notes",
	"checkout.place": "Place order",
	"checkout.placing": "Sending your order…",
	"checkout.businessClosed": "The business is closed right now",
	"checkout.estimate": "Estimated time: {minutes} min",
	"checkout.failed": "We couldn't place your order",

	"order.title": "Order",
	"order.number": "Order {code}",
	"order.placed": "Order placed",
	"order.placedAt": "{date} at {time}",
	"order.status.PENDING": "Waiting for confirmation",
	"order.status.ACCEPTED": "Accepted",
	"order.status.PREPARING": "In preparation",
	"order.status.READY": "Ready",
	"order.status.OUT_FOR_DELIVERY": "On the way",
	"order.status.COMPLETED": "Delivered",
	"order.status.CANCELLED": "Cancelled",
	"order.status.REJECTED": "Declined",
	"order.track": "Track order",
	"order.track.title": "Your order",
	"order.track.eta": "Arriving around {time}",
	"order.track.courier": "Courier: {name}",
	"order.track.updated": "Updated {time}",
	/* A marker rather than a time — see the Spanish file's note before rendering it. */
	"order.track.live": "Live",
	"order.track.reconnecting": "Reconnecting…",
	/* The caption under a step that did not happen, drawn for a state no producer sends yet — see the Spanish file's note. */
	"order.track.skipped": "Skipped",
	"order.cancel": "Cancel order",
	"order.cancel.confirm": "Cancel this order?",
	"order.cancel.reason": "Tell us why (optional)",
	/* The customer's own dialog — see the Spanish file's note on the `biz.*` key it replaced. */
	"order.cancel.reason.help": "The business reads your reason.",
	"order.cancel.tooLate": "Can't cancel now: the business started preparing it",
	"order.cancelled.by": "Cancelled by {actor}",
	/* The actors `{actor}` may be — see the Spanish file's note. */
	"order.actor.CUSTOMER": "the customer",
	"order.actor.BUSINESS": "the business",
	"order.actor.COURIER": "the courier",
	"order.actor.ADMIN": "the PymesHub team",
	"order.actor.SYSTEM": "the system",
	"order.items": "What you ordered",
	"order.deliveryTo": "Delivering to",
	"order.pickupAt": "Pick up at",
	/* The sentence under the pickup code — see the Spanish file's note on the block it sits in. */
	"order.pickupCode.help": "Show it at the shop when you pick up",
	"order.callBusiness": "Call the business",
	"order.help": "Something went wrong?",
	"order.empty.title": "No orders yet",
	"order.empty.body": "Your first order shows up here.",
	"order.active": "In progress",
	"order.past": "Previous",
	"order.notFound": "We couldn't find this order",
	"order.notFound.body":
		"The link may be old, or the order may no longer be available.",
	"order.reorder": "Order again",
	/* The reorder bar's toast and its caption. "Added to your cart" names no product on purpose — see the Spanish file's note. */
	"order.reorder.added": "Added to your cart",
	"order.reorder.help": "Adds to your cart",
	/* The heading over the lines a reorder could not bring back, and not a `REORDER_SKIP_REASONS` value — see the Spanish file's note. */
	"order.reorder.skipped.title": "We couldn't add everything",
	/* The `REORDER_SKIP_REASONS` enum verbatim — see the Spanish file's note, including why renaming one here alone breaks the lookup silently. Each follows a line's own name, so none starts a sentence. */
	"order.reorder.skipped.productUnavailable": "is no longer available",
	"order.reorder.skipped.optionsUnavailable":
		"has changed its options and they need choosing again",
	"order.reorder.skipped.cartFull": "doesn't fit in the basket",
	/* The one `REORDER_ERROR_KEYS` entry — see the Spanish file's note on why it is not a `store.closed.*` key. */
	"order.reorder.error.businessUnavailable":
		"This business isn't taking orders right now.",

	/*
	 * The two short fulfilment labels, for the chip on a list row. `order.deliveryTo` and
	 * `order.pickupAt` are sentences for the detail page; a chip is a word, and reusing a
	 * sentence there truncates it into something that reads like a mistake.
	 */
	"order.delivery": "Delivery",
	"order.pickup": "Pick up",
	/* The list row's item count. `biz.board.items` says the same thing on the shop's board; a
	   customer screen reading a `biz.*` key is a dependency on the wrong dictionary. */
	"order.itemCount": "{count} item",
	"order.itemCount_plural": "{count} items",
	/* The courier's own card. `order.track.courier` is the sentence that names them; this is
	   the word to fall back on when the shop sent a phone number and no name. */
	"order.courier": "Courier",
	"order.history": "History",

	"review.title": "How was it?",
	"review.subtitle": "Your review helps other people know what to expect.",
	"review.rating": "Rating",
	"review.comment": "Comment",
	"review.comment.placeholder": "How was your order?",
	"review.submit": "Post review",
	"review.thanks": "Thanks! It's posted.",
	"review.already": "You already reviewed this order",
	"review.onlyCompleted": "You can only review delivered orders",
	/* Spoken label for one star in the rating radio group. */
	"review.stars": "{count} of {stars} stars",

	"favorites.title": "Favorites",
	"favorites.businesses": "Businesses",
	"favorites.products": "Products",
	"favorites.empty.title": "No favorites yet",
	"favorites.empty.body":
		"Tap the heart on a business or product to keep it here.",
	"favorites.add": "Save to favorites",
	"favorites.remove": "Remove from favorites",

	"location.title": "Your location",
	"location.use": "Use my location",
	"location.denied":
		"We couldn't get your location. Type your address instead.",
	"location.manual": "Type address",
} as const;
