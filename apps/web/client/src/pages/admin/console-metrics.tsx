import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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