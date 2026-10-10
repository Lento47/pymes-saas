/**
 * English — the business's side. Same keys as Spanish, and no others.
 *
 * `biz.board.*` keeps the Spanish rule: the button is a verb naming what will
 * happen, never a synonym for the column it moves the order to. A board whose
 * buttons read "Advance" makes the person at the counter hold the state machine
 * in their head, and they are holding a customer's order at the same time.
 *
 * Role names are deliberately plain (`Owner`, `Manager`, `Staff`) rather than
 * corporate ranks. A three-person shop does not have a "Regional Director".
 */
export const business = {
	"biz.dashboard.title": "Your business",
	"biz.dashboard.today": "Today",
	"biz.dashboard.ordersToday": "Orders today",
	"biz.dashboard.revenueToday": "Sales today",
	"biz.dashboard.pending": "To confirm",
	"biz.dashboard.inProgress": "In progress",
	"biz.dashboard.rating": "Rating",
	"biz.dashboard.openNow": "Open right now",
	"biz.dashboard.closedNow": "Closed right now",
	// The "until {time}" tail of the open/closed line — see the Spanish file's note.
	"biz.dashboard.until": "Until {time}",
	"biz.dashboard.openToggle": "Open the business",
	"biz.dashboard.closeToggle": "Close the business",
	"biz.dashboard.closedWarning":
		"While closed you don't show up in search and no new orders come in.",
	"biz.dashboard.empty.title": "No orders today yet",
	"biz.dashboard.empty.body": "When one comes in, it rings here.",
	"biz.dashboard.viewBoard": "See the board",
	"biz.dashboard.syncing": "Updating dashboard",
	"biz.dashboard.updatedJustNow": "Updated just now",
	"biz.dashboard.updatedRelative": "Updated {relative}",
	"biz.dashboard.updatedStale": "Data may be out of date · {relative}",
	"biz.dashboard.refresh": "Refresh dashboard",
	"biz.dashboard.refreshHelp":
		"Refresh business, location, orders and analytics",
	"biz.home.attention": "Needs attention",
	"biz.home.attentionCount": "{count} item needing attention",
	"biz.home.attentionCount_plural": "{count} items needing attention",
	"biz.home.newOrders": "Orders awaiting response",
	"biz.home.outOfStock": "Sold-out products",
	"biz.home.catalogSummary":
		"{active} published · {draft} drafts · {outOfStock} sold out",

	// The merchant home's operational band ("the pulse"), its section and its rail.
	// Net sales, not gross: the number after the platform's cut is the one an owner
	// banks.
	"biz.pulse.netSales": "Net sales",
	"biz.pulse.avgTicket": "Average ticket",
	"biz.pulse.vsYesterday": "vs. yesterday",
	"biz.board.sectionTitle": "Orders now",
	"biz.rail.newProduct": "New product",
	"biz.rail.menu": "Menu",
	"biz.rail.delivery": "Delivery",
	"biz.board.caughtUp": "You're caught up.",
	"biz.board.caughtUp.body": "New orders appear here automatically.",
	"biz.insight.topProduct": "Top product",
	"biz.insight.repeat": "Repeat customers",
	"biz.insight.avgPreparation": "Avg. preparation",
	"biz.insight.avgOrder": "Avg. order",

	"biz.onboarding.title": "Finish setting up your business",
	"biz.onboarding.step.profile": "Business details",
	"biz.onboarding.step.hours": "Hours",
	"biz.onboarding.step.products": "First products",
	"biz.onboarding.step.delivery": "Delivery and payment",
	"biz.onboarding.step.done": "Ready to sell",
	"biz.onboarding.pending": "{count} step left",
	"biz.onboarding.pending_plural": "{count} steps left",
	"biz.onboarding.notLive": "Your business isn't published yet",

	"biz.board.title": "Order board",
	"biz.board.column.new": "New",
	"biz.board.column.preparing": "In preparation",
	"biz.board.column.ready": "Ready",
	"biz.board.column.done": "Delivered",
	"biz.board.empty": "Nothing here",
	/* The body under the empty board — see the Spanish file's note on the "it rings" lie. */
	"biz.board.empty.body": "Orders still in progress show up here.",
	"biz.board.accept": "Accept",
	"biz.board.reject": "Decline",
	"biz.board.startPreparing": "Start preparing",
	"biz.board.markReady": "Mark ready",
	"biz.board.markPickedUp": "Mark picked up",
	"biz.board.markDelivered": "Mark delivered",
	"biz.order.dispatch.title": "Delivery status",
	"biz.order.dispatch.noPickupPin":
		"This order has no pickup pin, so couriers cannot receive it. Set your shop location to start looking for a courier.",
	"biz.order.dispatch.setPickupPin": "Set shop location",
	"biz.order.dispatch.searching": "Looking for an available courier nearby.",
	"biz.order.dispatch.offered": "An offer is waiting for a courier's response.",
	"biz.order.dispatch.assigned": "A courier has accepted this delivery.",
	"biz.order.dispatch.self": "Your business is delivering this order.",
	"biz.order.selfDelivery.start": "Deliver ourselves",
	"biz.order.selfDelivered": "Delivery marked complete",
	"biz.board.sendOut": "Send for delivery",
	"biz.board.advance": "Next step",
	"biz.board.waitingFor": "Waiting {minutes} min",
	"biz.board.waitingTooLong": "Waiting {minutes} min already",
	"biz.board.newOrder": "New order",
	"biz.board.newOrder.body": "Order {code} · {total}",
	/*
	 * The new-order banner's three lines (interface.md §24). The separator lives in the
	 * dictionary and not in the code, the way `biz.board.movedTo` says it should. `title`
	 * carries the numeral because `merchant-order-row.tsx` prints it separately and a bare
	 * reference is not the number the counter recognises.
	 */
	"biz.board.newOrder.title": "New order #{reference}",
	"biz.board.newOrder.meta": "{total} · {items}",
	/* The banner's one control: the door into the order. "Review" and not "Look". */
	"biz.board.newOrder.review": "Review",
	/* A move that went through: the row changed it, the ear confirms it. */
	"biz.board.movedTo": "Order moved to {status}",
	/* Each board column's header; the separator lives here, not in the code. */
	"biz.board.section": "{title} · {count}",
	"biz.board.unassigned": "No courier",
	"biz.board.delivery": "Delivery",
	"biz.board.pickup": "Pick up",
	"biz.board.items": "{count} item",
	"biz.board.items_plural": "{count} items",
	"biz.board.reject.reason": "Why can't you take it?",
	"biz.board.reject.outOfStock": "We're out",
	"biz.board.reject.tooBusy": "We're swamped",
	"biz.board.reject.closing": "We're closing soon",
	"biz.board.reject.other": "Another reason",
	"biz.board.reject.help": "The customer is told why.",
	"biz.board.cancelledByCustomer": "The customer cancelled the order",
	"biz.board.print": "Print",
	"biz.board.acceptAll": "Accept all",
	"biz.board.assignCourier": "Assign a courier",
	"biz.board.noCouriers": "You don't have couriers yet",

	"biz.order.customer": "Customer",
	"biz.order.title": "Order #{reference}",
	"biz.order.address": "Delivery address",
	"biz.order.map": "Delivery map",
	// The three doors under the customer block. Each is drawn only when the data it acts on
	// is there - `action.call` and `action.message` need a customer phone, `biz.order.openMap`
	// needs a delivery address with a line to point at - so the keys are shared with every
	// other screen that offers the same hand-off and are not `biz.order.*` because they are
	// not about an order.
	"biz.order.call": "Call",
	"biz.order.message": "Message",
	"biz.order.openMap": "Open map",
	// The dark hero's last line, and the only place this screen claims a time the payload does
	// not carry. `orderSummarySchema` has no `updatedAt`; the newest event in the log is the
	// order's real last change, so the copy names the event rather than promising a freshness
	// the API never sent.
	"biz.order.updated": "Updated {time}",
	"biz.order.items": "Order items",
	"biz.order.total": "Order total",
	"biz.order.customerDeliveryCharge": "Customer delivery charge",
	"biz.order.courierFeeOwed": "Courier fee owed by shop",
	"biz.order.courierFeeNote": "Separate from the customer's order total.",
	"biz.order.events": "Activity",
	"biz.order.noteEvent": "Note",
	"biz.order.contact": "Contact",
	"biz.order.notes": "Customer notes",
	"biz.order.timeline": "History",
	"biz.order.timeline.acceptedAt": "Accepted {time}",
	"biz.order.timeline.readyAt": "Ready {time}",
	"biz.order.timeline.deliveredAt": "Delivered {time}",
	"biz.order.timeline.rejectedAt": "Declined {time}",
	"biz.order.notYours": "This order isn't from your business",

	"biz.products.title": "Products",
	"biz.catalog.title": "MENU",
	"biz.catalog.count": "{count} product",
	"biz.catalog.count_plural": "{count} products",
	"biz.catalog.search": "Search catalog",
	"biz.products.add": "Add product",

	/*
	 * The product form, in the commerce system: four named groups instead of one
	 * "Products" section above fields whose own labels already say what they are.
	 * The heading line under each group is that group's one job, and the empty state
	 * on the photo surface is the sentence a photograph is being asked for.
	 */
	"biz.products.screen.add": "List a new product in your shop.",
	"biz.products.screen.edit": "Update this product's details.",
	"biz.products.section.basic": "Basic information",
	"biz.products.section.basic.help":
		"Give your product a name buyers will recognise.",
	"biz.products.section.pricing": "Pricing",
	"biz.products.section.pricing.help":
		"Set the price and an optional previous price.",
	"biz.products.section.category.help":
		"Choose the category that best fits your product.",
	"biz.products.section.photo.help": "Add photos to showcase your product.",
	"biz.products.placeholder.name": "Product name",
	"biz.products.placeholder.description": "Describe your product...",
	"biz.products.save": "Save product",
	"biz.products.photo.module": "Add a product photo",
	"biz.products.photo.module.help":
		"Upload a photo from your gallery or take one with your camera.",
	"biz.products.photo.upload": "Upload from library",
	"biz.products.photo.camera": "Take photo",
	"biz.products.edit": "Edit product",
	"biz.products.available": "Available",
	"biz.products.outOfStock": "Sold out",
	"biz.products.stockCount": "{count} in stock",
	"biz.products.empty.title": "No products yet",
	"biz.products.empty.body":
		"Add the first one and it shows up in your store instantly.",
	"biz.products.name": "Name",
	"biz.products.description": "Description",
	"biz.products.price": "Price",
	"biz.products.compareAt": "Previous price",
	"biz.products.compareAt.rule": "It has to be more than the price.",
	"biz.products.category": "Category",
	/*
	 * Under the product form's category picker. The list beside it is already narrowed to
	 * the shop's own vertical — a food shop's products file under food categories, a phone
	 * shop's under electronics — and this names that vertical out loud, because a short
	 * list with no explanation reads as a list with rows missing.
	 */
	"biz.products.category.help": "Your shop's line: {sector}.",
	"biz.products.photo": "Photo",
	"biz.products.photo.add": "Add photo",
	/* Teaches the two controls now, not a pasted link — see the Spanish file's note. */
	"biz.products.photo.help":
		"Pick one from your gallery or take one with the camera.",
	"biz.products.photo.rule": "Choose a JPEG, PNG or WebP image up to 5 MB.",
	"biz.products.sku": "Internal code",
	"biz.products.prepTime": "Preparation time",
	"biz.products.trackStock": "Track inventory",
	"biz.products.stock": "In stock",
	"biz.products.lowStockAt": "Warn me when there are",
	"biz.products.options": "Options",
	"biz.products.options.add": "Add option group",
	"biz.products.options.name": "Group name",
	"biz.products.options.required": "One is required",
	"biz.products.options.multiple": "Can choose several",
	"biz.products.options.max": "Up to {count}",
	"biz.products.status.DRAFT": "Draft",
	"biz.products.status.ACTIVE": "Published",
	"biz.products.status.ARCHIVED": "Archived",
	"biz.products.publish": "Publish",
	"biz.products.unpublish": "Hide",
	"biz.products.hidden": "Hidden: it doesn't show in your store",
	"biz.products.featured": "Featured",
	"biz.products.markSoldOut": "Mark sold out",
	"biz.products.markAvailable": "Mark available",
	"biz.products.delete.confirm": "Delete this product?",
	"biz.products.delete.hasOrders":
		"It has orders, so it gets archived instead of deleted",
	"biz.products.duplicate": "Duplicate",
	"biz.products.filter.all": "All",
	/* The empty list with a filter on: the fact is the filter, not the catalogue. */
	"biz.products.filter.empty": "No products in that category",
	"biz.products.filter.empty.body": "Clear the filter to see your whole menu.",
	"biz.products.filter.hidden": "Hidden",
	"biz.products.filter.outOfStock": "Sold out",

	"biz.reviews.title": "Reviews",
	"biz.reviews.empty": "No reviews yet",
	"biz.reviews.reply": "Reply",
	"biz.reviews.reply.placeholder": "Thanks for coming by…",
	"biz.reviews.reply.edit": "Edit reply",
	"biz.reviews.reply.posted": "Your reply is posted",
	"biz.reviews.average": "Average",
	"biz.reviews.new": "New review",
	"biz.reviews.breakdown": "{count} of {stars} stars",
	"biz.reviews.postedOn": "Posted {date}",
	"biz.reviews.order": "See the order",
	"biz.reviews.reply.yours": "Your reply",

	"biz.settings.title": "Settings",

	// The merchant console palette. The four names are colour words rather than product
	// names, because the control chooses a colour and a flattering name makes the swatch
	// beside it look like a lie. `lime` is the default and is what a shop saw before this
	// control existed.
	"biz.theme.title": "Appearance",
	"biz.theme.help": "The colour of PymesHub on this device",
	"biz.theme.lime": "Lime",
	"biz.theme.amber": "Amber",
	"biz.theme.coral": "Coral",
	"biz.theme.sky": "Sky",
	"biz.theme.sunset": "Sunset",
	"biz.theme.forest": "Forest",
	"biz.theme.ocean": "Ocean",
	"biz.theme.orchid": "Orchid",
	"biz.theme.citrus": "Citrus",
	"biz.theme.berry": "Berry",
	"biz.theme.dune": "Dune",
	"biz.theme.harbor": "Harbour",
	"biz.theme.vine": "Vine",

	"biz.settings.profile": "Business details",
	"biz.settings.name": "Name",
	"biz.settings.slug": "Web address",
	"biz.settings.slug.help": "pymeshub.lat/{slug}",
	"biz.settings.slug.taken": "That name is already taken",
	"biz.settings.description": "Description",
	"biz.settings.logo": "Logo",
	"biz.settings.cover": "Cover image",
	/* See the Spanish file's note: the same two acts, said where they are shown. */
	"biz.settings.photo.help":
		"Pick one from your gallery or take one with the camera.",
	"biz.settings.category": "Main category",
	"biz.settings.contact": "Contact",
	"biz.settings.phone": "Phone",
	"biz.settings.whatsapp": "WhatsApp",
	"biz.settings.email": "Contact email",
	"biz.settings.address": "Address",
	"biz.settings.address.help":
		"We use it for pickups and to work out delivery.",
	"biz.settings.hours": "Hours",
	"biz.settings.hours.closed": "Closed",
	"biz.settings.hours.copyToAll": "Copy to every day",
	"biz.settings.hours.overnight": "Closes after midnight",
	"biz.settings.delivery": "Delivery",
	"biz.settings.delivery.enabled": "I offer delivery",
	"biz.settings.delivery.fee": "Courier fee per delivery",
	/* The unit is the one the API charges: the currency's minor unit, where ₡ goes bare and $ carries two more. */
	"biz.settings.delivery.fee.help":
		"Set what the courier earns per delivery. The customer charge may vary by route. ₡1 500 is entered as 1500; $25 as 2500.",
	"biz.settings.delivery.cover": "I will cover delivery for customers",
	"biz.settings.delivery.cover.on": "Shop pays",
	"biz.settings.delivery.cover.off": "Customer pays",
	"biz.settings.delivery.cover.help":
		"Customers pay no delivery fee. Your shop still owes the courier the amount above for each delivery.",
	"biz.settings.delivery.courierFeeRequired":
		"Set a courier fee above zero before offering delivery.",
	"biz.settings.delivery.freeOver": "Free delivery over",
	"biz.settings.delivery.radius": "Delivery radius",
	"biz.settings.delivery.minOrder": "Minimum order",
	"biz.settings.delivery.prepTime": "Preparation time",
	"biz.settings.pickup": "Pick up in store",
	"biz.settings.pickup.enabled": "I allow pickups",
	"biz.settings.payments": "Payment methods",
	"biz.settings.payments.cash": "Cash",
	"biz.settings.payments.sinpe": "SINPE Móvil",
	"biz.settings.payments.sinpe.phone": "SINPE number",
	"biz.settings.notifications": "Notifications",
	"biz.settings.notifications.newOrder": "Tell me about every new order",
	"biz.settings.notifications.sound": "Sound on the board",
	"biz.settings.save": "Save changes",
	"biz.settings.saved": "Changes saved",
	"biz.settings.danger": "Careful zone",
	"biz.settings.pause": "Pause the business",
	"biz.settings.pause.help":
		"It stops showing in the app. Nothing is deleted and you can come back anytime.",
	"biz.settings.currency": "Currency",
	"biz.settings.hours.opens": "Opens",
	"biz.settings.hours.closes": "Closes",
	"biz.settings.hours.rule": "Closing time has to be after opening time",
	"biz.settings.hours.add": "Add hours",
	"biz.settings.hours.help":
		"Until you set hours, your business shows as open at all times.",
	"biz.settings.readOnly": "Only the owner or the manager can save changes",
	"biz.settings.suspended":
		"PymesHub suspended this business. Write to us to have it looked at.",
	/* The four words for `BusinessStatus`, for the shop's own screens. See the Spanish
	   file's note: why these are not `store.open`/`store.closed`, and why they are kept
	   separate from `admin.businesses.status.*` (where ACTIVE reads "Active"). */
	"biz.status.DRAFT": "Draft",
	"biz.status.ACTIVE": "Published",
	"biz.status.SUSPENDED": "Suspended",
	"biz.status.CLOSED": "Closed",

	"biz.staff.title": "Team",
	"biz.staff.add": "Invite someone",
	"biz.staff.empty": "You're working alone for now",
	"biz.staff.invite.email": "Their email",
	"biz.staff.invite.role": "What they can do",
	"biz.staff.invite.send": "Send invitation",
	"biz.staff.invite.sent": "Invitation sent to {email}",
	"biz.staff.invite.pending": "Invitation pending",
	"biz.staff.invite.revoke": "Cancel invitation",
	"biz.staff.role.OWNER": "Owner",
	"biz.staff.role.MANAGER": "Manager",
	"biz.staff.role.STAFF": "Staff",
	/* The fourth membership role (`docs/domain.md`). Label only: a courier's own
	 * sentence is `biz.onboarding.delivery.courierHelp`, so there is no `.help` here. */
	"biz.staff.role.COURIER": "Courier",
	"biz.staff.role.OWNER.help": "Everything, including the team and payouts",
	"biz.staff.role.MANAGER.help":
		"Orders and products, without touching the team",
	"biz.staff.role.STAFF.help": "Only see and advance orders",
	"biz.staff.changeRole": "Change role",
	"biz.staff.owner.confirm.title": "Make {name} an owner?",
	"biz.staff.owner.confirm.body":
		"They will be able to manage the team, business settings, and payouts.",
	"biz.staff.owner.confirm.action": "Make owner",
	"biz.staff.remove": "Remove from team",
	"biz.staff.remove.confirm": "Remove {name} from the team?",
	"biz.staff.cantRemoveOwner": "You can't remove yourself as owner",
	"biz.staff.you": "You",
	"biz.staff.invite.help":
		"They need a PymesHub account already. You add them by their email; no email is sent.",
	"biz.staff.invite.added": "{name} is on the team now",
	"biz.staff.joinedAt": "On the team since {date}",
	"biz.staff.lastOwner":
		"A business can't be left without an owner. Make someone else an owner first.",

	"biz.payouts.title": "Payments and sales",
	"biz.payouts.empty": "No sales to show yet",
	"biz.payouts.gross": "Gross sales",
	"biz.payouts.commission": "PymesHub commission",
	"biz.payouts.net": "Yours",
	"biz.payouts.period": "From {from} to {to}",
	"biz.payouts.orders": "{count} order",
	"biz.payouts.orders_plural": "{count} orders",
	"biz.payouts.export": "Download CSV",
	"biz.payouts.note":
		"Payment is arranged directly with your customers. Here we just keep the tally.",
	"biz.payouts.status.PENDING": "Pending",
	"biz.payouts.status.PAID": "Paid",
	"biz.payouts.status.FAILED": "Failed",
	"biz.payouts.paidAt": "Paid {date}",
	"biz.payouts.reference": "Reference",
	"biz.subscription.title": "Subscription",
	"biz.subscription.note":
		"Your sales are paid directly. PymesHub charges a flat fee for use of the platform.",
	"biz.subscription.empty": "This business does not have a subscription yet",
	"biz.subscription.empty.body":
		"The plan will appear here when the first fee is activated.",
	"biz.subscription.plan": "Plan",
	"biz.subscription.plan.FREE": "Free",
	"biz.subscription.plan.EMPRENDE": "Emprende",
	"biz.subscription.plan.STARTER": "Starter",
	"biz.subscription.plan.GROWTH": "Growth",
	"biz.subscription.plan.BUSINESS": "Business",
	"biz.subscription.cadence": "Billing",
	"biz.subscription.cadence.MONTHLY": "Monthly",
	"biz.subscription.cadence.YEARLY": "Yearly",
	"biz.subscription.status": "Status",
	"biz.subscription.status.ACTIVE": "Current",
	"biz.subscription.status.GRACE": "Grace period",
	"biz.subscription.status.PAST_DUE": "Past due",
	"biz.subscription.status.SUSPENDED": "Suspended",
	"biz.subscription.period": "Period: {from} – {to}",
	"biz.subscription.price": "Fee",
	"biz.subscription.iva": "VAT included: {amount}",
	"biz.subscription.lastPaid": "Last payment: {date}",
	/*
	 * What the plan includes, for the merchant's subscription screen. The labels are
	 * `plans.ts` said out loud: limits are a function of the tier alone, so they read as
	 * a list rather than a table.
	 */
	"biz.subscription.limit.title": "What your plan includes",
	"biz.subscription.limit.products": "Products",
	"biz.subscription.limit.staffAccounts": "People with access",
	"biz.subscription.limit.locations": "Locations",
	"biz.subscription.limit.promotions": "Active promotions",
	"biz.subscription.limit.images": "Images per product",
	"biz.subscription.limit.storage": "Storage",
	"biz.subscription.limit.history": "History",
	"biz.subscription.limit.inventory": "Inventory tracking",
	"biz.subscription.limit.express": "Express deliveries per week",
	"biz.subscription.limit.included": "Included",
	"biz.subscription.limit.notIncluded": "Not included",
	"biz.subscription.limit.unlimited": "Unlimited",
	"biz.subscription.limit.days": "{count} days",
	"biz.subscription.limit.years": "{count} years",
	"biz.subscription.limit.megabytes": "{value} MB",
	"biz.subscription.limit.gigabytes": "{value} GB",
	"biz.subscription.plans": "Available plans",
	"biz.subscription.current": "Your current plan",
	"biz.subscription.change": "Change plan",
	"biz.subscription.updated": "Plan updated",

	"biz.notifications.title": "Notifications",
	"biz.notifications.empty": "Nothing to tell you right now",
	"biz.notifications.markAllRead": "Mark all as read",

	/*
	 * The business frame. Six sections, and the landmark's own name — "Main" would be
	 * announced twice, once for the container and once for its first item, which is the
	 * mistake `nav.primary`'s comment already records.
	 */
	"biz.nav.primary": "Business sections",
	"biz.nav.orders": "Orders",
	"biz.nav.products": "Products",
	"biz.nav.analytics": "Analytics",
	"biz.nav.more": "More",
	/* The tab, which names the job rather than the stock: the screen behind it
	 * is the menu the kitchen reads, and "Products" is what the stockroom calls
	 * the same rows. One word for the way in, another for the thing. */
	"biz.nav.menu": "Menu",
	"biz.nav.reviews": "Reviews",
	"biz.nav.payouts": "Payouts",
	"biz.nav.staff": "Team",
	"biz.nav.settings": "Settings",

	/*
	 * The two ways in are refused. Kept apart because they ask different things of the
	 * reader: `noAccess` is "you are not part of this shop" (an invite fixes it) and
	 * `permission` is "your role is too low" (a role change fixes it).
	 */
	"biz.noAccess.title": "You don't have access to this business",
	"biz.noAccess.body":
		"Your account isn't part of this business. Ask the owner to invite you.",
	"biz.permission.title": "Your role can't open this section",
	"biz.permission.body": "Ask the owner or the manager to give you access.",

	/**
	 * The identified courier no shop has added yet. The membership is not requested in
	 * the app: it arrives when the shop adds the person by email, so the screen states
	 * the fact and the step, not a denied permission.
	 */
	"biz.courier.pending.title": "No shop has added you yet",
	"biz.courier.pending.body":
		"Ask the shop to add you as a courier with the email you signed in with.",
	"biz.courier.location.title": "Share your location during delivery",
	"biz.courier.location.body":
		"The customer can see your position while the order is on the way. Updates stop when the delivery is completed.",
	"biz.courier.location.unavailable":
		"Turn on your phone's GPS to share your position during this delivery.",
	"biz.courier.location.action": "Allow location",
	"biz.courier.location.active": "Sharing is on",
	"biz.courier.location.starting": "Starting location sharing…",

	/* The courier's own profile: identity, vehicle, and the review mark on it. */
	"biz.courier.profile": "Courier profile",
	"biz.courier.profileTitle": "Courier profile",
	"biz.courier.profileSubtitle":
		"Your profile is shown to businesses only when you allow it.",
	"biz.courier.displayName": "Name businesses see",
	"biz.courier.serviceArea": "Where you deliver",
	"biz.courier.zone.title": "Delivery zone",
	"biz.courier.zone.map.label":
		"Map for choosing the centre of your delivery zone",
	"biz.courier.zone.unset": "No zone selected",
	"biz.courier.zone.choose": "Choose on map",
	"biz.courier.zone.edit": "Edit on map",
	"biz.courier.zone.hint": "Tap the map to place your zone.",
	"biz.courier.zone.done": "Use this zone",
	"biz.courier.zone.help":
		"Tap the map to choose the center. Pickups and destinations must both be inside this circle; you also need to be near the pickup.",
	"biz.courier.zone.radius": "Radius: {count} km",
	"biz.courier.zone.save": "Save delivery zone",
	"biz.courier.zone.saved": "Delivery zone saved",
	"biz.courier.bio": "About you",
	"biz.courier.bio.help": "A short line helps a business choose you.",
	"biz.courier.vehicle": "Vehicle",
	"biz.courier.vehicleName": "Vehicle name",
	"biz.courier.vehiclePlate": "Plate",
	"biz.courier.vehiclePhoto": "Vehicle photo",
	"biz.courier.vehiclePhoto.add": "Add photo",
	"biz.courier.vehiclePhoto.change": "Change photo",
	"biz.courier.vehiclePhoto.remove": "Remove photo",
	"biz.courier.vehiclePhoto.tooLarge": "Use a smaller photo, up to 5 MB.",
	"biz.courier.availability": "Availability",
	/*
	 * Availability does not wait for the save, and this is the sentence that says so.
	 * `isAvailable` is the field every business filters the pool on
	 * (`services/deliveries.ts` asks for `VERIFIED AND isAvailable`), so the change has to be
	 * the one the reader just made rather than the one they remember thirty seconds later.
	 */
	"biz.courier.availability.help":
		"Applies immediately. Businesses only offer you deliveries while you are available.",
	"biz.courier.available": "Available for invitations",
	"biz.courier.unavailable": "Not available right now",
	"biz.courier.save": "Save profile",
	"biz.courier.saved": "Profile saved",

	/*
	 * The price of saving.
	 *
	 * `services/couriers.ts` puts `verificationStatus` back to PENDING on any non-empty change —
	 * name, area, bio, vehicle, plate or photo — so a verified profile leaves the directory and
	 * the offers pool until the platform approves it again. These are the sentences that say so:
	 * a save that quietly makes the profile worse is the worst kind of surprise, and it went
	 * unspoken for years because the comment beside the vehicle section named a single field as
	 * though the rest of them were free.
	 *
	 * `.help` is the subtitle on the two sections it touches, and the panel is only asked when
	 * the profile is verified: a REJECTED one is already asking for this save — its own body
	 * says "update your details and send them for review again" — and a PENDING one has nothing
	 * to fall out of.
	 */
	"biz.courier.reviewReset.help":
		"Saving a change puts your profile back into review and takes it out of the directory until it is approved.",
	"biz.courier.reviewReset.title": "Save and go back to review?",
	"biz.courier.reviewReset.body":
		"Your profile is already verified. Saving means you stop receiving offers until PymesHub approves the changes.",
	"biz.courier.reviewReset.confirm": "Save and review",
	"biz.courier.reviewPending": "Review pending",
	"biz.courier.reviewPending.body":
		"PymesHub reviews your profile before it appears in the directory.",
	"biz.courier.verified": "Verified profile",
	"biz.courier.rejected": "Profile not approved",
	"biz.courier.rejected.body":
		"Update your details and send them for review again.",
	"biz.courier.rejected.next":
		"Change what is wrong below and save again. PymesHub reviews your profile before putting you back in the directory.",
	"biz.courier.directoryVerified": "Verified by PymesHub",

	// The directory preview and the heading that introduces it. The wording says what it
	// is — "this is what businesses see" — and promises nothing more: the card is the same
	// one a business renders, from the same data, so it cannot misrepresent by construction.
	"biz.courier.preview.title": "How businesses see you",
	"biz.courier.preview.body":
		"This is your card in the courier directory, exactly as a business looking for a rider sees it.",
	"biz.courier.preview.pending":
		"This is how businesses will see you once PymesHub approves your profile. The verified mark is not there yet.",

	/*
	 * Business invitations, and the row that makes them visible.
	 *
	 * `couriers.myInvites` worked and `/courier-invites` was a finished screen with accept and
	 * decline, and nothing linked either from this tree: the only route was
	 * `app/account.tsx:389`, and the courier tree cannot reach `/account`. A business that invited
	 * someone reached a courier with no way to find out.
	 *
	 * `.pending` takes `{count}` and follows the dictionary's `_plural` convention.
	 */
	"biz.courier.invites.help":
		"Businesses that invited you to deliver their orders.",
	"biz.courier.invites.pending": "{count} to answer",
	"biz.courier.invites.pending_plural": "{count} to answer",

	/* A refused move that is not the conflict below — see the Spanish file's note. */
	"biz.board.moveFailed": "We couldn't move the order",
	/* Someone else advanced the order while this phone was looking at the board. */
	"biz.board.conflict.title": "Someone else moved this order",
	"biz.board.conflict.body":
		"It's already {status}. We refreshed the board to the latest.",

	"biz.onboarding.create": "Create my business",
	"biz.onboarding.delivery.title": "Delivery setup",
	"biz.onboarding.delivery.body":
		"Fees, zone, and who rides. You can skip this and come back from your board.",
	"biz.onboarding.delivery.courier": "Courier email",
	"biz.onboarding.delivery.courierHelp":
		"They need a PymesHub account; we add them as your shop's courier.",
	"biz.onboarding.delivery.skip": "Skip for now",
	/* A state that is not an error: a pickup-only shop simply has no delivery to set up. */
	"biz.onboarding.delivery.pickupOnly":
		"Your shop offers pickup only, so there is no delivery to configure.",
	"biz.new.selected": "Selected",

	/*
	 * The creation form. Deliberately small: the fields here are the ones a shop cannot
	 * exist without, and address sub-fields reuse `biz.settings.*` rather than getting a
	 * second set of labels that would drift from them.
	 */
	"biz.new.title": "Open your business",
	"biz.new.subtitle":
		"It goes live once you add your first products. Everything here can be changed later.",
	"biz.new.name.help":
		"This is what customers see, and it becomes your web address.",
	"biz.new.category.placeholder": "Pick yours",
	/*
	 * The shop category *is* the taxonomy: it is where the shop shows up in the
	 * marketplace, and `businesses.list` filters on that column. It is required, and it is
	 * a leaf — a sector would make the shop answer for categories it does not sell. It used
	 * to be optional, back when the taxonomy was the six flat demo categories: then it was
	 * a label and nothing depended on it. Products carry their own on top of it.
	 */
	"biz.new.category.help":
		"Where your shop shows up in the marketplace. Each product carries its own on top.",
	"biz.new.currency": "Currency",
	"biz.new.currency.help":
		"Fixed for good once you start selling — changing it would re-price every product.",
	"biz.new.kind.required": "Pick at least one way to hand over an order",
	"biz.new.amount.unreadable": "We can't read that amount",
	"biz.new.number.unreadable": "We can't read that number",
	/* The row's hint, saying what the row opens rather than repeating its title. */
	"biz.new.currency.open": "Choose the currency you price in",
	"biz.new.category.open": "Open this sector's categories",
	"biz.new.submit": "Create business",

	/* The address fields, which `biz.settings.address` introduces but does not name. */
	"biz.settings.line1": "Street address",
	"biz.settings.line2": "Landmark or extra detail",
	"biz.settings.city": "City",
	"biz.settings.region": "Province",
	"biz.settings.postalCode": "Postal code",

	/* The dashboard's analytics block, over the window it read. */
	"biz.dashboard.period": "Last {days} days",
	"biz.dashboard.ordersByDay": "Orders per day",
	"biz.dashboard.topProducts": "Best sellers",
	"biz.dashboard.averageOrder": "Average order",
	"biz.dashboard.customers": "Customers",
	"biz.dashboard.repeat": "Order again",

	"biz.analytics.title": "Analytics",
	"biz.analytics.customRange": "Period",
	"biz.analytics.range.invalid": "Invalid amount: from 1 up to 2 years.",
	"biz.analytics.loadError": "Analytics could not load.",
	"biz.analytics.netRevenue": "NET REVENUE",
	"biz.analytics.gross": "{amount} gross",
	"biz.analytics.fees": "{amount} fees",
	"biz.analytics.orders": "Orders",
	"biz.analytics.average": "Average",
	"biz.analytics.customers": "Customers",
	"biz.analytics.repeat": "Repeat",
	"biz.analytics.accepted": "Accepted",
	"biz.analytics.refunds": "Refunds",
	"biz.analytics.discounts": "Discounts",
	"biz.analytics.avgAccept": "Avg. accept",
	"biz.analytics.avgPreparation": "Avg. preparation",
	"biz.analytics.revenueByDay": "Revenue by day",
	"biz.analytics.emptyOrders": "No orders in this period.",
	"biz.analytics.emptyProducts": "No product sales in this period.",
	"biz.analytics.sold": "{quantity} sold",
	"biz.analytics.sold_plural": "{quantity} sold",
	/* The chart column's voice: the bar is the view; the figure is the speech. */
	"biz.analytics.chartDay": "{day}: {amount}",

	"biz.more.loading": "Loading",
	"biz.more.title": "More",
	"biz.more.auditHistory": "Audit history",
	"biz.more.subtitle": "Changes and who made them",
	"biz.auditHistory.emptyState": "No changes recorded yet.",
	"biz.auditHistory.actor": "Person",
	"biz.auditHistory.action": "Action",
	"biz.auditHistory.targetType": "Target type",
	"biz.auditHistory.targetId": "Target ID",
	"biz.auditHistory.timestamp": "Timestamp",
	"biz.auditHistory.before": "Before",
	"biz.auditHistory.after": "After",
	"biz.auditHistory.reason": "Reason",
	"biz.more.business": "Business",
	"biz.more.signOut": "Sign out",
	// The question and its consequence, worded for the merchant. "of PymesHub" went with
	// them: the sheet is a panel inside this app, drawn on this app's canvas, and naming the
	// product in a heading two lines under a header that already names the account spends
	// the reader's attention on something they are not being asked about.
	"biz.more.signOutConfirm": "Sign out?",
	"biz.more.signOutBody":
		"You'll need to sign in again to manage your business.",
	"biz.locations.title": "Locations",
	// The shop's own position, and the courier catchment drawn around it. "Pickup point"
	// is the word the delivery screen already uses for this (`biz.settings.pickup`), so
	// the ring is named the same way rather than inventing a third name for one place.
	"biz.location.title": "Shop location",
	"biz.location.body":
		"Where your shop is on the map. Orders are offered to couriers near this point.",
	"biz.location.map": "Pickup point",
	"biz.location.map.label": "Map for choosing the shop pickup pin",
	"biz.location.subtitle": "Pickup point set on the map",
	"biz.location.unset": "Not set — no courier can be offered your orders",
	"biz.location.radius":
		"Couriers up to {count} km from this point can be offered your orders.",
	"biz.location.useDevice": "Use my current location",
	"biz.location.noFix":
		"The map needs a starting point. Enable location or add a complete shop address in your profile.",
	"biz.location.mapUnavailable":
		"The map is unavailable on this device. Try again in the development app.",
	"biz.locations.select": "Select location",
	"biz.locations.current": "Current",
	"biz.locations.allBusiness": "All locations",
	"biz.locations.subtitle": "Opening and order intake by branch",
	"biz.locations.pause": "Pause orders",
	"biz.locations.resume": "Resume orders",
	"biz.locations.pauseConfirm": "Pause orders at this location?",
	"biz.locations.minutes": "{count} minutes",
	"biz.locations.untilResumed": "Until I resume orders",
	"biz.locations.paused": "Orders paused for this location",
	"biz.locations.resumed": "Orders resumed for this location",
	"biz.locations.status.open": "Open",
	"biz.locations.status.closed_schedule": "Closed for the day",
	"biz.locations.status.paused_manual": "Paused",
	"biz.locations.status.paused_capacity": "Paused due to capacity",
	"biz.locations.status.paused_platform": "Paused by the platform",
	"biz.locations.status.offline": "Offline",
	"biz.locations.status.suspended": "Suspended",
	"biz.promotions.title": "Promotions",
	"biz.promotions.subtitle": "Your shop's discount codes",
	"biz.promotions.add": "Create promotion",
	"biz.promotions.edit": "Edit promotion",
	"biz.promotions.empty.title": "No promotions yet",
	"biz.promotions.empty.body":
		"Create a code your customers can use at checkout.",
	"biz.promotions.code": "Code",
	"biz.promotions.code.help":
		"What the customer types at checkout. Stored in uppercase.",
	"biz.promotions.kind": "Discount type",
	"biz.promotions.kind.PERCENT": "Percentage",
	"biz.promotions.kind.FIXED": "Fixed amount",
	"biz.promotions.kind.FREE_DELIVERY": "Free delivery",
	"biz.promotions.value": "Discount",
	"biz.promotions.value.percent": "1 to 100",
	"biz.promotions.value.fixed": "In your shop's currency",
	"biz.promotions.minOrder": "Minimum order",
	"biz.promotions.minOrder.help": "Blank: any order.",
	"biz.promotions.maxRedemptions": "Maximum uses",
	"biz.promotions.maxRedemptions.help": "Blank: unlimited.",
	"biz.promotions.used": "{count} use",
	"biz.promotions.used_plural": "{count} uses",
	"biz.promotions.usedOf": "{count} of {max} used",
	"biz.promotions.open": "Active",
	"biz.promotions.paused": "Paused",
	"biz.promotions.pause": "Pause",
	"biz.promotions.resume": "Resume",
	"biz.promotions.pausedToast": "Promotion paused",
	"biz.promotions.resumedToast": "Promotion resumed",
	"biz.promotions.created": "Promotion created",
	"biz.promotions.saved": "Promotion saved",
	"biz.promotions.code.required": "Enter a code of at least 3 characters.",
	"biz.promotions.value.percent.rule":
		"The discount must be between 1 and 100.",
	"biz.promotions.value.fixed.rule": "The discount must be greater than zero.",
	"biz.promotions.number.rule": "Enter a valid number.",
	"biz.promotions.code.taken": "A promotion with that code already exists.",
	"biz.promotions.description": "Description",
	"biz.promotions.description.placeholder":
		"What this offer is, in a few words",
	"biz.promotions.description.help": "{remaining} of {max} words left",
	"biz.promotions.description.rule": "Keep the description under 40 words.",
	"biz.promotions.photo.module": "Add a banner photo",
	"biz.promotions.photo.help":
		"JPEG, PNG or WebP, up to 5 MB. Cropped 16:9 for the banner.",
	"biz.more.empty.title": "No business to manage yet",
	"biz.more.empty.body":
		"Create a business to manage its settings, team, payouts and reviews.",
	"biz.more.empty.action": "Create business",
	"biz.more.settingsDelivery": "Settings and delivery",
	"biz.more.settingsFallback": "Business configuration",
	"biz.more.shopSubtitle": "Name, photos, category and address",
	"biz.more.hoursSubtitle": "Opening and closing each day",
	"biz.more.catalog": "Catalog",
	"biz.more.catalogSubtitle": "Products, stock and availability",
	"biz.more.moneyPeople": "Money and people",
	"biz.more.payouts": "Payouts",
	"biz.more.payoutsSubtitle": "{count} payout record",
	"biz.more.payoutsSubtitle_plural": "{count} payout records",
	"biz.more.subscription": "Subscription",
	"biz.more.subscriptionEmpty": "No active subscription",
	"biz.more.team": "Team",
	"biz.more.teamSubtitle": "{count} team member",
	"biz.more.teamSubtitle_plural": "{count} team members",
	"biz.more.feedback": "Customer feedback",
	"biz.more.viewReviews": "View all reviews",
	"biz.more.noWrittenReview": "No written review",
	"biz.more.noReviews": "No reviews yet.",
	"biz.more.account": "Account",
	"biz.more.profile": "Profile",
	"biz.more.profileSubtitle": "Personal account settings",
	"biz.more.settings": "Settings",
	"biz.more.settingsSubtitle": "Theme, notifications and privacy",
	"biz.more.support": "Support",
	"biz.more.supportSubtitle": "Help, safety and common questions",

	/* The product form, which is not the business settings form. */
	"biz.products.created": "Product added",
	"biz.products.saved": "Product saved",
	"biz.products.archived": "Product archived",
	"biz.products.search": "Search by name",
	"biz.products.stock.help": "How many are left today",
	"biz.products.options.option": "Option",
	"biz.products.options.addOption": "Add option",
	"biz.products.options.priceDelta": "Extra price",
	"biz.products.options.remove": "Remove group",

	/* Capabilities merged from master: courier, delivery and merchant operations. */
	"biz.insight.estimatedMargin": "Estimated margin",
	"biz.settings.country": "Country",
	"biz.settings.country.invalid": "Enter the 2-letter country code",
	"biz.settings.publish": "Publish the business",
	"biz.courier.profileRequired": "Create your profile to receive invitations.",
	"biz.courier.invites": "Invitations",
	"biz.courier.invitesTitle": "Courier invitations",
	"biz.courier.invitesSubtitle": "Businesses that want you to deliver for them",
	"biz.courier.invites.empty.title": "No invitations yet",
	"biz.courier.invites.empty.body":
		"When a business invites you, it will appear here.",
	"biz.courier.invite.pending": "Invitation pending",
	"biz.courier.invite.accept": "Accept",
	"biz.courier.invite.decline": "Decline",
	"biz.courier.invite.accepted": "You now deliver for this business",
	"biz.courier.invite.declined": "Invitation declined",
	"biz.courier.invite.expired": "This invitation expired",
	"biz.courier.search": "Find a courier",
	"biz.courier.search.action": "Search",
	"biz.courier.search.help":
		"Search by name or area. Emails and phone numbers are not shown.",
	"biz.courier.search.hint": "Enter at least two letters.",
	"biz.courier.search.empty": "No verified couriers match.",
	"biz.courier.invite.send": "Send invitation",
	"biz.courier.invite.sent": "Invitation sent to {name}",
	"biz.courier.invite.alreadyMember": "Already on the team",
	"biz.courier.invite.alreadySent": "Invitation pending",
	"biz.courier.invite.cancel": "Cancel invitation",
	"biz.courier.invitesForBusiness": "Sent invitations",
	"biz.courier.noPendingInvites": "No pending invitations",
	"biz.analytics.period": "Last {unit}",
	"biz.analytics.unit.hours": "{count} hour",
	"biz.analytics.unit.hours_plural": "{count} hours",
	"biz.analytics.unit.days": "{count} day",
	"biz.analytics.unit.days_plural": "{count} days",
	"biz.analytics.unit.months": "{count} month",
	"biz.analytics.unit.months_plural": "{count} months",
	"biz.analytics.unit.years": "{count} year",
	"biz.analytics.unit.years_plural": "{count} years",
	"biz.analytics.revenueByHour": "Revenue by hour",
	"biz.analytics.revenueByMonth": "Revenue by month",
	"biz.locations.status.title": "Store status",
	"biz.more.close": "Close",
	"biz.more.businessName": "Business name",
	"biz.more.businessNameSubtitle": "What customers see",
	"biz.more.switchBusiness": "Switch business",
	"biz.more.switchBusinessSubtitle": "Choose the business you want to open",
	"biz.more.verified": "Verified",
	"biz.more.verification": "Verification",
	"biz.more.verificationPending": "Verification pending",
	"biz.more.storeProfile": "Store profile",
	"biz.more.storeProfileSubtitle": "Name, contact and public details",
	"biz.more.businessHours": "Business hours",
	"biz.more.businessHoursSubtitle": "Weekly opening schedule",
	"biz.more.operations": "Operations",
	"biz.more.payments": "Payments",
	"biz.more.paymentsSubtitle": "Collection and payment records",
	"biz.more.promotions": "Promotions",
	"biz.more.promotionsSubtitle": "Visible codes and offers",
	"biz.more.settlements": "Settlements",
	"biz.more.settlementsSubtitle": "Periods, references and payouts",
	"biz.more.activity": "Activity log",
	"biz.more.activitySubtitle": "Summary and recent changes",
	"biz.manage.loading": "Loading",
	"biz.manage.loadingScope": "Loading business details",
	"biz.manage.merchantFallback": "Your business",
	"biz.manage.activeLocation": "Active location",
	"biz.manage.noLocation": "No location",
	"biz.manage.unavailable": "Unavailable",
	"biz.manage.noLocations": "You have no locations yet",
	"biz.manage.errorTitle": "We couldn't load this section",
	"biz.manage.errorBody": "Try again.",
	"biz.manage.editSettings": "Edit settings",
	"biz.manage.storeProfile": "Store profile",
	"biz.manage.brandAssets": "Brand assets",
	"biz.manage.notSet": "Not set",
	"biz.manage.noDescription": "No description",
	"biz.manage.schedule": "Weekly schedule",
	"biz.manage.day": "Day",
	"biz.manage.opens": "Opens",
	"biz.manage.closes": "Closes",
	"biz.manage.locationOperations": "Location operations",
	"biz.manage.location": "Location",
	"biz.manage.city": "City",
	"biz.manage.action": "Action",
	"biz.manage.staffRoster": "Team",
	"biz.manage.member": "Member",
	"biz.manage.email": "Email",
	"biz.manage.role": "Role",
	"biz.manage.changeRole": "Change role",
	"biz.manage.noStaff": "No team members",
	"biz.manage.paymentControls": "Payment records",
	"biz.manage.records": "Records",
	"biz.manage.pending": "Pending",
	"biz.manage.paid": "Paid",
	"biz.manage.recentPayments": "Recent payments",
	"biz.manage.period": "Period",
	"biz.manage.orders": "Orders",
	"biz.manage.amount": "Amount",
	"biz.manage.noPayments": "No payments yet",
	"biz.manage.settlementLedger": "Settlement ledger",
	"biz.manage.reference": "Reference",
	"biz.manage.paidOn": "Paid",
	"biz.manage.noSettlements": "No settlements yet",
	"biz.manage.promotionControls": "Visible promotions",
	"biz.manage.active": "Active",
	"biz.manage.scheduled": "Scheduled",
	"biz.manage.promotionRecords": "Promotion codes",
	"biz.manage.campaign": "Code",
	"biz.manage.window": "Benefit",
	"biz.manage.status": "Status",
	"biz.manage.redemptions": "Uses",
	"biz.manage.noPromotions": "No active promotions",
	"biz.manage.promotionReadOnly":
		"These are the codes customers can see right now.",
	"biz.manage.supportDesk": "Help centre",
	"biz.manage.supportQueue": "Frequently asked questions",
	"biz.manage.noTickets": "No open requests",
	"biz.manage.locationContext": "Location context",
	"biz.manage.responseChannel": "App guidance",
	"biz.manage.openHelp": "Open help",
	/* The support desk itself — see the Spanish block, which argues why these are not more
	 * `biz.manage.*` keys: `biz.more.support` is a menu row about help and common
	 * questions, which is honest about the FAQ and wrong for a queue of tickets. */
	"biz.support.queue": "Open requests",
	"biz.support.queueCount": "{count} open",
	"biz.support.queueCount_plural": "{count} open",
	"biz.support.newTicket": "Open a request",
	"biz.support.emptyTitle": "You have no open requests",
	"biz.support.emptyBody":
		"When you open one, PymesHub's answer shows up here.",
	"biz.support.category": "Category",
	"biz.support.category.BILLING": "Billing",
	"biz.support.category.TECHNICAL": "Technical",
	"biz.support.category.ACCOUNT": "Account",
	"biz.support.category.PRODUCT": "Products",
	"biz.support.category.OTHER": "Other",
	"biz.support.newTitle": "Open a request",
	"biz.support.subject": "Subject",
	"biz.support.subjectHelp": "One line. Up to 120 characters.",
	"biz.support.subjectRequired": "Write a subject.",
	"biz.support.subjectTooLong": "The subject can be up to 120 characters.",
	"biz.support.body": "Description",
	"biz.support.bodyHelp": "Tell us what happened. Up to 2000 characters.",
	"biz.support.bodyRequired": "Tell us what you need.",
	"biz.support.bodyTooLong": "The description can be up to 2000 characters.",
	"biz.support.submit": "Send request",
	"biz.support.submitFailed": "We could not send the request.",
	"biz.support.status.OPEN": "Open",
	"biz.support.status.WAITING": "Waiting on you",
	"biz.support.status.RESOLVED": "Resolved",
	"biz.support.status.CLOSED": "Closed",
	"biz.support.thread": "Conversation",
	"biz.support.messages": "{count} message",
	"biz.support.messages_plural": "{count} messages",
	"biz.support.lastActivity": "Last message",
	"biz.support.neverActivity": "No activity",
	"biz.support.replyLabel": "Your reply",
	"biz.support.replySend": "Send reply",
	"biz.support.replyRequired": "Write a reply.",
	"biz.support.replyFailed": "We could not send your reply.",
	"biz.support.markWaiting": "Mark as waiting",
	"biz.support.markOpen": "Move back to open",
	"biz.support.waitingExplain":
		"Mark this when you have answered and PymesHub has not replied yet.",
	"biz.support.reopenedNotice":
		"Replying puts this request back in the queue: it reopens and stops being resolved.",
	"biz.support.terminalNotice":
		"This request is {status}. You can still reply and it will rejoin the queue.",
	"biz.support.you": "You",
	"biz.support.fromSupport": "PymesHub",
	"biz.manage.activity": "Activity summary",
	"biz.manage.activityWindow": "Last {count} order",
	"biz.manage.activityWindow_plural": "Last {count} orders",
	"biz.manage.activityWindowTitle": "Orders shown",
	"biz.manage.activityOrders": "Orders loaded",
	"biz.manage.activityVolume": "Order value",
	"biz.manage.activityAverage": "Average order",
	"biz.manage.activityOpen": "Open now",
	"biz.manage.activityCompleted": "Completed",
	"biz.manage.activityAttention": "Needs attention",
	"biz.manage.activityByDay": "Orders by day",
	"biz.manage.activityNoChart": "No orders in the last 7 days",
	"biz.manage.activityStatus": "Order status",
	"biz.manage.activityFeed": "Recent changes",
	"biz.manage.activityViewAll": "View all orders",
	"biz.manage.activityItems": "{count} order",
	"biz.manage.activityItems_plural": "{count} orders",
	"biz.manage.orderActivity": "Recent activity",
	"biz.manage.noActivity": "No activity in this view",
	"biz.manage.time": "Time",
	"biz.manage.actor": "Person",
	"biz.manage.target": "Target",
	"delivery.board.title": "Deliveries",
	"delivery.board.subtitle": "Offers and active deliveries",
	"delivery.board.offers": "Offers to accept",
	"delivery.offer.expiresSoon": "Expires soon",
	"delivery.offer.expiresMinutes": "{count} min left",
	"delivery.board.active": "Active deliveries",
	"delivery.board.active.body":
		"Your current orders from every business, including accepted offers and direct assignments.",
	"delivery.board.active.empty": "No active deliveries",
	"delivery.board.active.emptyBody":
		"Orders you accept or a business assigns to you will appear here.",
	"delivery.board.openRun": "Open delivery",
	"delivery.board.zone.title": "Choose your delivery zone",
	"delivery.board.zone.body":
		"Pin where you want to work. Until then, your current nearby-offer matching continues.",
	"delivery.board.zone.action": "Set zone on map",
	"delivery.board.history": "Recent completed deliveries",
	"delivery.board.empty": "No new offers right now",
	"delivery.board.offers.busy":
		"Finish your current delivery to receive another offer.",
	"delivery.board.empty.body":
		"Matching deliveries will appear here while you are available.",

	/*
	 * The second board, and why it exists apart from the first.
	 *
	 * `/delivery` reads two different pipelines: `deliveries.offers` (an offer the courier
	 * accepts) and `orders.list` with `assignedToMe` (an order a business assigns by hand).
	 * `services/orders.ts` writes `order.courierUserId` and `deliveryTable.courierUserId` in the
	 * same assignment, so one delivery lives in both lists at once — with two state vocabularies
	 * and two different sets of buttons. What was missing was the heading that says so, and
	 * without it the second `EmptyState` read as a contradiction of the first rather than as the
	 * answer to a different question.
	 */
	"delivery.board.assigned": "Assigned orders",
	"delivery.board.assigned.body":
		"A business can assign you an order directly, without going through offers.",
	"delivery.board.assigned.empty": "No assigned orders",
	"delivery.board.assigned.emptyBody":
		"Orders a business assigns you without asking you to accept them will appear here.",

	/*
	 * Whether the courier is available for offers, in their pinned zone or nearby.
	 */
	"delivery.board.receiving.on": "Available for offers",
	"delivery.board.receiving.off": "Offers paused",
	"delivery.board.availability.change": "Change status",
	/* Couriers without a pinned zone need a fresh nearby location. */
	"delivery.board.presence.action": "Turn on location",
	"delivery.board.presence.body":
		"Without your location businesses cannot tell that you are nearby, so no offers reach you. Turn it on to start receiving them again.",
	"delivery.board.locationUnavailable":
		"Your location is unavailable. Check location services to receive offers.",
	"delivery.board.presenceFailed":
		"We couldn't update your location for offers.",
	"delivery.board.zoneDispatchFailed":
		"Couldn't check your delivery zone for offers.",

	/*
	 * How offers reach you, and every sentence is a condition of `candidateFor`.
	 *
	 * Shown while `mine` holds no `DELIVERED` delivery — the courier's own record, not a
	 * dismissal flag — so it cannot be swiped away and still be true.
	 *
	 * The numbers come from the server rather than from taste: `PRESENCE_FRESH_MS` is two
	 * minutes, `OFFER_RADIUS_KM` is 15 km and `OFFER_TTL_MS` is two minutes. If any of them
	 * changes in `services/delivery-dispatch.ts` these sentences go stale, and a test on this row
	 * is what should say so.
	 */
	"delivery.board.how.title": "How offers reach you",
	"delivery.board.how.body":
		"PymesHub looks for you, not the other way around. A business opens a delivery and it goes to the nearest verified, available courier.",
	"delivery.board.how.detail":
		"With a pinned zone, both stops must fit inside it. Without one, keep location on within 15 km. Each offer lasts 2 minutes.",

	/*
	 * The courier's record, and the only card on that screen that is not about the next
	 * delivery.
	 *
	 * **Drawn only once there is something to say.** Zero deliveries and zero ratings is worse
	 * to read than nothing: it is a scoreboard for somebody who has not started. And the mean of
	 * a single five-star rating is withheld too — `ratingCount` is in the payload precisely so
	 * the client can leave it out, because a number is not a judgement.
	 *
	 * **The two English forms differ, unlike the Spanish ones.** `{count}` is on both keys so
	 * `tp()` does not have to know that.
	 */
	"delivery.board.record.title": "Your record",
	"delivery.board.record.delivered": "{count} delivery completed",
	"delivery.board.record.delivered_plural": "{count} deliveries completed",
	/*
	 * `rating` is `t()` and not `tp()`, and that is the point: the card draws it only when
	 * `ratingCount > 1`, so "customers" is the only honest word and there is no singular form
	 * that could ever be reached with it.
	 */
	"delivery.board.record.rating": "{value} out of 5, from {count} customers",

	"delivery.offer.accept": "Accept delivery",
	"delivery.offer.courierFee": "Courier fee: {amount}",
	"delivery.offer.payerMerchant": "The shop owes this fee to the courier.",
	"delivery.offer.payerPromotion":
		"A promotion covers the customer's charge; the courier fee is still owed.",
	"delivery.offer.decline": "Decline",
	"delivery.offer.distance": "{value} km from the business",
	"delivery.offer.unavailable": "This offer is no longer available.",
	"delivery.detail.title": "Delivery details",
	"delivery.map.label": "Map of the pickup and drop-off",
	"delivery.map.courierLocation": "Your location: {status}",
	"delivery.map.locationWaiting": "Waiting for a location update",
	"delivery.map.locationUnavailable": "Location unavailable. Pull to retry.",
	"delivery.pickup": "Pick up at the business",
	"delivery.dropoff": "Deliver to the customer",
	"delivery.stop.pickup": "Pickup",
	"delivery.stop.dropoff": "Drop-off",
	"delivery.navigate": "Open directions",
	"delivery.status.SEARCHING": "Finding a courier",
	"delivery.status.OFFERED": "Offer sent",
	"delivery.status.ACCEPTED": "Accepted",
	"delivery.status.TO_PICKUP": "Going to the business",
	"delivery.status.AT_PICKUP": "At the business",
	"delivery.status.PICKED_UP": "Going to the customer",
	"delivery.status.DELIVERED": "Delivered",
	"delivery.status.CANCELLED": "Cancelled",
	"delivery.action.startPickup": "Go to the business",
	"delivery.action.arrivePickup": "I arrived at the business",
	"delivery.action.confirmPickup": "Confirm pickup",
	"delivery.action.complete": "Mark as delivered",
	"delivery.complete.confirm": "Confirm that you delivered the order?",
	"delivery.complete.body": "The customer is notified as delivered.",
	"delivery.waitingReady": "The business is still preparing the order.",
	"delivery.rateCustomer.title": "Rate the customer",
	"delivery.rateCustomer.subtitle":
		"This rating is used for safety and service metrics.",
	"delivery.rateCustomer.submit": "Send rating",
	"delivery.rateCustomer.thanks": "Rating saved",
	"delivery.presence.denied": "Turn on location to receive nearby offers.",
} as const;
