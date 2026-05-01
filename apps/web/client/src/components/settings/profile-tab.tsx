import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function ProfileTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = queryClient;
  const [name, setName] = useState(user?.name ?? "");
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url ?? null);

  const updateName = useMutation({
    mutationFn: () => api.updateMe({ name }),
    onSuccess: () => { toast({ title: "Nombre actualizado" }); qc.invalidateQueries({ queryKey: ["/api/auth/me"] }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const changePass = useMutation({
    mutationFn: () => api.changePassword({ current_password: currentPass, new_password: newPass }),
    onSuccess: () => { toast({ title: "Contraseña actualizada" }); setCurrentPass(""); setNewPass(""); setConfirmPass(""); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadAv = useMutation({
    mutationFn: (file: File) => { const fd = new FormData(); fd.append("file", file); return api.uploadAvatar(fd); },
    onSuccess: (data: any) => { setAvatarPreview(data.avatar_url); qc.invalidateQueries({ queryKey: ["/api/auth/me"] }); toast({ title: "Foto actualizada" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="max-w-md space-y-6">
      <div className="flex items-center gap-4">
        <label className="relative cursor-pointer group">
          <Avatar className="h-16 w-16">
            {avatarPreview ? <AvatarImage src={avatarPreview} /> : null}
            <AvatarFallback className="bg-primary/20 text-primary text-lg font-bold">{user?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="h-5 w-5 text-white" />
          </div>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setAvatarPreview(URL.createObjectURL(f)); uploadAv.mutate(f); } }} />
        </label>
        <div>
          <p className="text-sm font-semibold">{user?.name}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Nombre</Label>
          <div className="flex gap-2 mt-1">
            <Input value={name} onChange={e => setName(e.target.value)} className="bg-[hsl(var(--elevated))] border-border" />
            <Button size="sm" onClick={() => updateName.mutate()} disabled={!name || name === user?.name || updateName.isPending}>
              {updateName.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
            </Button>
          </div>
        </div>

        <Separator className="bg-border/60" />
        <h3 className="text-sm font-semibold">Cambiar contraseña</h3>
        <div>
          <Label className="text-xs">Contraseña actual</Label>
          <Input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
        </div>
        <div>
          <Label className="text-xs">Nueva contraseña (mín. 8 caracteres)</Label>
          <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
        </div>
        <div>
          <Label className="text-xs">Confirmar nueva contraseña</Label>
          <Input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="mt-1 bg-[hsl(var(--elevated))] border-border" />
        </div>
        <Button size="sm" onClick={() => changePass.mutate()} disabled={!currentPass || !newPass || newPass !== confirmPass || changePass.isPending} className="w-full">
          {changePass.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
          Cambiar contraseña
        </Button>
      </div>
    </div>
  );
}
