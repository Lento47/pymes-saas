import { ChevronLeft, Compass, Heart, Home, ListOrdered, LogOut, Search, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { marketplaceAuth, useCart, useMarketplaceSession } from "@/lib/marketplace";

/**
 * The public marketplace frame.
 *
 * This is the customer side of PymesHub, and it keeps the public web's own visual
 * language — navy `#05091d` with a single amber accent — scoped away from the
 * authenticated merchant app, which has its own theme. The storefront is the landing
 * page: a stranger browses shops and products before signing in, the same order of
 * questions Uber Eats and PedidosYa ask.
 *
 * The header carries search and the cart; the bottom bar carries the five destinations a
 * customer moves between on a phone, and it disappears without leaving a gap when the
 * viewport is wide enough to show the same links in the header.
 */

const NAV = [
  { href: "/", label: "Inicio", Icon: Home },
  { href: "/categories", label: "Categorías", Icon: Compass },
  { href: "/search", label: "Buscar", Icon: Search },
  { href: "/orders", label: "Pedidos", Icon: ListOrdered },
  { href: "/favorites", label: "Favoritos", Icon: Heart },
] as const;

export function MarketplaceShell({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { data: cart } = useCart();
  const { data: session } = useMarketplaceSession();
  const itemCount = cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;

  const onSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    navigate(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#05091d] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05091d]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-bold text-[#05091d]">
              P
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:inline">PymesHub</span>
          </Link>

          <form onSubmit={onSearch} className="min-w-0 flex-1">
            <label className="relative block">
              <span className="sr-only">Buscar tiendas y productos</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              />
              <Input
                type="search"
                name="q"
                defaultValue=""
                placeholder="¿Qué querés pedir hoy?"
                className="h-10 border-white/10 bg-white/5 pl-9 text-sm text-white placeholder:text-slate-400 focus-visible:ring-amber-500"
              />
            </label>
          </form>

          <nav aria-label="Cuenta" className="flex shrink-0 items-center gap-1">
            <Link
              href="/cart"
              aria-label={itemCount > 0 ? `Carrito, ${itemCount} productos` : "Carrito"}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              <ShoppingBag aria-hidden="true" className="h-5 w-5" />
              {itemCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-[#05091d]">
                  {itemCount}
                </span>
              ) : null}
            </Link>

            {session ? (
              <button
                type="button"
                onClick={() => {
                  void marketplaceAuth.signOut().then(() => window.location.reload());
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            ) : (
              <Link
                href="/sign-in"
                className="inline-flex h-10 items-center rounded-lg bg-amber-500 px-3 text-xs font-semibold text-[#05091d] transition hover:bg-amber-400"
              >
                Ingresar
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pb-12">{children}</main>

      <footer className="hidden border-t border-white/10 px-6 py-8 text-xs text-slate-400 sm:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} PymesHub · Pedidos a domicilio en Costa Rica</p>
          <nav aria-label="Enlaces" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/categories" className="transition hover:text-white">
              Categorías
            </Link>
            <Link href="/orders" className="transition hover:text-white">
              Mis pedidos
            </Link>
            <Link href="/legal" className="transition hover:text-white">
              Legal
            </Link>
            <Link href="/accessibility" className="transition hover:text-white">
              Accesibilidad
            </Link>
            <Link href="/login" className="transition hover:text-white">
              Panel de negocios
            </Link>
          </nav>
        </div>
      </footer>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#05091d]/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition",
                    active ? "text-amber-400" : "text-slate-400 hover:text-slate-200",
                  )}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
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

/** A storefront's own small header, used on the shop page. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-9 items-center gap-1.5 text-sm text-slate-300 transition hover:text-white"
    >
      <ChevronLeft aria-hidden="true" className="h-4 w-4" />
      {children}
    </Link>
  );
}

/** The primary amber action, on the navy ground. */
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
        "min-h-11 rounded-lg bg-amber-500 px-5 font-semibold text-[#05091d] hover:bg-amber-400 disabled:opacity-60",
        className,
      )}
    >
      {children}
    </Button>
  );
}
