import { LogOut, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { PageTemplate } from "@/components/layout/page-template";
import { useTheme } from "@/components/providers/theme-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import {
  CONSOLE_GROUPS,
  CONSOLE_TABS,
  type ConsoleTab,
  isConsoleTab,
} from "./console-tabs";

/**
 * The console's navigation.
 *
 * ## What replaced what
 *
 * Eleven destinations used to sit in a horizontal strip across the top, all the same weight, so
 * nothing on the screen said what mattered. This is the same eleven — plus an *Resumen* — as
 * five labelled groups, generated from `CONSOLE_TABS` rather than written out by hand.
 *
 * **The generation is the point.** A hand-written sidebar is a second list of routes that has
 * to agree with the first, and the failure is invisible: the tab exists, the route validates,
 * and the destination is simply unreachable from the nav. Every entry below comes from
 * `CONSOLE_TABS`, and `console-tabs.test.ts` compares that list against the rendered panels.
 *
 * ## Links, not buttons
 *
 * `AGENTS.md` requires pathname routing and forbids `#` fragments. A sidebar of anchors is
 * *more* compliant than the tab strip it replaced: every destination is linkable, bookmarkable
 * and leaves with the back button, which is what the tab strip's route segment was already
 * buying and the strip's own buttons partly gave back.
 *
 * ## The badge is only on Aprobaciones, and that is a fact about the data
 *
 * `adminApprovalCountsSchema` is exactly `{ pendingVerification, pendingCouriers }`. There is
 * no support-queue count anywhere in the API, so a badge on Soporte would have to be a
 * hardcoded zero or an invented number. A badge that lies is worse than no badge, so there is
 * one badge, on the one destination with a real count behind it.
 */
export function ConsoleNav({
  pending,
  onNavigate,
}: {
  /** Pending approvals, for the one badge there is real data for. */
  pending: number;
  /** Called after a link is followed, so the mobile drawer can close itself. */
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const active = activeTabFrom(location);

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader>
        <div className="px-2 py-1.5">
          <p className="text-sm font-semibold">PymesHub</p>
          <p className="text-xs text-muted-foreground">Consola de plataforma</p>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {CONSOLE_GROUPS.map((group) => {
          const tabs = CONSOLE_TABS.filter((tab) => tab.group === group.value);
          // A group with nothing in it draws nothing, rather than a heading over empty space.
          if (tabs.length === 0) return null;
          return (
            <SidebarGroup key={group.value}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {tabs.map((tab) => (
                    <SidebarMenuItem key={tab.value}>
                      <SidebarMenuButton
                        asChild
                        isActive={active === tab.value}
                        tooltip={tab.label}
                      >
                        <Link
                          href={`/admin/console/${tab.value}`}
                          onClick={onNavigate}
                          aria-current={active === tab.value ? "page" : undefined}
                        >
                          <span className="truncate">{tab.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {/*
                        `collapsible="icon"` collapses the sidebar to a rail, and a rail is
                        about 48px wide. A badge showing "12" beside a label that is then
                        hidden is the only thing still visible in that mode — so it stays, and
                        it is the count that matters most.
                      */}
                      {tab.value === "approvals" && pending > 0 ? (
                        <SidebarMenuBadge>{pending}</SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

/**
 * The console's frame: sidebar on the desktop, drawer on a phone, one header.
 *
 * ## Why there is no second header bar
 *
 * The obvious build is a shell with its own top row — trigger, breadcrumb, avatar — and then
 * `PageTemplate` underneath with its own sticky header. That is two stacked bars of chrome
 * above the content, which is a large part of the "reads like a prototype" complaint this
 * replaces.
 *
 * Instead the shell owns `PageTemplate` and fills its existing `actions` and `headerExtra`
 * slots. One header, and the trigger and avatar sit where the header already reserves space
 * for controls.
 */
export function ConsoleShell({
  title,
  description,
  activeTab,
  pending,
  operatorName,
  operatorEmail,
  onSignOut,
  children,
}: {
  title: string;
  description?: string;
  activeTab: ConsoleTab;
  pending: number;
  operatorName: string;
  operatorEmail: string;
  onSignOut: () => void;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const label = CONSOLE_TABS.find((tab) => tab.value === activeTab)?.label ?? title;

  return (
    <SidebarProvider>
      {/*
        The desktop sidebar is not collapsible-by-state here: `collapsible="icon"` is, and that
        is a deliberate difference. A console an operator keeps open all day should give the
        width back when they want it, but the rail is not the default state — the labels are
        how somebody finds a destination they do not visit daily.
      */}
      <div className="hidden md:block">
        <ConsoleNav pending={pending} />
      </div>

      {/*
        The phone drawer is a `Sheet` and not a hidden sidebar, because a sidebar at 375px is
        256px of content with 119px left over. The sheet is the same component for a different
        reason though — it is navigation, not a modal dialog, so it closes on link click rather
        than demanding an explicit dismiss.
      */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navegación de la consola</SheetTitle>
          <ConsoleNav pending={pending} onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <SidebarInset>
        <PageTemplate
          title={title}
          description={description}
          headerExtra={<ConsoleBreadcrumb current={label} />}
          headerSlot={
            <div className="flex items-center gap-2">
              {/*
                Rendered only below `md`. Above it the sidebar is already on screen and a
                trigger that opens it again is a button that does nothing useful.
              */}
              <SidebarTrigger className="md:hidden" aria-label="Abrir navegación" />
              <ConsoleUserMenu
                name={operatorName}
                email={operatorEmail}
                onSignOut={onSignOut}
              />
            </div>
          }
        >
          {children}
        </PageTemplate>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * `Plataforma / Aprobaciones`
 *
 * Two segments, deliberately. A breadcrumb's job is to answer "where am I, and how do I get
 * back up" — and with a sidebar showing the full tree one level below the root, the root is
 * the only ancestor worth naming. A trail of five crumbs over a navigation that already shows
 * five groups is decoration that costs vertical space.
 */
function ConsoleBreadcrumb({ current }: { current: string }) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/admin/console">Plataforma</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        {/*
          Not a link, and `aria-current="page"` rather than nothing: this is where the
          listener is, and the sidebar's active state is visual only until it is announced.
        */}
        <BreadcrumbItem>
          <BreadcrumbPage>{current}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/**
 * Who is operating, and the one way out.
 *
 * ## This is not a profile card, it is the console's only sign-out
 *
 * `rg logout apps/web/client/src/pages/admin/console.tsx` returns **nothing**. The console is
 * a bare route outside `AppSidebar`, it renders no account chrome, and until this existed an
 * operator had no way to end their session from the screen they were working in — they had to
 * navigate back through the merchant app and log out there. An admin console without a sign-out
 * is not a missing nicety; on a shared machine it is the thing you notice last.
 *
 * ## Theme lives in here rather than beside it
 *
 * `next-themes` is already wired through `@/components/providers/theme-provider` and used by
 * the marketplace shell, so there is one theme for the app and the console follows it. A
 * separate `ThemeSwitcher` next to this menu would be a second control for one piece of state.
 *
 * `AGENTS.md` fixes dark for landing and marketing; the console inherits whatever the app is
 * already doing rather than asserting a preference of its own.
 */
export function ConsoleUserMenu({
  name,
  email,
  onSignOut,
}: {
  name: string;
  email: string;
  onSignOut: () => void;
}) {
  const { theme, toggle } = useTheme();
  const [busy, setBusy] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Tu cuenta">
          {/*
            Fallback is the first letter rather than initials: a two-word Spanish name gives
            "FP" for "Ferretería Pérez"-style business accounts, and an operator account is a
            person's name where one letter is unambiguous. The full name is on the trigger's
            accessible name either way.
          */}
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => event.preventDefault()}
          onClick={toggle}
        >
          {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
          {theme === "dark" ? "Tema claro" : "Tema oscuro"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={busy}
          onSelect={(event) => {
            // Closing the menu on the way to a network call leaves a menu item highlighted
            // under a pointer that is about to navigate away.
            event.preventDefault();
            setBusy(true);
            onSignOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {busy ? "Cerrando sesión…" : "Cerrar sesión"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Which destination the address names, if it names one.
 *
 * Read from `location` rather than passed in, because the nav is rendered by a parent that
 * also resolves the route — and two derivations of "where am I" is one more list to keep in
 * sync. A malformed `/admin/console/<something>` yields `null` and highlights nothing, which
 * is right: `resolveConsoleTab` is already rewriting the address to a real tab, and a nav that
 * briefly highlighted the wrong item on the way there would flicker.
 */
function activeTabFrom(location: string): ConsoleTab | null {
  const match = /^\/admin\/console\/([^/?#]+)/.exec(location);
  const candidate = match?.[1];
  return isConsoleTab(candidate) ? candidate : null;
}
