import {
  type MobileConfiguration,
  MOBILE_CONTROLS,
  MOBILE_HOME_CATEGORY_CONTROLS,
  mobileControlEnabled,
  mobileDraftInput,
} from "@pymeshub/shared";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminApi } from "@/lib/admin";
import { mobileAdminApi } from "@/lib/mobile-admin";
import { MobileContentEditor } from "./console-mobile-content";
import { MobileControlPreview } from "./console-mobile-preview";

const key = ["admin", "mobile", "draft"] as const;
type Reply = Awaited<ReturnType<typeof mobileAdminApi.draft>>;
type Action =
  | { kind: "publish" }
  | { kind: "discard" }
  | { kind: "restore"; revisionId: string; revision: number };
const roleNames = {
  all: "Toda la app",
  customer: "Cliente",
  merchant: "Negocio",
  courier: "Repartidor",
} as const;

export function MobileAppTab() {
  const cache = useQueryClient();
  const query = useQuery({ queryKey: key, queryFn: mobileAdminApi.draft });
  const categories = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: adminApi.categories,
  });
  const history = useInfiniteQuery({
    queryKey: ["admin", "mobile", "history"],
    queryFn: ({ pageParam }) => mobileAdminApi.history(pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page) => page.next,
  });
  const [configuration, setConfiguration] =
    useState<MobileConfiguration | null>(null);
  const [baseline, setBaseline] = useState("");
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | "customer" | "merchant" | "courier">(
    "all",
  );
  const [confirmation, setConfirmation] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState("");
  const [contentBusy, setContentBusy] = useState(false);
  function adopt(reply: Reply) {
    const next = reply.draft ?? reply.published.configuration;
    setConfiguration(next);
    setBaseline(JSON.stringify(next));
    setVersion(reply.version);
    setValidation("");
  }
  useEffect(() => {
    if (query.data && configuration === null) adopt(query.data);
  }, [query.data, configuration]);
  const success = (reply: Reply) => {
    cache.setQueryData(key, reply);
    adopt(reply);
    setConfirmation(null);
    setReason("");
    void cache.invalidateQueries({ queryKey: ["admin", "mobile", "history"] });
  };
  const save = useMutation({
    mutationFn: mobileAdminApi.save,
    onSuccess: success,
    onError: () => { void cache.invalidateQueries({ queryKey: key }); },
  });
  const publish = useMutation({
    mutationFn: mobileAdminApi.publish,
    onSuccess: success,
    onError: () => { void cache.invalidateQueries({ queryKey: key }); },
  });
  const discard = useMutation({
    mutationFn: mobileAdminApi.discard,
    onSuccess: success,
    onError: () => { void cache.invalidateQueries({ queryKey: key }); },
  });
  const restore = useMutation({
    mutationFn: mobileAdminApi.restore,
    onSuccess: success,
    onError: () => { void cache.invalidateQueries({ queryKey: key }); },
  });
  const busy =
    contentBusy ||
    save.isPending ||
    publish.isPending ||
    discard.isPending ||
    restore.isPending;
  const dirty =
    configuration !== null && JSON.stringify(configuration) !== baseline;
  const stale = Boolean(query.data && query.data.version !== version);
  const failure = save.error ?? publish.error ?? discard.error ?? restore.error;
  function resetErrors() {
    save.reset();
    publish.reset();
    discard.reset();
    restore.reset();
    setValidation("");
  }
  function change(next: MobileConfiguration) {
    resetErrors();
    setConfiguration(next);
  }
  function changeHomeCategories(id: string | null, checked: boolean) {
    if (!configuration) return;
    const visibility = { ...configuration.visibility };
    // Enabling one shortcut after the global switch was off restores only that choice.
    if (id === null || (checked && visibility.categories === false)) {
      for (const control of MOBILE_HOME_CATEGORY_CONTROLS)
        visibility[control.id] = id === null ? checked : false;
    }
    if (id !== null) visibility[id] = checked;
    if (checked) visibility.categories = true;
    change({ ...configuration, visibility });
  }
  function saveDraft() {
    resetErrors();
    const parsed = mobileDraftInput.safeParse({
      expectedVersion: version,
      configuration,
    });
    if (!parsed.success) {
      setValidation(
        parsed.error.issues[0]?.message ?? "Revisa los campos del borrador.",
      );
      return;
    }
    save.mutate(parsed.data);
  }
  function confirm() {
    if (!confirmation) return;
    resetErrors();
    if (confirmation.kind === "discard") discard.mutate(version);
    else if (confirmation.kind === "publish")
      publish.mutate({ expectedVersion: version, reason: reason.trim() });
    else
      restore.mutate({
        expectedVersion: version,
        revisionId: confirmation.revisionId,
        reason: reason.trim(),
      });
  }
  if (query.isPending || (configuration === null && !query.isError))
    return <p role="status">Cargando configuración móvil…</p>;
  if (query.isError || !configuration || !query.data)
    return (
      <div role="alert" className="space-y-3 rounded-xl border p-5">
        <p>No pudimos cargar la configuración móvil.</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  const controls = MOBILE_CONTROLS.filter(
    (control) =>
      (role === "all" || control.role === role || control.role === "all") &&
      `${control.label.es} ${control.label.en} ${control.help.es} ${control.screen}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()),
  );
  const isHomeCategory = (id: string) =>
    MOBILE_HOME_CATEGORY_CONTROLS.some((control) => control.id === id);
  const homeCategories = controls.filter((control) => isHomeCategory(control.id));
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">App móvil</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Decide qué aparece en la app. Los cambios se guardan como borrador
          hasta publicar. No cambia el sitio web ni reinicia la app.
        </p>
        <p className="text-sm">
          {query.data.published.revision
            ? `Versión publicada ${query.data.published.revision}`
            : "Sin configuración publicada"}{" "}
          · Borrador {version}
          {dirty ? " · Cambios sin guardar" : ""}
        </p>
      </header>
      {!query.data.canPublish ? (
        <p className="rounded-xl border bg-muted/30 p-4 text-sm">
          Puedes preparar y revisar el borrador. Solo un Super Admin con permiso
          de publicación móvil puede publicarlo o restaurar una versión.
        </p>
      ) : null}
      {stale ? (
        <div role="alert" className="rounded-xl border p-4 text-sm">
          Otra persona cambió la configuración. Revisa la versión más reciente
          antes de guardar.
          <Button
            variant="outline"
            className="ml-2"
            disabled={busy}
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  "¿Descartar tus cambios locales y cargar la edición más reciente?",
                )
              )
                adopt(query.data);
            }}
          >
            Cargar versión reciente
          </Button>
        </div>
      ) : null}
      {validation || failure ? (
        <p
          role="alert"
          className="rounded-xl border border-destructive p-4 text-sm text-destructive"
        >
          {validation ||
            (failure instanceof Error
              ? failure.message
              : "No pudimos guardar los cambios.")}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || stale || (!dirty && query.data.draft !== null)}
          onClick={saveDraft}
        >
          {save.isPending ? "Guardando…" : "Guardar borrador"}
        </Button>
        <Button
          variant="outline"
          disabled={
            busy ||
            stale ||
            !query.data.canPublish ||
            !query.data.draft ||
            dirty
          }
          onClick={() => {
            resetErrors();
            setConfirmation({ kind: "publish" });
          }}
        >
          Publicar
        </Button>
        <Button
          variant="outline"
          disabled={busy || stale || (!dirty && !query.data.draft)}
          onClick={() => {
            resetErrors();
            setConfirmation({ kind: "discard" });
          }}
        >
          Descartar borrador
        </Button>
      </div>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-8">
          <section
            aria-labelledby="mobile-visibility-heading"
            className="space-y-4"
          >
            <div>
              <h2
                id="mobile-visibility-heading"
                className="text-lg font-semibold"
              >
                Visibilidad y nuevas operaciones
              </h2>
              <p className="text-sm text-muted-foreground">
                Pedidos existentes, pagos, seguimiento, soporte y cierre de
                sesión permanecen disponibles.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <label className="text-sm">
                Buscar control
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Categorías, pedidos, horario…"
                />
              </label>
              <label className="text-sm">
                Perfil
                <select
                  className="mt-1 block w-full rounded-md border bg-background p-2"
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as typeof role)
                  }
                >
                  {Object.entries(roleNames).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {homeCategories.length > 0 ? (
              <section
                aria-labelledby="mobile-home-categories-heading"
                className="space-y-4 rounded-xl border p-4"
              >
                <div>
                  <h3 id="mobile-home-categories-heading" className="font-semibold">
                    Categorías de inicio
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Oculta todas y activa solo Comida para empezar. Puedes habilitar
                    las demás por etapas. Estos controles cambian los accesos de Inicio.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || stale}
                    onClick={() => changeHomeCategories(null, false)}
                  >
                    Ocultar todas
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || stale}
                    onClick={() => changeHomeCategories(null, true)}
                  >
                    Mostrar todas
                  </Button>
                </div>
                {homeCategories.map((control) => (
                  <label
                    key={control.id}
                    className="flex min-h-12 items-center justify-between gap-4 border-t pt-3"
                  >
                    <span>{control.label.es}</span>
                    <Switch
                      aria-label={`Mostrar ${control.label.es} en Inicio`}
                      checked={mobileControlEnabled(configuration, control.id)}
                      disabled={busy || stale}
                      onCheckedChange={(checked) => changeHomeCategories(control.id, checked)}
                    />
                  </label>
                ))}
              </section>
            ) : null}
            {Object.entries(roleNames).map(([group, label]) => {
              const groupControls = controls.filter(
                (control) => control.role === group && !isHomeCategory(control.id),
              );
              if (!groupControls.length) return null;
              return (
                <div key={group} className="overflow-hidden rounded-xl border">
                  <h3 className="border-b bg-muted/30 px-4 py-3 font-semibold">
                    {label}
                  </h3>
                  {groupControls.map((control) => (
                    <label
                      key={control.id}
                      className="flex min-h-16 cursor-pointer items-start justify-between gap-4 border-b p-4 last:border-b-0"
                    >
                      <span className="min-w-0 space-y-1">
                        <span className="block text-xs text-muted-foreground">
                          {control.screen}
                        </span>
                        <span className="block font-medium">
                          {control.label.es}
                        </span>
                        <span
                          id={`help-${control.id}`}
                          className="block text-sm text-muted-foreground"
                        >
                          {control.help.es}
                        </span>
                        {control.parent &&
                        configuration.visibility[control.parent] === false ? (
                          <span className="block text-xs text-muted-foreground">
                            El control global está desactivado; esta preferencia
                            se conserva.
                          </span>
                        ) : null}
                      </span>
                      <Switch
                        className="mt-1 shrink-0"
                        checked={configuration.visibility[control.id] !== false}
                        disabled={busy || stale}
                        aria-label={control.label.es}
                        aria-describedby={`help-${control.id}`}
                        onCheckedChange={(checked) =>
                          change({
                            ...configuration,
                            visibility: {
                              ...configuration.visibility,
                              [control.id]: checked,
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              );
            })}
            {controls.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">
                No hay controles con ese nombre.
              </p>
            ) : null}
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer font-medium">
                Categorías individuales
              </summary>
              <p className="my-3 text-sm text-muted-foreground">
                El interruptor global tiene prioridad. Estas preferencias se
                conservan para cuando vuelvas a mostrar categorías; no modifican
                el catálogo web.
              </p>
              {categories.isPending ? (
                <p role="status">Cargando categorías…</p>
              ) : categories.isError ? (
                <p role="alert">
                  No pudimos cargar las categorías.{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void categories.refetch()}
                  >
                    Reintentar
                  </button>
                </p>
              ) : (
                categories.data?.map((category) => (
                  <label
                    key={category.id}
                    className={`flex items-center justify-between gap-4 border-t py-3 ${category.parentId ? "ml-4" : ""}`}
                  >
                    <span>{category.name}</span>
                    <Switch
                      aria-label={`Mostrar ${category.name} en la app`}
                      checked={
                        !configuration.hiddenCategoryIds.includes(category.id)
                      }
                      disabled={busy || stale}
                      onCheckedChange={(checked) =>
                        change({
                          ...configuration,
                          hiddenCategoryIds: checked
                            ? configuration.hiddenCategoryIds.filter(
                                (id) => id !== category.id,
                              )
                            : [...configuration.hiddenCategoryIds, category.id],
                        })
                      }
                    />
                  </label>
                ))
              )}
            </details>
          </section>
          <MobileContentEditor
            items={configuration.content}
            disabled={busy || stale}
            onBusyChange={setContentBusy}
            onChange={(content) => change({ ...configuration, content })}
          />
          <section
            className="space-y-4"
            aria-labelledby="mobile-history-heading"
          >
            <h2 id="mobile-history-heading" className="text-lg font-semibold">
              Historial de publicaciones
            </h2>
            {history.isPending ? (
              <p role="status">Cargando historial…</p>
            ) : history.isError ? (
              <p role="alert">
                No pudimos cargar el historial.{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => void history.refetch()}
                >
                  Reintentar
                </button>
              </p>
            ) : (
              history.data?.pages
                .flatMap((page) => page.items)
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                  >
                    <div className="min-w-0 break-words">
                      <h3 className="font-medium">
                        Versión {entry.revision}
                        {entry.restoredFromId ? " · Restaurada" : ""}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {new Intl.DateTimeFormat("es-CR", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(entry.createdAt)}
                      </p>
                      <p className="text-sm">{entry.reason}</p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={
                        busy ||
                        stale ||
                        !query.data.canPublish ||
                        entry.id === query.data.published.revisionId
                      }
                      onClick={() => {
                        resetErrors();
                        setConfirmation({
                          kind: "restore",
                          revisionId: entry.id,
                          revision: entry.revision,
                        });
                      }}
                    >
                      Restaurar
                    </Button>
                  </div>
                ))
            )}
            {history.data?.pages[0]?.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay publicaciones.
              </p>
            ) : null}
            {history.hasNextPage ? (
              <Button
                variant="outline"
                disabled={history.isFetchingNextPage}
                onClick={() => void history.fetchNextPage()}
              >
                Cargar anteriores
              </Button>
            ) : null}
          </section>
        </div>
        <MobileControlPreview configuration={configuration} />
      </div>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!busy && !open) {
            setConfirmation(null);
            setReason("");
          }
        }}
      >
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.kind === "publish"
                ? "¿Publicar este borrador?"
                : confirmation?.kind === "restore"
                  ? `¿Restaurar la versión ${confirmation.revision}?`
                  : "¿Descartar el borrador?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.kind === "discard"
                ? "Se eliminarán los cambios del borrador, incluidos los que aún no guardaste. La app seguirá usando la publicación actual."
                : "Creará una publicación para Android e iOS. Los pedidos y pagos existentes permanecen accesibles. No genera una APK ni fuerza un reinicio."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmation?.kind !== "discard" ? (
            <label className="text-sm">
              Motivo
              <Textarea
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explica brevemente el cambio (mínimo 5 caracteres)"
              />
            </label>
          ) : null}
          {failure ? (
            <p role="alert" className="text-sm text-destructive">
              {failure instanceof Error
                ? failure.message
                : "No pudimos completar la acción."}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                busy ||
                (confirmation?.kind !== "discard" && reason.trim().length < 5)
              }
              onClick={(event) => {
                event.preventDefault();
                confirm();
              }}
            >
              {busy
                ? "Procesando…"
                : confirmation?.kind === "discard"
                  ? "Descartar"
                  : confirmation?.kind === "restore"
                    ? "Restaurar"
                    : "Publicar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
