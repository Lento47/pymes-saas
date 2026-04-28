import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, parsePlanError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useRequireAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
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
}) {
  const full = [form.firstName, form.lastName].filter(Boolean).join(" ").trim();
  if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    throw new Error("El email no tiene un formato válido.");
  }
  return {
    type: form.type,
    full_name: full || "Sin nombre",
    ...(form.email?.trim() ? { email: form.email.trim() } : {}),
    ...(form.phone?.trim() ? { phone: form.phone.trim() } : {}),
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
  const [importOpen, setImportOpen] = useState(false);

  const params: Record<string, string> = {};
  if (search) params.q = search;
  if (typeFilter !== "ALL") params.type = typeFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/contacts", typeFilter, search],
    queryFn: () => api.getContacts(Object.keys(params).length ? params : undefined),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof toCreateContactPayload>[0]) =>
      editingId ? api.updateContact(editingId, toCreateContactPayload(data)) : api.createContact(toCreateContactPayload(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setShowCreate(false);
      setEditingId(null);
      setForm({ firstName: "", lastName: "", email: "", phone: "", company: "", type: "CUSTOMER" });
      toast({ title: editingId ? "Contact updated" : "Contact created" });
    },
    onError: (err: any) => {
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
      toast({ title: "Contact deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to delete contact", description: err.message, variant: "destructive" });
    },
  });

  const contactList = Array.isArray(data) ? data : data?.data || [];

  return (
    <div>
      <PageHeader title={c.title} description="Manage your contacts and leads">
        <Button size="sm" className="h-8 text-xs" onClick={() => {
          setEditingId(null);
          setForm({ firstName: "", lastName: "", email: "", phone: "", company: "", type: "CUSTOMER" });
          setShowCreate(true);
        }} data-testid="button-create-contact">
          <Plus className="w-3.5 h-3.5 mr-1.5" /> New Contact
        </Button>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setImportOpen(true)}>
          <Upload className="w-3.5 h-3.5 mr-1.5" /> Import CSV
        </Button>
      </PageHeader>

      <div className="px-4 md:px-6 py-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs bg-card border-border"
            data-testid="input-search-contacts"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs bg-card border-border" data-testid="select-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t === "ALL" ? "All Types" : t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : contactList.length === 0 ? (
        <EmptyState icon={Users} title={c.noContacts} description="Create your first contact to get started." />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto bg-card">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Name</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Company</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Email</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Phone</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Type</TableHead>
                <TableHead className="text-[11px] text-muted-foreground/60 font-medium">Last Activity</TableHead>
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
                          Edit Contact
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteMutation.mutate(c.id)}>
                          <Trash className="w-4 h-4 mr-2" />
                          Delete Contact
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
            <DialogTitle className="text-sm">{editingId ? "Edit Contact" : "New Contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">First Name</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-first-name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground/60">Last Name</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-last-name" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground/60">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-contact-email" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground/60">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-contact-phone" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground/60">Company</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="h-8 text-xs bg-background border-border" data-testid="input-contact-company" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground/60">Type</Label>
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
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="h-8 text-xs" data-testid="button-cancel">Cancel</Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending} data-testid="button-save-contact">
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              {editingId ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CsvImportModal open={importOpen} onClose={() => setImportOpen(false)} entityType="contacts" />
    </div>
  );
}
