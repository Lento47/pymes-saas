import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/loading-spinner";
import { SearchInput } from "@/components/shared/search-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  Ban,
  KeyRound,
  Loader2,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

/**
 * Platform users: the read side and all six lifecycle writes.
 *
 * ## The list is not the whole list, and says so
 *
 * `PlatformService.searchUsers` hardcodes `take: 50`, orders by `created_at desc`, and
 * returns **no total** — so there is no way to page and no way to know how many accounts
 * exist. The row count therefore says "up to 50" whenever the list is full, and the
 * header says it plainly. An operator must not read "50 accounts" as "we have 50
 * accounts"; that is the failure this note exists to prevent, and it is also why the
 * search box matters more here than a count would.
 *
 * ## Two of the six actions are refused by the API, and the UI refuses them first
 *
 * `updateUserStatus` rejects a non-ACTIVE status applied to the caller, and `deleteUser`
 * rejects the caller outright as well as any owner of a workspace. Those controls are
 * disabled for the signed-in operator with a title saying why, so the button does not
 * lead to a 400 the operator can do nothing about.
 *
 * `togglePlatformAdmin` has **no** such self-guard on the server — deliberately, since
 * it is a behaviour question rather than a bug fix — so the last platform admin can
 * revoke themselves here. Auth0 re-provisions the flag on next login, so it is
 * recoverable rather than permanent, but it is the one action on this page that can lock
 * somebody out, and the confirm dialog says so in those words.
 *
 * ## Consequences are stated before the click, not after
 *
 * Three of these writes do something the operator cannot see:
 * - `resetUserPassword` returns a **plaintext** password, shown once in a dialog with a
 *   copy button. It is deliberately not a toast: `TOAST_LIMIT` is 1 and a toast
 *   auto-dismisses, which is the wrong container for the only copy of a credential.
 * - `updateUserPassword` deletes **every** refresh token for the user, signing them out
 *   on every device immediately.
 * - `createUser` does not set `email_verified`, and `AuthService.login` rejects an
 *   unverified account — so a user created here **cannot sign in** until they follow the
 *   verification link. That is a genuine trap and the create dialog says so up front.
 */

type UserStatus = "ACTIVE" | "INACTIVE" | "INVITED" | "BANNED";

/** From the `UserStatus` Prisma enum. The PATCH validates against this server-side. */
const USER_STATUSES: readonly UserStatus[] = ["ACTIVE", "INACTIVE", "INVITED", "BANNED"];

const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  INVITED: "Invitado",
  BANNED: "Bloqueado",
};

/** `platformSearchUsers` is hard-capped at this on the server. */
const SERVER_LIMIT = 50;

const STATUS_VARIANT: Record<UserStatus, string> = {
  ACTIVE: "border-green-500/20 bg-green-500/10 text-green-400",
  INACTIVE: "",
  INVITED: "",
  BANNED: "border-red-500/20 bg-red-500/10 text-red-400",
};

interface PlatformUserRow {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  status: UserStatus;
  is_platform_admin: boolean;
  created_at: string;
  workspace_users: Array<{
    id: string;
    is_owner: boolean;
    role: string;
    workspace: { id: string; name: string; slug: string };
  }>;
}

/** Which destructive-ish action a confirm dialog is currently asking about. */
type PendingAction =
  | { kind: "toggle-admin"; user: PlatformUserRow }
  | { kind: "status"; user: PlatformUserRow; next: UserStatus }
  | { kind: "delete"; user: PlatformUserRow }
  | { kind: "set-password"; user: PlatformUserRow }
  | { kind: "reset-password"; user: PlatformUserRow };

export default function AdminUsers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [passwordDraft, setPasswordDraft] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", name: "", password: "", isPlatformAdmin: false });
  /** The temporary password from a reset. Held in state, never in a toast. */
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  // One debounce for the page, matching `marketplace/search.tsx`: the box stays
  // responsive while the query waits for the operator to stop typing. `SearchInput` is
  // deliberately undebounced and says the debounce belongs here.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term), 300);
    return () => window.clearTimeout(timer);
  }, [term]);

  const emailFilter = debounced.trim();
  const listKey = ["/api/platform/users", emailFilter];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: listKey,
    queryFn: () => api.platformSearchUsers(emailFilter || undefined),
    enabled: !!user?.is_platform_admin,
    retry: false,
    staleTime: 30000,
  });

  const users = ((Array.isArray(data) ? data : (data as { data?: unknown[] })?.data ?? []) as
    PlatformUserRow[]);

  /** Every mutation invalidates the list, which is the only thing on this page that reads. */
  const afterWrite = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ["/api/platform/users"] });
    toast({ title: message });
  };

  const fail = (e: unknown) =>
    toast({
      title: "No se pudo completar la acción",
      description: e instanceof Error ? e.message : String(e),
      variant: "destructive",
    });

  const toggleAdmin = useMutation({
    mutationFn: (id: string) => api.platformToggleAdmin(id),
    onSuccess: () => afterWrite("Acceso de administrador actualizado"),
    onError: fail,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) =>
      api.platformUpdateUserStatus(id, status),
    onSuccess: () => afterWrite("Estado de la cuenta actualizado"),
    onError: fail,
  });

  const setPasswordMut = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api.platformUpdateUserPassword(id, next),
    onSuccess: () => afterWrite("Contraseña actualizada — la cuenta fue desconectada de todos sus dispositivos"),
    onError: fail,
  });

  const resetPasswordMut = useMutation({
    mutationFn: (id: string) => api.platformResetUserPassword(id),
    onSuccess: (result: { message?: string; temporary_password?: string }, id) => {
      setPending(null);
      setPasswordDraft("");
      // The plaintext is the point of this action, so it goes in a dialog the operator
      // has to dismiss rather than a toast that disappears on its own.
      if (result?.temporary_password) {
        const target = users.find((u) => u.id === id);
        setIssued({ email: target?.email ?? "la cuenta", password: result.temporary_password });
      }
      void afterWrite("Contraseña temporal generada");
    },
    onError: fail,
  });

  const removeUser = useMutation({
    mutationFn: (id: string) => api.platformDeleteUser(id),
    onSuccess: () => afterWrite("Usuario eliminado"),
    onError: fail,
  });

  const createUser = useMutation({
    mutationFn: () =>
      api.platformCreateUser({
        email: newUser.email.trim(),
        name: newUser.name.trim(),
        password: newUser.password,
        is_platform_admin: newUser.isPlatformAdmin,
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setNewUser({ email: "", name: "", password: "", isPlatformAdmin: false });
      await afterWrite("Usuario creado");
    },
    onError: fail,
  });

  if (isLoading) return <PageLoader />;

  const busy =
    toggleAdmin.isPending ||
    updateStatus.isPending ||
    setPasswordMut.isPending ||
    resetPasswordMut.isPending ||
    removeUser.isPending;

  const closePending = () => {
    setPending(null);
    setPasswordDraft("");
  };

  const confirm = () => {
    if (!pending) return;
    const id = pending.user.id;
    if (pending.kind === "toggle-admin") toggleAdmin.mutate(id);
    else if (pending.kind === "status") updateStatus.mutate({ id, status: pending.next });
    else if (pending.kind === "delete") removeUser.mutate(id);
    else if (pending.kind === "set-password") {
      if (!passwordDraft) return;
      setPasswordMut.mutate({ id, next: passwordDraft });
    } else resetPasswordMut.mutate(id);
    if (pending.kind !== "set-password") closePending();
  };

  return (
    <div className="min-h-full" style={{ background: "hsl(var(--bg))" }}>
      <PageHeader title="Usuarios" description="Buscá y gestioná las cuentas de la plataforma.">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-3.5 h-3.5 mr-1.5" />Nuevo usuario
        </Button>
      </PageHeader>

      <div className="px-6 py-6 space-y-4">
        <SearchInput
          value={term}
          onValueChange={setTerm}
          placeholder="Buscar por email"
          aria-label="Buscar usuarios por email"
          wrapperClassName="max-w-md"
        />

        {/* The server caps this list and reports no total, so the count is a ceiling, not
            a census. Saying otherwise is the whole reason this line exists. */}
        <p className="text-[10px] text-muted-foreground">
          {emailFilter
            ? `Resultados para “${emailFilter}” — hasta ${SERVER_LIMIT} por consulta.`
            : `Las cuentas se devuelven por fecha de creación, hasta ${SERVER_LIMIT} por consulta. No hay paginación ni total: usá la búsqueda para encontrar cuentas fuera de este listado.`}
        </p>

        {isError ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
            <p className="text-xs text-red-400 mb-2">No se pudieron cargar los usuarios.</p>
            <p className="text-[10px] text-muted-foreground mb-3">
              {error instanceof Error ? error.message : String(error)}
            </p>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        ) : users.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {emailFilter ? "Ninguna cuenta coincide con esa búsqueda." : "No hay cuentas."}
          </p>
        ) : (
          <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
            <div className="divide-y divide-border/60">
              {users.map((u) => {
                const isSelf = u.id === user?.id;
                const ownsWorkspace = u.workspace_users.some((w) => w.is_owner);
                return (
                  <div key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground truncate">{u.name}</span>
                          {u.is_platform_admin && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
                              Admin
                            </Badge>
                          )}
                          {isSelf && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">vos</Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{u.email}</span>
                        {u.workspace_users.length > 0 && (
                          <span className="text-[10px] text-muted-foreground/80 block">
                            {u.workspace_users.length === 1
                              ? u.workspace_users[0].workspace.name
                              : `${u.workspace_users.length} workspaces`}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${STATUS_VARIANT[u.status]}`}>
                        {STATUS_LABEL[u.status] ?? u.status}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            aria-label={`Acciones para ${u.email}`}
                            disabled={busy}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onSelect={() => setPending({ kind: "toggle-admin", user: u })}
                            disabled={busy}
                          >
                            {u.is_platform_admin ? (
                              <><ShieldOff className="mr-2 h-3.5 w-3.5" />Quitar administrador</>
                            ) : (
                              <><ShieldCheck className="mr-2 h-3.5 w-3.5" />Dar administrador</>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Estado</DropdownMenuLabel>
                          {USER_STATUSES.filter((s) => s !== u.status).map((s) => (
                            <DropdownMenuItem
                              key={s}
                              // The API refuses a non-ACTIVE status on the caller, so the
                              // control is off rather than leading to a 400.
                              disabled={busy || (isSelf && s !== "ACTIVE")}
                              title={isSelf && s !== "ACTIVE" ? "No podés desactivar tu propia cuenta" : undefined}
                              onSelect={() => setPending({ kind: "status", user: u, next: s })}
                            >
                              <Ban className="mr-2 h-3.5 w-3.5" />Marcar {STATUS_LABEL[s].toLowerCase()}
                            </DropdownMenuItem>
                          ))}

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => setPending({ kind: "set-password", user: u })}
                            disabled={busy}
                          >
                            <KeyRound className="mr-2 h-3.5 w-3.5" />Definir contraseña
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => setPending({ kind: "reset-password", user: u })}
                            disabled={busy}
                          >
                            <KeyRound className="mr-2 h-3.5 w-3.5" />Generar contraseña temporal
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            disabled={busy || isSelf || ownsWorkspace}
                            title={
                              isSelf
                                ? "No podés eliminar tu propia cuenta"
                                : ownsWorkspace
                                  ? "Es owner de un workspace — transferí la propiedad primero"
                                  : undefined
                            }
                            onSelect={() => setPending({ kind: "delete", user: u })}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />Eliminar cuenta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Create user ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              Crea una cuenta de plataforma. La contraseña debe tener al menos 8 caracteres, una
              mayúscula, una minúscula y un número.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-[11px]">Email</Label>
              <Input
                type="email"
                className="h-9 text-xs bg-background border-border"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[11px]">Nombre</Label>
              <Input
                className="h-9 text-xs bg-background border-border"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-[11px]">Contraseña</Label>
              <Input
                type="password"
                className="h-9 text-xs bg-background border-border"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={newUser.isPlatformAdmin}
                onChange={(e) => setNewUser({ ...newUser, isPlatformAdmin: e.target.checked })}
              />
              Dar acceso de administrador de plataforma
            </label>

            {/* `createUser` never sets `email_verified` and `login` rejects an unverified
                account, so this is a real trap rather than a footnote. */}
            <p className="text-[10px] text-amber-400/90 border border-amber-500/20 bg-amber-500/[0.05] rounded-md p-2">
              La cuenta queda sin verificar. <code className="text-amber-300">login</code> rechaza
              los usuarios sin email verificado, así que la persona no podrá entrar hasta seguir el
              enlace de verificación.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              disabled={
                createUser.isPending ||
                !newUser.email.trim() ||
                !newUser.name.trim() ||
                newUser.password.length < 8
              }
              onClick={() => createUser.mutate()}
            >
              {createUser.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Crear usuario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generated temporary password: shown once, copied deliberately ── */}
      <Dialog open={issued !== null} onOpenChange={(open) => !open && setIssued(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Contraseña temporal</DialogTitle>
            <DialogDescription>
              Esta es la única vez que se muestra. Cópiala y entregala por un canal seguro — no se
              puede volver a leer.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-[10px] text-muted-foreground mb-1">{issued?.email}</p>
            <code className="text-sm font-mono text-foreground break-all">{issued?.password}</code>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (issued) void navigator.clipboard.writeText(issued.password);
                toast({ title: "Contraseña copiada" });
              }}
            >
              Copiar
            </Button>
            <Button size="sm" onClick={() => setIssued(null)}>Listo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmations, one per consequence ── */}
      <ConfirmDialog
        open={pending !== null && pending.kind === "toggle-admin"}
        onOpenChange={(open) => !open && closePending()}
        title={pending?.kind === "toggle-admin" && pending.user.is_platform_admin
          ? "Quitar acceso de administrador"
          : "Dar acceso de administrador"}
        description={
          pending?.kind === "toggle-admin" && pending.user.is_platform_admin
            ? `${pending.user.email} va a perder el acceso que le da control sobre todos los workspaces. Queda registrado en la auditoría.`
            : pending?.kind === "toggle-admin"
              ? `${pending.user.email} va a poder ver y modificar cualquier workspace de la plataforma, y suspender cuentas. Dáselo a pocas personas.`
              : ""
        }
        confirmLabel="Confirmar"
        destructive={pending?.kind === "toggle-admin" && pending.user.is_platform_admin}
        onConfirm={confirm}
      />

      <ConfirmDialog
        open={pending?.kind === "status"}
        onOpenChange={(open) => !open && closePending()}
        title="Cambiar el estado de la cuenta"
        description={
          pending?.kind === "status"
            ? `${pending.user.email} va a pasar a ${STATUS_LABEL[pending.next]}. ${
                pending.next === "ACTIVE"
                  ? "Va a poder volver a entrar."
                  : "No va a poder entrar a la cuenta. Sus datos quedan como están."
              }`
            : ""
        }
        confirmLabel="Confirmar"
        destructive={pending?.kind === "status" && pending.next !== "ACTIVE"}
        onConfirm={confirm}
      />

      <ConfirmDialog
        open={pending?.kind === "delete"}
        onOpenChange={(open) => !open && closePending()}
        title="Eliminar la cuenta"
        description={
          pending?.kind === "delete"
            ? `Se elimina permanentemente la cuenta de ${pending.user.email} y se la desconecta de todos sus dispositivos. No se puede deshacer.`
            : ""
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={confirm}
      />

      <ConfirmDialog
        open={pending?.kind === "reset-password"}
        onOpenChange={(open) => !open && closePending()}
        title="Generar contraseña temporal"
        description={
          pending?.kind === "reset-password"
            ? `Se genera una contraseña nueva para ${pending.user.email} y se desconecta la cuenta de todos sus dispositivos. La vas a ver una sola vez.`
            : ""
        }
        confirmLabel="Generar"
        onConfirm={confirm}
      />

      <Dialog
        open={pending?.kind === "set-password"}
        onOpenChange={(open) => {
          if (!open) closePending();
        }}
      >
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Definir contraseña</DialogTitle>
            <DialogDescription>
              Mínimo 8 caracteres, una mayúscula, una minúscula y un número.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[11px]">Nueva contraseña</Label>
              <Input
                type="password"
                autoFocus
                className="h-9 text-xs bg-background border-border"
                value={passwordDraft}
                onChange={(e) => setPasswordDraft(e.target.value)}
              />
            </div>
            {/* `updateUserPassword` deletes every refresh token, so this is a sign-out
                everywhere as a side effect of setting a password. */}
            <p className="text-[10px] text-amber-400/90 border border-amber-500/20 bg-amber-500/[0.05] rounded-md p-2">
              Esto borra todas las sesiones activas: la persona va a quedar desconectada de cada
              dispositivo y tendrá que entrar de nuevo.
            </p>
            {setPasswordMut.isError && (
              <p className="text-[10px] text-red-400">
                {setPasswordMut.error instanceof Error ? setPasswordMut.error.message : ""}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={closePending}>Cancelar</Button>
            <Button
              size="sm"
              disabled={setPasswordMut.isPending || passwordDraft.length < 8}
              onClick={confirm}
            >
              {setPasswordMut.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Guardar contraseña
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
