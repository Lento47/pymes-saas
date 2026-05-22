import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";
import { ApiKeyCard } from "@/components/settings/api-key-card";
import { SettingsLayout } from "@/components/settings/settings-layout";

export default function IntegrationsSettingsPage() {
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

  if (isLoading) return <SettingsLayout><div className="text-muted-foreground text-sm">Cargando...</div></SettingsLayout>;

  return (
    <SettingsLayout>
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
    </SettingsLayout>
  );
}
