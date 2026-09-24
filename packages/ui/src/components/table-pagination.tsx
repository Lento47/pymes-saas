"use client";

import ChevronLeft from "@carbon/icons-react/es/ChevronLeft";
import ChevronRight from "@carbon/icons-react/es/ChevronRight";
import { Button } from "@pymeshub/ui/components/button";
import { Spinner } from "@pymeshub/ui/components/spinner";
import type { ReactNode } from "react";

/** The runtime's own locale — see the note on `meta`. */
const numberFormat = new Intl.NumberFormat();

/**
 * The page count and the two arrows.
 *
 * **Every word it says is a prop or a Spanish default.** `packages/ui` has no
 * `@pymeshub/i18n` dependency, and it used to render `Previous`, `Next`,
 * `Showing 1–25 of 90` and `No results` to a Spanish-first product with no way to change
 * them — an English sentence on an admin table that is read all day. The defaults here are
 * Spanish, which is what the rest of this package already does (`status-badge`,
 * `bottom-nav`) and what this one keeps, unlike `business-card` — whose badges are
 * customer-facing, so its words are required props and it has no Spanish default to fall
 * back to. `meta`, `previousLabel` and `nextLabel` are the escape hatches for a caller that
 * has a translator: pass the translated string in rather than a language into the
 * component.
 *
 * The fallback summary formats its numbers with the *runtime's* locale, not the reader's.
 * A caller that cares — and a table of counts is a caller that cares, because `1.234` and
 * `1,234` are the same number — passes `meta`, which is exactly what
 * `apps/web/components/admin/list-footer.tsx` does with `Intl.NumberFormat(intlLocale)`.
 *
 * That same caller also passes `previousLabel` and `nextLabel` now. It did not until this
 * pass, and the result was the exact failure the paragraph above describes, one direction
 * over: an operator reading the console in English got `Anterior` and `Siguiente` under an
 * English table, because two escape hatches existed and only one of them was used. An
 * escape hatch nobody walks through is not a fix — if a second caller ever pages a list in
 * another language, it has to pass these three the same way.
 */
export function TablePagination({
	page,
	totalPages,
	pageSize,
	total,
	onPageChange,
	loading = false,
	meta,
	previousLabel = "Anterior",
	nextLabel = "Siguiente",
}: {
	page: number;
	totalPages: number;
	pageSize: number;
	total: number;
	onPageChange: (page: number) => void;
	loading?: boolean;
	meta?: ReactNode;
	/** A translated word, for a caller that has one. */
	previousLabel?: string;
	nextLabel?: string;
}) {
	const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
	const rangeEnd = Math.min(page * pageSize, total);

	return (
		<div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
			<span className="flex items-center gap-2 text-muted-foreground text-xs tabular-nums">
				{loading && <Spinner />}
				{meta ??
					(total === 0
						? "Sin resultados"
						: `Mostrando ${numberFormat.format(rangeStart)}–${numberFormat.format(
								rangeEnd,
							)} de ${numberFormat.format(total)}`)}
			</span>
			{totalPages > 1 && (
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={page <= 1}
						onClick={() => onPageChange(Math.max(1, page - 1))}
					>
						<ChevronLeft data-icon="inline-start" />
						{previousLabel}
					</Button>
					<span className="text-muted-foreground text-xs tabular-nums">
						{page} / {totalPages}
					</span>
					<Button
						variant="outline"
						size="sm"
						disabled={page >= totalPages}
						onClick={() => onPageChange(page + 1)}
					>
						{nextLabel}
						<ChevronRight data-icon="inline-end" />
					</Button>
				</div>
			)}
		</div>
	);
}
