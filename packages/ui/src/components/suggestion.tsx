"use client";

import Checkmark from "@carbon/icons-react/es/Checkmark";
import Close from "@carbon/icons-react/es/Close";
import { Button } from "@pymeshub/ui/components/button";
import { Icon } from "@pymeshub/ui/components/icon";
import { Spinner } from "@pymeshub/ui/components/spinner";
import type * as React from "react";

/**
 * Something a machine thinks is true, offered to somebody who can tell.
 *
 * The rule this encodes: **a suggestion is never rendered as a value.** It sits
 * under the empty field it would fill, in muted text, with the two buttons that
 * settle it. A guess formatted identically to a fact is how a CRM quietly
 * teaches people to distrust every field in it.
 *
 * It lives here rather than in the app because the same shape will be wanted on
 * companies and deals, and because "how does this product show uncertainty" is
 * exactly the sort of decision `design.md` says belongs in one place.
 */

/**
 * One action, and the words it is announced by.
 *
 * A pair rather than an `onAccept` beside an `acceptLabel`, for the reason
 * `product-card`'s `onAdd` is one prop: both controls here are a bare glyph, so the label
 * is the whole of what a screen reader hears, and an action that arrives without one is
 * announced as noise. Keeping them in a single object makes the word impossible to omit
 * — a call site cannot express the button without it, and the type system says so there
 * rather than in a reader's ear.
 */
type SuggestionAction = { label: string; onClick: () => void };

export function Suggestion({
	value,
	rationale,
	pending = false,
	onAccept,
	onDismiss,
}: {
	value: React.ReactNode;
	/** Why the agent thinks so, in one line. */
	rationale?: React.ReactNode;
	pending?: boolean;
	/**
	 * Settle it, or throw it away — each carrying its own words.
	 *
	 * These were `aria-label="Accept"` and `aria-label="Dismiss"` in the source: English,
	 * hardcoded, in a package with no translator, on the two controls whose *only* content
	 * they are. A default was not available here either — nothing outside the component
	 * can correct an `aria-label` a caller never sees — so the words are required, and
	 * they arrive attached to the action they name.
	 */
	onAccept: SuggestionAction;
	onDismiss: SuggestionAction;
}) {
	return (
		<div
			data-slot="suggestion"
			className="flex min-w-0 items-start gap-2 py-1 text-muted-foreground text-xs"
		>
			<div className="min-w-0 flex-1 space-y-0.5">
				<p className="truncate">
					<span className="text-foreground">{value}</span>
				</p>
				{rationale ? <p className="text-pretty">{rationale}</p> : null}
			</div>

			<div className="flex shrink-0 items-center gap-1">
				{pending ? (
					<Spinner className="size-3" />
				) : (
					<>
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={onAccept.onClick}
							aria-label={onAccept.label}
						>
							<Icon icon={Checkmark} />
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							onClick={onDismiss.onClick}
							aria-label={onDismiss.label}
						>
							<Icon icon={Close} />
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
