import { useLayoutEffect } from "react";

/**
 * The default indexing policy.
 *
 * The signed-in app is not content. A crawler that somehow reaches `/inbox` or
 * `/settings` should get noindex, and this is the blanket that says so.
 *
 * ## Why this writes the tag imperatively instead of rendering one
 *
 * `applySeoMetadata` owns `meta[name=robots]` on every page that declares its own
 * metadata, and it does so by finding the *first* `meta[name=robots]` in the document
 * and overwriting its content. This component used to render a `<meta>` element in
 * JSX, which React 19 hoists into `<head>` as an element of its own — so the document
 * ended up with two tags on the same key, written by two components, and which one
 * `querySelector` found first depended on the order the effects happened to run. Public
 * pages shipped `index, follow` and `noindex, nofollow` at the same time, and which of
 * the two a crawler believed was not deterministic.
 *
 * Writing it here instead, in a layout effect, fixes the ordering rather than the
 * symptoms:
 *
 *   - React runs every layout effect in the tree before any passive effect, so this
 *     runs before the page's own `useEffect` calls `applySeoMetadata`.
 *   - This therefore creates the single `meta[name=robots]` element.
 *   - The page's `upsertMeta` then finds *that* element and overwrites it.
 *
 * One element, one writer at a time, and a public page's own policy always wins. An
 * authenticated page never calls `applySeoMetadata`, so it keeps the noindex this set.
 */

/** Written as a constant so the exact string is asserted rather than retyped. */
export const NOINDEX = "noindex, nofollow";

/**
 * Applied only to routes that are neither on the indexable list nor claimed by a page.
 *
 * The list stays deliberately short. It is a backstop for the app's own routes, not a
 * catalogue of public pages: every marketing, storefront and SEO route declares its
 * own policy through `applySeoMetadata`, and a route that does not get noindex whether
 * or not it appears here. Extending it to cover those routes would re-create the
 * two-writers problem in the opposite direction — a second opinion racing the page's
 * own — so it names only the handful of pages that genuinely have no policy of their
 * own and are still public.
 */
const INDEXABLE = new Set([
  "/",
  "/login",
  "/register",
  "/accept-invite",
  "/pricing",
  "/product",
  "/documentation",
  "/legal",
  "/blog",
]);

function shouldBeIndexed(pathname: string): boolean {
  const clean = pathname.split("?")[0];
  return INDEXABLE.has(clean) || clean.startsWith("/legal/") || clean.startsWith("/documentation/");
}

export function NoindexMeta() {
  useLayoutEffect(() => {
    if (shouldBeIndexed(window.location.pathname)) return;

    // Reuse whatever is already there if a page got there first, so this can never be
    // the thing that introduces a second element on the key.
    let element = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!element) {
      element = document.createElement("meta");
      element.setAttribute("name", "robots");
      document.head.appendChild(element);
    }
    element.setAttribute("content", NOINDEX);
  }, []);

  // Deliberately renders nothing. See the note above.
  return null;
}
