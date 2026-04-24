import { useSyncExternalStore, useCallback } from "react";
import { getWorkspaceSlug } from "@/lib/api";

const PUBLIC_PATHS = ["/login", "/accept-invite", "/legal"];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}

function readRawHash(): string {
  return window.location.hash.replace(/^#/, "") || "/";
}

function stripSlug(hash: string, slug: string | null): string {
  if (!slug) return hash;
  const prefix = `/${slug}`;
  if (hash === prefix) return "/";
  if (hash.startsWith(prefix + "/")) return hash.slice(prefix.length);
  return hash;
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
  if (isPublicPath(hash)) return;
  const expected = addSlug(hash, slug);
  if (expected !== hash) {
    history.replaceState(null, "", `#${expected}`);
  }
}

function getLocation(): string {
  return stripSlug(readRawHash(), getWorkspaceSlug());
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
