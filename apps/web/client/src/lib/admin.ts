import {
  type AdminAction,
  type AdminApprovalCounts,
  type AdminBusinessDetail,
  type AdminBusinessRow,
  type AdminCourierListInput,
  type AdminCourierRow,
  type AdminListInput,
  type AdminMetrics,
  type AdminOrderRow,
  type AdminSubscription,
  type AdminSupportTicketDetail,
  type AdminSupportTicketListInput,
  type AdminSupportTicketRow,
  type AdminUserRow,
  type AuditLogEntry,
  adminActionSchema,
  adminApprovalCountsSchema,
  adminBusinessDetailSchema,
  adminBusinessRowSchema,
  adminCategoryInput,
  adminCourierListInput,
  adminCourierRowSchema,
  adminDeleteCategoryInput,
  adminListInput,
  adminMetricsSchema,
  adminOrderRowSchema,
  adminSubscriptionSchema,
  adminSubscriptionsInput,
  adminSupportTicketDetailSchema,
  adminSupportTicketListInput,
  adminSupportTicketRowSchema,
  adminUserRowSchema,
  auditLogEntrySchema,
  BUSINESS_STATUSES,
  type BusinessStatus,
  COURIER_VERIFICATION_STATUSES,
  type CourierVerificationStatus,
  categorySchema,
  createPriceBookInput,
  PLANS,
  REASON_MIN_LENGTH,
  REASON_REQUIRED_ACTIONS,
  recordPaymentInput,
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
  TICKET_CATEGORY,
  TICKET_STATUS,
  type TicketCategory,
  type TicketStatus,
  type UserProfile,
  userProfileSchema,
} from "@pymeshub/shared";

import { z } from "zod";

import { trpc } from "./marketplace";

/**
 * The platform console's client — `trpc.admin.*`, and nothing else.
 *
 * ## Why this exists next to `marketplace.ts` and not inside it
 *
 * The storefront's client is `lib/marketplace.ts` and it talks to the **marketplace**
 * Worker. So does this one — but through a different door, and the difference is the whole
 * point of this file: `adminProcedure` checks `isAdmin` on the caller's own row and nothing
 * else. There is no `admin` capability to hold, no second token, no separate service.
 *
 * **This is now the only admin surface, and the reason is worth stating plainly.**
 *
 * There used to be two. The other was the NestJS service in `apps/api`, reached through
 * `lib/api.ts` under `/api/*`, and it administered the *SaaS* — workspaces, SAML, members,
 * the landing page, router metrics. **It is not deployed.** Railway is gone, this Worker
 * mounts `/trpc`, `/auth`, `/uploads` and nothing under `/api/*`, and `api.pymeshub.com`
 * does not resolve. Those seven admin pages are deleted, as is `PlatformAdminLayout`.
 *
 * An earlier version of this comment said the opposite — that the SaaS API was deployed and
 * the pages worked, citing `apps/api/railway.json`, `deploy-railway.yml` and
 * `.env.production.example`. All three are stale files, not deployment. That was wrong, and
 * it was the kind of wrong that keeps dead code alive: I read it, believed it, and spent
 * several commits reasoning from it before a DNS lookup settled it. `App.tsx` carries the
 * same correction at the `/admin` redirect.
 *
 * Two dead consumers of `api.platform*` survive and are not this file's business:
 * `pages/settings/platform.tsx`, and one call in `components/playground/PlaygroundBoard.tsx`.
 *
 * ## Why every response is parsed
 *
 * `marketplace.ts` types the client as `any` on purpose: the Worker router's own type drags
 * drizzle and `@trpc/server` into the browser graph. That trade is only sound if something
 * else holds the contract, and this file is that something — the shared zod schemas run on
 * every row before a component sees it, so a renamed field is a thrown error at the
 * boundary rather than `undefined` in a table cell.
 *
 * ## The audit log is not optional
 *
 * Every mutation the Worker exposes here writes an `audit_log` row with the actor and the
 * before/after values, and the actions in `REASON_REQUIRED_ACTIONS` refuse without a
 * reason — enforced in the service, so it cannot be skipped by a caller that goes straight
 * to the service. That is why the mutations here take a `reason` and why `needsReason` is
 * exported: the console is the only place those two guarantees become visible to a person,
 * and a button that silently does nothing is how they get lost.
 */

/**
 * Actions the service refuses without a reason — **imported, not copied**.
 *
 * This used to be a second, hand-written copy of `REASON_REQUIRED_ACTIONS` in
 * `@pymeshub/shared`, and it had drifted in both directions:
 *
 * - it was **missing** `subscription.record_payment` and `subscription.create_price_book`,
 *   so the console never asked for a reason on a payment or a price rise — the two acts
 *   that move money — and the server refused one of them anyway, after the round trip;
 * - it carried `order.refund`, an action no procedure implements, and `category.delete`,
 *   which the server did not require, so the console collected a reason for a category
 *   deletion and the service wrote `reason: null`.
 *
 * Syncing the copy would have fixed today's mismatch and left the mechanism that produced
 * it, so the copy is gone. `needsReason` now answers from the one list the services
 * enforce, and an action added there shows a dialog here the day it is named.
 */
export { REASON_REQUIRED_ACTIONS };

/** Whether the console must ask for a reason before sending this action. */
export function needsReason(action: AdminAction): boolean {
	return REASON_REQUIRED_ACTIONS.includes(action);
}

/** The cursor `adminListInput` takes is an encoded offset, per the router's own note. */
function page(input: Partial<AdminListInput> & { limit?: number } = {}) {
  return adminListInput.parse({ limit: 25, ...input });
}

/**
 * A page of rows plus the total, which is what every admin table renders its footer from.
 */
export interface Page<T> {
  rows: T[];
  total: number;
  /** Present when there are more rows after this one. */
  cursor?: string;
}

/**
 * Validate a `{ rows, total }` answer, one row at a time.
 *
 * **Not** `z.object({ rows: z.array(rowSchema) })` from *this* package's `zod`, and the
 * reason is a version split: `apps/web` resolves `zod@^4.4.3` and `@pymeshub/shared`
 * resolves `^4.6.5`. Both are v4, but they are two copies in the graph, so the shared
 * schema's type is not assignable to this package's `ZodType` — a composite built here
 * fails to type-check even though it would run. Calling `.parse` on the shared schema
 * itself uses the copy it was built with, and needs no bridge.
 */
function pageOf<T>(schema: { parse: (value: unknown) => T }): (value: unknown) => Page<T> {
  return (value) => {
    const raw = value as { rows?: unknown[]; total?: number };
    return {
      rows: (raw.rows ?? []).map((row) => schema.parse(row)),
      total: typeof raw.total === "number" ? raw.total : 0,
    };
  };
}

const businessList = pageOf(adminBusinessRowSchema);
const userList = pageOf(adminUserRowSchema);
const orderList = pageOf(adminOrderRowSchema);
const auditList = pageOf(auditLogEntrySchema);
const courierList = pageOf(adminCourierRowSchema);
const ticketList = pageOf(adminSupportTicketRowSchema);
const subscriptionList = pageOf(adminSubscriptionSchema);

/**
 * One price book, as `subscriptions.priceBooks` returns it: the row plus the two flags the
 * service derives from `effectiveFrom` against the clock.
 *
 * **Declared here rather than imported, and this is the one exception to the rule above.**
 * The version split only bites when a schema built in `@pymeshub/shared` has to satisfy a
 * type from this package's `zod`; a schema built *in* this file from this file's `zod` has
 * no cross-package boundary to cross, so it composes normally. And it has to be local
 * because `@pymeshub/shared` exports no price-book schema at all — the service returns a
 * spread of the `price_book` row and the console is its only reader.
 */
const priceBookRowSchema = z.object({
  id: z.string(),
  label: z.string(),
  weeklyMinor: z.number().int(),
  monthlyMinor: z.number().int(),
  effectiveFrom: z.date(),
  createdAt: z.date(),
  /** True once the book's date has arrived. */
  isCurrent: z.boolean(),
  /** True for a book dated in the future: staged, charging nobody yet. */
  isStaged: z.boolean(),
});
export type PriceBookRow = z.infer<typeof priceBookRowSchema>;

/** A bare list, for the procedures that answer with an array and no total. */
function listOf<T>(schema: { parse: (value: unknown) => T }): (value: unknown) => T[] {
  return (value) => (Array.isArray(value) ? value : []).map((row) => schema.parse(row));
}

const categoryList = listOf(categorySchema);
const priceBookList = listOf(priceBookRowSchema);

/**
 * Everything below is one procedure per call, named after the router.
 *
 * The parses are `parse`, not `safeParse`, and that is deliberate: a response that does not
 * match its own schema is a bug in the API, and swallowing it would render an empty table
 * that looks like "no businesses exist". It should be loud.
 */
export const adminApi = {
  /**
   * Who the session belongs to, and whether that session is an admin.
   *
   * This is the console's gate, and it reads `users.me` rather than anything under
   * `trpc.admin` on purpose. `adminProcedure` answers a non-admin with a 403 and a
   * sentence, which is the right answer to a request and the wrong answer to a
   * *question* — "are you allowed in?" is a yes/no, and it is answerable from a procedure
   * every signed-in caller may already make. Asking `admin.metrics` instead would render
   * the console's own error state as the permission screen.
   *
   * It is the same `isAdmin` the Worker checks, so the two can never disagree: there is
   * one flag, read in two places, and the server's copy is the one that decides.
   */
  viewer: async (): Promise<UserProfile> =>
    userProfileSchema.parse(await trpc.users.me.query()),

  metrics: async (): Promise<AdminMetrics> =>
    adminMetricsSchema.parse(await trpc.admin.metrics.query()),

  /**
   * Queue depth, for the badge and the default tab — not for a dashboard.
   *
   * Parsed like every other read here, because the client is typed `any` on purpose and this
   * file is what holds the contract. Two integers is exactly the case where a silent shape
   * change matters: a missing field would render a badge reading `NaN` rather than throwing.
   */
  approvalCounts: async (): Promise<AdminApprovalCounts> =>
    adminApprovalCountsSchema.parse(await trpc.admin.approvalCounts.query()),

  // ── Businesses, and the verification queue ────────────────────────────────

  businesses: async (
    input: Partial<AdminListInput> & { status?: BusinessStatus[] } = {},
  ): Promise<Page<AdminBusinessRow>> =>
    businessList(await trpc.admin.businesses.query(page(input))),

  /**
   * One business in full: the row, its ten most recent orders and the audit entries that
   * touched it.
   *
   * Parsed as the **envelope** the router answers with, not as the row. `admin.business`
   * returns `{ business, recentOrders, auditLog }`, and parsing that object against
   * `adminBusinessRowSchema` throws a `ZodError` for every business on the platform —
   * which is what it did, so the detail sheet could only ever render its error state.
   */
  business: async (id: string): Promise<AdminBusinessDetail> =>
    adminBusinessDetailSchema.parse(await trpc.admin.business.query({ id })),

  /**
   * The approvals queue, expressed as a filter rather than its own endpoint.
   *
   * `metrics.businesses.pendingVerification` is the count this badges, and the list is the
   * same `businesses` query filtered to `DRAFT` — an unverified shop is a draft that has
   * asked to be seen. One query, two views, and no way for the count and the list to
   * disagree.
   *
   * The ordering is a parameter, and it is here rather than hardcoded because the queue is
   * the one table where **oldest first** is the ordering an operator wants: a shop that
   * asked to be seen three weeks ago is the one that has been waiting, and `newest` puts
   * it at the bottom. The default stays `newest` because the schema's default is
   * `newest` and a helper that silently disagreed with it would be a second thing to know.
   */
  pendingVerifications: async (
    input: Partial<Pick<AdminListInput, "sort" | "direction">> = {},
  ): Promise<Page<AdminBusinessRow>> =>
    adminApi.businesses({
      status: ["DRAFT"],
      sort: "newest",
      direction: "desc",
      ...input,
    }),

  // ── Users ────────────────────────────────────────────────────────────────

  users: async (input: Partial<AdminListInput> = {}): Promise<Page<AdminUserRow>> =>
    userList(await trpc.admin.users.query(page(input))),

  // ── Orders ───────────────────────────────────────────────────────────────

  orders: async (input: Partial<AdminListInput> = {}): Promise<Page<AdminOrderRow>> =>
    orderList(await trpc.admin.orders.query(page(input))),

  // ── Couriers, and the second approvals queue ─────────────────────────────

  /**
   * Courier profiles, filtered by verification state.
   *
   * The courier queue is a separate list from the shop queue and it is a separate call,
   * not a filter on `businesses`: a courier is a person on the `user` table with a
   * `courier_profile` beside them, not a shop, and the two have no shared primary key to
   * pivot on. `status: "PENDING"` is the queue the console opens on, for the same reason
   * the shop queue is first — an unreviewed courier is a courier who cannot take a run.
   */
  couriers: async (input: Partial<AdminCourierListInput> = {}): Promise<Page<AdminCourierRow>> =>
    courierList(await trpc.admin.courierProfiles.query(adminCourierListInput.parse(input))),

  pendingCouriers: async (): Promise<Page<AdminCourierRow>> =>
    adminApi.couriers({ status: "PENDING" }),

  // ── The support desk ─────────────────────────────────────────────────────
  //
  // These are the 12-procedure gap: `courierProfiles`, `reviewCourier` and the four
  // `support*` procedures exist in the tree but were not in the deployed Worker, so every
  // call here 404s until the next deploy. They are written against the shipped contract
  // rather than left out, because the contract is in the tree and the deploy is a
  // separate, reversible act.

  supportTickets: async (
    input: Partial<AdminSupportTicketListInput> = {},
  ): Promise<Page<AdminSupportTicketRow>> =>
    ticketList(await trpc.admin.supportTickets.query(adminSupportTicketListInput.parse(input))),

  /**
   * One ticket and its whole thread, with both names an operator needs to answer.
   *
   * The names come with the ticket rather than being looked up on demand because the thread
   * is where the work happens, and a thread headed only by a `usr_…` id is a thread the
   * operator has to leave in order to reply.
   */
  supportTicket: async (ticketId: string): Promise<AdminSupportTicketDetail> =>
    adminSupportTicketDetailSchema.parse(
      await trpc.admin.supportTicket.query({ ticketId }),
    ),

  // ── Billing ──────────────────────────────────────────────────────────────
  //
  // The platform's whole money surface, and the reason the router says "there is no
  // settlement now". The consumer pays the merchant and the courier; the platform charges a
  // flat subscription. So this is not a payouts table — it is an arrears table, and the
  // default sort is `arrears` for that reason: someone opening it is looking for debt.

  subscriptions: async (
    input: Partial<{
      search: string;
      status: SubscriptionStatus;
      sort: "arrears" | "periodEnd" | "businessName";
    }> = {},
  ): Promise<Page<AdminSubscription>> =>
    subscriptionList(await trpc.admin.subscriptions.query(adminSubscriptionsInput.parse(input))),

  /**
   * Recording that a merchant paid.
   *
   * `amountMinor` **is** the money received and the service records it, so this is the
   * operator's statement of fact rather than a field the API discards. It used to be
   * discarded: `recordSubscriptionPayment` ignored it and passed the invoice instead, which
   * also disabled the callee's own comparison — so a miscount could be typed into the
   * console and silently produce a correct-looking record.
   *
   * `reference` is the bank's or SINPE's and is **required**: it is the only thing that
   * makes the payment reconcileable later, and it lives in the audit entry rather than a
   * column of its own.
   *
   * `reason` is required — `subscription.record_payment` is in `REASON_REQUIRED_ACTIONS` —
   * and the schema says so, which it did not. That gap is why the ordinary exact-amount
   * payment was the one case the API rejected.
   */
  recordPayment: (input: {
    subscriptionId: string;
    amountMinor: number;
    reference: string;
    reason: string;
  }) => trpc.admin.recordPayment.mutate(recordPaymentInput.parse(input)),

  // ── Price books ──────────────────────────────────────────────────────────
  //
  // "Raise the price as the app grows" is a row, not a setting. `effectiveFrom` is
  // required and a past date is refused server-side, because a book dated last week would
  // reprice every merchant who joined since — the one outcome the design prevents. The
  // console asks for a date and lets the service refuse the past, rather than second-guess
  // it with a `min` that would silently disagree about the boundary.
  //
  // `reason` is required, and it was missing here as well as in the input schema: the
  // console staged a price rise — the most consequential act on this screen — without ever
  // asking why, and nothing server-side asked either. Both halves are now the one rule in
  // `REASON_REQUIRED_ACTIONS`, and the minimum length is `REASON_MIN_LENGTH` so the field
  // cannot be looser here than the API is.

  priceBooks: async (): Promise<PriceBookRow[]> =>
    priceBookList(await trpc.admin.priceBooks.query()),

  createPriceBook: (input: {
    label: string;
    weeklyMinor: number;
    monthlyMinor: number;
    effectiveFrom: Date;
    reason: string;
  }) => trpc.admin.createPriceBook.mutate(createPriceBookInput.parse(input)),

  // ── Catalogue taxonomy ───────────────────────────────────────────────────

  categories: async () => categoryList(await trpc.admin.categories.query()),

  /**
   * Create or edit. **No `id` means create** — the same input schema does both, and that
   * is the service's choice, so the console sends an absent `id` rather than an empty one.
   */
  saveCategory: (input: {
    id?: string;
    name: string;
    nameEn?: string | null;
    slug?: string;
    iconName?: string;
    parentId?: string | null;
    imageUrl?: string | null;
    sortOrder?: number;
  }) => trpc.admin.saveCategory.mutate(adminCategoryInput.parse(input)),

  /**
   * Delete a category, with the reason.
   *
   * The reason is a required argument rather than a second call: `deleteCategory` used to
   * take only an id, so `ActionButton` collected a reason the callback discarded and the
   * audit row was written with `reason: null`. Passing it through the same input the server
   * validates means the dialog, the wire and the audit row cannot disagree about whether a
   * deletion was explained.
   */
  deleteCategory: (id: string, reason: string) =>
    trpc.admin.deleteCategory.mutate(adminDeleteCategoryInput.parse({ id, reason })),

  // ── Audit ────────────────────────────────────────────────────────────────

  auditLog: async (
    input: Partial<AdminListInput> & { actorId?: string; targetId?: string } = {},
  ): Promise<Page<AuditLogEntry>> =>
    auditList(
      await trpc.admin.auditLog.query({
        ...page(input),
        actorId: input.actorId,
        targetId: input.targetId,
      }),
    ),

  // ── The actions ──────────────────────────────────────────────────────────
  //
  // Each writes an audit row server-side, so there is nothing to record here. What these
  // do is refuse a missing reason locally, so the person clicking is told before a round
  // trip rather than after one.

  verifyBusiness: (targetId: string, reason?: string) =>
    trpc.admin.verifyBusiness.mutate({ targetId, reason }),

  suspendBusiness: (targetId: string, reason: string) =>
    trpc.admin.suspendBusiness.mutate({ targetId, reason }),

  reactivateBusiness: (targetId: string, reason?: string) =>
    trpc.admin.reactivateBusiness.mutate({ targetId, reason }),

  grantAdmin: (userId: string) => trpc.admin.grantAdmin.mutate({ userId }),

  suspendUser: (targetId: string, reason: string) =>
    trpc.admin.suspendUser.mutate({ targetId, reason }),

  cancelOrder: (targetId: string, reason: string) =>
    trpc.admin.cancelOrder.mutate({ targetId, reason }),

  /**
   * `decision` is `"VERIFIED" | "REJECTED"` and the reason is required for one of them.
   *
   * That asymmetry is the service's, not this file's: a courier turned down deserves to be
   * told why, and `courier.reject` is in `REASON_REQUIRED_ACTIONS` on the server. The
   * console mirrors it through `needsReason`, so the dialog appears on the reject and not
   * on the approve.
   */
  reviewCourier: (profileId: string, decision: "VERIFIED" | "REJECTED", reason?: string) =>
    trpc.admin.reviewCourier.mutate({ profileId, decision, reason }),

  /**
   * Answering without moving the ticket.
   *
   * Not a status change, and deliberately: an operator who is still working should not have
   * to flip a ticket to `WAITING` to record what they said. The merchant does that themselves
   * when they are satisfied.
   */
  replyOnSupportTicket: (ticketId: string, body: string) =>
    trpc.admin.replyOnSupportTicket.mutate({ ticketId, body }),

  /**
   * Closing, with a note that becomes the closing message.
   *
   * `note` is required and is posted as the message, so a resolution always carries the
   * words that resolved it. There is no input here that closes a ticket silently, and the
   * console does not offer one.
   */
  resolveSupportTicket: (ticketId: string, status: "RESOLVED" | "CLOSED", note: string) =>
    trpc.admin.resolveSupportTicket.mutate({ ticketId, status, note }),
};

export type {
  AdminAction,
  AdminBusinessDetail,
  AdminBusinessRow,
  AdminCourierListInput,
  AdminCourierRow,
  AdminMetrics,
  AdminOrderRow,
  AdminSubscription,
  AdminSupportTicketDetail,
  AdminSupportTicketListInput,
  AdminSupportTicketRow,
  AdminUserRow,
  AuditLogEntry,
  BusinessStatus,
  CourierVerificationStatus,
  SubscriptionStatus,
  TicketCategory,
  TicketStatus,
};
export {
  adminActionSchema,
  BUSINESS_STATUSES,
  COURIER_VERIFICATION_STATUSES,
  PLANS,
  REASON_MIN_LENGTH,
  SUBSCRIPTION_STATUSES,
  TICKET_CATEGORY,
  TICKET_STATUS,
};
