import { useState, useEffect, useRef } from 'react';
import { getAuthToken, getWorkspaceSlug } from '@/lib/api';

const API_BASE = import.meta.env.VITE_PYMESHUB_API_URL ?? import.meta.env.VITE_API_URL ?? import.meta.env.API_URL ?? '';

const MAX_CACHE_SIZE = 50;
const blobCache = new Map<string, string>();
const errorCache = new Map<string, number>(); // mediaUrl → timestamp of last error

// Minimum seconds before retrying a previously failed URL
const ERROR_RETRY_MS = 30_000;

export function useMediaBlobUrl(mediaUrl: string | null | undefined): { blobUrl: string | null; error: string | null; loading: boolean } {
  const [blobUrl, setBlobUrl] = useState<string | null>(() =>
    mediaUrl ? (blobCache.get(mediaUrl) ?? null) : null,
  );
  const [error, setError] = useState<string | null>(() => {
    if (!mediaUrl) return null;
    if (blobCache.has(mediaUrl)) return null;
    const lastError = errorCache.get(mediaUrl);
    if (lastError && Date.now() - lastError < ERROR_RETRY_MS) return 'Media no disponible';
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (!mediaUrl) return false;
    if (blobCache.has(mediaUrl)) return false;
    const lastError = errorCache.get(mediaUrl);
    if (lastError && Date.now() - lastError < ERROR_RETRY_MS) return false;
    return true;
  });

  useEffect(() => {
    if (!mediaUrl) {
      setLoading(false);
      return;
    }

    setError(null);

    if (blobCache.has(mediaUrl)) {
      setBlobUrl(blobCache.get(mediaUrl)!);
      setLoading(false);
      return;
    }

    const lastError = errorCache.get(mediaUrl);
    if (lastError && Date.now() - lastError < ERROR_RETRY_MS) {
      setError('Media no disponible');
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
        if (cancelled) return;

        if (res.status === 404 || res.status === 410) {
          let detail = 'Media no disponible';
          try {
            const body = await res.json();
            if (body?.message) detail = body.message;
          } catch { /* ignore */ }
          errorCache.set(mediaUrl, Date.now());
          setError(detail);
          setLoading(false);
          return;
        }

        if (!res.ok) {
          errorCache.set(mediaUrl, Date.now());
          setError('Error al cargar el medio');
          setLoading(false);
          return;
        }

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
        errorCache.delete(mediaUrl);
        setBlobUrl(url);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          errorCache.set(mediaUrl, Date.now());
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
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
