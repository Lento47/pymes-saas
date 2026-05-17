import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface NewConversationModalProps {
  onCreated?: (conversationId: string) => void;
}

export function NewConversationModal({ onCreated }: NewConversationModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [channelId, setChannelId] = useState("");
  const [contactId, setContactId] = useState("");
  const [subject, setSubject] = useState("");

  const { data: channels } = useQuery({
    queryKey: ["/api/channels"],
    queryFn: () => api.getChannels(),
    enabled: open,
  });

  const { data: contacts } = useQuery({
    queryKey: ["/api/contacts"],
    queryFn: () => api.getContacts(),
    enabled: open,
  });

  const activeChannels = (Array.isArray(channels) ? channels : []).filter((c) => c.status === "ACTIVE");
  const contactList = Array.isArray(contacts) ? contacts : contacts?.data ?? [];

  const create = useMutation({
    mutationFn: () => api.createConversation({
      channel_id: channelId,
      contact_id: (contactId && contactId !== "none") ? contactId : undefined,
      subject: subject || undefined,
    }),
    onSuccess: (conv) => {
      toast({ title: "Conversación creada" });
      qc.invalidateQueries({ queryKey: ["/api/conversations"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setOpen(false);
      setChannelId(""); setContactId(""); setSubject("");
      onCreated?.(conv.id);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 h-9 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" />Nueva
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-card">
        <DialogHeader><DialogTitle className="text-foreground">Nueva conversación</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-muted-foreground">Canal <span className="text-red-400">*</span></Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger className="mt-1 border-border bg-foreground/[0.04] text-foreground">
                <SelectValue placeholder="Seleccioná un canal activo" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                {activeChannels.length === 0
                  ? <SelectItem value="-" disabled>Sin canales activos</SelectItem>
                  : activeChannels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-muted-foreground">Contacto</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger className="mt-1 border-border bg-foreground/[0.04] text-foreground">
                <SelectValue placeholder="Seleccioná un contacto (opcional)" />
              </SelectTrigger>
              <SelectContent className="border-border bg-card">
                <SelectItem value="none">Sin contacto</SelectItem>
                {contactList.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}{c.email ? ` — ${c.email}` : ""}{c.phone ? ` · ${c.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-muted-foreground">Asunto</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="ej. Consulta sobre factura #123"
              className="mt-1 border-border bg-foreground/[0.04] text-foreground"
            />
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={!channelId || create.isPending}
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:opacity-90"
          >
            {create.isPending ? "Creando..." : "Crear conversación"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
