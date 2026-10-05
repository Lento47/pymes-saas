import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { type AdminProductRow, adminApi } from "@/lib/admin";
import { DateRangeFilter, useDateRange } from "./console-date-range";
import { TablePager } from "./console-pager";
import { EmptyState, QueryErrorState } from "./console-states";
import { useAdminPage } from "./use-admin-page";

/**
 * The catalogue: what the marketplace is actually showing.
 *
 * ## Why this tab exists at all
 *
 * `admin.products`, `admin.promotions` and `admin.courierInvites` were working procedures that
 * **nothing in the console called**. Three lists the platform maintained, cost a query to
 * serve, and showed to nobody.
 *
 * Products are the urgent one. A product is the thing a customer sees and pays for, and until
 * this tab the only way to find a mispriced or inappropriate one was to know its id already —
 * or to hear about it from a merchant. `product.unpublish` was in `ADMIN_ACTIONS` *and* in
 * `REASON_REQUIRED_ACTIONS` the entire time, which means the platform had a written policy
 * about taking a product down, a reason requirement nobody could satisfy, and no button.
 *
 * The three sub-lists are switchable rather than three tabs because they answer one question —
 * "what is live right now" — and an operator checking that does not want three route changes.
 * Each keeps its own query key, so switching does not refetch what is already loaded.
 *
 * **Reviews are deliberately not here.** `admin.reviews` is a moderation surface with a real
 * job to do, and it wants a *moderation* decision — hide, warn, escalate — rather than a fourth
 * read-only list bolted onto a tab about the catalogue. Half of it is better than none, and
 * the other half done badly is worse than none. It is listed here as the remaining gap rather
 * than quietly omitted.
 */
type CatalogueView = "products" | "promotions" | "invites";

const VIEWS: { value: CatalogueView; label: string }[] = [
  { value: "products", label: "Productos" },
  { value: "promotions", label: "Promociones" },
  { value: "invites", label: "Invitaciones" },
];

export function CatalogueTab() {
  const [view, setView] = useState<CatalogueView>("products");

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Qué lista del catálogo ver"
        className="inline-flex gap-1 rounded-lg border border-border bg-transparent p-1"
      >
        {VIEWS.map((option) => (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={view === option.value}
            className={`rounded-md px-3 py-1 text-xs transition-colors ${
              view === option.value
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setView(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {view === "products" ? <ProductsList /> : null}
      {view === "promotions" ? <PromotionsList /> : null}
      {view === "invites" ? <InvitesList /> : null}
    </div>
  );
}

/**
 * Products, and the one button that makes this tab matter.
 *
 * The unpublish control is offered **only on an `ACTIVE` product**. The same reasoning as the
 * Personas row: offering an action that would be refused means writing an audit entry claiming
 * something was done when it was not, and `unpublishProduct` returns early on an already
 * `ARCHIVED` row without noticing.
 */
function ProductsList() {
  const [search, setSearch] = useState("");
  const dates = useDateRange();

  const page = useAdminPage<AdminProductRow>({
    queryKey: [search, dates.from, dates.to],
    queryFn: ({ cursor, limit }) =>
      adminApi.products({
        search: search || undefined,
        from: dates.range.from,
        to: dates.range.to,
        cursor,
        limit,
      }),
  });

  const { data, isPending, isSettling, isError, isFetching, error, refetch } = page;

  if (isPending || isSettling) return <div className="h-64 w-full animate-pulse rounded-md bg-muted" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar los productos."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            page.reset();
          }}
          placeholder="Buscar por producto o comercio"
          aria-label="Buscar productos"
          className="max-w-xs rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <DateRangeFilter range={dates} onChange={page.reset} column="alta" />
      </div>

      <p className="text-xs text-muted-foreground">{data.total} en total</p>

      {data.rows.length === 0 ? (
        <EmptyState message="No hay productos." hint="Aparecen en cuanto un comercio publica algo." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.rows.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{product.name}</span>
                  {/*
                    `ACTIVE`, not `PUBLISHED`. `PRODUCT_STATUSES` is
                    `ACTIVE | DRAFT | ARCHIVED`, and "archive" is what `unpublishProduct`
                    actually writes — so a product the platform has pulled is `ARCHIVED`,
                    not some fourth state.
                  */}
                  <span className="text-xs text-muted-foreground">
                    {product.status === "ACTIVE" ? "En el mercado" : product.status}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {product.businessName}
                  {product.categoryName ? ` · ${product.categoryName}` : ""}
                  {product.ratingCount > 0
                    ? ` · ★ ${product.ratingAvg.toFixed(1)} (${product.ratingCount})`
                    : " · sin reseñas"}
                </div>
              </div>

              <div className="text-right text-sm tabular-nums">
                {new Intl.NumberFormat("es-CR", {
                  style: "currency",
                  currency: product.currency,
                }).format(product.priceMinor / 100)}
                <div className="text-xs text-muted-foreground">{product.soldCount} vendidos</div>
              </div>

              {product.status === "ACTIVE" ? (
                <UnpublishButton productId={product.id} productName={product.name} />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <TablePager
        offset={page.offset}
        total={page.total}
        pageSize={page.pageSize}
        atFirstPage={page.atFirstPage}
        atLastPage={page.atLastPage}
        onPrevious={page.previous}
        onNext={page.next}
        label="productos"
      />
    </div>
  );
}

/**
 * Taking a product off the marketplace.
 *
 * `product.unpublish` is in `REASON_REQUIRED_ACTIONS`, so the reason is mandatory — the
 * dialog asks for it and the server refuses without one. The text says the product goes off the
 * marketplace and that the merchant can republish, because an operator pressing this on a
 * mispriced item needs to know it is reversible *from the merchant's side* even though nothing
 * here reverses it.
 */
function UnpublishButton({ productId, productName }: { productId: string; productName: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /**
   * A real `useMutation`, not a hand-rolled `try`/`catch` with a reload.
   *
   * The first version of this button ended with `window.location.reload()`. That works and it
   * is wrong: it throws away the whole application — the operator's place in the catalogue
   * list, their search, their page — to refresh one row, and it does it over the network on
   * every unpublish. `invalidateQueries` is what every other action in this console does, and
   * the row disappears from under the button on its own because the list refetches.
   */
  const unpublish = useMutation({
    mutationFn: (why: string) => adminApi.unpublishProduct(productId, why),
    onSuccess: async () => {
      setOpen(false);
      setReason("");
      toast({
        title: "Producto retirado",
        description: `${productName} ya no aparece en el mercado. El comercio puede volverlo a publicar.`,
      });
      await queryClient.invalidateQueries();
    },
    onError: (error: Error) =>
      toast({
        title: "No se pudo retirar",
        description: error.message,
        variant: "destructive",
      }),
  });

  function run() {
    if (reason.trim().length === 0) {
      toast({ title: "Falta el motivo", description: "El motivo va al registro de auditoría.", variant: "destructive" });
      return;
    }
    unpublish.mutate(reason.trim());
  }

  const busy = unpublish.isPending;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Retirar del mercado: ${productName}`}
        className="rounded-md border border-border px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
      >
        Retirar
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Retirar ${productName} del mercado`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-background p-5">
            <div>
              <h2 className="font-medium">Retirar del mercado: {productName}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Deja de aparecer en el mercado al instante. El comercio puede volverlo a
                publicar por su cuenta. Queda registrado en Auditoría con tu nombre y el motivo.
              </p>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs text-muted-foreground">Motivo</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                // No `autoFocus`: the operator has just clicked "Retirar", and the dialog
                // title already says which product — focusing the reason field is a courtesy
                // the lint rule (rightly) flags as a cursor-jump they did not ask for. They
                // can tab to it, and the dialog traps focus either way.
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-md border border-border px-3 py-1.5 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy}
                className="rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground disabled:opacity-50"
              >
                {busy ? "Retirando…" : "Retirar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * Promotions: the discount codes live across every tenant.
 *
 * Read-only on purpose. `admin.promotions` is a query and there is no procedure to disable a
 * code, so a button here would have nowhere to go. The column that matters is
 * `redemptions / maxRedemptions` — an exhausted or over-subscribed promotion is the thing an
 * operator is looking for, and it is the reason this list is worth having at all.
 */
function PromotionsList() {
  const [search, setSearch] = useState("");

  const page = useAdminPage({
    queryKey: [search],
    queryFn: ({ cursor, limit }) =>
      adminApi.promotions({ search: search || undefined, cursor, limit }),
  });

  const { data, isPending, isSettling, isError, isFetching, error, refetch } = page;

  if (isPending || isSettling) return <div className="h-64 w-full animate-pulse rounded-md bg-muted" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar las promociones."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          page.reset();
        }}
        placeholder="Buscar por código o comercio"
        aria-label="Buscar promociones"
        className="max-w-xs rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="text-xs text-muted-foreground">{data.total} en total</p>

      {data.rows.length === 0 ? (
        <EmptyState message="No hay promociones." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.rows.map((promotion) => {
            const capped = promotion.maxRedemptions !== null;
            const used = promotion.redemptions;
            const exhausted = capped && used >= (promotion.maxRedemptions ?? 0);
            return (
              <li key={promotion.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {promotion.code}
                    </code>
                    <span className="text-xs text-muted-foreground">{promotion.kind}</span>
                    {promotion.isActive ? null : (
                      <span className="text-xs text-muted-foreground">inactiva</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{promotion.businessName}</div>
                </div>

                {/*
                  The redemption count is the reason this list earns its place, and it is
                  drawn as the fraction it is rather than as a bare number: "50" beside
                  "máx. 20" is a problem an operator has to notice, and "50 / 20" is not.
                */}
                <div
                  className={`text-right text-sm tabular-nums ${
                    exhausted ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {used}
                  {promotion.maxRedemptions === null ? " usos" : ` / ${promotion.maxRedemptions}`}
                  {exhausted ? <div className="text-xs">agotada</div> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TablePager
        offset={page.offset}
        total={page.total}
        pageSize={page.pageSize}
        atFirstPage={page.atFirstPage}
        atLastPage={page.atLastPage}
        onPrevious={page.previous}
        onNext={page.next}
        label="promociones"
      />
    </div>
  );
}

/**
 * Courier invitations: the codes a business hands out.
 *
 * An invitation row is a **credential** — the code is what lets somebody become a courier — so
 * only the state and the expiry are shown here. The code itself is not drawn, because this tab
 * has no reason to be a place an operator copies one from; the business is the only party that
 * needs it, and it issued it.
 */
function InvitesList() {
  const [search, setSearch] = useState("");

  const page = useAdminPage({
    queryKey: [search],
    queryFn: ({ cursor, limit }) =>
      adminApi.courierInvites({ search: search || undefined, cursor, limit }),
  });

  const { data, isPending, isSettling, isError, isFetching, error, refetch } = page;

  if (isPending || isSettling) return <div className="h-64 w-full animate-pulse rounded-md bg-muted" />;
  if (isError) {
    return (
      <QueryErrorState
        error={error}
        fallback="No se pudieron cargar las invitaciones."
        onRetry={() => void refetch()}
        isRetrying={isFetching}
      />
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          page.reset();
        }}
        placeholder="Buscar por comercio o repartidor"
        aria-label="Buscar invitaciones"
        className="max-w-xs rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <p className="text-xs text-muted-foreground">{data.total} en total</p>

      {data.rows.length === 0 ? (
        <EmptyState message="No hay invitaciones." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.rows.map((invite) => {
            const expired = invite.expiresAt.getTime() < Date.now();
            return (
              <li key={invite.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{invite.courierName}</div>
                  <div className="text-xs text-muted-foreground">{invite.businessName}</div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{invite.status}</div>
                  <div>
                    {expired && invite.status === "PENDING"
                      ? "expirada"
                      : `vence ${invite.expiresAt.toISOString().slice(0, 10)}`}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TablePager
        offset={page.offset}
        total={page.total}
        pageSize={page.pageSize}
        atFirstPage={page.atFirstPage}
        atLastPage={page.atLastPage}
        onPrevious={page.previous}
        onNext={page.next}
        label="invitaciones"
      />
    </div>
  );
}