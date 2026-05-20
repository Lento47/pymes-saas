import { useState, useEffect, useRef } from 'react';
import { getAuthToken, getWorkspaceSlug } from '@/lib/api';

const API_BASE = import.meta.env.VITE_PYMESHUB_API_URL ?? import.meta.env.VITE_API_URL ?? import.meta.env.API_URL ?? '';

const MAX_CACHE_SIZE = 50;
const blobCache = new Map<string, string>();

export function useMediaBlobUrl(mediaUrl: string | null | undefined): { blobUrl: string | null; error: string | null; loading: boolean } {
  const [blobUrl, setBlobUrl] = useState<string | null>(() =>
    mediaUrl ? (blobCache.get(mediaUrl) ?? null) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !mediaUrl || !!blobCache.get(mediaUrl ?? '') ? false : true);
  const currentBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mediaUrl) {
      setLoading(false);
      return;
    }

    setError(null);

    if (blobCache.has(mediaUrl)) {
      const cached = blobCache.get(mediaUrl)!;
      setBlobUrl(cached);
      currentBlobUrlRef.current = cached;
      setLoading(false);
      return;
    }

    setLoading(true);
    let cancelled = false;

    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        setError('Timeout');
        setLoading(false);
      }
    }, 10000);

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

        if (blobCache.size >= MAX_CACHE_SIZE) {
          const oldestKey = blobCache.keys().next().value;
          if (oldestKey) {
            const oldestUrl = blobCache.get(oldestKey);
            if (oldestUrl) {
              URL.revokeObjectURL(oldestUrl);
            }
            blobCache.delete(oldestKey);
          }
        }
        const url = URL.createObjectURL(blob);
        blobCache.set(mediaUrl, url);
        currentBlobUrlRef.current = url;
        setBlobUrl(url);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (currentBlobUrlRef.current) {
        try { URL.revokeObjectURL(currentBlobUrlRef.current); } catch { /* ignore */ }
        currentBlobUrlRef.current = null;
      }
    };
  }, [mediaUrl]);

  return { blobUrl, error, loading };
}

// Revoke all blob URLs on page unload to prevent memory leaks
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    blobCache.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    });
    blobCache.clear();
  });
}

// Revoke all blob URLs on page unload to prevent memory leaks
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    blobCache.forEach((url) => {
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
    });
    blobCache.clear();
  });
}
