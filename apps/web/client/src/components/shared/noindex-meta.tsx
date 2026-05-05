import { useState, useEffect } from "react";

const PUBLIC_PATHS = ["/login", "/register", "/accept-invite", "/pricing", "/product", "/documentation", "/legal", "/blog"];

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
