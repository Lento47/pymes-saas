import {
  activeMobileContent,
  formatMoney,
  type MobileConfiguration,
  mobileControlEnabled,
  mobilePreviewSchema,
  type MobileRole,
  MOBILE_CONTROLS,
  MOBILE_HOME_CATEGORY_CONTROLS,
} from "@pymeshub/shared";
import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { useState } from "react";
import { mobileAdminApi } from "@/lib/mobile-admin";
import { MARKETPLACE_API_URL } from "@/lib/marketplace";

type Data = z.infer<typeof mobilePreviewSchema>;
const roles = {
  customer: "Cliente",
  merchant: "Negocio",
  courier: "Repartidor",
} as const;
export function MobileControlPreview({
  configuration,
}: {
  configuration: MobileConfiguration;
}) {
  const [role, setRole] = useState<MobileRole>("customer");
  const [locale, setLocale] = useState<"es" | "en">("es");
  const [businessId, setBusinessId] = useState<string>();
  const [courierUserId, setCourierUserId] = useState<string>();
  const query = useQuery({
    queryKey: ["admin", "mobile", "preview", role, businessId, courierUserId],
    queryFn: () => mobileAdminApi.preview({ role, businessId, courierUserId }),
    staleTime: 60_000,
  });
  const enabled = (id: string) => mobileControlEnabled(configuration, id);
  const data: Data | undefined = query.data;
  const shop =
    data?.shops.find((one) => one.id === businessId) ?? data?.shops[0];
  const courier =
    data?.couriers.find((one) => one.userId === courierUserId) ??
    data?.couriers[0];
  const content = activeMobileContent(configuration, role);
  return (
    <aside
      className="space-y-4 xl:sticky xl:top-6 xl:self-start"
      aria-label="Vista previa móvil"
    >
      <div>
        <h2 className="text-lg font-semibold">
          Vista previa de disponibilidad
        </h2>
        <p className="text-sm text-muted-foreground">
          Datos reales. Las acciones de esta muestra no realizan operaciones.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          Perfil
          <select
            className="mt-1 w-full rounded-md border bg-background p-2"
            value={role}
            onChange={(event) => setRole(event.target.value as MobileRole)}
          >
            {Object.entries(roles).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Idioma
          <select
            className="mt-1 w-full rounded-md border bg-background p-2"
            value={locale}
            onChange={(event) => setLocale(event.target.value as "es" | "en")}
          >
            <option value="es">Español</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      {role === "courier" ? (
        <label className="block text-sm">
          Repartidor
          <select
            className="mt-1 w-full rounded-md border bg-background p-2"
            value={courier?.userId ?? ""}
            onChange={(event) => setCourierUserId(event.target.value)}
          >
            <option value="">Seleccionar…</option>
            {data?.couriers.map((one) => (
              <option key={one.userId} value={one.userId}>
                {one.displayName}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="block text-sm">
          Negocio
          <select
            className="mt-1 w-full rounded-md border bg-background p-2"
            value={shop?.id ?? ""}
            onChange={(event) => setBusinessId(event.target.value)}
          >
            <option value="">Seleccionar…</option>
            {data?.shops.map((one) => (
              <option key={one.id} value={one.id}>
                {one.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div
        className="overflow-hidden rounded-[2rem] border-4 border-muted bg-background"
        lang={locale}
      >
        <div className="space-y-4 p-5">
          <h3 className="break-words text-lg font-semibold">
            {role === "customer"
              ? "PymesHub"
              : role === "merchant"
                ? (shop?.name ?? "Sin negocio en la muestra")
                : (courier?.displayName ?? "Sin repartidor en la muestra")}
          </h3>
          {query.isPending ? (
            <p role="status">Cargando datos…</p>
          ) : query.isError ? (
            <p role="alert">
              No pudimos cargar la vista previa.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void query.refetch()}
              >
                Reintentar
              </button>
            </p>
          ) : (
            <>
              {role === "customer" && enabled("customer.search") ? (
                <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                  {locale === "es"
                    ? "Buscar comercios y productos"
                    : "Search shops and products"}
                </div>
              ) : null}
              {role === "merchant" ? (
                <div className="rounded-xl border p-3 text-sm">
                  <b>
                    {locale === "es" ? "Estado del negocio" : "Shop status"}
                  </b>
                  <p>{shop?.status ?? "—"}</p>
                </div>
              ) : null}
              {role === "courier" ? (
                <div className="rounded-xl border p-3 text-sm">
                  <b>{locale === "es" ? "Disponibilidad" : "Availability"}</b>
                  <p>
                    {courier
                      ? courier.isAvailable
                        ? locale === "es"
                          ? "Disponible"
                          : "Available"
                        : locale === "es"
                          ? "No disponible"
                          : "Unavailable"
                      : "—"}
                  </p>
                  {!enabled("courier.availability") ? (
                    <p className="text-muted-foreground">
                      {locale === "es"
                        ? "Activación pausada"
                        : "Going available is paused"}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {content.map((item) => (
                <div
                  key={item.id}
                  className="space-y-2 overflow-hidden rounded-xl border p-3"
                >
                  {item.imagePath ? (
                    <img
                      src={new URL(item.imagePath, MARKETPLACE_API_URL).href}
                      alt=""
                      className="aspect-video w-full rounded-lg object-cover"
                    />
                  ) : null}
                  <h4 className="font-semibold">{item.title[locale]}</h4>
                  <p className="text-sm">{item.body[locale]}</p>
                  <span className="inline-block rounded-full bg-primary px-3 py-1.5 text-sm text-primary-foreground">
                    {item.button[locale]}
                  </span>
                </div>
              ))}
              {role === "customer" && enabled("categories") ? (
                <div className="flex flex-wrap gap-2" aria-label="Categorías de inicio en la vista previa">
                  {MOBILE_HOME_CATEGORY_CONTROLS
                    .filter((one) => enabled(one.id))
                    .map((one) => (
                      <span
                        key={one.id}
                        className="rounded-full border px-3 py-1 text-xs"
                      >
                        {one.label[locale]}
                      </span>
                    ))}
                </div>
              ) : null}
              {role !== "customer" ? (
                <div className="space-y-2">
                  <h4 className="font-semibold">
                    {locale === "es"
                      ? "Pedidos en la muestra"
                      : "Orders in this sample"}
                  </h4>
                  {data?.orders.length ? (
                    data.orders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border p-3 text-sm"
                      >
                        <b>{order.reference}</b>
                        <p>{order.status}</p>
                        <p>{formatMoney(order.totalMinor, order.currency)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {locale === "es"
                        ? "No hay pedidos en esta muestra."
                        : "No orders in this sample."}
                    </p>
                  )}
                </div>
              ) : null}
              {role === "customer" ||
              (role === "merchant" && enabled("merchant.widget.catalog")) ? (
                <div className="space-y-2">
                  <h4 className="font-semibold">
                    {locale === "es" ? "Productos" : "Products"}
                  </h4>
                  {data?.products.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border p-3 text-sm"
                    >
                      {item.imageUrl ? (
                        <img
                          src={new URL(item.imageUrl, MARKETPLACE_API_URL).href}
                          alt=""
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 break-words">
                        <b>{item.name}</b>
                        <p>{formatMoney(item.priceMinor, item.currency)}</p>
                      </div>
                    </div>
                  ))}
                  {!data?.products.length ? (
                    <p className="text-sm text-muted-foreground">
                      {locale === "es"
                        ? "Sin productos en esta muestra."
                        : "No products in this sample."}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {role === "merchant" ? (
                <div className="flex flex-wrap gap-2">
                  {MOBILE_CONTROLS.filter(
                    (one) =>
                      one.role === "merchant" &&
                      one.kind === "tool" &&
                      enabled(one.id),
                  ).map((one) => (
                    <span
                      key={one.id}
                      className="rounded-lg border px-2 py-1 text-xs"
                    >
                      {one.label[locale]}
                    </span>
                  ))}
                </div>
              ) : null}
              {role === "customer" &&
              (!enabled("customer.newCheckout") ||
                !enabled("merchant.newOrders")) ? (
                <p className="rounded-xl bg-muted p-3 text-sm">
                  {locale === "es"
                    ? "Nuevos pedidos temporalmente pausados. Tus pedidos existentes siguen disponibles."
                    : "New checkout is temporarily paused. Existing orders remain available."}
                </p>
              ) : null}
              {role === "courier" && !enabled("courier.acceptDeliveries") ? (
                <p className="rounded-xl bg-muted p-3 text-sm">
                  {locale === "es"
                    ? "Nuevas entregas pausadas. Puedes completar las entregas aceptadas."
                    : "New deliveries are paused. You can finish accepted deliveries."}
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="flex flex-wrap justify-around gap-2 border-t p-3 text-xs">
          <span>{locale === "es" ? "Inicio" : "Home"}</span>
          {role === "customer" ? (
            <>
              {enabled("customer.search") ? (
                <span>{locale === "es" ? "Buscar" : "Search"}</span>
              ) : null}
              <span>{locale === "es" ? "Pedidos" : "Orders"}</span>
              {enabled("customer.cart") ? (
                <span>{locale === "es" ? "Carrito" : "Cart"}</span>
              ) : null}
            </>
          ) : (
            <span>{locale === "es" ? "Cuenta" : "Account"}</span>
          )}
        </div>
      </div>
    </aside>
  );
}
