import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";

interface CabysResult {
  codigo: string;
  descripcion: string;
  impuesto?: string;
}

export function useCabysSearch(query: string) {
  const [results, setResults] = useState<CabysResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.searchCabys({ q, top: "8" });
      const items = Array.isArray(data) ? data : data?.cabys || data?.data || data?.results || [];
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  return { results, loading };
}
