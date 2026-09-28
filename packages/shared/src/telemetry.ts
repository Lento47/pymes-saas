const SENSITIVE_KEY =
	/(authorization|cookie|token|secret|password|passcode|address|location|latitude|longitude|(?:lat|lng)$|coordinate|heading|speed|payment|sinpe|card|reference)/i;

/**
 * Personal data that is recognisable by its *shape* rather than by its key name.
 *
 * The key filter above is exhaustive for the fields this codebase names, and it
 * catches all of them. What it cannot catch is a personal datum that arrives inside
 * a value the filter has no reason to touch — a customer's name quoted in an error
 * message, an address pasted into a free-text `detail`, a support note in a
 * `context` bag. Under Costa Rica's Ley 8968 an error report carrying someone's
 * address is still a treatment of their personal data, whatever the object it
 * arrived in, and `Sentry.init` sends that object to a US-hosted service.
 *
 * So this is a second pass over string *values*, independent of the key. It is
 * deliberately narrow — three shapes, each unambiguous:
 *
 * - an email address, because one in a log line is a re-identification vector and
 *   every address in a support string is a real customer's;
 * - a long digit run, which is where a Costa Rican phone number, a SINPE reference
 *   and a card fragment all look alike, and which no error message needs verbatim;
 * - a `+506` prefix with digits, the one that is unambiguously this product's users.
 *
 * A person's *name* is deliberately not matched. There is no reliable way to
 * recognise a name in free text without either a name list — which would be the
 * database this module exists not to be — or a false-positive rate high enough to
 * redact the error messages the module exists to preserve. That limitation is stated
 * here rather than papered over: a name in a free-text field still reaches the
 * provider, and the answer to that is what callers put in those fields, not a
 * cleverer regex.
 *
 * The digit rule is a floor of 8, not 4: a four-digit run is an order id, a status
 * fragment or a year, and redacting those would cost more diagnosis than it protects.
 * An 8-digit date is the known cost of that floor — `20260915` is redacted — and it
 * is left redacted rather than special-cased, because a compact date is not reliably
 * distinguishable from a card fragment and the cost of the mistake is asymmetric: a
 * missing timestamp in a log, versus a card number in one.
 */
const EMAIL_IN_TEXT = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g;
const LONG_DIGITS = /\b\d{8,}\b/g;
/**
 * A phone number written the way people write phone numbers.
 *
 * The bare `LONG_DIGITS` rule misses these, because `\b` does not span a separator:
 * `8712-3456` is eight digits but not eight *contiguous* ones, and it is how a
 * Costa Rican number appears in nearly every string a human typed. `\b` is kept off
 * both ends here deliberately — without it, `1234-5678` inside a longer token would
 * not be found, which is the common case for an id or a reference that happens to
 * contain the pattern.
 *
 * Ordered before `LONG_DIGITS` so the `+506` form is consumed whole rather than
 * leaving a bare 8-digit remainder behind for the next rule to find.
 */
const PHONE_IN_TEXT = /(?:\+?506[\s-]?)?\d{4}[\s-]?\d{4}\b/g;

/** What a matched run is replaced with. Same token as the key filter, deliberately. */
const REDACTED = "[Filtered]";

/**
 * Redact personal data out of a string's *content*.
 *
 * Applied to every string that reaches the sink, after the key check has had its
 * chance. A value under a sensitive key never gets here — it is already
 * `[Filtered]` — so this only ever sees values the key filter considered harmless.
 */
export function scrubStringValue(value: string): string {
	return value
		.replace(EMAIL_IN_TEXT, REDACTED)
		.replace(PHONE_IN_TEXT, REDACTED)
		.replace(LONG_DIGITS, REDACTED);
}

/**
 * Return a telemetry-safe copy of an SDK event or breadcrumb.
 *
 * Observability payloads must never become a second customer database. This
 * strips authentication, addresses, precise movement, and payment references
 * recursively, while keeping error names, stack traces, status codes and route
 * paths useful for diagnosis.
 *
 * ## Session replay is not enabled, and should not be enabled silently
 *
 * There is no `replayIntegration()` in any of the four SDKs this product uses
 * (`@sentry/react`, `@sentry/nestjs`, `@sentry/cloudflare`, `@sentry/react-native`),
 * and that is deliberate. Replay is DOM-level: it captures the rendered text of a
 * screen, which is precisely the customer data the rest of this file is written to
 * keep out of telemetry. A `replayIntegration` added without thought would not be
 * caught by any of the scrubbing here, because replay does not go through
 * `beforeSend` on the same terms.
 *
 * If it is ever wanted, the work is a consent prompt and a mask list for input
 * fields — not a one-line option. Replay also carries a bandwidth cost that error
 * events do not.
 */
export function scrubTelemetryPayload<T>(payload: T): T {
	const seen = new WeakMap<object, unknown>();

	const scrub = (value: unknown, key = "", depth = 0): unknown => {
		if (SENSITIVE_KEY.test(key)) return "[Filtered]";
		if (typeof value === "string") {
			if (key === "url") {
				try {
					const parsed = new URL(value);
					return `${parsed.origin}${parsed.pathname}`;
				} catch {
					return value.split("?", 1)[0];
				}
			}
			// The key said this was fine to keep; the content still gets a pass, because
			// a personal datum inside a harmless-looking value is the case the key
			// filter structurally cannot see.
			return scrubStringValue(value);
		}
		if (value === null || typeof value !== "object" || depth >= 8) return value;
		if (value instanceof Date) return value;
		const existing = seen.get(value);
		if (existing) return existing;

		if (Array.isArray(value)) {
			const copy: unknown[] = [];
			seen.set(value, copy);
			for (const entry of value) copy.push(scrub(entry, "", depth + 1));
			return copy;
		}

		const copy: Record<string, unknown> = {};
		seen.set(value, copy);
		for (const [entryKey, entryValue] of Object.entries(value)) {
			copy[entryKey] = scrub(entryValue, entryKey, depth + 1);
		}
		return copy;
	};

	return scrub(payload) as T;
}
