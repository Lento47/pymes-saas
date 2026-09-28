import * as Sentry from "@sentry/nestjs";

const sensitiveKey =
  /(authorization|cookie|token|secret|password|passcode|address|location|latitude|longitude|(?:lat|lng)$|coordinate|heading|speed|payment|sinpe|card|reference)/i;

function scrubTelemetryPayload<T>(payload: T): T {
  const scrub = (value: unknown, key = "", depth = 0): unknown => {
    if (sensitiveKey.test(key)) return "[Filtered]";
    if (typeof value === "string" && key === "url") return value.split("?", 1)[0];
    if (value === null || typeof value !== "object" || depth >= 8) return value;
    if (Array.isArray(value)) return value.map((entry) => scrub(entry, "", depth + 1));
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        scrub(entryValue, entryKey, depth + 1),
      ]),
    );
  };
  return scrub(payload) as T;
}

const dsn = process.env.SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV ?? "development",
  release: `pymeshub-api@${process.env.npm_package_version ?? "0.1.0"}`,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
  beforeSend: (event) => scrubTelemetryPayload(event),
  beforeBreadcrumb: (breadcrumb) => scrubTelemetryPayload(breadcrumb),
});
