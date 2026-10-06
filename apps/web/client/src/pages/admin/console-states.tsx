import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * How a failed read and an empty one are drawn.
 *
 * These are separate from `console.tsx` for the reason `console-tabs.ts` is: they are the
 * two states every one of the console's dozen queries has to handle, they are worth looking at
 * on their own, and they are testable in jsdom without mounting a router, a query client and
 * ten tab components.
 *
 * ## Why the retry button is the whole point
 *
 * The console had eleven `isError` branches and every one of them was the same two lines —
 * the raw message in red, and nothing to press. An operator whose fetch failed had exactly
 * one way forward: reload the tab, which throws away the filters they had set, the row they
 * had expanded and the dialog they were halfway through. A failed read is the most recoverable
 * thing on the page, and it was the only state offering no recovery at all.
 */

/**
 * A sentence to show for a failed request.
 *
 * The Worker's own message is used when there is one, because it is more specific than
 * anything this file could invent — but it is not trusted to be a sentence. `TRPCError`
 * surfaces its code in `message` for some failures, and a bare `INTERNAL_SERVER_ERROR` on
 * screen is worse than a plain statement of what happened, because it looks like a bug report
 * the operator has to file rather than a request they can send again.
 *
 * Anything that is not a usable string falls back to the `fallback` the caller supplies,
 * which is the only way to keep this honest: "could not load businesses" is a fact about the
 * console, and this file does not know what was being loaded.
 *
 * Not exported: this module exports components, and a named export that is not one costs the
 * file its fast-refresh boundary. The behaviour is asserted through `QueryErrorState` instead,
 * which is the thing anybody actually renders.
 */
function describeError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return fallback;
  // Radix/console codes are upper-case with underscores and no spaces; a real sentence has
  // at least one of neither being true.
  if (/^[A-Z0-9_]+$/.test(message)) return fallback;
  if (isSerializedPayload(message)) return fallback;
  return message;
}

/**
 * A stringified structure is not a sentence, and this is the case the guard above misses.
 *
 * Every read in `lib/admin.ts` is `someSchema.parse(await trpc…)`, and a parse failure throws
 * a `ZodError` whose `message` is `JSON.stringify(issues, null, 2)` — an array of
 * `{ expected, code, path, message }` objects. That string has spaces and brackets, so the
 * upper-case-code test lets it through, and the operator was shown this verbatim in red:
 *
 *     [{"expected":"array","code":"invalid_type","path":["orderSeries"],
 *       "message":"Invalid input: expected array, received undefined"}]
 *
 * It is also the least useful thing that could be in that spot. It describes a disagreement
 * between two *deployed bundles* — the console's schema against an API that is a different
 * version — and there is nothing in it the operator can act on or send again. The panel's
 * own sentence is both true and actionable, and the retry button beside it still applies: a
 * half-finished API deploy genuinely does resolve on a retry.
 *
 * **JSON, rather than a check for Zod, on purpose.** The shape of Zod's issue array is not a
 * contract, and neither is the only library that stringifies a structure into `message`. A
 * guard written against one of them keeps passing while the other reaches the screen; "this
 * parses as JSON" is the property that actually distinguishes a payload from a sentence, and
 * it holds for whatever produces one next.
 *
 * The failure is deliberately one-directional. A `DomainError`'s `message` is a sentence the
 * Worker wrote for a customer and is never valid JSON, so nothing that is meant to be read
 * is being suppressed — and if some future message ever *were* valid JSON, the operator
 * reading the fallback sentence is a far better outcome than the alternative.
 */
function isSerializedPayload(message: string): boolean {
  try {
    JSON.parse(message);
    return true;
  } catch {
    return false;
  }
}

/** A failed read, with the button that sends it again. */
export function QueryErrorState({
  error,
  fallback,
  onRetry,
  isRetrying = false,
}: {
  error: unknown;
  /** What could not be loaded, in the console's own words. */
  fallback: string;
  onRetry?: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 px-4 py-8 text-center"
    >
      <p className="text-sm text-destructive">{describeError(error, fallback)}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw className={isRetrying ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {isRetrying ? "Reintentando…" : "Reintentar"}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A read that succeeded and found nothing.
 *
 * `hint` is what makes an empty state useful rather than decorative. "No hay tickets aquí" on
 * its own leaves the reader deciding whether they have done something wrong; adding what the
 * table is *for* tells them whether the absence is expected. It is optional because some
 * tables genuinely need no explanation.
 */
export function EmptyState({ message, hint }: { message: string; hint?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p> : null}
    </div>
  );
}

/**
 * The empty row for a table that has to keep its header.
 *
 * Same copy as `EmptyState`, shaped as a `colSpan` row so the table does not collapse to
 * nothing and then jump when the first record arrives.
 */
export function EmptyTableRow({ colSpan, message, hint }: { colSpan: number; message: string; hint?: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{message}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p> : null}
      </td>
    </tr>
  );
}
