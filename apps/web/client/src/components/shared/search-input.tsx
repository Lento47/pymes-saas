import * as React from "react";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The one search box. Every filter-as-you-type field in the app is this component,
 * so the icon, the clear affordance, the sizing knobs and the accessible name are
 * decided once instead of five times.
 *
 * ## Controlled and deliberately undebounced
 *
 * `value` / `onValueChange` only — no internal state, no timer. A debounced input that
 * is also controlled drifts: the box shows what the user typed while `value` still holds
 * the last debounced commit, and a clear button then writes back a stale string. Debounce
 * belongs at the query layer, where the call sites already have it (`queryKey` on the
 * term, or the 200ms timer in `search-dialog.tsx`).
 *
 * `onValueChange` carries the **string**, not the event, because the clear button has no
 * event to give — a native `onChange` would force it to synthesise one or to split the
 * callback in two.
 *
 * ## Enter submits the surrounding form, and that is on purpose
 *
 * No `onSubmit` here. Sites like `invoices.tsx` and `tasks.tsx` already wrap the field in
 * a `<form>` with a submit button beside it, and a plain input inside that form already
 * submits on Enter. Re-implementing it here would mean either firing both handlers or
 * calling `preventDefault` and breaking the button.
 *
 * `type="text"` and not `type="search"`: Safari and Chrome draw their own native clear
 * affordance on `type="search"`, which sits on top of the one below and gives two X's
 * that behave differently.
 */
export interface SearchInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name for the clear button. Required the moment a clear button shows. */
  clearLabel?: string;
  /** Layout of the outer box (sizing, max-width). The input skin goes in `className`. */
  wrapperClassName?: string;
  /** Extra classes for the leading icon wrapper. */
  iconClassName?: string;
}

export function SearchInput({
  value,
  onValueChange,
  clearLabel = "Limpiar búsqueda",
  className,
  wrapperClassName,
  iconClassName,
  placeholder,
  "aria-label": ariaLabel,
  disabled,
  ...rest
}: SearchInputProps) {
  const showClear = value.length > 0 && !disabled;

  return (
    <div className={cn("relative w-full", wrapperClassName)}>
      <Search
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
          iconClassName,
        )}
        strokeWidth={1.75}
      />
      <Input
        {...rest}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("pl-8", showClear && "pr-8", className)}
      />
      {showClear && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={() => onValueChange("")}
          className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}
