/**
 * `@pymeshub/shared` — everything the API and its three clients must agree on.
 *
 * The test for whether something belongs here: *would a disagreement between the
 * server and a client be a bug?* Money formatting, order transitions, cart totals,
 * the shape of a product card — yes, so they live here and are imported rather than
 * reimplemented. Anything with a `D1Database`, a session cookie or a `fetch` in it —
 * no, that is the API's, and the clients get it over tRPC.
 *
 * The package is deliberately runtime-free: zod and plain functions, no bindings, no
 * network, no database. It is imported by a Worker, a React app and a React Native
 * app, so anything Node-shaped would break at least one of the three.
 */

export * from "./ids";
export * from "./money";
export * from "./options";
export * from "./order-state";
export * from "./pagination";
export * from "./ranking";
export * from "./schemas/admin";
export * from "./schemas/analytics";
export * from "./schemas/business";
export * from "./schemas/cart";
export * from "./schemas/catalog";
export * from "./schemas/common";
export * from "./schemas/location";
export * from "./schemas/merchant-home";
export * from "./schemas/notification";
export * from "./schemas/order";
export * from "./schemas/user";
