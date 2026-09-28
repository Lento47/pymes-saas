import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { isStorefrontRoute } from "./storefront-routes";
import { ThemeProvider, useTheme } from "@/components/providers/theme-provider";

/**
 * Theme resolution for the storefront.
 *
 * The storefront is the page a signed-out stranger lands on, and the direction there is
 * a near-white ground, so it defaults to light. The signed-in app keeps dark, per
 * DESIGN.md.
 *
 * The part with teeth is persistence. `applyTheme` used to write to localStorage on
 * mount, so flipping the default would have meant a stranger who only browsed products
 * silently changed the theme of the app they later signed in to. A resolved theme must
 * never be written back; only a chosen one is.
 */

/** Mirrors the inline pre-paint script in `client/index.html`. */
function readPrePaintTheme(pathname: string): string {
  const STOREFRONT_ROUTES = [
    "/", "/categories", "/category", "/search", "/store", "/cart",
    "/checkout", "/orders", "/order", "/favorites", "/sign-in",
  ];
  const isStorefront = STOREFRONT_ROUTES.some(
    (route) => pathname === route || pathname.indexOf(route + "/") === 0,
  );
  const stored = localStorage.getItem("PymesHub-theme");
  return (stored === "light" || stored === "dark" ? stored : null) || (isStorefront ? "light" : "dark");
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
});

/** Reads the theme the provider resolved, and can press the toggle. */
function ThemeProbe() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" onClick={toggle}>
      {theme}
    </button>
  );
}

function renderProvider() {
  return render(
    <ThemeProvider>
      <ThemeProbe />
    </ThemeProvider>,
  );
}

describe("isStorefrontRoute", () => {
  it("matches the storefront home exactly, not every path", () => {
    // "/" must not act as a prefix, or every route in the app would read as storefront.
    expect(isStorefrontRoute("/")).toBe(true);
    expect(isStorefrontRoute("/categories")).toBe(true);
    expect(isStorefrontRoute("/category/soda-dona-elba")).toBe(true);
    expect(isStorefrontRoute("/orders")).toBe(true);
  });

  it("does not match the app's routes", () => {
    for (const path of ["/inbox", "/settings", "/crm", "/admin/users", "/solutions/retail", "/pricing"]) {
      expect(isStorefrontRoute(path)).toBe(false);
    }
  });

  it("does not treat a longer sibling as a match", () => {
    // "/order" must not swallow "/orders" by prefix, and "/orders" must not swallow it
    // either — they are separate routes.
    expect(isStorefrontRoute("/orderish")).toBe(false);
    expect(isStorefrontRoute("/order/123")).toBe(true);
  });
});

describe("the pre-paint script", () => {
  it("agrees with the module on every storefront route", () => {
    // The duplication in index.html is only safe if the two cannot drift.
    for (const path of ["/", "/categories", "/cart", "/sign-in", "/order/9"]) {
      window.history.replaceState(null, "", path);
      const expected = isStorefrontRoute(path) ? "light" : "dark";
      expect(readPrePaintTheme(path)).toBe(expected);
    }
  });

  it("keeps a stated preference over the storefront default", () => {
    localStorage.setItem("PymesHub-theme", "dark");
    expect(readPrePaintTheme("/")).toBe("dark");
  });

  it("does not write a preference for a visitor who never chose", () => {
    readPrePaintTheme("/");
    expect(localStorage.getItem("PymesHub-theme")).toBeNull();
  });
});

describe("ThemeProvider", () => {
  it("resolves the storefront to light when nobody has chosen", () => {
    window.history.replaceState(null, "", "/");
    renderProvider();
    expect(screen.getByRole("button").textContent).toBe("light");
  });

  it("resolves the signed-in app to dark when nobody has chosen", () => {
    window.history.replaceState(null, "", "/inbox");
    renderProvider();
    expect(screen.getByRole("button").textContent).toBe("dark");
  });

  it("does not persist a theme the visitor never chose", () => {
    // The regression this guards: a stranger who only browsed the storefront would end
    // up having chosen the theme of the account they later sign in to.
    window.history.replaceState(null, "", "/");
    renderProvider();

    expect(localStorage.getItem("PymesHub-theme")).toBeNull();
  });

  it("persists a theme the visitor does choose", () => {
    window.history.replaceState(null, "", "/");
    renderProvider();

    screen.getByRole("button").click();

    expect(localStorage.getItem("PymesHub-theme")).toBe("dark");
  });

  it("honours a stored preference over the storefront default", () => {
    localStorage.setItem("PymesHub-theme", "dark");
    window.history.replaceState(null, "", "/");
    renderProvider();

    expect(screen.getByRole("button").textContent).toBe("dark");
  });

  it("applies the resolved theme to the document", () => {
    window.history.replaceState(null, "", "/");
    renderProvider();

    expect(document.documentElement.classList.contains("light")).toBe(true);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
