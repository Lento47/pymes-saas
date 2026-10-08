import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/arc/button/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function InvoiceContactPicker({ value, onChange, initialName = "" }: { value: string; onChange: (id: string) => void; initialName?: string }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [choosing, setChoosing] = useState(!value);
  const [selectedName, setSelectedName] = useState(initialName);
  const selectedButton = useRef<HTMLButtonElement>(null);
  const wasChoosing = useRef(choosing);
  useEffect(() => { if (value && !choosing && wasChoosing.current) selectedButton.current?.focus(); wasChoosing.current = choosing; }, [value, choosing]);
  const contacts = useQuery({
    queryKey: ["/api/invoices/contacts", user?.workspace.id, query, page],
    queryFn: () => api.getInvoiceContacts({ q: query, page: String(page) }),
    enabled: choosing,
  });
  const find = () => { setQuery(search.trim()); setPage(1); };
  return <fieldset className="min-w-0 space-y-3">
    <legend className="text-base font-medium">Cliente de la factura</legend>
    {value && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3">
      <p className="min-w-0 break-words">{selectedName || "Cliente seleccionado"}</p>
      <Button ref={selectedButton} type="button" variant="secondary" className="min-h-11" onClick={() => setChoosing(!choosing)}>{choosing ? "Listo" : "Cambiar cliente"}</Button>
    </div>}
    {choosing && <>
      <Label htmlFor="invoice-client-search">Buscar por nombre o empresa</Label>
      <div className="flex gap-2">
        <Input id="invoice-client-search" className="min-w-0 h-12" value={search} maxLength={255} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); find(); } }} />
        <Button type="button" variant="secondary" aria-label="Buscar cliente" className="h-12 w-12 shrink-0 p-0" onClick={find}><Search className="h-5 w-5" /></Button>
      </div>
      {contacts.isPending ? <p role="status">Cargando clientes…</p> : contacts.isError ? <div role="alert"><p>No se pudieron cargar los clientes.</p><Button type="button" className="mt-2 min-h-11" variant="secondary" onClick={() => void contacts.refetch()}>Reintentar clientes</Button></div> : <>
        <div className="max-h-56 space-y-1 overflow-y-auto" aria-label="Resultados de clientes">
          {contacts.data.data.map(contact => <Button type="button" key={contact.id} variant="ghost" className="h-auto min-h-12 w-full justify-start whitespace-normal rounded-xl border border-border p-3 text-left" onClick={() => { onChange(contact.id); setSelectedName(contact.full_name); setChoosing(false); }}>
            <span className="min-w-0 break-words">{contact.full_name}{contact.company_name && <span className="block text-sm text-muted-foreground">{contact.company_name}</span>}</span>
          </Button>)}
        </div>
        {!contacts.data.data.length && <p role="status">{query ? "No hay coincidencias. Prueba otro nombre." : "No hay clientes disponibles. Agrega un contacto o pide ayuda al administrador."}</p>}
        {contacts.data.meta.pages > 1 && <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" aria-label="Clientes anteriores" className="h-12 w-12 p-0" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-5 w-5" /></Button>
          <span role="status" className="text-sm">{page} / {contacts.data.meta.pages}</span>
          <Button type="button" aria-label="Más clientes" className="h-12 w-12 p-0" variant="secondary" disabled={page >= contacts.data.meta.pages} onClick={() => setPage(page + 1)}><ChevronRight className="h-5 w-5" /></Button>
        </div>}
      </>}
    </>}
  </fieldset>;
}
