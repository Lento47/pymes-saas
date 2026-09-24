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
 * English mirrors Spanish key for key. The split by domain matches `es/` exactly, so
 * a translator or an agent working on one surface edits one pair of files and cannot
 * collide with another working on a different one.
 */
export const en = {
	// The same domain as `es/account.ts`, and the same position in the list.
	...account,
	...common,
	...auth,
	...customer,
	...business,
	...admin,
	// The same five as `es/`, in the same order. `keys.test.ts` asserts the two locales carry
	// an identical key set, which is the check that keeps this list and the Spanish one from
	// drifting the next time a domain is added.
	...discovery,
	...storefront,
	...basket,
	...tracking,
	...settings,
} as const;
