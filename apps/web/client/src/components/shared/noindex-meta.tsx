import { useState, useEffect } from "react";

// Routes that are public content rather than the signed-in app. A path on this list is
// left alone here so the page's own `applySeoMetadata` is the only thing writing a
// `robots` tag for it — two components writing that tag is how a page ends up
// shipping `index, follow` and `noindex, nofollow` at the same time.
//
// `/` is on the list because it is the storefront a signed-out stranger lands on, and
// it is the page this list most obviously used to get wrong.
//
// This list is still shorter than `PUBLIC_PATHS` in `hooks/use-workspace-location.ts`.
// The routes in between — the marketing sub-pages, the SEO slugs, the solutions pages,
// the storefront — are therefore still rendering a `noindex` that contradicts their own
// metadata. That is a real inconsistency, but changing the index policy on twenty
// public pages is a decision about SEO, not about a theme, so it is not made here.
const PUBLIC_PATHS = [
  "/",
  "/login", "/register", "/accept-invite", "/pricing", "/product", "/documentation", "/legal", "/blog",
];

function isAppRoute(path: string): boolean {
  const clean = path.split("?")[0];
  return !PUBLIC_PATHS.some(p => clean === p || clean.startsWith(p + "/"));
}

export function NoindexMeta() {
  const [noindex, setNoindex] = useState(false);

  useEffect(() => {
    const check = () => setNoindex(isAppRoute(window.location.pathname));
    check();
    window.addEventListener("popstate", check);
    return () => window.removeEventListener("popstate", check);
  }, []);

  if (!noindex) return null;

  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
    </>
  );
}
