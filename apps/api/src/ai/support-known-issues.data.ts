export interface KnownIssue {
  error_code: string;
  title: string;
  module: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  workaround: string;
  fix_status: "OPEN" | "FIX_IN_PROGRESS" | "FIXED" | "WONT_FIX" | "DOCUMENTED";
  fix_pr_url?: string;
}

export const KNOWN_ISSUES: KnownIssue[] = [
  {
    error_code: "CIRCULAR_DEP_MODULE",
    title: "NestJS cannot create module — circular dependency",
    module: "billing",
    category: "PRODUCT_BUG",
    severity: "critical",
    description:
      "The InvoicesModule has an undefined import at index [1] caused by a circular reference chain: InvoicesModule → ConversationsModule → AutomationsModule → WorkersModule → InvoicesModule.",
    workaround:
      "Add forwardRef(() => ConversationsModule) in InvoicesModule and forwardRef(() => InvoicesModule) in WorkersModule.",
    fix_status: "FIXED",
    fix_pr_url: "https://github.com/Lento47/pymes-saas/commit/dc2bf3d",
  },
  {
    error_code: "PRISMA_P2002_DUPLICATE",
    title: "Duplicate record — unique constraint violation",
    module: "database",
    category: "PRODUCT_BUG",
    severity: "medium",
    description:
      "Attempting to create a record that already exists (e.g., duplicate invoice number, duplicate contact email). The global Prisma exception filter now maps P2002 to 409 Conflict.",
    workaround:
      "Check if the record already exists before creating. The error message now shows which field is duplicated.",
    fix_status: "FIXED",
  },
  {
    error_code: "PRISMA_P2025_NOT_FOUND",
    title: "Resource not found — Prisma findUniqueOrThrow failed",
    module: "database",
    category: "PRODUCT_BUG",
    severity: "low",
    description:
      "A query expected to find a record but it was missing, throwing a raw Prisma error. The global Prisma exception filter now maps this to 404 Not Found.",
    workaround:
      "Verify the ID exists before querying. The error is now user-friendly instead of raw Prisma output.",
    fix_status: "FIXED",
  },
  {
    error_code: "PADDLE_WEBHOOK_MISSING",
    title: "Paddle webhook events not being received",
    module: "billing",
    category: "WORKSPACE_CONFIGURATION",
    severity: "high",
    description:
      "Paddle subscription events (activated, canceled, payment completed) are not arriving at the webhook endpoint, causing the workspace plan to remain stuck at FREE.",
    workaround:
      "Verify PADDLE_WEBHOOK_SECRET is set on Railway. Check Paddle dashboard → Developer Tools → Notifications that the webhook URL is https://api.pymeshub.lat/api/billing/webhook.",
    fix_status: "DOCUMENTED",
  },
  {
    error_code: "PADDLE_PRICE_UNMAPPED",
    title: "Paddle price ID not mapped to a plan — falls back to FREE",
    module: "billing",
    category: "WORKSPACE_CONFIGURATION",
    severity: "critical",
    description:
      "mapPaddlePriceToPlan() could not find the Paddle price ID in any PADDLE_PRICE_* environment variable. The plan silently defaults to FREE, meaning paid customers get stuck on the free plan.",
    workaround:
      "Set all 6 PADDLE_PRICE_*_MONTHLY/ANNUAL env vars on Railway to match the Paddle price IDs in production.",
    fix_status: "FIXED",
    fix_pr_url: "https://github.com/Lento47/pymes-saas/commit/8014b13",
  },
  {
    error_code: "SUBSCRIPTION_OUT_OF_SYNC",
    title: "Workspace plan and subscription plan are different",
    module: "billing",
    category: "PRODUCT_BUG",
    severity: "high",
    description:
      "The workspace.plan field and workspace_subscriptions.plan field contain different values. This happens after subscription cancellation (workspace becomes FREE but subscription still shows the paid plan).",
    workaround:
      "Both fields are now updated together in all webhook handlers (activated, updated, canceled, transaction completed). If they are still out of sync, call POST /api/billing/sync.",
    fix_status: "FIXED",
  },
  {
    error_code: "HACIENDA_XML_SIGNING_STUB",
    title: "Hacienda XML is not cryptographically signed",
    module: "hacienda",
    category: "PRODUCT_BUG",
    severity: "critical",
    description:
      "The HaciendaSigningService.signXml() returns an unsigned XML with a placeholder comment. Hacienda Costa Rica REQUIRES XAdES-EPES digital signature for all Factura Electrónica submissions.",
    workaround:
      "In staging/sandbox environments, Hacienda may accept unsigned XML for testing. For production, the XAdES-EPES signer needs to be integrated using the digital certificate from Banco Central de Costa Rica.",
    fix_status: "OPEN",
  },
  {
    error_code: "RESEND_WEBHOOK_SECRET_MISSING",
    title: "Inbound email webhook returns 401",
    module: "email",
    category: "WORKSPACE_CONFIGURATION",
    severity: "high",
    description:
      "POST /api/inbound/email/webhook requires RESEND_WEBHOOK_SECRET environment variable. Without it, Resend webhook calls are rejected with 401 Unauthorized.",
    workaround:
      "Set RESEND_WEBHOOK_SECRET (whsec_...) on Railway. Get it from Resend dashboard → your domain → Inbound.",
    fix_status: "DOCUMENTED",
  },
  {
    error_code: "ENCRYPTION_KEY_MISSING",
    title: "Per-channel email API keys cannot be encrypted",
    module: "email",
    category: "WORKSPACE_CONFIGURATION",
    severity: "high",
    description:
      "The CryptoService requires ENCRYPTION_KEY to encrypt per-workspace email channel API keys (SMTP passwords, Resend keys). Without it, all email channel configurations fail.",
    workaround:
      "Generate ENCRYPTION_KEY with openssl rand -hex 32 and set it on Railway. The key must be 32 bytes.",
    fix_status: "DOCUMENTED",
  },
  {
    error_code: "BALANCE_DUE_PARSING_ERROR",
    title: "Invoice balance due is miscalculated — Decimal parsing issue",
    module: "invoices",
    category: "PRODUCT_BUG",
    severity: "medium",
    description:
      'The getBalanceDue() method used Number() to parse Decimal values from Prisma. Edge cases with null/undefined/object values could return 0, causing "Factura ya pagada" errors on unpaid invoices.',
    workaround:
      "Fixed by adding parseAmount() helper that handles Prisma Decimal objects, strings, numbers, and nulls consistently.",
    fix_status: "FIXED",
    fix_pr_url: "https://github.com/Lento47/pymes-saas/commit/6746233",
  },
  {
    error_code: "MOBILE_SIDEBAR_FLASH",
    title: "Sidebar opens then immediately closes on iOS Safari",
    module: "frontend",
    category: "PRODUCT_BUG",
    severity: "low",
    description:
      "On page load in iOS Safari, the sidebar opens briefly then closes. Caused by sidebarOpen starting as true, then the mobile detection useEffect setting it to false.",
    workaround:
      "Fixed by lazy-initializing sidebarOpen and isMobile from window.innerWidth, eliminating the mount-time flash.",
    fix_status: "FIXED",
    fix_pr_url: "https://github.com/Lento47/pymes-saas/commit/ae291d5",
  },
  {
    error_code: "INVITE_CODE_LIMIT_REACHED",
    title: "Cannot create more invitation codes — plan limit reached",
    module: "members",
    category: "PERMISSION_ISSUE",
    severity: "low",
    description:
      "Each plan has a limit on active invitation codes (FREE: 3, STARTER: 10, GROWTH: 50, BUSINESS: 200).",
    workaround: "Revoke unused codes or upgrade the plan to increase the limit.",
    fix_status: "DOCUMENTED",
  },
];
