import "@testing-library/jest-dom";

/**
 * The SaaS API host, for tests.
 *
 * Set here rather than in each test file because `lib/api.ts` and `lib/error-reporting.ts`
 * both resolve their base from `import.meta.env` **at module load**, so a test that wants to
 * exercise either has to have the variable in place before the import is evaluated — which
 * a `beforeEach` cannot do.
 *
 * It is a dummy value and nothing resolves it: every test that reaches the network stubs
 * `fetch`. What it buys is that the guard which refuses an unconfigured base does not fire
 * in the suite, so the three tests that were failing are testing their own subject again
 * rather than the absence of a build variable.
 */
/**
 * `ImportMetaEnv` declares its members `readonly`, which is right for a build-time constant
 * and wrong for a test that has to stand one up. Rather than widen the global type for
 * every consumer, the cast is local to here and the object it reaches is the same
 * `import.meta.env` both clients read at module load.
 */
const env = import.meta.env as Record<string, string | undefined>;
if (!env.VITE_API_URL) {
  env.VITE_API_URL = "https://saas-api.test";
}

/**
 * `IntersectionObserver`, which jsdom does not implement.
 *
 * `motion`'s `useInView` constructs one at mount, so any component using it throws
 * `ReferenceError: IntersectionObserver is not defined` on render — which is how the Arc
 * `AnimatedCounter` first failed here. Every real browser has had it for years, so this is a
 * jsdom gap and not a runtime one, and the stub belongs in the shared setup rather than in
 * whichever test happens to render a motion component today.
 *
 * The stub reports **not intersecting**, which is the honest answer for an element that was
 * never laid out: `animateOnView` stays armed, digits render at their real value, and the
 * roll-up simply never plays. Asserting the *final* state rather than the animation is what
 * makes a test here meaningful anyway — the animation is the part that does not run.
 */
if (typeof globalThis.IntersectionObserver === "undefined") {
  class TestIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: ReadonlyArray<number> = [];
    disconnect() {}
    observe() {}
    unobserve() {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  globalThis.IntersectionObserver = TestIntersectionObserver;
}

/**
 * `window.matchMedia`, which jsdom does not implement.
 *
 * shadcn's `SidebarProvider` calls it on mount — `useIsMobile()` reads
 * `(max-width: 768px)` to decide whether to render a rail or a sheet — so **any** test that
 * renders a sidebar, a navigation drawer, or anything built on that provider throws
 * `TypeError: window.matchMedia is not a function`.
 *
 * Like the observer above, this is a jsdom gap rather than a runtime one, and it belongs here
 * rather than in whichever test happens to render a responsive component first.
 *
 * The stub reports **no match** for everything, which makes `useIsMobile()` answer `false` —
 * i.e. "desktop". That is the right default for this suite: the desktop layout is the one the
 * vast majority of these assertions are about, and a stub that reported a phone viewport would
 * make responsive branches render by default and hide desktop bugs. A test that needs the
 * mobile branch can override `matchMedia` for itself.
 */
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/**
 * `ResizeObserver`, which jsdom does not implement either.
 *
 * Arc's `SortableDataTable` constructs **three** of them at mount — one to measure each column
 * before locking its width, one to keep the sorted-column band aligned while rows move, and
 * one per `Swap` label to animate the count line's width — so rendering it without this stub
 * throws `ReferenceError: ResizeObserver is not defined`.
 *
 * Same reasoning as the two above: a real browser has had it for years, so this is a jsdom gap
 * rather than a runtime one, and it belongs in the shared setup.
 *
 * The stub never fires. That is deliberate and it is what makes the assertions meaningful: the
 * column-width lock is an *optimisation* that stops the layout reflowing during a sort, and the
 * band is decoration. Neither is behaviour under test here, so a silent observer leaves the
 * table in its fully functional first-paint state and the tests can assert what the component
 * actually promises — the rows, the headers and the order they come back in.
 */
if (typeof globalThis.ResizeObserver === "undefined") {
  class TestResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver = TestResizeObserver;
}
