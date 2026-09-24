/**
 * Logging, for a Worker.
 *
 * `docs/api.md`'s discipline survives the move off NestJS unchanged, and one rule
 * in it is worth restating where the code is: **never log headers, query strings or
 * request bodies.** They carry sessions and personal data, and a log line is the
 * one artefact that outlives the request, gets copied into a support thread, and
 * has no access control. Everything below is a field the caller chose to name.
 *
 * What replaced the Nest logger: `console.log` was forbidden there because a JSON
 * logger was installed; on a Worker `console.log` *is* the JSON logger —
 * `wrangler tail` and Workers Logs both parse a single-line JSON object — so the
 * rule inverts and the discipline becomes "one object, one line, no string
 * interpolation".
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export type Logger = {
	debug: (message: string, fields?: LogFields) => void;
	info: (message: string, fields?: LogFields) => void;
	warn: (message: string, fields?: LogFields) => void;
	error: (message: string, fields?: LogFields) => void;
	/** A logger that stamps every line with extra fields — the request's context. */
	child: (fields: LogFields) => Logger;
};

/**
 * Fields that must never reach a log line, dropped rather than trusted.
 *
 * The rule is already "do not pass these", and this is the version that holds when
 * somebody does: a `token` field on an error object, passed whole as a field, is
 * exactly how a bearer token ends up in a log.
 */
const REDACTED_KEYS = new Set([
	"token",
	"accessToken",
	"access_token",
	"refreshToken",
	"refresh_token",
	"authorization",
	"cookie",
	"headers",
	"password",
	"secret",
	"apiKey",
	"serviceRoleKey",
	"anonKey",
]);

/** Deep enough for a nested error object, shallow enough not to walk a row. */
const MAX_REDACT_DEPTH = 3;

function redact(value: unknown, depth = 0): unknown {
	if (depth > MAX_REDACT_DEPTH) return "[truncated]";
	if (Array.isArray(value))
		return value.map((entry) => redact(entry, depth + 1));
	if (value instanceof Error) {
		// The message is kept; the stack is not. A stack names files and lines we
		// already have in the source, and printing one per failed request buries
		// the fields that identify the request.
		return { name: value.name, message: value.message };
	}
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, entry] of Object.entries(value)) {
			out[key] = REDACTED_KEYS.has(key)
				? "[redacted]"
				: redact(entry, depth + 1);
		}
		return out;
	}
	return value;
}

function emit(level: LogLevel, message: string, fields: LogFields): void {
	const line = { level, message, ...(redact(fields) as LogFields) };
	const serialised = JSON.stringify(line);
	if (level === "error") console.error(serialised);
	else if (level === "warn") console.warn(serialised);
	else console.log(serialised);
}

function makeLogger(base: LogFields): Logger {
	return {
		debug: (message, fields) => emit("debug", message, { ...base, ...fields }),
		info: (message, fields) => emit("info", message, { ...base, ...fields }),
		warn: (message, fields) => emit("warn", message, { ...base, ...fields }),
		error: (message, fields) => emit("error", message, { ...base, ...fields }),
		child: (fields) => makeLogger({ ...base, ...fields }),
	};
}

export function createLogger(fields: LogFields = {}): Logger {
	return makeLogger(fields);
}

/**
 * A request id, generated here or taken from an inbound `x-request-id`.
 *
 * Returned on the response header and printed in every error body, because the
 * only useful thing a customer can tell support is the id on the screen — and a
 * support thread that has it can find the request without anybody pasting a
 * session token into a chat window.
 */
export function requestIdFrom(header: string | null | undefined): string {
	const candidate = header?.trim();
	// Bounded, and restricted to characters that cannot forge a log line or a
	// header value. An unbounded inbound id is reflected into our own response.
	if (candidate && /^[A-Za-z0-9._-]{8,64}$/.test(candidate)) return candidate;
	return crypto.randomUUID();
}
