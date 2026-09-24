import { account } from "./account";
import { admin } from "./admin";
import { auth } from "./auth";
import { basket } from "./basket";
import { business } from "./business";
import { common } from "./common";
import { customer } from "./customer";
import { discovery } from "./discovery";
import { settings } from "./settings";
import { storefront } from "./storefront";
import { tracking } from "./tracking";

/**
 * Spanish is the source of truth — `MessageKey` is derived from this object, so a key
 * that exists only here is a compile error in English rather than a screen showing
 * `cart.empty.title` to somebody.
 *
 * One file per domain, per locale, on purpose: the customer, business and admin
 * surfaces are built by different people at the same time, and one dictionary per
 * locale would have all of them editing the same file. Two files is the whole reason
 * the split exists.
 *
 * **A key that appears in two of these objects is silently the last one spread.**
 * `../keys.test.ts` asserts that never happens, and that both locales carry the
 * identical key set — a type can only check one direction.
 */
export const es = {
	// The account hub: its four sections, its inbox, and the help and safety screens behind
	// it. A domain of its own because the strings are destinations and screen copy rather
	// than the reusable control labels `./settings` holds — that file's docblock draws the
	// line, and this is the first thing to land on the far side of it.
	...account,
	...common,
	...auth,
	...customer,
	...business,
	...admin,
	// Added when the mobile browse, storefront, basket, tracking and settings surfaces were
	// rebuilt at once. Five domains in one change is what the split above is for: each of the
	// five was owned by a different worker, and no two of them touched the same file.
	...discovery,
	...storefront,
	...basket,
	...tracking,
	...settings,
} as const;
