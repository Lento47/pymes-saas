/**
 * The account hub, its inbox, and the two reference screens behind it.
 *
 * A domain of its own rather than an addition to `settings.ts`, and the split is the same
 * one that file's docblock draws: `settings.ts` holds *control labels* — "save", "default"
 * — that any screen might reuse. These are the names of destinations and the sentences of
 * two screens that exist only here, and none of them has a second caller to be reused by.
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
 * `settings.theme.system` is the interesting one. "System" is not a colour, it is an
 * answer to "who decides" — and it is the default, so it is the label most readers will
 * ever see. It is not `locale.*`'s neighbour in `common.ts` because `locale.switch` names
 * a control and these name a value.
 */
export const account = {
	/* The hub's four groups. Each is a noun for a set of rows, so each is short: a section
	   heading is read at a glance while scrolling, and "Your account" is the only one that has
	   to disambiguate itself from the tab it is drawn on. */
	"account.section.account": "Your account",
	"account.section.activity": "Activity",
	"account.section.preferences": "Preferences",
	"account.section.support": "Help & safety",

	/* The rows. Each label is the destination's own name and each hint says where it goes,
	   which is the pair `settings.ts` explains: a chevron is decoration a screen reader never
	   hears, so "Inbox, button" is a row whose destination is a guess without one. */
	"account.inbox": "Inbox",
	"account.inbox.help": "Opens notices about your orders and reviews",
	"account.history": "Order history",
	"account.history.help": "Opens your past orders",
	"account.help": "Help",
	"account.help.help": "Opens the frequently asked questions",
	"account.safety": "Safety",
	"account.safety.help": "Opens the tips and how to report a problem",

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
	 * The copy names the *missing* thing rather than the missing count. "You are missing a
	 * phone number" is a fact a reader can act on; "2 of 4" is a score, and a score with no
	 * explanation is the kind of thing that makes somebody close the screen. The count is still
	 * there, as the `{done}`/`{total}` pair, because it is the one part that is true at every
	 * value.
	 */
	"account.setup.title": "Finish your profile",
	"account.setup.body":
		"So the shop knows who to call and where to bring the order.",
	"account.setup.progress": "{done} of {total}",
	"account.setup.name": "Your name",
	"account.setup.phone": "A contact phone",
	"account.setup.photo": "A profile photo",
	"account.setup.address": "A saved address",

	/* Appearance. `settings.theme.help` is the hint on the control that is *not* a
	   destination: a segmented control announces its own label and its chosen value, but not
	   what "System" means, and that is the whole question a reader has about it. */
	"settings.theme": "Theme",
	"settings.theme.system": "System",
	"settings.theme.light": "Light",
	"settings.theme.dark": "Dark",
	"settings.theme.help": "System follows your phone's setting",

	/* The inbox. `inbox.empty.body` states what will appear rather than apologising for the
	   space — the reader has not lost anything, they have simply not been told anything yet. */
	"inbox.title": "Inbox",
	"inbox.empty.title": "No notices yet",
	"inbox.empty.body":
		"News about your orders and replies from shops land here.",
	/* Only on a row that actually leads somewhere — a notification whose `data` carries an
	   `orderId`. A reply to a review carries a `businessId` and no slug, so its row is not
	   pressable at all and never reads this. */
	"inbox.row.help": "Opens the order",

	/* Help. The four questions are the four things a customer actually asks a marketplace,
	   and each answer says what the *app* does about it rather than what a policy says — a
	   FAQ that restates terms is a document, not help. */
	"help.title": "Help",
	"help.faq.title": "Frequently asked questions",
	"help.faq.track.title": "Where is my order?",
	"help.faq.track.body":
		"In Orders, open the order and you will see which step it is on and since when.",
	"help.faq.cancel.title": "Can I cancel an order?",
	"help.faq.cancel.body":
		"Yes, as long as the shop has not started preparing it. The button is inside the order and it tells you whether it is still possible.",
	"help.faq.problem.title": "Something went wrong with my order",
	"help.faq.problem.body":
		"Open the order and use the button to contact the shop. The record of what happened stays right there.",
	"help.faq.delivery.title": "How do delivery and pickup work?",
	"help.faq.delivery.body":
		"Each business decides whether it delivers, whether you can pick up, or both. The fee and the minimum appear on its page before you order.",
	"help.orders": "See my orders",
	"help.orders.help": "Opens the orders tab",
	"help.safety": "Safety tips",
	"help.safety.help": "Opens the safety screen",

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
	"safe.title": "Safety",
	"safe.intro":
		"PymesHub connects neighbours with businesses nearby. These are the precautions we recommend.",
	"safe.emergency": "Emergencies",
	"safe.emergency.number": "911",
	"safe.emergency.body":
		"If you are in danger, call first. Tell us what happened afterwards.",
	/* The heading over the three tips. A section name, not a destination — the three cards
	   under it are the content, and without it they are three surfaces with no reason to be
	   grouped. */
	"safe.tips.title": "Recommendations",
	"safe.tip.meet.title": "Check before you pay",
	"safe.tip.meet.body":
		"The name, the price and the delivery fee are on the business's page. If something does not match what you were told, do not confirm the order.",
	"safe.tip.share.title": "Share the order",
	"safe.tip.share.body":
		"The order number and its status are in the app. If somebody is waiting for you, send them that screen.",
	"safe.tip.cash.title": "Pay through the app when you can",
	"safe.tip.cash.body":
		"An order placed through the app is recorded with its number and its time. We cannot look into an arrangement made outside it.",
	"safe.report.title": "Report a problem",
	"safe.report.body":
		"Open the order and contact the shop from there. If the problem is with the shop itself, write to us from the same order and the record stays.",
} as const;
