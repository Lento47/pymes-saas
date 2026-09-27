import { useState, useSyncExternalStore, type ElementType } from "react";
import { Link } from "wouter";
import {
  CheckSquare,
  FileText,
  Inbox,
  Receipt,
  SlidersHorizontal,
  Users,
  KanbanSquare,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

const choices: {
  key: string;
  path: string;
  icon: ElementType;
  es: string;
  en: string;
}[] = [
  { key: "inbox", path: "/inbox", icon: Inbox, es: "Bandeja", en: "Inbox" },
  {
    key: "tasks",
    path: "/tasks",
    icon: CheckSquare,
    es: "Tareas",
    en: "Tasks",
  },
  {
    key: "contacts",
    path: "/contacts",
    icon: Users,
    es: "Clientes",
    en: "Customers",
  },
  {
    key: "invoices",
    path: "/invoices",
    icon: Receipt,
    es: "Facturas",
    en: "Invoices",
  },
  {
    key: "documents",
    path: "/documents",
    icon: FileText,
    es: "Archivos",
    en: "Files",
  },
  {
    key: "pipeline",
    path: "/pipeline",
    icon: KanbanSquare,
    es: "Ventas",
    en: "Sales",
  },
];
const eventName = "pymes-home-shortcuts";
const memory = new Map<string, string>();
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(eventName, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(eventName, notify);
  };
}

export function HomeShortcuts({ can }: { can: (key: string) => boolean }) {
  const { user } = useAuth();
  const { locale } = useI18n();
  const es = locale === "es";
  const [open, setOpen] = useState(false);
  const storageKey = `pymes-home:${user?.id}:${user?.workspace.id}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      if (memory.has(storageKey)) return memory.get(storageKey)!;
      try {
        return localStorage.getItem(storageKey) ?? "";
      } catch {
        return "";
      }
    },
    () => "",
  );
  const available = choices.filter((choice) => can(choice.key));
  let selected = available.slice(0, 4).map((choice) => choice.key);
  try {
    const value = JSON.parse(raw);
    if (Array.isArray(value))
      selected = [
        ...new Set(
          value.filter(
            (item): item is string =>
              typeof item === "string" &&
              choices.some((choice) => choice.key === item),
          ),
        ),
      ];
  } catch {
    /* Invalid settings use available defaults. */
  }
  function save(keys: string[]) {
    const value = JSON.stringify(keys);
    try {
      localStorage.setItem(storageKey, value);
      memory.delete(storageKey);
    } catch {
      memory.set(storageKey, value);
    }
    window.dispatchEvent(new Event(eventName));
  }
  const visible = available.filter((choice) => selected.includes(choice.key));
  // One dominant command (highest-frequency workflow), rest stay neutral.
  const dominantKey = visible.some((choice) => choice.key === "inbox")
    ? "inbox"
    : (visible[0]?.key ?? "");
  return (
    <section aria-labelledby="home-shortcuts-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="home-shortcuts-title" className="text-base font-semibold">
          {es ? "Acciones rápidas" : "Quick actions"}
        </h2>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              className="min-h-12 rounded-xl"
              aria-label={es ? "Personalizar accesos" : "Customize shortcuts"}
            >
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              {es ? "Personalizar" : "Customize"}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            closeLabel={es ? "Cerrar" : "Close"}
            className="mobile-feature-sheet max-h-[85dvh] overflow-y-auto rounded-t-3xl"
          >
            <SheetTitle className="pr-12 text-2xl">
              {es ? "Tus accesos de Inicio" : "Your home shortcuts"}
            </SheetTitle>
            <SheetDescription className="mt-2">
              {es
                ? "Elige qué quieres tener a mano. Se guarda para tu cuenta y espacio en este navegador."
                : "Choose what to keep at hand. Saved for your account and workspace in this browser."}
            </SheetDescription>
            <div className="my-5 grid gap-2 sm:grid-cols-2">
              {available.map((choice) => (
                <label
                  key={choice.key}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 py-3 has-[:checked]:bg-muted"
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary"
                    checked={selected.includes(choice.key)}
                    onChange={(event) =>
                      save(
                        event.target.checked
                          ? [...selected, choice.key]
                          : selected.filter((key) => key !== choice.key),
                      )
                    }
                  />
                  <choice.icon aria-hidden="true" className="h-5 w-5" />
                  <span>{choice[locale]}</span>
                </label>
              ))}
            </div>
            {memory.has(storageKey) && (
              <p role="status" className="mb-3 text-sm">
                {es
                  ? "El almacenamiento está bloqueado. Estos cambios duran esta sesión."
                  : "Storage is blocked. These changes last for this session."}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="min-h-12 rounded-xl"
                onClick={() =>
                  save(available.slice(0, 4).map((choice) => choice.key))
                }
              >
                {es ? "Restablecer" : "Reset"}
              </Button>
              <Button
                className="min-h-12 rounded-xl"
                onClick={() => setOpen(false)}
              >
                {es ? "Listo" : "Done"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      {visible.length ? (
        <div className="-mx-4 border-y border-border bg-card px-2 py-1.5 md:mx-0 md:rounded-xl md:border-x">
          <div className="flex gap-1 overflow-x-auto overscroll-x-contain md:flex-wrap md:overflow-visible">
            {visible.map((choice) => {
              const dominant = choice.key === dominantKey;
              return (
                <Link
                  key={choice.key}
                  href={choice.path}
                  className={
                    "mobile-tab flex min-h-14 min-w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary " +
                    (dominant
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted")
                  }
                >
                  <choice.icon
                    aria-hidden="true"
                    className="h-5 w-5"
                    strokeWidth={dominant ? 2 : 1.75}
                  />
                  <span className="text-[11px] font-semibold leading-none">
                    {choice[locale]}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {es
            ? "Personaliza tus accesos para verlos aquí."
            : "Customize your shortcuts to show them here."}
        </p>
      )}
    </section>
  );
}
