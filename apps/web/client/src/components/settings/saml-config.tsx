import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { apiErrorDescription } from '@/lib/api-error';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Copy, ExternalLink, Save, Shield } from 'lucide-react';

export function SamlConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: workspace } = useQuery({
    queryKey: ['/api/workspaces/current'],
    queryFn: api.getWorkspace,
  });

  const s = workspace?.settings_json || {};
  const existing = s.saml_idp_config || {};

  const [entityId, setEntityId] = useState(existing.entityId || '');
  const [ssoUrl, setSsoUrl] = useState(existing.ssoUrl || '');
  const [certificate, setCertificate] = useState(existing.certificate || '');

  useEffect(() => {
    setEntityId(existing.entityId || '');
    setSsoUrl(existing.ssoUrl || '');
    setCertificate(existing.certificate || '');
  }, [workspace]);

  const saveMutation = useMutation({
    mutationFn: () => api.updateWorkspace({
      settings_json: {
        ...s,
        saml_idp_config: { entityId, ssoUrl, certificate },
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/workspaces/current'] });
      toast({ title: 'Configuración SAML guardada' });
    },
    onError: (err: any) => toast({ title: 'Error', description: apiErrorDescription(err), variant: 'destructive' }),
  });

  const slug = workspace?.slug || 'TU_SLUG';
  const spMetadataUrl = `https://api.pymeshub.lat/api/auth/saml/${slug}/metadata`;
  const spLoginUrl = `https://api.pymeshub.lat/api/auth/saml/${slug}/login`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">SAML SSO</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Conectá PyMesHub con tu proveedor de identidad (Azure AD, Okta, PingOne, etc.)
          </p>
        </div>
      </div>

      {/* SP Configuration */}
      <div className="rounded-lg p-4 space-y-3" style={{ background: 'hsl(var(--elevated))', border: '1px solid hsl(var(--border))' }}>
        <h3 className="text-sm font-semibold text-foreground">Tu configuración como Service Provider</h3>
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Metadata URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={spMetadataUrl} readOnly className="text-xs font-mono bg-foreground/[0.04] border-border" />
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(spMetadataUrl); toast({ title: 'Copiado' }); }}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Pegá esta URL en tu IdP para que reconozca a PyMesHub como SP.</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Login URL</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input value={spLoginUrl} readOnly className="text-xs font-mono bg-foreground/[0.04] border-border" />
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(spLoginUrl); toast({ title: 'Copiado' }); }}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* IdP Configuration */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Configuración de tu Identity Provider</h3>
        <p className="text-xs text-muted-foreground">Obtené estos datos desde el dashboard de tu IdP (Azure, Okta, etc.)</p>

        <div>
          <Label className="text-foreground">Entity ID / Issuer URL</Label>
          <Input
            value={entityId}
            onChange={e => setEntityId(e.target.value)}
            placeholder="https://sts.windows.net/xxxx-xxxx-xxxx/"
            className="mt-1 bg-[hsl(var(--elevated))] border-border"
          />
        </div>
        <div>
          <Label className="text-foreground">SSO URL / Login URL</Label>
          <Input
            value={ssoUrl}
            onChange={e => setSsoUrl(e.target.value)}
            placeholder="https://login.microsoftonline.com/xxxx/saml2"
            className="mt-1 bg-[hsl(var(--elevated))] border-border"
          />
        </div>
        <div>
          <Label className="text-foreground">X.509 Certificate</Label>
          <Textarea
            value={certificate}
            onChange={e => setCertificate(e.target.value)}
            placeholder="MIIC8DCCAdigAwIBAgI..."
            rows={4}
            className="mt-1 bg-[hsl(var(--elevated))] border-border text-xs font-mono"
          />
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !entityId || !ssoUrl || !certificate}
          className="w-full"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Guardar configuración SAML
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Una vez configurado, los usuarios de tu workspace podrán iniciar sesión sin contraseña desde la página de login.
        Al ingresar su email, el sistema detectará que el SSO está activo y los redirigirá automáticamente a tu Identity Provider.
        Requiere plan ENTERPRISE.
      </p>
    </div>
  );
}
