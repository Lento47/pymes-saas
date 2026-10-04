import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

import { pageCount, windowLabel } from "./console-pagination";

/**
 * The pager for an admin table: *anterior*, what is on screen, *siguiente*.
 *
 * ## Built on the shadcn component, minus its link
 *
 * `Pagination`, `PaginationContent` and `PaginationItem` are used as-is — they carry the
 * `nav` / `ul` / `li` semantics and the layout. The `PaginationLink` is **not**, and the
 * reason is worth stating because it looks like an omission.
 *
 * `PaginationLink` renders an `<a>`. This console has no URL for a page of a table — the
 * offset is component state, and `AGENTS.md` forbids `#` fragments in routes, so there is
 * nothing to point an anchor at. An `<a>` with no `href` is not focusable and is not
 * announced as a control, so the buttons would be unreachable by keyboard and invisible to a
 * screen reader while looking entirely normal on screen.
 *
 * So the items are `<button>`s carrying `buttonVariants` for styling. Same design language,
 * real semantics.
 *
 * ## No page numbers
 *
 * The label is a row range — "mostrando 26–50 de 312" — and there is deliberately no "1 2 3 4
 * …". The admin cursor is an offset, so pages shift under the operator as rows are added;
 * a row range is a fact about the screen and a page number is a promise the API explicitly
 * disclaims. `console-pagination.ts` says so at length.
 *
 * ## Hidden when there is nothing to page
 *
 * One page or zero rows draws no pager at all. A control that offers *siguiente* on a table
 * with four rows is telling the operator something false about their own screen.
 */
export function TablePager({
  offset,
  total,
  pageSize,
  atFirstPage,
  atLastPage,
  onPrevious,
  onNext,
  /** What is being paged, for the navigation's accessible name. */
  label,
  className,
}: {
  offset: number;
  total: number;
  pageSize: number;
  atFirstPage: boolean;
  atLastPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
  label: string;
  className?: string;
}) {
  if (total === 0) return null;
  if (pageCount(total, pageSize) <= 1) return null;

  const itemClass = cn(
    buttonVariants({ variant: "outline", size: "default" }),
    "h-8 gap-1 px-2.5 text-xs",
  );

  return (
    <Pagination aria-label={`Paginación de ${label}`} className={cn("justify-between", className)}>
      <PaginationContent className="w-full justify-between">
        <PaginationItem>
          <button
            type="button"
            className={itemClass}
            disabled={atFirstPage}
            onClick={onPrevious}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Anterior
          </button>
        </PaginationItem>

        {/*
          The range, and the only thing between the two buttons.

          `aria-live="polite"` because this is the one piece of the console that changes
          without a navigation: a reader who asked for the next page needs to be told they
          got it, and a reader who has just filtered to nothing needs to be told that too.
        */}
        <PaginationItem>
          <span
            aria-live="polite"
            aria-atomic="true"
            className="px-2 text-xs text-muted-foreground"
          >
            {windowLabel(offset, total, pageSize)}
          </span>
        </PaginationItem>

        <PaginationItem>
          <button
            type="button"
            className={itemClass}
            disabled={atLastPage}
            onClick={onNext}
          >
            Siguiente
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}