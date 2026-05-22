import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Eye, Trash2, UserPlus, UserMinus, PowerOff, Plug } from "lucide-react";
import { SettingsLayout } from "@/components/settings/settings-layout";

export default function DepartmentsSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editDept, setEditDept] = useState<any>(null);
  const [deleteDept, setDeleteDept] = useState<any>(null);
  const [addMemberDept, setAddMemberDept] = useState<any>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#4f8ef7");
  const [memberUserId, setMemberUserId] = useState("");

  const { data: depts, isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.getDepartments(),
  });

  const { data: membersData } = useQuery({
    queryKey: ["workspace-members"],
    queryFn: () => api.getMembers(),
  });

  const departments: any[] = Array.isArray(depts) ? depts : [];
  const allMembers: any[] = Array.isArray(membersData) ? membersData : [];

  const createMut = useMutation({
    mutationFn: (d: any) => api.createDepartment(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setCreateOpen(false);
      setName(""); setDescription(""); setColor("#4f8ef7");
      toast({ title: "Departamento creado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => api.updateDepartment(id, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setEditDept(null);
      toast({ title: "Departamento actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteDepartment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setDeleteDept(null);
      toast({ title: "Departamento eliminado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addMemberMut = useMutation({
    mutationFn: ({ deptId, userId }: any) => api.addDepartmentMember(deptId, { user_id: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setAddMemberDept(null);
      setMemberUserId("");
      toast({ title: "Miembro agregado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMemberMut = useMutation({
    mutationFn: ({ deptId, userId }: any) => api.removeDepartmentMember(deptId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEdit = (dept: any) => {
    setEditDept(dept);
    setName(dept.name);
    setDescription(dept.description ?? "");
    setColor(dept.color ?? "#4f8ef7");
  };

  return (
    <SettingsLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Organiza usuarios y conversaciones por departamento.</p>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Nuevo departamento
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : departments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay departamentos aún.</p>
        ) : (
          <div className="space-y-3">
            {departments.map((dept: any) => (
              <div key={dept.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: dept.color ?? "#4f8ef7" }}
                    />
                    <span className="font-medium text-sm">{dept.name}</span>
                    {!dept.is_active && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Inactivo</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {dept._count?.conversations ?? 0} convs
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(dept)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddMemberDept(dept)}>
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteDept(dept)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {dept.description && (
                  <p className="text-xs text-muted-foreground">{dept.description}</p>
                )}
                {dept.members?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {dept.members.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-1 bg-elevated rounded px-2 py-0.5 text-xs">
                        <span>{m.user?.name ?? m.user?.email}</span>
                        {m.is_lead && <Badge variant="outline" className="text-xs h-4 px-1">Lead</Badge>}
                        <button
                          className="ml-1 text-muted-foreground hover:text-destructive"
                          onClick={() => removeMemberMut.mutate({ deptId: dept.id, userId: m.user_id })}
                        >
                          <UserMinus className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo departamento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Soporte, Ventas..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descripción (opcional)</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                  <span className="text-xs text-muted-foreground">{color}</span>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!name.trim() || createMut.isPending}
                onClick={() => createMut.mutate({ name, description: description || undefined, color })}
              >
                Crear
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editDept} onOpenChange={v => { if (!v) setEditDept(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Editar departamento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre</Label>
                <Input value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descripción</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-8 w-8 rounded cursor-pointer" />
                  <span className="text-xs text-muted-foreground">{color}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => updateMut.mutate({ id: editDept?.id, is_active: !editDept?.is_active })}
                >
                  {editDept?.is_active ? <PowerOff className="h-4 w-4 mr-1" /> : <Plug className="h-4 w-4 mr-1" />}
                  {editDept?.is_active ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  className="flex-1"
                  disabled={!name.trim() || updateMut.isPending}
                  onClick={() => updateMut.mutate({ id: editDept?.id, name, description: description || undefined, color })}
                >
                  Guardar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!addMemberDept} onOpenChange={v => { if (!v) { setAddMemberDept(null); setMemberUserId(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Agregar miembro — {addMemberDept?.name}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Usuario</Label>
                <Select value={memberUserId} onValueChange={setMemberUserId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar usuario" /></SelectTrigger>
                  <SelectContent>
                    {allMembers.map((m: any) => (
                      <SelectItem key={m.user?.id ?? m.id} value={m.user?.id ?? m.id}>
                        {m.user?.name ?? m.name} ({m.user?.email ?? m.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={!memberUserId || addMemberMut.isPending}
                onClick={() => addMemberMut.mutate({ deptId: addMemberDept?.id, userId: memberUserId })}
              >
                Agregar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteDept} onOpenChange={v => { if (!v) setDeleteDept(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar departamento?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará <strong>{deleteDept?.name}</strong>. Las conversaciones y canales asociados perderán su departamento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteMut.mutate(deleteDept?.id)}
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SettingsLayout>
  );
}
