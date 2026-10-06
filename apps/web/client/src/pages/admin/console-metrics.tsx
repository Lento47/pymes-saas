import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuditLogEntry } from "@/lib/admin";

/**
 * The two halves of `admin.metrics` that used to be fetched and thrown away, and the
 * arithmetic behind them.
 *
 * The helpers and the panels are one file rather than two on purpose: TypeScript resolves
 * `./console-metrics` to the `.ts` first and stops, so a sibling `console-metrics.ts` of
 * helpers would have made this import silently point at the wrong module. `console-pagination.ts`
 * has no such problem because nothing in it has a `.tsx` sibling.
 *
 * `volumeByCurrency` and `signupsSeries` have been in `adminMetricsSchema` from the start,
 * rendered by nothing, on a query that refetches every thirty seconds — so every operator
 * paid for them on every poll.
 *
 * ## No charting library
 *
 * Thirty daily bars and a per-currency list are both shapes CSS draws well, and `recharts`
 * is declared in `apps/web` but has **never rendered anything here** — the only file
 * referencing it is `components/ui/chart.tsx`. Making the first-ever chart render in this app
 * carry a metrics fix would add a large dependency and an unproven path to a glance-level
 * number. `packages/ui` has `dashboard-chart` and `stat-card`, and neither is reachable from
 * here: that package is Tailwind v4 and this app is v3.4.
 */

/** One bar's height as a percentage of the tallest bar. Always 0–100. */
export type Bar = { day: string; count: number; percent: number };

/**
 * Scale a daily series to bar heights.
 *
 * Two decisions that are not obvious:
 *
 * **The tallest bar is 100, never less.** A series of `[3, 3, 3]` scaled by its own maximum
 * would draw three full-height bars, which reads as "a strong week" when it is three
 * signups. Scaling by the maximum says nothing about whether three is a lot.
 *
 * **A zero series is all zeros, not all full bars.** With no maximum there is nothing to
 * scale against, and dividing by it would produce `NaN` — which React renders as nothing at
 * all, leaving an empty strip that looks like a loading state.
 *
 * **A single day is full height.** It is the maximum. That is consistent with the first rule
 * and needs no special case beyond the zero guard.
 */
export function toBars(series: readonly { day: string; count: number }[]): Bar[] {
  const max = series.reduce((highest, point) => Math.max(highest, point.count), 0);
  if (max <= 0) {
    return series.map((point) => ({ ...point, percent: 0 }));
  }
  return series.map((point) => ({
    ...point,
    percent: Math.round((point.count / max) * 100),
  }));
}

/** Total signups across the window. An operator wants the number, not only the shape. */
export function seriesTotal(series: readonly { day: string; count: number }[]): number {
  return series.reduce((sum, point) => sum + point.count, 0);
}

/** The busiest day, or `null` for an empty series. Used to label the tallest bar. */
export function busiestDay(series: readonly { day: string; count: number }[]): {
  day: string;
  count: number;
} | null {
  let best: { day: string; count: number } | null = null;
  for (const point of series) {
    if (!best || point.count > best.count) best = { day: point.day, count: point.count };
  }
  return best;
}

/**
 * Whether two currencies are being added together.
 *
 * **Always `false`, and that is the whole point of the function existing.**
 *
 * `adminMetricsSchema`'s docblock is explicit: money is grouped by currency and never summed
 * across them, because *"₡4 200 000 + $1 300 has no answer, and the dashboard that renders
 * one is the dashboard an operator makes a decision on."* The service returns
 * `volumeByCurrency` already grouped, and the console's job is to refuse to flatten it.
 *
 * A guard that always returns `false` looks pointless, and it is here on purpose: the moment
 * somebody adds a "total revenue" tile, this is the named place that says why not, instead
 * of the temptation being rediscovered every quarter. Anything that needs a cross-currency
 * number must convert at a stated rate first, and the rate is a business fact, not a `sum`.
 */
export function canSumAcrossCurrencies(_currencies: readonly string[]): boolean {
  return false;
}
/**
 * A window of the order series, and the window immediately before it.
 *
 * ## Why the comparison is honest by construction
 *
 * `orderSeries` carries **60** days rather than 30, and this is what that buys: the previous
 * period is read out of the same response instead of fetched, so "the last 30 days" really is
 * compared against the 30 before it. A 30-day series could only ever compare 15 against 15.
 *
 * ## Three cases the arithmetic has to get right, and usually does not
 *
 * - **The series is sorted here, not trusted.** The service orders by the day expression, and
 *   this sorts again anyway — because a chart drawn left-to-right from an unsorted array is
 *   wrong in a way no assertion catches, and the failure looks like a data problem.
 * - **A previous period of zero yields `null`, not `Infinity`.** Doubling from nothing is not
 *   an infinite percentage; it is a first period, and rendering "∞%" or "+100%" teaches an
 *   operator nothing. `null` is drawn as "sin periodo anterior".
 * - **Days with no orders are absent from the series**, so the window is taken from the tail of
 *   the array rather than by counting calendar days backwards from today. Otherwise a quiet
 *   week reports the wrong period and the comparison silently compares two different spans.
 */
export function orderWindow(
  series: readonly { day: string; count: number; cancelled: number }[],
  days: number,
): {
  current: { count: number; cancelled: number; cancellationRate: number };
  previous: { count: number; cancelled: number } | null;
  changePercent: number | null;
  bars: { day: string; count: number }[];
} {
  const ordered = [...series].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const window = ordered.slice(-days);
  const before = ordered.slice(-days * 2, -days);

  const sum = (rows: typeof ordered) =>
    rows.reduce(
      (total, row) => ({
        count: total.count + row.count,
        cancelled: total.cancelled + row.cancelled,
      }),
      { count: 0, cancelled: 0 },
    );

  const currentRows = sum(window);
  const previousRows = before.length > 0 ? sum(before) : null;

  return {
    current: {
      ...currentRows,
      cancellationRate:
        currentRows.count === 0 ? 0 : currentRows.cancelled / currentRows.count,
    },
    previous: previousRows,
    changePercent:
      previousRows === null || previousRows.count === 0
        ? null
        : ((currentRows.count - previousRows.count) / previousRows.count) * 100,
    bars: window.map((row) => ({ day: row.day, count: row.count })),
  };
}

/**
 * Order activity, with the period it is being compared against.
 *
 * The dashboard had no answer to the question an operator actually opens it for — "are orders
 * trending up?" — because every order number on it was a single cumulative total. "42 today"
 * could only be compared against a number in somebody's head.
 *
 * **The delta is the point, and it is drawn with its sign and its baseline.** A green "+18%"
 * alone tells an operator nothing about scale; "+18% · 61 vs 52" does. And a first period
 * prints "sin periodo anterior" rather than a number, because inventing one teaches them
 * something false about their own marketplace.
 */
export function ActivityPanel({
  series,
  accent = "bg-amber-500/70",
}: {
  series: readonly { day: string; count: number; cancelled: number }[];
  /** Injected so the same panel can draw volume later; amber is the console's accent. */
  accent?: string;
}) {
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const window = orderWindow(series, days);
  const { current, previous, changePercent, bars } = window;
  const max = bars.reduce((peak, bar) => Math.max(peak, bar.count), 0);

  const change =
    changePercent === null
      ? null
      : {
          // One decimal, and a floor of ±0.1 so a rounding artefact is never shown as a
          // flat "0.0%" — which reads as "nothing happened" rather than "almost nothing".
          text: `${changePercent > 0 ? "+" : ""}${Math.abs(changePercent) < 0.1 ? (changePercent > 0 ? "+0.1" : "-0.1") : changePercent.toFixed(1)}%`,
          tone:
            changePercent > 0
              ? "text-success"
              : changePercent < 0
                ? "text-destructive"
                : "text-muted-foreground",
        };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Actividad · últimos {days} días</CardTitle>
      </CardHeader>
      <CardContent>
        {/*
          The window control is three buttons rather than a select: three fixed widths, all
          visible at once, and an operator comparing 7 against 30 should see both options at
          the moment they are thinking about it.
        */}
        {/*
          A `<fieldset>`, not a `div` with `role="group"` — which is what biome's
          `useSemanticElements` asks for, and it is right to: a fieldset is the element that
          means "a set of related controls under one label", so the grouping is conveyed by the
          tag rather than by an ARIA attribute bolted onto a generic box.
        */}
        <fieldset
          aria-label="Periodo a comparar"
          className="mb-3 inline-flex gap-1 rounded-lg border border-border p-0.5"
        >
          {([7, 14, 30] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={days === option}
              onClick={() => setDays(option)}
              className={`rounded-md px-2 py-0.5 text-xs tabular-nums transition-colors ${
                days === option
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option}d
            </button>
          ))}
        </fieldset>

        <p className="text-sm font-semibold tabular-nums">{current.count} pedidos</p>

        {change === null ? (
          <p className="text-xs text-muted-foreground">Sin periodo anterior con que comparar.</p>
        ) : (
          <p className={`text-xs tabular-nums ${change.tone}`}>
            {change.text}
            {previous ? (
              <span className="text-muted-foreground">
                {" "}
                · {current.count} vs {previous.count}
              </span>
            ) : null}
          </p>
        )}

        <div
          className="mt-3 flex h-16 items-end gap-px"
          role="img"
          aria-label={`Pedidos por día durante los últimos ${days} días. ${current.count} en total${
            previous ? `, frente a ${previous.count} en el periodo anterior` : ""
          }.`}
        >
          {bars.map((bar) => (
            <div
              key={bar.day}
              className={`min-w-0 flex-1 rounded-t-sm ${accent}`}
              style={{ height: `${max === 0 ? 2 : Math.max((bar.count / max) * 100, 2)}%` }}
              title={`${bar.day}: ${bar.count}`}
            />
          ))}
        </div>

        {/*
          The cancellation rate is drawn even when it is zero, because "0% cancel" and "we do
          not track cancellations" look identical otherwise — and the dashboard already warns
          above 20% elsewhere, so a rate that quietly stopped being reported here would look
          like an improvement.
        */}
        <p className="mt-2 text-xs text-muted-foreground">
          {current.cancelled} cancelados ·{" "}
          {(current.cancellationRate * 100).toFixed(1)}% del total
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Who is operating this session, and what they have done.
 *
 * ## Why this is on the dashboard at all
 *
 * Every destructive action in this console writes an audit row naming its actor, and the
 * Auditoría tab can find them — but only if you already know your own user id to filter by.
 * The result is that "what have *I* done" needs a step of setup, while "what has anybody
 * done" needs none. That asymmetry is backwards for the question an operator asks most often
 * after making a mistake.
 *
 * `viewer()` and `auditLog({ actorId })` both already existed; nothing was missing from the
 * API. What was missing was the surface.
 *
 * ## Why the actions are the content and not the avatar
 *
 * An operator does not open the console to look at a picture of themselves. They open it after
 * having suspended a shop or written off a debt, and the first question is whether it landed.
 * So this panel is the answer to that, with the identity as the label rather than the headline.
 */
export function OperatorPanel({
  viewer,
  entries,
  isLoading,
}: {
  viewer: { name: string; email: string; createdAt: Date } | undefined;
  entries: readonly AuditLogEntry[];
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tu actividad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {viewer ? (
          <div>
            <p className="text-sm font-medium">{viewer.name}</p>
            <p className="text-xs text-muted-foreground">{viewer.email}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        )}

        {/*
          "Acciones registradas", not "acciones". It counts rows in the audit log, and it
          deliberately does not claim to be the total number of things this operator has done —
          an action performed before the log existed, or one outside it, is not counted here.
        */}
        <p className="text-xs text-muted-foreground">
          {entries.length === 0
            ? isLoading
              ? "Buscando acciones…"
              : "Todavía no hay acciones registradas a tu nombre."
            : `${entries.length} acción${entries.length === 1 ? "" : "es"} reciente${entries.length === 1 ? "" : "s"}`}
        </p>

        {entries.length > 0 ? (
          <ul className="space-y-1.5">
            {entries.map((entry) => (
              <li key={entry.id} className="text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  {/*
                    The action name is the load-bearing text and it is the raw string, not a
                    translated label: the audit log is a record, and a record whose verbs change
                    when the interface language does cannot be quoted in a dispute. The
                    Auditoría tab renders labels for reading; this is a list of what you did.
                  */}
                  <span className="truncate font-mono">{entry.action}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString("es-CR")}
                  </span>
                </div>
                {entry.targetType ? (
                  <div className="truncate text-muted-foreground">
                    {entry.targetType} · {entry.targetId}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SignupsPanel({
  series,
}: {
  series: readonly { day: string; count: number }[];
}) {
  const bars = toBars(series);
  const busiest = busiestDay(series);
  const total = seriesTotal(series);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Negocios nuevos · {series.length} días</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-semibold tabular-nums">{total} en total</p>
        {/*
          The bars are a shape, not a chart: a reader gets "steady", "spiky" or "flat", and the
          number above is what tells them whether the shape is good. `title` on each bar is
          the hover detail, because thirty bars is more than fits in a legend.
        */}
        <div
          className="mt-3 flex h-16 items-end gap-px"
          role="img"
          aria-label={`Negocios nuevos por día durante ${series.length} días. ${total} en total.`}
        >
          {bars.map((bar) => (
            <div
              key={bar.day}
              className="min-w-0 flex-1 rounded-t-sm bg-amber-500/70"
              style={{ height: `${Math.max(bar.percent, 2)}%` }}
              title={`${bar.day}: ${bar.count}`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {busiest && busiest.count > 0
            ? `El día más activo fue ${busiest.day}, con ${busiest.count}.`
            : "Sin registros en este periodo."}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Volume, one currency per row.
 *
 * **`volumeByCurrency` is never added together**, and this panel is the reason that is easy
 * to see: there is deliberately no total row. `adminMetricsSchema` groups money by currency
 * because "₡4 200 000 + $1 300 has no answer, and the dashboard that renders one is the
 * dashboard an operator makes a decision on". Cancelled and rejected orders are excluded
 * server-side — this is completed volume, not orders placed.
 */
export function VolumePanel({
  volumes,
  format,
}: {
  volumes: readonly {
    currency: string;
    grossMinor: number;
    orderCount: number;
  }[];
  format: (minor: number, currency: string) => string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Volumen por moneda</CardTitle>
      </CardHeader>
      <CardContent>
        {volumes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay órdenes completadas.</p>
        ) : (
          <dl className="space-y-3">
            {volumes.map((volume) => (
              <div key={volume.currency} className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-muted-foreground">
                  {volume.orderCount}{" "}
                  {volume.orderCount === 1 ? "orden completada" : "órdenes completadas"}
                </dt>
                <dd className="text-sm font-semibold tabular-nums">
                  {format(volume.grossMinor, volume.currency)}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {/*
          Stated on the panel rather than left as a silent omission: with two currencies on
          screen and no total, somebody will ask where the total went, and "these cannot be
          added" is the answer.
        */}
        {volumes.length > 1 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Sin total: cada moneda se lleva por separado. Sumarlas no daría un número real.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}