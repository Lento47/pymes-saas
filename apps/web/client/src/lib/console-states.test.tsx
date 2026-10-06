import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { adminMetricsSchema } from "@pymeshub/shared";
import { describe, expect, it, vi } from "vitest";

import { EmptyState, QueryErrorState } from "../pages/admin/console-states";

/**
 * The two states every one of the console's twelve queries has to handle.
 *
 * The console had eleven `isError` branches that were all the same two lines — the raw
 * message in red, and nothing to press — and one query with no error branch at all, which
 * rendered a skeleton forever and looked like it was still working. A failed read is the most
 * recoverable thing on the page, and it was the only state offering no recovery at all.
 *
 * `role="alert"` is asserted because it is what makes the error *announced*: a panel that
 * swaps content without it is silent to somebody using a screen reader, who is told nothing
 * and left waiting.
 */

describe("QueryErrorState", () => {
  it("announces itself as an alert", () => {
    render(<QueryErrorState error={new Error("network down")} fallback="No se pudo cargar." />);

    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("shows the error's own message when it reads like a sentence", () => {
    render(
      <QueryErrorState
        error={new Error("No se encontró el negocio")}
        fallback="No se pudo cargar el negocio."
      />,
    );

    expect(screen.getByText("No se encontró el negocio")).toBeTruthy();
  });

  it("falls back when the message is a bare code", () => {
    // A TRPCError surfaces its code in `message` for some failures. A screen reading
    // "INTERNAL_SERVER_ERROR" looks like a bug report to file rather than a request to send
    // again, so the caller's plain sentence wins.
    render(
      <QueryErrorState
        error={new Error("INTERNAL_SERVER_ERROR")}
        fallback="No se pudieron cargar los negocios."
      />,
    );

    expect(screen.getByText("No se pudieron cargar los negocios.")).toBeTruthy();
    expect(screen.queryByText("INTERNAL_SERVER_ERROR")).toBeNull();
  });

  it("falls back when the error is a schema mismatch rather than a sentence", () => {
    // The production incident, reproduced rather than described. `admin.metrics` was
    // answering with the payload it sent before `orderSeries` existed, while the console's
    // copy of `adminMetricsSchema` already required it — two deployed bundles two days out of
    // step with each other, and nothing else on the payload wrong.
    //
    // Built from the real schema and a real parse so this cannot drift away from Zod's
    // message format: `ZodError.message` is `JSON.stringify(issues, null, 2)`, and a
    // hand-written approximation of it would pass against a guard that only recognises the
    // shape it was written for.
    const stalePayload = {
      businesses: { total: 1, active: 1, suspended: 0, pendingVerification: 0 },
      users: { total: 2, admins: 1, suspended: 0 },
      orders: { total: 3, today: 1, active: 1, cancelledRate: 0 },
      volumeByCurrency: [],
      signupsSeries: [],
      generatedAt: new Date(),
    };

    // The premise, asserted: this payload really is the one that throws, and it throws for
    // the field it is missing rather than for anything incidental.
    expect(() => adminMetricsSchema.parse(stalePayload)).toThrow(/orderSeries/);

    let thrown: unknown;
    try {
      adminMetricsSchema.parse(stalePayload);
    } catch (error) {
      thrown = error;
    }

    render(
      <QueryErrorState
        error={thrown as Error}
        fallback="No se pudieron cargar las métricas."
      />,
    );

    // The operator reads the panel's own sentence...
    expect(screen.getByText("No se pudieron cargar las métricas.")).toBeTruthy();
    // ...and never the serialized issue array that was on this screen in red.
    expect(screen.queryByText(/orderSeries/)).toBeNull();
    expect(screen.getByRole("alert").textContent).not.toContain("invalid_type");
  });

  it("falls back when there is no message, or no error at all", () => {
    for (const error of [new Error(""), null, undefined, "not an error"]) {
      const { unmount } = render(
        <QueryErrorState error={error} fallback="No se pudo cargar la auditoría." />,
      );
      expect(screen.getByText("No se pudo cargar la auditoría.")).toBeTruthy();
      unmount();
    }
  });

  it("offers a retry that calls back", () => {
    const onRetry = vi.fn();
    render(
      <QueryErrorState
        error={new Error("boom")}
        fallback="No se pudo cargar."
        onRetry={onRetry}
      />,
    );

    screen.getByRole("button", { name: /reintentar/i }).click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("says it is retrying, and will not fire twice", () => {
    const onRetry = vi.fn();
    render(
      <QueryErrorState
        error={new Error("boom")}
        fallback="No se pudo cargar."
        onRetry={onRetry}
        isRetrying
      />,
    );

    const button = screen.getByRole("button", { name: /reintentando/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("omits the button when there is nothing to retry", () => {
    render(<QueryErrorState error={new Error("boom")} fallback="No se pudo cargar." />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("EmptyState", () => {
  it("says what is absent", () => {
    render(<EmptyState message="No hay negocios en esta lista." />);

    expect(screen.getByText("No hay negocios en esta lista.")).toBeTruthy();
  });

  it("can say why the absence is expected", () => {
    // "No hay tickets aquí" alone leaves the reader deciding whether they did something
    // wrong. The hint is what turns an empty state from decoration into information.
    render(
      <EmptyState
        message="No hay negocios en esta lista."
        hint="Los que esperan verificación aparecen en Aprobaciones."
      />,
    );

    expect(screen.getByText("Los que esperan verificación aparecen en Aprobaciones.")).toBeTruthy();
  });

  it("omits the hint when there is none to give", () => {
    const { container } = render(<EmptyState message="No hay tickets aquí." />);

    expect(container.querySelectorAll("p")).toHaveLength(1);
  });
});

/**
 * The structural guard: every error branch in the console offers a retry.
 *
 * The eleven that existed offered none, and the twelfth did not exist at all, so this is a
 * property that held for the console's entire life and has to be *kept* rather than assumed.
 * The way it regresses is mundane and likely: somebody adds a tab, copies the nearest error
 * branch — which before this change meant copying a dead end — and the new one is
 * unrecoverable in a way no type, lint rule or existing test notices.
 *
 * ## Why this reads the source instead of rendering the console
 *
 * Rendering `console.tsx` means the trpc client, the query client, a router and every tab
 * component, with `adminApi` mocked at twelve call sites. That would assert far less than it
 * costs: it would prove the branches *can* render, not that all twelve *do*. Counting the
 * branches and reading what is inside each one is the check that actually holds the line, and
 * its known weakness — that it reads text rather than behaviour — is stated here rather than
 * hidden.
 */
describe("console error branches", () => {
  const consoleSource = readFileSync(
    join(import.meta.dirname, "..", "pages", "admin", "console.tsx"),
    "utf-8",
  );

  /** Each `if (isError) {` block, up to the next `if (` at the same indent. */
  const errorBranches = consoleSource
    .split("\n")
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.trim() === "if (isError) {")
    .map(({ index }) => {
      const body: string[] = [];
      for (let i = index + 1; i < consoleSource.split("\n").length; i += 1) {
        const next = consoleSource.split("\n")[i];
        if (/^ {2}if \(/.test(next)) break;
        body.push(next);
      }
      return body.join("\n");
    });

  it("finds the error branches rather than none", () => {
    expect(errorBranches.length).toBeGreaterThanOrEqual(10);
  });

  it("renders the shared error state in every branch", () => {
    const without = errorBranches.filter((body) => !body.includes("<QueryErrorState"));

    expect(without).toEqual([]);
  });

  it("offers a retry in every branch", () => {
    const without = errorBranches.filter((body) => !body.includes("onRetry="));

    expect(without).toEqual([]);
  });

  it("has no branch left rendering a bare error message", () => {
    // The shape this replaces: `<p className="...text-destructive">{(error as Error)?.message}</p>`
    const bare = errorBranches.filter((body) => body.includes("(error as Error)?.message"));

    expect(bare).toEqual([]);
  });
});
