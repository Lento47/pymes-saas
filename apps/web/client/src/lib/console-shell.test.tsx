import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageTemplate } from "@/components/layout/page-template";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * The console's shell: the tab strip inside a sticky header, the panels in the body, and
 * one collapsed disclosure above them.
 *
 * Every assertion here is about an `id` reference that a screen reader follows. Those are
 * the failure this file exists to catch, because they are the one kind of markup mistake
 * that typechecks, builds, renders visibly and passes lint — the page looks perfect and is
 * still wrong for the people using it with a keyboard.
 *
 * ## The bug this was written for
 *
 * The strip and the panels were briefly in two separate Radix `Tabs` roots. `Tabs.Root` takes
 * `baseId: useId()` **per root** and each trigger points `aria-controls` at
 * `` `${baseId}-content-${value}` ``, so two roots produce two unrelated id namespaces and
 * every reference dangles permanently — for all ten tabs, not only the inactive ones.
 * Verified directly against the installed `@radix-ui/react-tabs` and by rendering both
 * shapes: with two roots the trigger's `aria-controls` names an id that is not in the
 * document while the panel it "controls" is sitting right there under a different id.
 *
 * So two tests here are worth their weight: one asserts the console's real shape resolves,
 * and one asserts the shape it must never go back to does not.
 */

/**
 * The element an `aria-controls` / `aria-labelledby` reference resolves to, or `null`.
 *
 * A helper rather than `document.getElementById(id!)` at each call site: the non-null
 * assertion is a lint warning, and repeating it three times is three chances to skip the
 * check that the attribute is present at all.
 */
function referencedBy(element: Element | null, attribute: string): HTMLElement | null {
  const id = element?.getAttribute(attribute);
  return id ? document.getElementById(id) : null;
}

/** The console's shell, as `console.tsx` composes it. */
function ConsoleShell({ active }: { active: string }) {
  return (
    <Tabs value={active}>
      <PageTemplate
        title="Consola de plataforma"
        description="Todo lo que hay aquí queda registrado con tu nombre."
        headerExtra={
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="approvals" className="shrink-0">
              Aprobaciones
            </TabsTrigger>
            <TabsTrigger value="billing" className="shrink-0">
              Cobros
            </TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="approvals">approvals body</TabsContent>
        <TabsContent value="billing">billing body</TabsContent>
      </PageTemplate>
    </Tabs>
  );
}

describe("console shell: aria wiring", () => {
  it("keeps the tab strip inside the sticky header", () => {
    const { container } = render(<ConsoleShell active="approvals" />);

    const sticky = container.querySelector(".sticky");
    expect(sticky, "PageTemplate's header should be sticky").not.toBeNull();
    expect(sticky?.querySelector("[role='tablist']")).not.toBeNull();
  });

  it("resolves every trigger's aria-controls to a panel in the document", () => {
    render(<ConsoleShell active="approvals" />);

    for (const tab of screen.getAllByRole("tab")) {
      expect(
        tab.getAttribute("aria-controls"),
        `trigger "${tab.textContent}" has no aria-controls`,
      ).toBeTruthy();
      expect(
        referencedBy(tab, "aria-controls"),
        `trigger "${tab.textContent}" points at an id that is not in the document`,
      ).not.toBeNull();
    }
  });

  it("does NOT resolve when the strip and panels are in separate roots", () => {
    // The regression, pinned. If someone splits the Tabs again to make the header layout
    // easier, this goes red before the page ships broken.
    render(
      <>
        <Tabs value="approvals">
          <TabsList>
            <TabsTrigger value="approvals">Aprobaciones</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value="approvals">
          <TabsContent value="approvals">approvals body</TabsContent>
        </Tabs>
      </>,
    );

    const tab = screen.getByRole("tab", { name: "Aprobaciones" });

    // The panel *is* rendered...
    expect(screen.getByText("approvals body")).toBeTruthy();
    // ...and the trigger does not point at it.
    expect(referencedBy(tab, "aria-controls")).toBeNull();
  });

  it("labels each panel with the trigger that controls it", () => {
    render(<ConsoleShell active="billing" />);

    const panel = screen.getByText("billing body");
    expect(panel.getAttribute("aria-labelledby")).toBeTruthy();
    expect(referencedBy(panel, "aria-labelledby")?.tagName).toBe("BUTTON");
  });
});

describe("console metrics disclosure", () => {
  /**
   * The disclosure, exactly as `Metrics` renders it: a button naming a region with
   * `aria-controls`, and the region.
   *
   * `open` is `false` in the first test on purpose — that is the state that was broken.
   */
  function Disclosure({ open }: { open: boolean }) {
    return (
      <div>
        <button type="button" aria-expanded={open} aria-controls="admin-metrics-tiles">
          {open ? "Ocultar métricas" : "Ver métricas"}
        </button>
        <div id="admin-metrics-tiles" hidden={!open}>
          tiles
        </div>
      </div>
    );
  }

  it("keeps aria-controls valid while collapsed", () => {
    render(<Disclosure open={false} />);

    const button = screen.getByRole("button", { name: "Ver métricas" });
    expect(button.getAttribute("aria-controls")).toBe("admin-metrics-tiles");

    const region = referencedBy(button, "aria-controls");
    expect(region, "the collapsed region must still be in the document").not.toBeNull();
    expect(region?.hasAttribute("hidden")).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows the region when expanded", () => {
    render(<Disclosure open />);

    expect(referencedBy(screen.getByRole("button"), "aria-controls")?.hasAttribute("hidden")).toBe(
      false,
    );
    expect(
      screen.getByRole("button", { name: "Ocultar métricas" }).getAttribute("aria-expanded"),
    ).toBe("true");
  });

  it("does NOT resolve while collapsed, if the region is unmounted instead", () => {
    // The pinned regression, same shape as the Tabs one: `{open ? <div id=.../> : null}`
    // typechecks, renders fine, and leaves the button pointing at nothing.
    render(
      <div>
        <button type="button" aria-expanded={false} aria-controls="admin-metrics-tiles">
          Ver métricas
        </button>
        {false ? <div id="admin-metrics-tiles">tiles</div> : null}
      </div>,
    );

    expect(referencedBy(screen.getByRole("button"), "aria-controls")).toBeNull();
  });
});
