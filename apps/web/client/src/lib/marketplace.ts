/**
 * The public customer marketplace, wired to the Cloudflare Worker in
 * `packages/trpc-api`.
 *
 * PymesHub is a delivery marketplace: a stranger can browse shops and products before
 * signing in, and a signed-in customer gets a cart, orders and favourites. This module is
 * the only place the web app talks to that API, so the two clients (web and mobile) share
 * one contract instead of each inventing its own fetch.
 *
 * ## What is deliberately not imported
 *
 * - `@pymeshub/auth` root — it side-effect imports `@pymeshub/env/load`, which reads the
 *   root `.env` off the filesystem and cannot run in a browser. The subpath
 *   `@pymeshub/auth/marketplace-client` is the dependency-free entry the README points a
 *   web client at.
 * - The Worker's `AppRouter` type — it transitively names `@pymeshub/db` and drizzle, none
 *   of which the web bundle has. Responses are validated with the shared zod schemas
 *   instead, which is the same source of truth the API builds them from.
 *
 * Every read returns a value the shared schemas parse, so a shape drift between the Worker
 * and this client is a caught parse error rather than an `undefined` rendered as `NaN`.
 */

import { createMarketplaceAuthClient } from "@pymeshub/auth/marketplace-client";
import {
  type Address,
  addressSchema,
  type BusinessCard,
  type BusinessStorefront,
  businessCardSchema,
  businessStorefrontSchema,
  type Cart,
  type Category,
  cartSchema,
  cartTotalsSchema,
  categorySchema,
  newRequestId,
  type OrderDetail,
  type OrderSummary,
  orderDetailSchema,
  orderSummarySchema,
  type ProductCard,
  type ProductDetail,
  type ProductSearchResult,
  type PromotionCard,
  productCardSchema,
  productDetailSchema,
  productSearchResultSchema,
  promotionCardSchema,
  type Review,
  reviewSchema,
} from "@pymeshub/shared";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { z } from "zod";
import { reportClientError } from "@/lib/error-reporting";

/**
 * Where the Worker lives.
 *
 * `VITE_MARKETPLACE_API_URL` names the deployed Worker: `apps/web/.env.production`
 * for a production build, and `wrangler dev` locally. There is deliberately **no
 * production fallback**, and that is a correction rather than a style choice.
 *
 * This used to guess `https://api-staging.pymeshub.lat` for any non-dev build. The
 * guess was justified in a comment that has since gone out of date — staging stopped
 * being the only host with a production-shaped domain once `env.production` took
 * `api.pymeshub.lat` — and by the time it was wrong nobody could see it. Production
 * was calling the staging Worker, the staging Worker refused `https://pymeshub.lat`
 * as a browser origin, and because that refusal is a 403 with no `Access-Control-*`
 * headers on it, the browser reported every sign-up as a CORS policy failure. The
 * misconfiguration was invisible from the outside by construction.
 *
 * A build without the variable now stops in `vite.config.ts` instead of shipping.
 * The throw below is the second half of that: if a bundle ever reaches a browser
 * without it, a named error beats a request to whichever host was guessed.
 */
export const MARKETPLACE_API_URL: string = (() => {
	const configured = import.meta.env.VITE_MARKETPLACE_API_URL;
	if (configured) return configured;
	if (import.meta.env.DEV) return "http://localhost:8787";
	throw new Error(
		"VITE_MARKETPLACE_API_URL is not set. The marketplace Worker is a different " +
			"origin from this app and cannot be defaulted to; see apps/web/.env.production.",
	);
})();

/** The auth calls a browser makes. No storage argument: the session is an HttpOnly cookie. */
export const marketplaceAuth = createMarketplaceAuthClient(MARKETPLACE_API_URL);

/**
 * The tRPC link, typed loosely on purpose.
 *
 * The router's own type lives in the Worker package and drags server-only dependencies
 * (drizzle, `@trpc/server`) into the browser graph. `any` here is the price of that; the
 * schemas below are what actually hold the contract, and they run on every response.
 */
// biome-ignore lint/suspicious/noExplicitAny: the Worker router type is server-only; the shape is
// checked by the shared zod schemas on every response instead. The `any` is what lets a page call
// `trpc.catalog.feed.query` without importing the server's router graph into the browser bundle.
export const trpc: any = createTRPCClient<any>({
  links: [
    httpBatchLink({
      url: `${MARKETPLACE_API_URL}/trpc`,
      transformer: superjson,
      headers: () => ({
        "x-client": "web",
        // One id per HTTP request (a batch shares one, server-side included).
        // The API echoes it on the response and stamps its log line with it, so an
        // error the console reports can be grepped in `wrangler tail` by value.
        "x-request-id": newRequestId(),
      }),
      // The browser carries its session in a cookie, so the request must ask for it. The
      // Worker's CORS policy allows exactly this with `credentials: true` and a strict
      // origin allow-list.
      fetch: (input, init) => fetch(input, { ...init, credentials: "include" }),
    }),
  ],
});

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Fill in the availability fields the deployed Worker does not send yet.
 *
 * The shared schema requires `enabled` and `unavailableReason` on every
 * availability object, and `locationScope` on every product card — the API
 * implements the schema's own `availabilityOf()` helper, which produces them,
 * but its SQL projection omits all three. Every product row therefore failed
 * `productCardSchema.parse()`, and every catalog read (feed, product lists,
 * search, favourites, a storefront's featured rail) failed with it: the parse
 * error was a caught rejection, the query rendered as an error or as empty,
 * and the catalog read as broken even though the API had answered.
 *
 * The values derived here are exactly what the API's own helper would have
 * sent for the shape it does return: an available product is enabled with no
 * reason, and a product that reaches a card is not location-gated. When the
 * Worker is fixed to send the fields these defaults become dead branches —
 * `??` falls through to the real value — so nothing has to change here.
 */
function reconcileProductRow(row: unknown): unknown {
  if (typeof row !== "object" || row === null) return row;
  const product = row as Record<string, unknown>;
  const availability = product.availability;
  if (typeof availability !== "object" || availability === null) return row;
  const a = availability as Record<string, unknown>;
  return {
    ...product,
    availability: {
      enabled: a.inStock,
      unavailableReason: a.inStock ? null : "out_of_stock",
      ...a,
    },
    // Only where the row has none: a real value from the API always wins.
    locationScope: product.locationScope ?? "all_locations",
  };
}

/** Structural, not `z.ZodType<T>`: a schema's inferred output is enough and avoids variance games. */
function parseAll<T>(schema: { parse: (value: unknown) => T }, rows: unknown[]): T[] {
  return rows.map((row) => schema.parse(row));
}

/**
 * Product rows, reconciled then parsed.
 *
 * Every catalog surface goes through this rather than a bare `parseAll` on
 * `productCardSchema`, so one schema/Worker drift cannot take the whole grid
 * down again. A single row that still does not parse (a genuinely new field,
 * a corrupted row) is dropped and reported rather than failing the read —
 * one missing card is a smaller failure than an empty catalog.
 */
function parseProducts(schema: { parse: (value: unknown) => ProductCard }, rows: unknown[]): ProductCard[] {
  const out: ProductCard[] = [];
  for (const row of rows) {
    try {
      out.push(schema.parse(reconcileProductRow(row)));
    } catch (error) {
      // Fire-and-forget: a dropped row must not hold up the render, and the
      // report endpoint is the app's own API — an unreachable API already has
      // bigger problems than one missing product card.
      void reportClientError({
        source: "web",
        category: "api",
        severity: "warning",
        title: "Marketplace product row failed schema parse",
        message: error instanceof Error ? error.message : String(error),
        context_json: {
          scope: "marketplace.product_parse",
          productId: typeof (row as Record<string, unknown> | null)?.id === "string"
            ? (row as Record<string, unknown>).id
            : null,
        },
      });
    }
  }
  return out;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function cursorOf(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const marketplaceKeys = {
  feed: (lat?: number, lng?: number) => ["marketplace", "feed", lat ?? null, lng ?? null] as const,
  categories: () => ["marketplace", "categories"] as const,
  businesses: (input: BusinessListInput) => ["marketplace", "businesses", input] as const,
  storefront: (slug: string) => ["marketplace", "storefront", slug] as const,
  product: (id: string) => ["marketplace", "product", id] as const,
  products: (input: Record<string, unknown>) => ["marketplace", "products", input] as const,
  search: (q: string, lat?: number, lng?: number) =>
    ["marketplace", "search", q, lat ?? null, lng ?? null] as const,
  cart: () => ["marketplace", "cart"] as const,
  pickupLocations: () => ["marketplace", "cart", "pickup-locations"] as const,
  quote: (input: { fulfilment: "PICKUP" | "DELIVERY"; locationId?: string; addressId?: string }) => ["marketplace", "cart", "quote", input] as const,
  orders: (role: "CUSTOMER" | "BUSINESS") => ["marketplace", "orders", role] as const,
  order: (id: string) => ["marketplace", "order", id] as const,
  favorites: () => ["marketplace", "favorites"] as const,
  businessReviews: (businessId: string) => ["marketplace", "reviews", businessId] as const,
  session: () => ["marketplace", "session"] as const,
};

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export type Feed = {
  featured: ProductCard[];
  offers: ProductCard[];
  nearby: BusinessCard[];
  promotions: PromotionCard[];
  categories: Category[];
};

export function useFeed(location?: { lat: number; lng: number }) {
  return useQuery({
    queryKey: marketplaceKeys.feed(location?.lat, location?.lng),
    queryFn: async (): Promise<Feed> => {
      const raw: Record<string, unknown> = await trpc.catalog.feed.query({
        lat: location?.lat,
        lng: location?.lng,
        limit: 12,
      });
      return {
        featured: parseProducts(productCardSchema, asArray(raw.featured)),
        offers: parseProducts(productCardSchema, asArray(raw.offers)),
        nearby: parseAll(businessCardSchema, asArray(raw.nearby)),
        promotions: parseAll(promotionCardSchema, asArray(raw.promotions)),
        categories: parseAll(categorySchema, asArray(raw.categories)),
      };
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: marketplaceKeys.categories(),
    queryFn: async (): Promise<Category[]> =>
      parseAll(categorySchema, asArray(await trpc.catalog.categories.query())),
  });
}

export type BusinessListInput = {
  search?: string;
  categoryId?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  openNow?: boolean;
  deliveryOnly?: boolean;
  sort?: "distance" | "rating" | "popular" | "newest" | "best";
  cursor?: string;
  limit?: number;
};

export function useBusinesses(input: BusinessListInput) {
  return useQuery({
    queryKey: marketplaceKeys.businesses(input),
    queryFn: async (): Promise<Paged<BusinessCard>> => {
      const raw: Record<string, unknown> = await trpc.businesses.list.query(input);
      return {
        items: parseAll(businessCardSchema, asArray(raw?.items)),
        nextCursor: cursorOf(raw?.nextCursor),
      };
    },
  });
}

/**
 * The same paging as `useProductListInfinite`, against `businesses.list`.
 *
 * It exists for `/category/:slug`, which draws every shop in a sector and was reading the
 * first 24 while discarding the `nextCursor` the API had already computed — so a category
 * with 30 shops could not be browsed to the end and nothing on the page said so.
 *
 * Everything documented on `useProductListInfinite` applies here unchanged: `cursor` must
 * stay out of the query key or the pages never accumulate, `enabled` is for a caller that
 * has to read something else first, `keepPreviousData` holds the previous rows through a
 * filter change, and a request made while that previous data is still on screen would send
 * the wrong cursor. Only the procedure and the schema differ. Do not pass `cursor` in
 * `input`; the page param supplies it, and it wins the spread either way.
 */
export function useBusinessesInfinite(
  input: BusinessListInput,
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: marketplaceKeys.businesses(input),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Paged<BusinessCard>) => lastPage.nextCursor ?? undefined,
    queryFn: async ({ pageParam }): Promise<Paged<BusinessCard>> => {
      const raw: Record<string, unknown> = await trpc.businesses.list.query({
        ...input,
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
      });
      return {
        items: parseAll(businessCardSchema, asArray(raw?.items)),
        nextCursor: cursorOf(raw?.nextCursor),
      };
    },
  });
}

export function useStorefront(slug: string) {
  return useQuery({
    queryKey: marketplaceKeys.storefront(slug),
    enabled: slug.length > 1,
    queryFn: async (): Promise<BusinessStorefront | null> => {
      const raw = await trpc.businesses.bySlug.query({ slug });
      if (!raw) return null;
      const r = raw as Record<string, unknown>;
      // The featured rail is product rows; reconcile them like every other card.
      return businessStorefrontSchema.parse({
        ...r,
        featured: parseProducts(productCardSchema, asArray(r.featured)),
      });
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: marketplaceKeys.product(id),
    enabled: id.length > 2,
    queryFn: async (): Promise<ProductDetail | null> => {
      const raw = await trpc.products.byId.query({ id });
      if (!raw) return null;
      const parsed = productDetailSchema.safeParse(reconcileProductRow(raw));
      if (parsed.success) return parsed.data;
      // A detail row the schema still refuses is a report, not a broken page:
      // the caller renders its not-found state.
      void reportClientError({
        source: "web",
        category: "api",
        severity: "warning",
        title: "Marketplace product detail failed schema parse",
        message: parsed.error.issues.map((i) => i.path.join(".")).join(", "),
        context_json: { scope: "marketplace.product_detail_parse", productId: id },
      });
      return null;
    },
  });
}

/**
 * One page of a cursor-paged list, as `products.list` and `businesses.list` both answer it.
 *
 * `nextCursor` is `null` at the end of the catalogue rather than merely "not yet": both
 * services read one row more than they serve to decide, so a null is an answer and not an
 * absence. The `use*Infinite` hooks below turn exactly that into `hasNextPage`.
 */
export type Paged<T> = { items: T[]; nextCursor: string | null };

/**
 * A shop's products, a page at a time, narrowed by whatever the caller passes through to
 * `products.list` — `businessId`, `categoryId`, `search`, price bounds.
 *
 * ## Why paged and not one bigger `limit`
 *
 * `products.list` caps `limit` at 50, and the store page used to ask for exactly that and
 * then narrow the result in the browser. A shop with 51 products therefore had one no
 * customer could reach, and the category chips answered from the 50 that happened to load.
 * The cursor to do this properly was already there — nothing on the API side changed.
 *
 * ## Why a plain `useInfiniteQuery` and not the tRPC helper
 *
 * `@trpc/tanstack-react-query`'s `infiniteQueryOptions` owns two keys of an infinite
 * input: it fills `cursor` from the page param — which is what this wants — and it writes
 * **`direction`** itself, `"forward"` or `"backward"`, overwriting whatever the caller
 * passed. That is the reason `productListInput` spells its sort direction `sortDirection`
 * (see the schema, which documents the outage it caused). This module talks to the
 * low-level `createTRPCClient` and so never meets the injected key; the page param is
 * spread in by hand instead.
 *
 * `cursor` is deliberately absent from the query key. The key must be stable across pages
 * or each fetch would open a new cache entry and the pages would never accumulate.
 *
 * `options.enabled` exists for the storefront, which cannot ask for a shop's products
 * until it has read the shop. `businessId` is undefined on that first render, and an
 * unpinned `products.list` is not an empty list — it is every `ACTIVE` product on the
 * marketplace, so the shop page would fire one request it throws away and briefly hold
 * another business's catalogue under this one's name.
 *
 * `keepPreviousData` holds the last pages while the next key resolves. Changing a category
 * chip is not a page load, and swapping a grid for a skeleton on every tap makes the
 * filter feel slower than it is. The caller keeps the stale rows and marks them busy —
 * `store.tsx` dims the grid off `isFetching` and sets `aria-busy`.
 */
export function useProductListInfinite(
  input: Record<string, unknown>,
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: marketplaceKeys.products(input),
    enabled: options.enabled ?? true,
    placeholderData: keepPreviousData,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: Paged<ProductCard>) => lastPage.nextCursor ?? undefined,
    queryFn: async ({ pageParam }): Promise<Paged<ProductCard>> => {
      // `cursor` is added only once there is one. A key present with `undefined` is a key
      // every layer of serialisation has to have an opinion about, and the first page has
      // no cursor to send.
      const raw: Record<string, unknown> = await trpc.products.list.query({
        ...input,
        ...(pageParam === undefined ? {} : { cursor: pageParam }),
      });
      return {
        items: parseProducts(productCardSchema, asArray(raw?.items)),
        nextCursor: cursorOf(raw?.nextCursor),
      };
    },
  });
}

export function useSearch(q: string, location?: { lat: number; lng: number }) {
  const term = q.trim();
  return useQuery({
    queryKey: marketplaceKeys.search(term, location?.lat, location?.lng),
    enabled: term.length > 0,
    queryFn: async (): Promise<ProductSearchResult> => {
      const raw: Record<string, unknown> = await trpc.catalog.search.query({
        q: term,
        lat: location?.lat,
        lng: location?.lng,
      });
      return productSearchResultSchema.parse({
        products: parseProducts(productCardSchema, asArray(raw.products)),
        businesses: parseAll(businessCardSchema, asArray(raw.businesses)),
        categories: parseAll(categorySchema, asArray(raw.categories)),
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Cart (signed in)
// ---------------------------------------------------------------------------

export function useCart(enabled = true) {
  return useQuery({
    queryKey: marketplaceKeys.cart(),
    enabled,
    queryFn: async (): Promise<Cart | null> => {
      try {
        return cartSchema.parse(await trpc.cart.get.query());
      } catch (error) {
        // An anonymous caller gets UNAUTHORIZED. A cart is a signed-in thing; the pages
        // that need one send the customer to sign in rather than showing an error.
        if (isUnauthorized(error)) return null;
        throw error;
      }
    },
  });
}

const pickupLocationSchema = z.object({
  id: z.string(), name: z.string(), isDefault: z.boolean(),
  line1: z.string().nullable(), city: z.string().nullable(),
  lat: z.number().nullable(), lng: z.number().nullable(),
});

export function usePickupLocations(enabled = true) {
  return useQuery({
    queryKey: marketplaceKeys.pickupLocations(),
    enabled,
    queryFn: async () => z.array(pickupLocationSchema).parse(await trpc.cart.pickupLocations.query()),
  });
}

export function useCartQuote(
  input: { fulfilment: "PICKUP" | "DELIVERY"; locationId?: string; addressId?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: marketplaceKeys.quote(input),
    enabled,
    refetchInterval: 15_000,
    queryFn: async () => cartTotalsSchema.parse(await trpc.cart.quote.query(input)),
  });
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      productId: string;
      quantity?: number;
      optionIds?: string[];
      notes?: string;
      onBusinessConflict?: "reject" | "replace";
    }): Promise<Cart> =>
      cartSchema.parse(await trpc.cart.addItem.mutate({ quantity: 1, optionIds: [], ...input })),
    onSuccess: (cart) => qc.setQueryData(marketplaceKeys.cart(), cart),
  });
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cartItemId: string; quantity: number }): Promise<Cart> =>
      cartSchema.parse(await trpc.cart.updateItem.mutate(input)),
    onSuccess: (cart) => qc.setQueryData(marketplaceKeys.cart(), cart),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { cartItemId: string }): Promise<Cart> =>
      cartSchema.parse(await trpc.cart.removeItem.mutate(input)),
    onSuccess: (cart) => qc.setQueryData(marketplaceKeys.cart(), cart),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Cart> => cartSchema.parse(await trpc.cart.clear.mutate()),
    onSuccess: (cart) => qc.setQueryData(marketplaceKeys.cart(), cart),
  });
}

export function useApplyPromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { code: string }): Promise<Cart> =>
      cartSchema.parse(await trpc.cart.applyPromotion.mutate(input)),
    onSuccess: (cart) => qc.setQueryData(marketplaceKeys.cart(), cart),
  });
}

export function useRemovePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<Cart> => cartSchema.parse(await trpc.cart.removePromotion.mutate()),
    onSuccess: (cart) => qc.setQueryData(marketplaceKeys.cart(), cart),
  });
}

/** The refusals a cart write can carry, in the reader's words. */
export function cartErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("CONFLICT")) return "Tu carrito tiene productos de otra tienda.";
  if (isUnauthorized(error)) return "Iniciá sesión para usar el carrito.";
  return "No se pudo actualizar el carrito. Intentá de nuevo.";
}

// ---------------------------------------------------------------------------
// Orders (signed in)
// ---------------------------------------------------------------------------

export function useMyOrders(enabled = true) {
  return useQuery({
    queryKey: marketplaceKeys.orders("CUSTOMER"),
    enabled,
    queryFn: async (): Promise<OrderSummary[] | null> => {
      try {
        const raw: Record<string, unknown> = await trpc.orders.list.query({ role: "CUSTOMER", limit: 20 });
        return parseAll(orderSummarySchema, asArray(raw?.items));
      } catch (error) {
        if (isUnauthorized(error)) return null;
        throw error;
      }
    },
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: marketplaceKeys.order(id),
    enabled: id.length > 2,
    queryFn: async (): Promise<OrderDetail | null> => {
      try {
        const raw = await trpc.orders.byId.query({ id });
        return raw ? orderDetailSchema.parse(raw) : null;
      } catch (error) {
        if (isUnauthorized(error) || isNotFound(error)) return null;
        throw error;
      }
    },
    // A live order moves while the customer watches it. Polling is the honest transport:
    // the Worker also exposes a socket at `/orders/:id/live`, but the web order page reads
    // `orders.byId` the same way the mobile app does.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return false;
      return status === "COMPLETED" || status === "CANCELLED" || status === "REJECTED"
        ? (false as const)
        : 15_000;
    },
  });
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      fulfilment: "PICKUP" | "DELIVERY";
      locationId?: string;
      addressId?: string;
      quoteId?: string;
      expectedTotalMinor?: number;
      paymentMethod: "CASH" | "SINPE_MOVIL";
      tipMinor?: number;
      customerNotes?: string;
      promotionCode?: string;
      clientRequestId: string;
    }): Promise<{ id?: string }> => await trpc.orders.place.mutate(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: marketplaceKeys.cart() });
      void qc.invalidateQueries({ queryKey: marketplaceKeys.orders("CUSTOMER") });
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; reason?: string }) => trpc.orders.cancel.mutate(input),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: marketplaceKeys.order(variables.orderId) });
      void qc.invalidateQueries({ queryKey: marketplaceKeys.orders("CUSTOMER") });
    },
  });
}

// ---------------------------------------------------------------------------
// Favourites (signed in)
// ---------------------------------------------------------------------------

export function useFavorites(enabled = true) {
  return useQuery({
    queryKey: marketplaceKeys.favorites(),
    enabled,
    queryFn: async (): Promise<{ businesses: BusinessCard[]; products: ProductCard[] } | null> => {
      try {
        const raw: Record<string, unknown> = await trpc.favorites.list.query();
        return {
          businesses: parseAll(businessCardSchema, asArray(raw?.businesses)),
          products: parseProducts(productCardSchema, asArray(raw?.products)),
        };
      } catch (error) {
        if (isUnauthorized(error)) return null;
        throw error;
      }
    },
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      businessId?: string;
      productId?: string;
    }): Promise<{ favorited: boolean }> => await trpc.favorites.toggle.mutate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketplaceKeys.favorites() }),
  });
}

// ---------------------------------------------------------------------------
// Reviews (public read)
// ---------------------------------------------------------------------------

export function useBusinessReviews(businessId: string) {
  return useQuery({
    queryKey: marketplaceKeys.businessReviews(businessId),
    enabled: businessId.length > 2,
    queryFn: async (): Promise<Review[]> => {
      const raw: Record<string, unknown> = await trpc.reviews.list.query({ businessId, limit: 20 });
      return parseAll(reviewSchema, asArray(raw?.items));
    },
  });
}

// ---------------------------------------------------------------------------
// Addresses (signed in)
// ---------------------------------------------------------------------------

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: ["marketplace", "addresses"] as const,
    enabled,
    queryFn: async (): Promise<Address[] | null> => {
      try {
        return parseAll(addressSchema, asArray(await trpc.users.addresses.query()));
      } catch (error) {
        if (isUnauthorized(error)) return null;
        throw error;
      }
    },
  });
}

export function useSaveAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => await trpc.users.saveAddress.mutate(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketplace", "addresses"] }),
  });
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export type MarketplaceUser = { userId: string; email: string | null };

export function useMarketplaceSession() {
  return useQuery({
    queryKey: marketplaceKeys.session(),
    queryFn: async (): Promise<MarketplaceUser | null> => {
      const session = await marketplaceAuth.currentSession();
      return session ? { userId: session.userId, email: session.email } : null;
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Shared error helpers
// ---------------------------------------------------------------------------

function httpStatusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const data = (error as { data?: { httpStatus?: unknown } }).data;
  return typeof data?.httpStatus === "number" ? data.httpStatus : null;
}

function isUnauthorized(error: unknown): boolean {
  return httpStatusOf(error) === 401;
}

function isNotFound(error: unknown): boolean {
  return httpStatusOf(error) === 404;
}
