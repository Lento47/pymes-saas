import { Redirect } from "expo-router";

import { Spinner } from "@/components/spinner";
import { useT } from "@/lib/i18n";
import { useResolvedRole } from "@/lib/role";

/**
 * The root route is not a screen: it is the role resolver, and it lasts one frame.
 *
 * `docs/architecture.md` §8 has the spec and `lib/role.ts` has the decision; this file is
 * only the redirect at the end of it. Three things worth knowing:
 *
 * - **The href names the group, not the path.** Parentheses are a route *group* and add no
 *   URL segment, so `(customer)`, `(business)` and `(delivery)` all resolve to `/`. A
 *   `<Redirect href="/" />` here would point back at this file and loop forever; the group in
 *   the href is what makes it a destination.
 * - **The fast path never fetches.** `lib/role.ts` returns the customer role before any query
 *   is enabled, so the common launch is one AsyncStorage read and this redirect.
 * - **The degraded cases have already been corrected by the time this renders the redirect** —
 *   the notice they carry is read by `(customer)/index.tsx` through `takeDegradation()`, one
 *   time, from the module rather than from the URL (a URL that says "your membership ended"
 *   says it again on every reload).
 */
export default function RoleGate() {
	const resolved = useResolvedRole();
	const { t } = useT();

	if (resolved.state === "boot") {
		// The one spinner this app allows outside a sign-in and a payment: the question being
		// asked is "which tree is mine", and its shape is not something a skeleton can stand
		// in for — there are three different shapes behind the answer.
		return <Spinner label={t("state.loading")} centered />;
	}

	const href =
		resolved.role === "business"
			? "/(business)"
			: resolved.role === "delivery"
				? "/(delivery)"
				: "/(customer)";

	return <Redirect href={href} />;
}
