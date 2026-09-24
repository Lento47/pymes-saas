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
 * label says: a row announces "Home, Default, button" and its chevron is decoration a screen
 * reader never hears, and "See all" beside the word "Addresses" is a link whose destination
 * is a guess. `discovery.seeAll.hint` is the same idea for the browse surface and is
 * deliberately not reused here — it says "opens search", which is where *that* one goes.
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
	"settings.device": "Permissions and accessibility",
	"settings.location": "Location",
	"settings.location.help":
		"Used to show nearby shops. You can browse without sharing your location.",
	"settings.permission.granted": "Allowed",
	"settings.permission.denied": "Not allowed",
	"settings.permission.unasked": "Not requested",
	"settings.permission.unknown": "Not verified",
	"settings.device.open": "Opens this app's permissions in your phone settings",
	"settings.device.error": "We couldn't open settings. Try again.",
	"settings.motion": "Reduce motion",
	"settings.motion.help": "Follows your phone's accessibility setting.",
	"account.addresses.row.help": "Opens the form to edit it",
	"account.addresses.seeAll.help": "Opens your saved addresses",

	"settings.fulfilment": "Default fulfilment method",
	"settings.haptics": "Haptics",
	"settings.haptics.help": "A response when you tap, add, and confirm.",
	"settings.haptics.on": "On",
	"settings.haptics.off": "Off",
	"settings.about": "About",
	"settings.version": "Version",
	"settings.notifications": "Notifications",
	"settings.notifications.orders": "Orders",
	"settings.notifications.orders.help":
		"We tell you when your order changes state.",
	"settings.notifications.replies": "Review replies",
	"settings.notifications.replies.help": "The shop answered what you wrote.",
	"settings.privacy": "Privacy",
	"settings.privacy.photo": "Photo on reviews",
	"settings.privacy.photo.help":
		"Your name always shows; this is only the photo.",
	"settings.switch.on": "On",
	"settings.switch.off": "Off",

	"admin.overview.users.admins": "{count} admin",
	"admin.overview.users.admins_plural": "{count} admins",
} as const;
