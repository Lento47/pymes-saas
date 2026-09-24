import { cn } from "@pymeshub/ui/lib/utils";
import type { OrderStatus } from "@pymeshub/shared/order-state";
import { cva, type VariantProps } from "class-variance-authority";
import {
	CheckIcon,
	CircleCheckIcon,
	ClockIcon,
	Loader2Icon,
	OctagonXIcon,
	PackageIcon,
	TruckIcon,
	XIcon,
	type LucideIcon,
} from "lucide-react";
import type * as React from "react";

/**
 * The order's state, in Spanish, in one place — and the last resort, not the only source.
 *
 * Keys are the wire values from `@pymeshub/shared/order-state` — the union is
 * the contract with the API, and a badge that took a free string would let a
 * typo'd status render as a blank pill on the screen a customer is refreshing to
 * find out whether their food is coming.
 *
 * `Record<OrderStatus, string>` and not a partial map: adding a status to the
 * union fails the build here, which is the only place that can be trusted to
 * notice.
 *
 * **This map is what a caller gets when it says nothing**, and a caller that has
 * `@pymeshub/i18n` should say something: `label` overrides it, and
 * `apps/web/components/admin/order-status.tsx` passes the dictionary's own
 * `order.status.*` word, because the admin console is read in English and this
 * map is Spanish. The two surfaces where the map is still correct are the ones
 * with no dictionary in reach — see `order-status-pill.tsx` in `apps/web` for the
 * long version of why the customer's screen does not use this component at all.
 */
const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
	PENDING: "Pendiente",
	ACCEPTED: "Aceptado",
	PREPARING: "En preparación",
	READY: "Listo",
	OUT_FOR_DELIVERY: "En camino",
	COMPLETED: "Completado",
	CANCELLED: "Cancelado",
	REJECTED: "Rechazado",
};

/**
 * The icon is chosen to be distinguishable from its neighbours in the list
 * rather than to be pretty: a customer scanning "En preparación → Listo → En
 * camino" is reading three shapes before they read three words. `PREPARING`
 * spins, because it is the one status that means work is happening right now.
 */
const ORDER_STATUS_ICON: Record<OrderStatus, LucideIcon> = {
	PENDING: ClockIcon,
	ACCEPTED: CheckIcon,
	PREPARING: Loader2Icon,
	READY: PackageIcon,
	OUT_FOR_DELIVERY: TruckIcon,
	COMPLETED: CircleCheckIcon,
	CANCELLED: XIcon,
	REJECTED: OctagonXIcon,
};

const ORDER_STATUS_SPINS: OrderStatus[] = ["PREPARING"];

/**
 * Terminal statuses. Their tint is the only status colour that is allowed to be
 * quiet: a cancelled order and a completed one are history, and a row of them in
 * the vivid tints of the in-flight states makes an archive look like a queue.
 */
const ORDER_STATUS_TERMINAL: OrderStatus[] = [
	"COMPLETED",
	"CANCELLED",
	"REJECTED",
];

const statusBadgeVariants = cva(
	"inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap [&_svg]:shrink-0",
	{
		variants: {
			size: {
				sm: "h-6 gap-1 px-2 text-xs [&_svg]:size-3",
				md: "h-7 px-2.5 text-xs [&_svg]:size-3.5",
				lg: "h-9 px-3 text-sm [&_svg]:size-4",
			},
		},
		defaultVariants: {
			size: "md",
		},
	},
);

/**
 * The `--status-*` pair for a status, as Tailwind classes.
 *
 * Written out rather than composed from the status string, because Tailwind
 * scans source text: `bg-status-${status}` produces no CSS at all, and the
 * failure is a colourless badge rather than a build error. The mapping is here
 * so that the scan sees eight literal class names.
 */
const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
	PENDING: "bg-status-pending text-status-pending-foreground",
	ACCEPTED: "bg-status-accepted text-status-accepted-foreground",
	PREPARING: "bg-status-preparing text-status-preparing-foreground",
	READY: "bg-status-ready text-status-ready-foreground",
	OUT_FOR_DELIVERY:
		"bg-status-out-for-delivery text-status-out-for-delivery-foreground",
	COMPLETED: "bg-status-completed text-status-completed-foreground",
	CANCELLED: "bg-status-cancelled text-status-cancelled-foreground",
	REJECTED: "bg-status-rejected text-status-rejected-foreground",
};

/** `"OUT_FOR_DELIVERY"` → `"En camino"`. For copy that is not a badge. */
function orderStatusLabel(status: OrderStatus): string {
	return ORDER_STATUS_LABEL[status];
}

type StatusBadgeProps = Omit<React.ComponentProps<"span">, "children"> &
	VariantProps<typeof statusBadgeVariants> & {
		status: OrderStatus;
		/**
		 * The word for `status`, in the reader's language — `t("order.status." + status)`.
		 *
		 * Omitted, the badge uses `ORDER_STATUS_LABEL`, which is Spanish. That map is the
		 * right answer for the surfaces this package was written for — the shop's board is
		 * one market, and `order-status-pill.tsx` in `apps/web` says the same thing at
		 * length — but it is the wrong answer for the admin console, which is translated
		 * from end to end. The operator reading an orders table in English was getting "En
		 * preparación" in a column of otherwise English words, and there was no prop to
		 * correct it with.
		 *
		 * Optional and not required because the Spanish map is a real default here rather
		 * than an oversight: `packages/ui` has no `@pymeshub/i18n` dependency, so a
		 * required prop would only move the literal to the two call sites that have no
		 * dictionary of their own.
		 */
		label?: string;
		/** Replaces the word with a skeleton-free placeholder while loading. */
		loading?: boolean;
		/** Drops the word, for a dense table column that has a header. */
		iconOnly?: boolean;
	};

/**
 * Where an order is.
 *
 * A pill here and not a dot: `StatusIndicator` is the density answer for a table
 * of accounts, but this is the word a person opens the app to read, one per
 * screen, and it is the state machine's own vocabulary — so it takes the ink.
 *
 * The icon is decorative (`aria-hidden`): the label is right there and reads
 * better than "truck".
 */
function StatusBadge({
	status,
	size,
	label: labelProp,
	loading = false,
	iconOnly = false,
	className,
	...props
}: StatusBadgeProps) {
	const Icon = ORDER_STATUS_ICON[status];
	const label = labelProp ?? ORDER_STATUS_LABEL[status];
	const spins = ORDER_STATUS_SPINS.includes(status);

	return (
		<span
			data-slot="status-badge"
			data-status={status}
			data-size={size ?? "md"}
			data-terminal={ORDER_STATUS_TERMINAL.includes(status) ? "true" : undefined}
			aria-busy={loading || undefined}
			className={cn(
				statusBadgeVariants({ size }),
				ORDER_STATUS_TONE[status],
				// The status is known throughout — it is the *change* that is in
				// flight, so the label stays and only the icon is replaced. Hiding
				// the word behind a shimmer would take away the one thing the
				// person is watching.
				loading && "opacity-80",
				className,
			)}
			{...props}
		>
			{loading ? (
				<Loader2Icon aria-hidden="true" className="motion-safe:animate-spin" />
			) : (
				<Icon
					aria-hidden="true"
					className={cn(spins && "motion-safe:animate-spin")}
				/>
			)}
			{iconOnly ? <span className="sr-only">{label}</span> : label}
		</span>
	);
}

export {
	StatusBadge,
	statusBadgeVariants,
	ORDER_STATUS_LABEL,
	ORDER_STATUS_TONE,
	orderStatusLabel,
};
export type { StatusBadgeProps };
