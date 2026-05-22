import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Send, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ContactSalesModal({ open, onClose }: Props) {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    contact_name: "",
    email: "",
    phone: "",
    message: "",
    sso_needed: false,
    sla_needed: false,
    dedicated_onboarding_needed: false,
    custom_workflows_needed: false,
  });

  const mutation = useMutation({
    mutationFn: () => api.submitContactSales(form),
    onSuccess: () => {
      setSent(true);
      toast({ title: "Mensaje enviado", description: "Nuestro equipo de ventas te contactará pronto." });
    },
    onError: () => toast({ title: "Error", description: "No se pudo enviar. Intentá de nuevo.", variant: "destructive" }),
  });

  const update = (key: string, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  if (sent) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground"></DialogTitle></DialogHeader>
          <div className="text-center py-6 space-y-3">
            <Check className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-sm text-foreground font-semibold">¡Gracias por tu interés!</p>
            <p className="text-xs text-muted-foreground">Te contactaremos pronto para armar tu plan Business+ a medida.</p>
            <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Business+ — Contactar a ventas</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nombre del negocio</Label>
              <Input value={form.business_name} onChange={(e) => update("business_name", e.target.value)} placeholder="Mi Empresa S.A." className="mt-1 h-8 text-xs bg-[hsl(var(--elevated))] border-border" />
            </div>
            <div>
              <Label className="text-xs">Tu nombre</Label>
              <Input value={form.contact_name} onChange={(e) => update("contact_name", e.target.value)} placeholder="Juan Pérez" className="mt-1 h-8 text-xs bg-[hsl(var(--elevated))] border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="juan@miempresa.com" className="mt-1 h-8 text-xs bg-[hsl(var(--elevated))] border-border" />
            </div>
            <div>
              <Label className="text-xs">Teléfono</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+506 8888-7777" className="mt-1 h-8 text-xs bg-[hsl(var(--elevated))] border-border" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Mensaje (opcional)</Label>
            <Textarea value={form.message} onChange={(e) => update("message", e.target.value)} placeholder="Contanos qué necesitás..." className="mt-1 text-xs bg-[hsl(var(--elevated))] border-border min-h-[60px]" />
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">¿Qué necesitás?</Label>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">SSO / SAML</span>
              <Switch checked={form.sso_needed} onCheckedChange={(v) => update("sso_needed", v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">SLA personalizado</span>
              <Switch checked={form.sla_needed} onCheckedChange={(v) => update("sla_needed", v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Onboarding dedicado</span>
              <Switch checked={form.dedicated_onboarding_needed} onCheckedChange={(v) => update("dedicated_onboarding_needed", v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Flujos personalizados</span>
              <Switch checked={form.custom_workflows_needed} onCheckedChange={(v) => update("custom_workflows_needed", v)} />
            </div>
          </div>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.business_name || !form.email || mutation.isPending}
            size="sm"
            className="w-full gap-1.5 bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Enviar solicitud
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
