import {
  type MobileContent,
  mobileDestinationSchema,
  type MobileRole,
} from "@pymeshub/shared";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { mobileAdminApi } from "@/lib/mobile-admin";
import { MARKETPLACE_API_URL } from "@/lib/marketplace";
import { MobileDestinationPicker } from "./console-mobile-destination";

const destinationNames: Record<MobileContent["destination"]["kind"], string> = {
  home: "Inicio",
  help: "Ayuda",
  settings: "Ajustes",
  inbox: "Bandeja de entrada",
  search: "Buscar",
  offers: "Descuentos",
  store: "Un negocio",
  product: "Un producto",
  merchantOrders: "Pedidos del negocio",
  merchantProducts: "Productos del negocio",
  merchantSettings: "Configuración del negocio",
  courierDeliveries: "Entregas del repartidor",
  courierProfile: "Perfil del repartidor",
};

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}
export function MobileContentEditor({
  items,
  onChange,
  disabled,
  onBusyChange,
}: {
  items: MobileContent[];
  onChange: (items: MobileContent[]) => void;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const change = (id: string, patch: Partial<MobileContent>) =>
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const add = (kind: MobileContent["kind"]) =>
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        kind,
        roles: ["customer"],
        title: { es: "", en: "" },
        body: { es: "", en: "" },
        button: { es: "", en: "" },
        imagePath: null,
        destination: { kind: "home" },
        startsAt: null,
        endsAt: null,
      },
    ]);
  return (
    <section className="space-y-4" aria-labelledby="mobile-content-heading">
      <div>
        <h2 id="mobile-content-heading" className="text-lg font-semibold">
          Campañas y avisos
        </h2>
        <p className="text-sm text-muted-foreground">
          Texto en español e inglés, imágenes subidas y destinos de la app. No
          cambia promociones de comercios.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {items.map((item, index) => (
        <details
          key={item.id}
          className="rounded-xl border p-4"
          open={!item.title.es}
        >
          <summary className="cursor-pointer font-medium">
            {item.title.es ||
              `${item.kind === "campaign" ? "Campaña" : "Aviso"} ${index + 1}`}
          </summary>
          <fieldset
            disabled={disabled || uploading !== null}
            className="mt-4 space-y-4 min-w-0"
          >
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["customer", "Cliente"],
                  ["merchant", "Negocio"],
                  ["courier", "Repartidor"],
                ] as const
              ).map(([role, label]) => (
                <label key={role} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.roles.includes(role)}
                    onChange={(event) =>
                      change(item.id, {
                        roles: event.target.checked
                          ? [...item.roles, role]
                          : (item.roles.filter(
                              (value) => value !== role,
                            ) as MobileRole[]),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            {(["es", "en"] as const).map((locale) => (
              <fieldset
                key={locale}
                className="grid gap-3 rounded-lg bg-muted/30 p-3"
              >
                <legend className="text-sm font-medium">
                  {locale === "es" ? "Español" : "English"}
                </legend>
                <label className="text-sm">
                  {locale === "es" ? "Título" : "Title"}
                  <Input
                    lang={locale}
                    value={item.title[locale]}
                    maxLength={100}
                    onChange={(event) =>
                      change(item.id, {
                        title: { ...item.title, [locale]: event.target.value },
                      })
                    }
                  />
                </label>
                <label className="text-sm">
                  {locale === "es" ? "Mensaje" : "Message"}
                  <Textarea
                    lang={locale}
                    value={item.body[locale]}
                    maxLength={300}
                    onChange={(event) =>
                      change(item.id, {
                        body: { ...item.body, [locale]: event.target.value },
                      })
                    }
                  />
                </label>
                <label className="text-sm">
                  {locale === "es" ? "Texto del botón" : "Button label"}
                  <Input
                    lang={locale}
                    value={item.button[locale]}
                    maxLength={50}
                    onChange={(event) =>
                      change(item.id, {
                        button: {
                          ...item.button,
                          [locale]: event.target.value,
                        },
                      })
                    }
                  />
                </label>
              </fieldset>
            ))}
            <label className="block text-sm">
              Imagen {item.kind === "announcement" ? "(opcional)" : ""}
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploading(item.id);
                  onBusyChange(true);
                  setError("");
                  try {
                    const image = await mobileAdminApi.upload(file);
                    change(item.id, { imagePath: image.path });
                  } catch (failure) {
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : "No pudimos subir la imagen.",
                    );
                  } finally {
                    setUploading(null);
                    onBusyChange(false);
                    event.target.value = "";
                  }
                }}
              />
            </label>
            {uploading === item.id ? (
              <p role="status">Subiendo imagen…</p>
            ) : null}
            {item.imagePath ? (
              <div className="space-y-2">
                <img
                  src={new URL(item.imagePath, MARKETPLACE_API_URL).href}
                  alt={item.title.es || "Imagen de la campaña"}
                  className="max-h-48 rounded-lg object-contain"
                />
                {item.kind === "announcement" ? (
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => change(item.id, { imagePath: null })}
                  >
                    Quitar imagen
                  </Button>
                ) : null}
              </div>
            ) : null}
            <label className="block text-sm">
              Destino
              <select
                className="mt-1 block w-full rounded-md border bg-background p-2"
                value={item.destination.kind}
                onChange={(event) =>
                  change(item.id, {
                    destination: {
                      kind: mobileDestinationSchema.shape.kind.parse(
                        event.target.value,
                      ),
                    },
                  })
                }
              >
                {mobileDestinationSchema.shape.kind.options
                  .filter(
                    (destination) =>
                      ["home", "help", "settings", "inbox"].includes(
                        destination,
                      ) ||
                      item.roles.every(
                        (role) =>
                          role ===
                          (destination.startsWith("merchant")
                            ? "merchant"
                            : destination.startsWith("courier")
                              ? "courier"
                              : "customer"),
                      ),
                  )
                  .map((destination) => (
                    <option key={destination} value={destination}>
                      {destinationNames[destination]}
                    </option>
                  ))}
              </select>
            </label>
            {item.destination.kind === "store" ||
            item.destination.kind === "product" ? (
              <MobileDestinationPicker
                kind={item.destination.kind}
                value={item.destination.value}
                onChange={(value) =>
                  change(item.id, {
                    destination: { ...item.destination, value },
                  })
                }
              />
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["startsAt", "Desde (opcional)"],
                  ["endsAt", "Hasta (opcional)"],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="text-sm">
                  {label}
                  <Input
                    type="datetime-local"
                    value={localDate(item[field])}
                    onChange={(event) =>
                      change(item.id, {
                        [field]: event.target.value
                          ? new Date(event.target.value).toISOString()
                          : null,
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Zona horaria: {Intl.DateTimeFormat().resolvedOptions().timeZone}.
            </p>
            <Button
              variant="destructive"
              type="button"
              onClick={() =>
                onChange(items.filter((value) => value.id !== item.id))
              }
            >
              Quitar del borrador
            </Button>
          </fieldset>
        </details>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          disabled={disabled || uploading !== null || items.length >= 100}
          onClick={() => add("campaign")}
        >
          Nueva campaña
        </Button>
        <Button
          variant="outline"
          disabled={disabled || uploading !== null || items.length >= 100}
          onClick={() => add("announcement")}
        >
          Nuevo aviso
        </Button>
      </div>
    </section>
  );
}
