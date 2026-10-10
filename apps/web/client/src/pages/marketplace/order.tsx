import { Check, Circle } from "lucide-react";
import { Link, useLocation } from "wouter";

import { EmptyState, ErrorState, money } from "@/components/marketplace/cards";
import { AmberButton, MarketplaceShell } from "@/components/marketplace/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useCancelOrder, useMarketplaceSession, useOrder } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente de confirmación",
  ACCEPTED: "Aceptado",
  PREPARING: "Preparando",
  READY: "Listo",
  OUT_FOR_DELIVERY: "En camino",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  REJECTED: "Rechazado",
};

function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function MarketplaceOrderPage({ id }: { id: string }) {
  const { data: session } = useMarketplaceSession();
  const { data, isLoading, isError, refetch } = useOrder(id);
  const cancelOrder = useCancelOrder();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <MarketplaceShell>
        <Skeleton className="h-64 w-full rounded-xl bg-foreground/[0.07]" />
      </MarketplaceShell>
    );
  }

  if (isError) {
    return (
      <MarketplaceShell>
        <ErrorState message="No pudimos cargar este pedido." onRetry={() => void refetch()} />
      </MarketplaceShell>
    );
  }

  if (!data) {
    return (
      <MarketplaceShell>
        <EmptyState
          title="No encontramos ese pedido."
          description="Puede que el enlace esté vencido o no sea tuyo."
          action={<AmberButton onClick={() => navigate("/orders")}>Ver mis pedidos</AmberButton>}
        />
      </MarketplaceShell>
    );
  }

  const isFinished = data.status === "COMPLETED" || data.status === "CANCELLED" || data.status === "REJECTED";

  return (
    <MarketplaceShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">{data.headline}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.reference} · {formatDate(data.placedAt)}
          </p>
        </div>
        <span className="rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-link">
          {STATUS_LABELS[data.status] ?? data.status}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          <ol className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            {data.events.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-link">
                  <Check aria-hidden="true" className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{STATUS_LABELS[event.status] ?? event.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(event.createdAt)}
                    {event.note ? ` · ${event.note}` : ""}
                  </p>
                </div>
              </li>
            ))}
            {data.events.length === 0 ? (
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Circle aria-hidden="true" className="h-4 w-4" />
                Todavía no hay eventos para este pedido.
              </li>
            ) : null}
          </ol>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Productos</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {data.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    {item.quantity}× {item.name}
                    {item.options.length > 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        {item.options.map((option) => option.name).join(", ")}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0">{money(item.lineTotalMinor, data.currency)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <aside className="flex h-fit flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <Link
              href={`/store/${data.business.slug}`}
              className="text-sm font-semibold text-link hover:text-link/80"
            >
              {data.business.name}
            </Link>
            <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{money(data.totals.subtotalMinor, data.currency)}</dd>
              </div>
              {data.fulfilment === "DELIVERY" ? (
                <div className="flex justify-between">
                  <dt>Envío</dt>
                  <dd>{money(data.totals.deliveryFeeMinor, data.currency)}</dd>
                </div>
              ) : null}
              {data.totals.merchantCoversDelivery ? (
                <p className="text-xs text-muted-foreground">El comercio cubrió tu envío y debe pagar al repartidor.</p>
              ) : null}
              {data.totals.discountMinor > 0 ? (
                <div className="flex justify-between">
                  <dt>Descuento</dt>
                  <dd>-{money(data.totals.discountMinor, data.currency)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-3 text-base font-semibold text-foreground">
                <dt>Total</dt>
                <dd>{money(data.totals.totalMinor, data.currency)}</dd>
              </div>
            </dl>
          </div>

          {data.deliveryAddress ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Entrega</p>
              <p>
                {data.deliveryAddress.line1}, {data.deliveryAddress.city}
              </p>
            </div>
          ) : data.pickupCode ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Retiro en tienda</p>
              <p>
                Código: <span className="font-mono font-semibold text-foreground">{data.pickupCode}</span>
              </p>
            </div>
          ) : null}

          {data.courier ? (
            <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Repartidor</p>
              <p>{data.courier.name ?? "Asignado"}</p>
            </div>
          ) : null}

          {data.canCancel && !isFinished ? (
            <button
              type="button"
              disabled={cancelOrder.isPending}
              onClick={() =>
                cancelOrder.mutate(
                  { orderId: data.id },
                  {
                    onSuccess: () => toast({ title: "Pedido cancelado" }),
                    onError: () => toast({ title: "No pudimos cancelar el pedido", variant: "destructive" }),
                  },
                )
              }
              className={cn(
                "min-h-11 rounded-md border border-destructive/30 px-4 text-sm font-semibold text-destructive transition",
                "hover:bg-destructive/10 disabled:opacity-60",
              )}
            >
              {cancelOrder.isPending ? "Cancelando…" : "Cancelar pedido"}
            </button>
          ) : null}

          {!session ? (
            <p className="text-xs text-muted-foreground">
              <Link href="/sign-in" className="text-link hover:text-link/80">
                Iniciá sesión
              </Link>{" "}
              para ver el detalle completo.
            </p>
          ) : null}
        </aside>
      </div>
    </MarketplaceShell>
  );
}
