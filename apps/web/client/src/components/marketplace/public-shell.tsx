import {
  ChevronLeft,
  Compass,
  Heart,
  Home,
  ListOrdered,
  LogOut,
  Moon,
  Search,
  ShoppingBag,
  Sun,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "wouter";

import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  marketplaceAuth,
  useCart,
  useMarketplaceSession,
} from "@/lib/marketplace";

/**
 * The public marketplace frame.
 *
 * This is the customer side of PymesHub, and it draws from its own token set — the
 * `.storefront` scope in `index.css` — rather than from hardcoded colours. That is the
 * whole reason the frame is written as `bg-background` / `text-foreground` /
 * `border-border` and never as `bg-white/5`: the scope defines those tokens for both
 * palettes, so one component serves the dark storefront and a light one, and no
 * component here has to ask which theme it is in.
 *
 * The direction is restrained: hairline borders, flat surfaces, one radius, and no
 * gradients or glow. A storefront that reads as expensive here is one where the type
 * scale and the spacing carry the hierarchy.
 *
 * The header carries search; below it, a row of the five destinations a customer moves
 * between. On a phone that row moves to the bottom of the screen, where a thumb
 * reaches it, and the two never both show — `sm` is the single breakpoint that decides
 * which one is visible.
 */

const NAV = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/categories", label: "Categorías", Icon: Compass },
  { href: "/search", label: "Buscar", Icon: Search },
  { href: "/orders", label: "Pedidos", Icon: ListOrdered },
  { href: "/favorites", label: "Favoritos", Icon: Heart },
] as const;

export function MarketplaceShell({
  children,
  hideSearch = false,
}: {
  children: ReactNode;
  hideSearch?: boolean;
}) {
  const mainRef = useRef<HTMLElement>(null);
  const [location, navigate] = useLocation();
  const { data: cart } = useCart();
  const { data: session } = useMarketplaceSession();
  const itemCount =
    cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;

  // `body` is outside `.storefront` and therefore keeps the app's own canvas, which the
  // overscroll area above the header reveals. The class belongs on `<html>` so the CSS
  // can select `html.storefront-page body` and also see `html.light`, which is what
  // makes the matching light value possible.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("storefront-page");
    return () => root.classList.remove("storefront-page");
  }, []);

  const onSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(
      new FormData(event.currentTarget).get("q") ?? "",
    ).trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  };

  return (
    <div className="storefront flex min-h-screen flex-col bg-background text-foreground">
      <button
        type="button"
        className="market-skip"
        onClick={() => mainRef.current?.focus()}
      >
        Saltar al contenido
      </button>
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-1.5 gap-y-3 px-4 py-3 sm:gap-x-3 sm:px-6 lg:gap-x-8 lg:py-4">
          <Link
            href="/"
            aria-label="PymesHub, inicio"
            className="flex min-h-11 shrink-0 items-center gap-2 sm:gap-2.5"
          >
            {/* The brand's own mark — the same app icon the browser tab and PWA carry,
                not a letter placeholder. */}
            <img
              src="/images/appIcon.png"
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
              className="h-8 w-8 shrink-0 rounded-xl object-contain sm:h-9 sm:w-9"
            />
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              PymesHub
            </span>
          </Link>

          {!hideSearch ? (
            <form
              onSubmit={onSearch}
              role="search"
              className="order-3 w-full min-w-0 sm:order-none sm:w-auto sm:flex-1"
            >
              <label className="relative block">
                <span className="sr-only">Buscar tiendas y productos</span>
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="search"
                  name="q"
                  autoComplete="off"
                  defaultValue=""
                  placeholder="¿Qué querés pedir hoy?"
                  className="h-12 rounded-2xl border-border bg-card pl-10 pr-4 text-base placeholder:text-muted-foreground focus-visible:ring-primary"
                />
              </label>
            </form>
          ) : null}

          <nav
            aria-label="Cuenta"
            className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2"
          >
            <ThemeToggle />

            <Link
              href="/cart"
              aria-label={
                itemCount > 0 ? `Carrito, ${itemCount} productos` : "Carrito"
              }
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-bg-hover hover:text-foreground"
            >
              <ShoppingBag aria-hidden="true" className="h-5 w-5" />
              {itemCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold tabular-nums text-primary-foreground">
                  {itemCount}
                </span>
              ) : null}
            </Link>

            {session ? (
              <button
                type="button"
                onClick={() => {
                  void marketplaceAuth
                    .signOut()
                    .then(() => window.location.reload());
                }}
                className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-bg-hover hover:text-foreground"
                aria-label="Cerrar sesión"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex min-h-11 items-center rounded-xl bg-primary px-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:px-3.5"
              >
                Ingresar
              </Link>
            )}
          </nav>
        </div>

        {/* The desktop destination row. On a phone these same five links live in the
            bottom bar; showing both would be two copies of one navigation. */}
        <nav
          aria-label="Navegación principal"
          className="hidden border-t border-border sm:block"
        >
          <ul className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 sm:px-6">
            {NAV.map(({ href, label, Icon }) => {
              const active =
                href === "/" ? location === "/" : location.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-medium transition-colors",
                      active
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main
        ref={mainRef}
        tabIndex={-1}
        className="market-main mx-auto w-full max-w-6xl flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pb-14 sm:pt-8"
      >
        {children}
      </main>

      <footer className="market-footer border-t border-border px-4 py-8 text-xs text-muted-foreground sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p>
            © {new Date().getFullYear()} PymesHub · Pedidos a domicilio en Costa
            Rica
          </p>
          <nav aria-label="Enlaces" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href="/categories"
              className="transition hover:text-foreground"
            >
              Categorías
            </Link>
            <Link href="/orders" className="transition hover:text-foreground">
              Mis pedidos
            </Link>
            <Link href="/legal" className="transition hover:text-foreground">
              Legal
            </Link>
            <Link
              href="/accessibility"
              className="transition hover:text-foreground"
            >
              Accesibilidad
            </Link>
            <Link href="/login" className="transition hover:text-foreground">
              Panel de negocios
            </Link>
          </nav>
        </div>
      </footer>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map(({ href, label, Icon }) => {
            const active =
              href === "/" ? location === "/" : location.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {/* A 2px rule instead of a colour swap: the label keeps the same
                      contrast in either state, so the active tab is not the only
                      legible one. */}
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary"
                    />
                  ) : null}
                  <Icon
                    aria-hidden="true"
                    className="h-5 w-5"
                    strokeWidth={active ? 2 : 1.75}
                  />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/**
 * Dark and light, in the storefront's own header.
 *
 * The marketplace is the one surface a signed-out stranger sees, and asking them to
 * sign in before they can read the page comfortably is the wrong order — so the switch
 * lives here rather than only in the merchant account screen. It writes the same
 * `PymesHub-theme` preference the app's own toggle does, so the choice carries.
 */
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "clara" : "oscura";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Cambiar a apariencia ${next}`}
      title={`Cambiar a apariencia ${next}`}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-bg-hover hover:text-foreground"
    >
      {theme === "dark" ? (
        <Sun aria-hidden="true" className="h-5 w-5" />
      ) : (
        <Moon aria-hidden="true" className="h-5 w-5" />
      )}
    </button>
  );
}

/** A storefront's own small header, used on the shop page. */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      {children}
    </Link>
  );
}

/** The primary action: brand amber fill, near-black label, one radius, no glow. */
export function AmberButton({
  children,
  onClick,
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-12 h-auto whitespace-normal rounded-xl bg-primary px-5 py-3 text-sm font-semibold leading-snug text-primary-foreground hover:bg-primary/90 disabled:opacity-60",
        className,
      )}
    >
      {children}
    </Button>
  );
}

/** The secondary action: a hairline border on the page's own surface. */
export function OutlineButton({
  children,
  onClick,
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <Button
      type={type}
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "min-h-12 h-auto whitespace-normal rounded-xl border-border bg-card px-5 py-3 text-sm font-semibold leading-snug text-foreground hover:bg-bg-hover disabled:opacity-60",
        className,
      )}
    >
      {children}
    </Button>
  );
}
