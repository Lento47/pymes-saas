import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, parsePlanError } from "@/lib/api";
import { apiErrorDescription } from "@/lib/api-error";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { DiagnosticButton } from "@/components/shared/diagnostic-button";
import { HelpButton } from "@/components/shared/help-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoader } from "@/components/shared/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "wouter";
import { Users, Plus, Search, Loader2, MoreHorizontal, Pencil, Trash, Upload } from "lucide-react";
import { format } from "date-fns";
import CsvImportModal from "@/components/import/csv-import-modal";

function toCreateContactPayload(form: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  type: string;
}, phonePrefix: string) {
  const full = [form.firstName, form.lastName].filter(Boolean).join(" ").trim();
  if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    throw new Error("El email no tiene un formato válido.");
  }
  return {
    type: form.type,
    full_name: full || "Sin nombre",
    ...(form.email?.trim() ? { email: form.email.trim() } : {}),
    ...(form.phone?.trim() ? { phone: phonePrefix + form.phone.trim() } : {}),
    ...(form.company?.trim() ? { company_name: form.company.trim() } : {}),
  };
}

const TYPE_OPTIONS = ["ALL", "CUSTOMER", "VENDOR", "LEAD", "OTHER"];
const typeBadgeColors: Record<string, string> = {
  CUSTOMER: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  VENDOR: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  LEAD: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  OTHER: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

export default function ContactsPage() {
  useRequireAuth();
  const { messages } = useI18n();
  const c = messages.contacts;
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", company: "", type: "CUSTOMER" });
  const [phonePrefix, setPhonePrefix] = useState("+506");
  const [importOpen, setImportOpen] = useState(false);

  const params: Record<string, string> = {};
  if (search) params.q = search;
  if (typeFilter !== "ALL") params.type = typeFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/contacts", typeFilter, search],
    queryFn: () => api.getContacts(Object.keys(params).length ? params : undefined),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const payload = toCreateContactPayload(form, phonePrefix);
      return editingId ? api.updateContact(editingId, payload) : api.createContact(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setShowCreate(false);
      setEditingId(null);
      setForm({ firstName: "", lastName: "", email: "", phone: "", company: "", type: "CUSTOMER" });
      toast({ title: editingId ? "Contacto actualizado" : "Contacto creado" });
    },
    onError: (err) => {
      const apiMsg = Array.isArray(err?.message) ? err.message.join(", ") : err?.message ?? "";
      const { isPlanLimit, message } = parsePlanError(err);
      toast({
        title: isPlanLimit ? "Límite de plan alcanzado" : (editingId ? "Error al actualizar contacto" : "Error al crear contacto"),
        description: isPlanLimit ? message : apiMsg || "Revisá los campos e intentá de nuevo.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteContact(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contacto eliminado" });
    },
    onError: (err) => {
      toast({ title: "Error al eliminar contacto", description: apiErrorDescription(err), variant: "destructive" });
    },
  });

  const contactList = Array.isArray(data) ? data : data?.data || [];

  return (
    <div>
      <PageHeader title={c.title} description="Gestioná tus contactos y leads">
        <Button size="sm" className="h-8 text-xs" onClick={() => {
          setEditingId(null);
          setForm({ firstName: "", lastName: "", email: "", phone: "", company: "", type: "CUSTOMER" });
          setShowCreate(true);
        }} data-testid="button-create-contact">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Nuevo contacto
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setImportOpen(true)}>
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Importar CSV
        </Button>
      </PageHeader>

      <div className="px-6 pb-2">
        <DiagnosticButton module="contacts" />
      </div>

      <div className="px-4 md:px-6 py-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Buscar contactos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-card border-border"
            data-testid="input-search-contacts"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[130px] h-8 text-xs bg-card border-border" data-testid="select-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t === "ALL" ? "Todos" : t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : contactList.length === 0 ? (
        <EmptyState icon={Users} title={c.noContacts} description="Creá tu primer contacto para empezar." />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto bg-card">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Nombre</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Empresa</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Email</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Teléfono</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Tipo</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Última actividad</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contactList.map((c: any) => (
                <TableRow key={c.id} className="border-border hover:bg-foreground/[0.015] cursor-pointer" data-testid={`contact-row-${c.id}`}>
                  <TableCell>
                    <Link href={`/contacts/${c.id}`}>
                      <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                        {c.full_name || c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "—"}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground/60">{c.company_name || c.company || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground/60">{c.email || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground/60">{c.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${typeBadgeColors[c.type] || typeBadgeColors.OTHER}`}>
                      {c.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground/60">
                    {c.lastInteraction || c.last_interaction || c.updatedAt || c.updated_at
                      ? format(new Date(c.lastInteraction || c.last_interaction || c.updatedAt || c.updated_at), "MMM d, yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-contact-options-${c.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setEditingId(c.id);
                          const [first = "", ...rest] = (c.full_name || c.name || "").split(" ");
                          setForm({
                            firstName: first,
                            lastName: rest.join(" "),
                            email: c.email || "",
                            phone: c.phone || "",
                            company: c.company || c.company_name || "",
                            type: c.type || "CUSTOMER"
                          });
                          setShowCreate(true);
                        }}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Editar contacto
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                          <Trash className="w-4 h-4 mr-2" />
                          Eliminar contacto
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      </div>{/* end px-4 content wrapper */}

      {/* Create / Edit Contact Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => {
        if (!open) {
          setShowCreate(false);
        } else {
          setShowCreate(true);
        }
      }}>
        <DialogContent className="bg-card border-border sm:max-w-[420px]" data-testid="dialog-create-contact">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingId ? "Editar contacto" : "Nuevo contacto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Nombre</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-first-name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Apellido</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-last-name" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground/60">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-contact-email" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground/60">Teléfono</Label>
              <div className="flex gap-1.5">
                <select
                  value={phonePrefix}
                  onChange={(e) => setPhonePrefix(e.target.value)}
                  className="h-8 w-20 rounded-md border border-border bg-background text-xs text-foreground px-1.5 shrink-0"
                >
                  <option value="+506">🇨🇷 +506</option>
                  <option value="+1">🇺🇸 +1</option>
                  <option value="+52">🇲🇽 +52</option>
                  <option value="+57">🇨🇴 +57</option>
                  <option value="+51">🇵🇪 +51</option>
                  <option value="+54">🇦🇷 +54</option>
                  <option value="+56">🇨🇱 +56</option>
                  <option value="+507">🇵🇦 +507</option>
                  <option value="+503">🇸🇻 +503</option>
                  <option value="+502">🇬🇹 +502</option>
                  <option value="+504">🇭🇳 +504</option>
                  <option value="+505">🇳🇮 +505</option>
                  <option value="+34">🇪🇸 +34</option>
                  <option value="+44">🇬🇧 +44</option>
                </select>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="8888-7777"
                  className="h-8 text-xs bg-background border-border flex-1"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground/60">Empresa</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-contact-company" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground/60">Tipo</Label>
              <Select value={form.type} onValueChange={(val) => setForm({ ...form, type: val })}>
                <SelectTrigger className="h-8 text-xs bg-background border-border" data-testid="select-contact-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["CUSTOMER", "VENDOR", "LEAD", "OTHER"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="h-8 text-xs" data-testid="button-cancel">Cancelar</Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => createMutation.mutate()} disabled={createMutation.isPending} data-testid="button-save-contact">
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {editingId ? "Guardar cambios" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} entityType="contacts" />
      <HelpButton page="Contactos" />
    </div>
  );
}
