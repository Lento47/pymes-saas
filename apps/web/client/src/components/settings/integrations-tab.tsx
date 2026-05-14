import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { SecretInput } from "@/components/settings/secret-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

function ApiKeyCard({
  label, description, icon, iconBg, iconColor,
  isSet, keyValue, onKeyChange, placeholder,
  onSave, onClear, isPending,
}: {
  label: string; description: string;
  icon: React.ReactNode; iconBg: string; iconColor: string;
  isSet: boolean; keyValue: string; onKeyChange: (v: string) => void; placeholder: string;
  onSave: () => void; onClear: () => void; isPending: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-[hsl(var(--elevated))] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${iconBg}`}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className={isSet ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-gray-400 border-gray-500/30 bg-gray-500/10"}>
          {isSet ? "Configurado" : "Sin configurar"}
        </Badge>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">API Key</Label>
        <SecretInput value={keyValue} onChange={onKeyChange} placeholder={isSet ? "••••••••••••••••" : placeholder} />
      </div>
      <div className="flex items-center gap-2 justify-end">
        {isSet && (
          <Button size="sm" variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={onClear} disabled={isPending}>
            {isPending ? "Eliminando..." : "Eliminar key"}
          </Button>
        )}
        <Button size="sm" onClick={onSave} disabled={!keyValue.trim() || isPending}>
          {isPending ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

export function IntegrationsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [resendKey, setResendKey] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/workspaces/current/api-keys"],
    queryFn: () => api.getApiKeys(),
  });

  const resendSet = data?.resend_api_key_set === true;

  const saveKey = useMutation({
    mutationFn: (payload: Record<string, string>) => api.updateApiKeys(payload),
    onSuccess: (_data, payload) => {
      qc.invalidateQueries({ queryKey: ["/api/workspaces/current/api-keys"] });
      const isDelete = Object.values(payload)[0] === "";
      toast({ title: isDelete ? "API key eliminada" : "API key guardada" });
      if (payload.resend_api_key !== undefined) setResendKey("");
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-muted-foreground text-sm">Cargando...</div>;

  return (
    <div className="space-y-4 max-w-lg">
      <p className="text-sm text-muted-foreground">
        Configurá aquí las integraciones operativas del workspace. La configuración de modelos y proveedores de IA se administra únicamente desde la pestaña de Inteligencia Artificial.
      </p>

      <ApiKeyCard
        label="Resend"
        description="Emails transaccionales del sistema (invitaciones, notificaciones)"
        icon={<Mail className="h-4 w-4 text-blue-400" />}
        iconBg="bg-blue-500/10 border border-blue-500/20"
        iconColor="text-blue-400"
        isSet={resendSet}
        keyValue={resendKey}
        onKeyChange={setResendKey}
        placeholder="re_..."
        onSave={() => saveKey.mutate({ resend_api_key: resendKey })}
        onClear={() => saveKey.mutate({ resend_api_key: "" })}
        isPending={saveKey.isPending}
      />
    </div>
  );
}
