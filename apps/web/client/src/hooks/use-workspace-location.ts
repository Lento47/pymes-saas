import { useSyncExternalStore, useCallback } from "react";
import { getWorkspaceSlug } from "@/lib/api";

const PUBLIC_PATHS = ["/login", "/register", "/accept-invite", "/legal", "/pricing", "/documentation", "/product", "/platform", "/ai-agents", "/billing-workflows", "/security"];

function isPublicPath(path: string): boolean {
  const cleanPath = path.split("?")[0];
  return PUBLIC_PATHS.some((p) => cleanPath === p || cleanPath.startsWith(p + "/"));
}

function readPathname(): string {
  return window.location.pathname || "/";
}

function stripSlug(path: string, slug: string | null): string {
  if (!slug) {
    try { slug = localStorage.getItem('pymes_last_slug'); } catch { /* ignore */ }
    if (!slug) return path;
  }
  const [pathPart, queryPart] = path.split("?");
  const prefix = `/${slug}`;
  let stripped = pathPart;
  if (pathPart === prefix) stripped = "/";
  else if (pathPart.startsWith(prefix + "/")) stripped = pathPart.slice(prefix.length);
  return queryPart ? `${stripped}?${queryPart}` : stripped;
}

function addSlug(path: string, slug: string | null): string {
  if (!slug) return path;
  if (isPublicPath(path)) return path;
  if (path === `/${slug}` || path.startsWith(`/${slug}/`)) return path;
  if (path === "/") return `/${slug}`;
  return `/${slug}${path}`;
}

function maybeNormalizePath(): void {
  const slug = getWorkspaceSlug();
  if (!slug) return;
  const currentPath = readPathname();
  const cleanPath = currentPath.split("?")[0];
  if (isPublicPath(cleanPath)) return;
    const expected = addSlug(cleanPath, slug);
    if (expected !== cleanPath) {
      const queryPart = currentPath.includes("?") ? currentPath.slice(currentPath.indexOf("?")) : "";
      history.replaceState(null, "", expected + queryPart);
    }
}

function getLocation(): string {
  const path = stripSlug(readPathname(), getWorkspaceSlug());
  return path.split("?")[0];
}

function subscribe(onChange: () => void): () => void {
  const handler = () => {
    maybeNormalizePath();
    onChange();
  };
  window.addEventListener("popstate", handler);
  return () => window.removeEventListener("popstate", handler);
}

export function normalizeInitialLocation(): void {
  maybeNormalizePath();
}

export function useWorkspaceHashLocation(): [
  string,
  (to: string, opts?: { replace?: boolean }) => void,
] {
  const location = useSyncExternalStore(subscribe, getLocation, getLocation);

  const navigate = useCallback(
    (to: string, opts?: { replace?: boolean }) => {
      const finalPath = addSlug(to, getWorkspaceSlug());
      if (opts?.replace) {
        history.replaceState(null, "", finalPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else {
        history.pushState(null, "", finalPath);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    },
    [],
  );

  return [location, navigate];
}
