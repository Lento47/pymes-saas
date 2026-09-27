import { useState, useEffect } from "react";
import { api } from "@/lib/api";

interface CabysResult {
  codigo: string;
  descripcion: string;
  impuesto?: string;
}

export function useCabysSearch(query: string) {
  const [results, setResults] = useState<CabysResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setResults([]);
    setError(false);
    setLoading(query.trim().length >= 2);
    if (query.trim().length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const data = await api.searchCabys({ q: query.trim(), top: "8" });
        if (active) setResults(Array.isArray(data) ? data : data?.cabys || data?.data || data?.results || []);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, attempt]);

  return { results, loading, error, retry: () => setAttempt(value => value + 1) };
}
