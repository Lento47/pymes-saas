import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { mobileAdminApi } from "@/lib/mobile-admin";

export function MobileDestinationPicker({
  kind,
  value,
  onChange,
}: {
  kind: "store" | "product";
  value?: string;
  onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const options = useQuery({
    queryKey: ["admin", "mobile", "destinations", kind, debounced, value],
    queryFn: () =>
      mobileAdminApi.destinations({
        kind,
        query: debounced,
        selectedValue: value,
      }),
    staleTime: 60_000,
  });
  return (
    <div className="space-y-2">
      <label className="block text-sm">
        {kind === "store" ? "Buscar negocio" : "Buscar producto"}
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Escribe un nombre"
        />
      </label>
      <label className="block text-sm">
        {kind === "store" ? "Negocio de destino" : "Producto de destino"}
        <select
          className="mt-1 block w-full rounded-md border bg-background p-2"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Seleccionar…</option>
          {options.data?.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {options.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          Buscando…
        </p>
      ) : options.isError ? (
        <p role="alert" className="text-sm text-destructive">
          No pudimos cargar los destinos.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => void options.refetch()}
          >
            Reintentar
          </button>
        </p>
      ) : options.data?.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay resultados para ese nombre.
        </p>
      ) : null}
    </div>
  );
}
