import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { api, parsePlanError } from "@/lib/api";
import { apiErrorDescription } from "@/lib/api-error";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InboxConversation } from "../types";

type ContactForm = {
  fullName: string;
  email: string;
  phone: string;
  company: string;
};

function normalizeMessages(data: unknown): Array<Record<string, any>> {
  if (Array.isArray(data)) return data as Array<Record<string, any>>;
  if (data && typeof data === "object" && Array.isArray((data as any).data)) {
    return (data as any).data;
  }
  return [];
}

function cleanSubject(subject?: string | null) {
  return (subject ?? "")
    .replace(/^mensaje de\s+/i, "")
    .replace(/^conversaci[oó]n con\s+/i, "")
    .trim();
}

function getContactDefaults(
  conversation: InboxConversation | Record<string, any> | null,
  messages: Array<Record<string, any>>,
): ContactForm {
  const inbound = [...messages].reverse().find((m) => String(m.direction).toUpperCase() === "INBOUND") ?? {};
  const senderRef = String(inbound.sender_ref ?? "").trim();
  const senderName = String(inbound.sender_name ?? "").trim();
  const subjectName = cleanSubject(conversation?.subject);
  const existing = conversation?.contact;

  const fullName =
    existing?.full_name ||
    existing?.name ||
    senderName ||
    subjectName ||
    (senderRef && !senderRef.includes("@") ? senderRef : "") ||
    "Contacto de bandeja";

  const email = existing?.email || (senderRef.includes("@") ? senderRef : "");
  const phone = existing?.phone || (!senderRef.includes("@") ? senderRef : "");

  return {
    fullName,
    email,
    phone,
    company: existing?.company || (existing as any)?.company_name || "",
  };
}

export function ContactFromConversationDialog({
  open,
  onOpenChange,
  conversationId,
  conversation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  conversation: InboxConversation | Record<string, any> | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContactForm>({ fullName: "", email: "", phone: "", company: "" });
  const [isDirty, setIsDirty] = useState(false);

  const { data: messagesData } = useQuery({
    queryKey: ["/api/conversations", conversationId, "messages"],
    queryFn: () => api.getMessages(conversationId),
    enabled: open && !!conversationId,
    staleTime: 3_000,
  });

  const defaults = useMemo(
    () => getContactDefaults(conversation, normalizeMessages(messagesData)),
    [conversation, messagesData],
  );

  useEffect(() => {
    if (!open) {
      setIsDirty(false);
      return;
    }
    if (!isDirty) setForm(defaults);
  }, [defaults, isDirty, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fullName = form.fullName.trim();
      const email = form.email.trim();
      const phone = form.phone.trim();
      const company = form.company.trim();

      if (!fullName) throw new Error("El nombre es obligatorio.");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("El email no tiene un formato válido.");
      }

      const contact = await api.createContact({
        type: "LEAD",
        full_name: fullName,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        ...(company ? { company_name: company } : {}),
      });
      const contactId = contact?.id ?? contact?.data?.id;
      if (!contactId) throw new Error("El contacto fue creado, pero no se pudo leer su ID.");

      await api.updateConversation(conversationId, { contact_id: contactId });
      return contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contacto agregado", description: "La conversación quedó vinculada al nuevo contacto." });
      onOpenChange(false);
    },
    onError: (err) => {
      const { isPlanLimit, message } = parsePlanError(err);
      toast({
        title: isPlanLimit ? "Límite de plan alcanzado" : "No se pudo agregar el contacto",
        description: isPlanLimit ? message : apiErrorDescription(err),
        variant: "destructive",
      });
    },
  });

  const update = (key: keyof ContactForm, value: string) => {
    setIsDirty(true);
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            Agregar contacto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nombre</Label>
            <Input
              value={form.fullName}
              onChange={(event) => update("fullName", event.target.value)}
              className="h-8 text-xs"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Teléfono</Label>
            <Input
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              className="h-8 text-xs"
              placeholder="+506..."
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Empresa</Label>
            <Input
              value={form.company}
              onChange={(event) => update("company", event.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Se creará como lead y quedará vinculado a esta conversación.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Crear y vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
