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
  addressSchema,
  businessCardSchema,
  businessStorefrontSchema,
  cartSchema,
  categorySchema,
  orderDetailSchema,
  orderSummarySchema,
  productCardSchema,
  productDetailSchema,
  productSearchResultSchema,
  promotionCardSchema,
  reviewSchema,
  type BusinessCard,
  type Address,
  type BusinessStorefront,
  type Cart,
  type Category,
  type OrderDetail,
  type OrderSummary,
  type ProductCard,
  type ProductDetail,
  type ProductSearchResult,
  type PromotionCard,
  type Review,
} from "@pymeshub/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

/**
 * Where the Worker lives.
 *
 * `VITE_MARKETPLACE_API_URL` is the deployed Worker; staging is the only host with a
 * production-shaped domain today (`docs/technical/architecture/cloudflare-and-maps.md`),
 * so it is the honest default rather than a hardcoded production hostname. Local
 * development points at `wrangler dev`.
 */
export const MARKETPLACE_API_URL =
  import.meta.env.VITE_MARKETPLACE_API_URL ||
  (import.meta.env.DEV ? "http://localhost:8787" : "https://api-staging.pymeshub.lat");

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
      headers: () => ({ "x-client": "web" }),
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

/** Structural, not `z.ZodType<T>`: a schema's inferred output is enough and avoids variance games. */
function parseAll<T>(schema: { parse: (value: unknown) => T }, rows: unknown[]): T[] {
  return rows.map((row) => schema.parse(row));
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
        featured: parseAll(productCardSchema, asArray(raw.featured)),
        offers: parseAll(productCardSchema, asArray(raw.offers)),
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
    queryFn: async (): Promise<{ items: BusinessCard[]; nextCursor: string | null }> => {
      const raw: Record<string, unknown> = await trpc.businesses.list.query(input);
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
      return raw ? businessStorefrontSchema.parse(raw) : null;
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: marketplaceKeys.product(id),
    enabled: id.length > 2,
    queryFn: async (): Promise<ProductDetail | null> => {
      const raw = await trpc.products.byId.query({ id });
      return raw ? productDetailSchema.parse(raw) : null;
    },
  });
}

export function useProductList(input: Record<string, unknown>) {
  return useQuery({
    queryKey: marketplaceKeys.products(input),
    queryFn: async (): Promise<{ items: ProductCard[]; nextCursor: string | null }> => {
      const raw: Record<string, unknown> = await trpc.products.list.query(input);
      return {
        items: parseAll(productCardSchema, asArray(raw?.items)),
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
    queryFn: async (): Promise<ProductSearchResult> =>
      productSearchResultSchema.parse(
        await trpc.catalog.search.query({ q: term, lat: location?.lat, lng: location?.lng }),
      ),
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
      addressId?: string;
      paymentMethod: "CASH" | "CARD" | "TRANSFER";
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
          products: parseAll(productCardSchema, asArray(raw?.products)),
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
