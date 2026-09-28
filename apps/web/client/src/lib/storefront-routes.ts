/**
 * The storefront's routes.
 *
 * These are the paths `MarketplaceShell` serves, and therefore exactly the pages that
 * carry the storefront's own theme toggle. The list exists so the theme can resolve to
 * light for a visitor who has not chosen, without that choice being written back as if
 * they had.
 *
 * ## This list is duplicated in `client/index.html`
 *
 * The inline script there runs before first paint to stop a flash of the wrong ground,
 * and an inline script cannot import a module. The two must be kept in step. If you add
 * a storefront route, add it in both places, or that route will flash the app's canvas
 * on load before the provider corrects it.
 */
const STOREFRONT_ROUTES = [
  "/",
  "/categories", "/category", "/search", "/store", "/cart", "/checkout", "/orders", "/order",
  "/favorites", "/sign-in",
];

/** Whether a pathname is served by the storefront shell. */
export function isStorefrontRoute(pathname: string): boolean {
  const clean = pathname.split("?")[0];
  return STOREFRONT_ROUTES.some((route) => clean === route || clean.startsWith(route + "/"));
}
