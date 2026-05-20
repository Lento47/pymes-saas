import { useState, useEffect } from 'react';
import { getAuthToken, getWorkspaceSlug } from '@/lib/api';

const API_BASE = import.meta.env.VITE_PYMESHUB_API_URL ?? import.meta.env.VITE_API_URL ?? import.meta.env.API_URL ?? '';

// Module-level cache: avoids re-fetching the same media URL across renders / re-mounts
const blobCache = new Map<string, string>(); // mediaUrl -> objectURL

/**
 * Fetches a JWT-protected media URL with auth headers and returns a blob objectURL
 * suitable for use as `src` in <img>, <video>, and <audio> elements.
 *
 * Results are cached in memory for the page session so each file is only
 * fetched once regardless of how many times the component remounts.
 */
export function useMediaBlobUrl(mediaUrl: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(() =>
    mediaUrl ? (blobCache.get(mediaUrl) ?? null) : null,
  );

  useEffect(() => {
    if (!mediaUrl) return;

    if (blobCache.has(mediaUrl)) {
      setBlobUrl(blobCache.get(mediaUrl)!);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const token = getAuthToken();
        const slug = getWorkspaceSlug();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (slug) headers['x-workspace-slug'] = slug;

        const res = await fetch(`${API_BASE}${mediaUrl}`, { headers });
        if (!res.ok || cancelled) return;

        const blob = await res.blob();
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        blobCache.set(mediaUrl, url);
        setBlobUrl(url);
      } catch {
        // fail silently — broken media shows nothing rather than crashing
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mediaUrl]);

  return blobUrl;
}
