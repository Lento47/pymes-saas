import { Bike, ChevronRight } from "lucide-react";
import { Link, useLocation } from "wouter";

import { EmptyState, ErrorState, money } from "@/components/marketplace/cards";
import { AmberButton, MarketplaceShell } from "@/components/marketplace/public-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketplaceSession, useMyOrders } from "@/lib/marketplace";
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

const STATUS_TONE: Record<string, string> = {
  COMPLETED: "text-success",
  CANCELLED: "text-muted-foreground",
  REJECTED: "text-destructive",
  OUT_FOR_DELIVERY: "text-link",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

function formatDate(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-CR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function MarketplaceOrdersPage() {
  const { data: session, isLoading: loadingSession } = useMarketplaceSession();
  const { data, isLoading, isError, refetch } = useMyOrders(Boolean(session));
  const [, navigate] = useLocation();

  if (loadingSession || (session && isLoading)) {
    return (
      <MarketplaceShell>
        <Skeleton className="h-48 w-full rounded-xl bg-foreground/[0.07]" />
      </MarketplaceShell>
    );
  }

  if (!session) {
    return (
      <MarketplaceShell>
        <EmptyState
          title="Iniciá sesión para ver tus pedidos."
          action={<AmberButton onClick={() => navigate("/sign-in")}>Ingresar</AmberButton>}
        />
      </MarketplaceShell>
    );
  }

  if (isError) {
    return (
      <MarketplaceShell>
        <ErrorState message="No pudimos cargar tus pedidos." onRetry={() => void refetch()} />
      </MarketplaceShell>
    );
  }

  if (!data || data.length === 0) {
    return (
      <MarketplaceShell>
        <EmptyState
          title="Todavía no hiciste pedidos."
          description="Cuando hagas tu primer pedido, acá vas a poder seguir su estado."
          action={<AmberButton onClick={() => navigate("/")}>Explorar negocios</AmberButton>}
        />
      </MarketplaceShell>
    );
  }

  return (
    <MarketplaceShell>
      <h1 className="mb-4 text-2xl font-semibold tracking-[-0.02em] text-foreground">Mis pedidos</h1>
      <ul className="flex flex-col gap-3">
        {data.map((order) => (
          <li key={order.id}>
            <Link
              href={`/order/${order.id}`}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 transition hover:border-primary/50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-link">
                <Bike aria-hidden="true" className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm font-medium text-foreground">{order.headline}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {order.reference} · {formatDate(order.placedAt)}
                </p>
                <p className={cn("mt-1 text-xs font-medium", STATUS_TONE[order.status] ?? "text-link")}>
                  {statusLabel(order.status)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-foreground">
                  {money(order.totalMinor, order.currency)}
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </MarketplaceShell>
  );
}
