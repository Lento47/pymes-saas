import { useEffect, useState } from "react";
import { Camera, Mic } from "lucide-react";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/arc/button/button";

type DevicePermission = "camera" | "microphone";
type Status = PermissionState | "unknown" | "unavailable" | "loading";

export function DevicePermissions() {
  const { locale } = useI18n();
  const es = locale === "es";
  const [revision, setRevision] = useState(0);
  const [states, setStates] = useState<Record<DevicePermission, Status>>({
    camera: "loading",
    microphone: "loading",
  });

  useEffect(() => {
    let active = true;
    let generation = 0;
    let unsubscribe: (() => void)[] = [];
    function clearListeners() {
      unsubscribe.forEach((remove) => remove());
      unsubscribe = [];
    }
    async function refresh() {
      const current = ++generation;
      clearListeners();
      for (const name of ["camera", "microphone"] as const) {
        let state: Status = "unknown";
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          state = "unavailable";
        } else {
          try {
            // Older lib.dom versions omit these browser-supported names.
            // Unsupported browsers reject the query and use the unknown state.
            const permission = await navigator.permissions.query({
              name: name as PermissionName,
            });
            if (!active || current !== generation) return;
            state = permission.state;
            const onChange = () => {
              if (active && current === generation)
                setStates((previous) => ({
                  ...previous,
                  [name]: permission.state,
                }));
            };
            permission.addEventListener("change", onChange);
            unsubscribe.push(() =>
              permission.removeEventListener("change", onChange),
            );
          } catch {
            /* Some browsers cannot report camera/microphone permission. */
          }
        }
        if (active && current === generation)
          setStates((previous) => ({ ...previous, [name]: state }));
      }
    }
    const onFocus = () => {
      void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      clearListeners();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [revision]);

  const labels: Record<Status, string> = es
    ? {
        loading: "Consultando…",
        granted: "Permitido",
        denied: "Bloqueado",
        prompt: "Se pedirá al usar",
        unknown: "Estado no disponible",
        unavailable: "No disponible aquí",
      }
    : {
        loading: "Checking…",
        granted: "Allowed",
        denied: "Blocked",
        prompt: "Ask when used",
        unknown: "Status unavailable",
        unavailable: "Unavailable here",
      };

  return (
    <section aria-labelledby="device-permissions-title">
      <h2 id="device-permissions-title" className="font-semibold">
        {es ? "Permisos del dispositivo" : "Device permissions"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {es
          ? "La cámara se usa en videollamadas y el micrófono en llamadas. El permiso se solicita al usar esas funciones."
          : "Video calls use your camera; calls use your microphone. Permission is requested when you use those features."}
      </p>
      <ul
        className="mt-4 divide-y divide-border rounded-2xl border border-border px-4"
        aria-live="polite"
      >
        {(
          [
            { name: "camera", title: es ? "Cámara" : "Camera", Icon: Camera },
            {
              name: "microphone",
              title: es ? "Micrófono" : "Microphone",
              Icon: Mic,
            },
          ] as const
        ).map(({ name, title, Icon }) => (
          <li
            key={name}
            className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
          >
            <span className="flex items-center gap-2">
              <Icon aria-hidden="true" className="h-5 w-5" />
              {title}
            </span>
            <span className="font-medium">{labels[states[name]]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        {es
          ? "Para cambiar o retirar permisos, abre los controles del sitio junto a la dirección del navegador. Si el estado no está disponible, revísalo allí."
          : "To change or revoke permissions, open site controls beside your browser's address. If status is unavailable, check it there."}
      </p>
      <Button
        type="button"
        variant="secondary"
        className="mt-3 min-h-11 rounded-xl"
        onClick={() => setRevision((value) => value + 1)}
      >
        {es ? "Revisar permisos" : "Check permissions"}
      </Button>
    </section>
  );
}
