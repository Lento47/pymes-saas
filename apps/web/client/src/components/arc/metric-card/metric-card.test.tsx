import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricCard } from "@/components/arc/metric-card/metric-card";

/**
 * The Arc components, rendered in this app's tokens.
 *
 * Three things are being asserted, and each one is a failure mode this integration could
 * have shipped with:
 *
 * **The value is readable.** `AnimatedCounter` draws the digits as ten absolutely-positioned
 * glyphs per column and hides the real text behind a visually-hidden span for screen
 * readers. If that span is missing or wrong, the card looks perfect and announces garbage —
 * the value is `aria-hidden`, so nothing else would catch it.
 *
 * **The urgent flag paints something.** `urgent` is the one prop added to Arc's `MetricCard`
 * — it has no equivalent upstream — because the queue tile has to look different when
 * something is waiting. It is a data attribute, so this is the only place it is verified.
 *
 * **The adapter resolves.** The card's colours come from `--surface` and `--border`, which
 * `foundation.css` maps onto this app's tokens. Rendering in jsdom proves the module graph
 * and the CSS-module imports resolve; it cannot prove the colours, and that gap is stated
 * rather than papered over.
 */
/**
 * Whether `expected` is in the card's **announced** text.
 *
 * `AnimatedCounter` deliberately renders the number twice: a visually-hidden span holding the
 * real text, and the aria-hidden wheel of glyphs that carries the motion. Only the first is
 * announced, so that is the only copy worth asserting — and querying by text alone finds
 * several matches, because the wheel's digit spans and its size sizer contain the same
 * characters. Asserting the announced copy is also the stronger claim: it is what a screen
 * reader actually says.
 *
 * Selected structurally, by "a span whose entire text is the value and which is not inside
 * an `aria-hidden` subtree", rather than by class name — Vitest does not resolve CSS-module
 * classes to their original keys, so `span.srOnly` finds nothing and would quietly turn
 * this into an assertion that passes for the wrong reason if it ever returned null.
 */
function announces(container: HTMLElement, expected: string): boolean {
  return Array.from(container.querySelectorAll("span")).some(
    (element) => element.textContent === expected && !element.closest("[aria-hidden]"),
  );
}

describe("MetricCard", () => {
  it("exposes the value to assistive technology", () => {
    const { container } = render(
      <MetricCard label="Negocios activos" value={42} context="Publicados en el mercado" />,
    );

    expect(announces(container, "42")).toBe(true);
  });

  it("renders the label and the context", () => {
    render(<MetricCard label="Órdenes hoy" value={7} context="Desde medianoche, UTC" />);

    expect(screen.getByText("Órdenes hoy")).toBeTruthy();
    expect(screen.getByText("Desde medianoche, UTC")).toBeTruthy();
  });

  it("marks the urgent tile so it can be painted differently", () => {
    const { container } = render(
      <MetricCard label="Negocios pendientes" value={3} context="Esperan verificación" urgent />,
    );

    const article = container.querySelector("article");
    expect(article?.getAttribute("data-urgent")).toBe("true");
  });

  it("leaves an ordinary tile unmarked", () => {
    const { container } = render(
      <MetricCard label="Admins" value={2} context="Con acceso a esta consola" />,
    );

    expect(container.querySelector("article")?.hasAttribute("data-urgent")).toBe(false);
  });

  it("puts the suffix in the announced value, not only on screen", () => {
    // A rate announced as "21" with no unit is a different sentence from "21%", so the
    // suffix has to be inside the accessible copy rather than beside it.
    const { container } = render(
      <MetricCard label="Tasa de cancelación" value={21} suffix="%" context="Canceladas" />,
    );

    expect(announces(container, "21%")).toBe(true);
  });

  it("renders a zero, which is the case a hand-rolled tile usually drops", () => {
    const { container } = render(
      <MetricCard label="Órdenes activas" value={0} context="En curso ahora" />,
    );

    expect(announces(container, "0")).toBe(true);
  });

  describe("the quiet tier (animate={false})", () => {
    it("still announces the value", () => {
      // The static branch is a *different DOM shape* from Arc's counter — one text node
      // instead of a wheel of ten absolutely positioned glyphs per column — so "it renders"
      // and "it is readable by a screen reader" are separate claims and both need saying.
      const { container } = render(
        <MetricCard
          label="Negocios totales"
          value={412}
          context="Registrados en la plataforma"
          animate={false}
        />,
      );

      expect(announces(container, "412")).toBe(true);
    });

    it("puts the suffix in the announced value, exactly as the animated tier does", () => {
      // Otherwise the two tiers describe different sentences for the same number, and which
      // one you get depends on a prop.
      const { container } = render(
        <MetricCard
          label="Tasa de cancelación"
          value={21}
          suffix="%"
          context="Canceladas"
          animate={false}
        />,
      );

      expect(announces(container, "21%")).toBe(true);
    });

    it("renders no counter wheel at all", () => {
      // The point of the tier. Each animated column is ten glyph spans; a tile that claims
      // to be quiet while still mounting thirty of them has saved nothing.
      const { container } = render(
        <MetricCard label="Admins" value={2} context="Con acceso" animate={false} />,
      );

      // One element carries the number, and it is the article's own text rather than a
      // hidden copy behind an aria-hidden wheel.
      expect(container.querySelectorAll("span").length).toBeLessThan(8);
    });
  });
});