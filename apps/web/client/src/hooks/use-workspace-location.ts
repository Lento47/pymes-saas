import { useSyncExternalStore, useCallback } from "react";
import { getWorkspaceSlug } from "@/lib/api";

const PUBLIC_PATHS = ["/login", "/accept-invite", "/legal"];

function isPublicPath(path: string): boolean {
  const cleanPath = path.split("?")[0];
  return PUBLIC_PATHS.some((p) => cleanPath === p || cleanPath.startsWith(p + "/"));
}

function readRawHash(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

function stripSlug(hash: string, slug: string | null): string {
  if (!slug) return hash;
  const [pathPart, queryPart] = hash.split("?");
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

function maybeNormalizeHash(): void {
  const slug = getWorkspaceSlug();
  if (!slug) return;
  const hash = readRawHash();
  const cleanPath = hash.split("?")[0];
  if (isPublicPath(cleanPath)) return;
  const expected = addSlug(cleanPath, slug);
  if (expected !== cleanPath) {
    const queryPart = hash.includes("?") ? hash.slice(hash.indexOf("?")) : "";
    history.replaceState(null, "", `#${expected}${queryPart}`);
  }
}

function getLocation(): string {
  const hash = stripSlug(readRawHash(), getWorkspaceSlug());
  return hash.split("?")[0];
}

function subscribe(onChange: () => void): () => void {
  const handler = () => {
    maybeNormalizeHash();
    onChange();
  };
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}

export function normalizeInitialLocation(): void {
  maybeNormalizeHash();
}

export function useWorkspaceHashLocation(): [
  string,
  (to: string, opts?: { replace?: boolean }) => void,
] {
  const location = useSyncExternalStore(subscribe, getLocation, getLocation);

  const navigate = useCallback(
    (to: string, opts?: { replace?: boolean }) => {
      const finalPath = addSlug(to, getWorkspaceSlug());
      const finalHash = `#${finalPath}`;
      if (opts?.replace) {
        history.replaceState(null, "", finalHash);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      } else {
        window.location.hash = finalHash;
      }
    },
    [],
  );

  return [location, navigate];
}
