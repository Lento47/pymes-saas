// Fallback ambient declarations for packages not available in this environment.
// These are present in package.json and properly typed when npm install runs.

// ── JSX support ──────────────────────────────────────────────────────────────
declare namespace JSX {
  type Element = any;
  interface ElementClass { render(): any; }
  interface ElementAttributesProperty { props: {}; }
  interface ElementChildrenAttribute { children: {}; }
  interface IntrinsicElements { [key: string]: any; }
  interface IntrinsicAttributes { key?: string | number | null; }
}

// ── React (all types exported so `import * as React` namespace access works) ──
declare module "react" {
  export type ReactNode = any;
  export type ReactElement = any;
  export type FC<P = {}> = (props: P & { children?: ReactNode; [k: string]: any }) => ReactElement | null;
  export type FunctionComponent<P = {}> = FC<P>;
  export type ComponentType<P = {}> = FC<P>;
  export type RefObject<T> = { current: T | null };
  export type MutableRefObject<T> = { current: T };
  export type Dispatch<A> = (action: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export type EffectCallback = () => void | (() => void);
  export type DependencyList = readonly unknown[];
  export type Context<T> = { Provider: FC<{ value: T; children?: ReactNode }>; Consumer: any };
  export type ForwardRefExoticComponent<P> = FC<P> & { displayName?: string };
  export type Key = string | number;
  export type Ref<T> = RefObject<T> | ((instance: T | null) => void) | null;
  export type PropsWithChildren<P = unknown> = P & { children?: ReactNode };
  export type HTMLAttributes<T = Element> = Record<string, any> & { children?: ReactNode };
  export type CSSProperties = Record<string, string | number | undefined>;
  export type SyntheticEvent<T = Element, E = Event> = any;
  export type MouseEvent<T = Element, E = globalThis.MouseEvent> = any;
  export type ChangeEvent<T = Element> = any;
  export type KeyboardEvent<T = Element> = any;
  export type FocusEvent<T = Element> = any;
  export type FormEvent<T = Element> = any;
  export type PointerEvent<T = Element> = any;
  export type DragEvent<T = Element> = any;
  export type WheelEvent<T = Element> = any;
  export type TouchEvent<T = Element> = any;
  export type AnimationEvent<T = Element> = any;
  export type TransitionEvent<T = Element> = any;
  export type ClipboardEvent<T = Element> = any;
  export type ComponentPropsWithoutRef<T> = any;
  export type ComponentPropsWithRef<T> = any;
  export type ComponentProps<T> = any;
  export type ElementRef<T> = any;
  export type ElementType = any;
  export type LazyExoticComponent<T extends ComponentType<any>> = T;
  export type ReactPortal = any;
  export type ReactChild = any;
  export type ReactFragment = any;
  export type PropsWithRef<P> = P & { ref?: any };
  export type WeakValidationMap<T> = any;
  export type ValidationMap<T> = any;
  export type ExoticComponent<P = {}> = FC<P> & { $$typeof: symbol };
  export interface Component<P = {}, S = {}> { props: P; state: S; setState(s: any): void; render(): ReactNode; }
  export class PureComponent<P = {}, S = {}> { props: P; state: S; setState(s: any): void; render(): ReactNode; }
  export const useState: <T>(init: T | (() => T)) => [T, Dispatch<SetStateAction<T>>];
  export const useEffect: (effect: EffectCallback, deps?: DependencyList) => void;
  export const useLayoutEffect: (effect: EffectCallback, deps?: DependencyList) => void;
  export const useCallback: <T extends (...args: any[]) => any>(cb: T, deps: DependencyList) => T;
  export const useMemo: <T>(factory: () => T, deps: DependencyList) => T;
  export const useRef: <T = undefined>(initial?: T) => MutableRefObject<T>;
  export const useContext: <T>(ctx: Context<T>) => T;
  export const useReducer: <S, A>(reducer: (s: S, a: A) => S, init: S, initializer?: (a: S) => S) => [S, Dispatch<A>];
  export const useId: () => string;
  export const useImperativeHandle: (ref: any, init: () => any, deps?: DependencyList) => void;
  export const useDebugValue: (val: any, fmt?: (v: any) => any) => void;
  export const useTransition: () => [boolean, (cb: () => void) => void];
  export const useDeferredValue: <T>(val: T) => T;
  export const useSyncExternalStore: (sub: any, get: any, getServer?: any) => any;
  export const createContext: <T>(def: T) => Context<T>;
  export const createRef: <T>() => RefObject<T>;
  export const forwardRef: <T, P = {}>(render: (props: P, ref: Ref<T>) => ReactNode) => ForwardRefExoticComponent<PropsWithChildren<P> & { ref?: Ref<T> }>;
  export const memo: <T extends ComponentType<any>>(c: T, eq?: (a: any, b: any) => boolean) => T;
  export const lazy: <T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) => LazyExoticComponent<T>;
  export const Suspense: FC<{ fallback?: ReactNode; children?: ReactNode }>;
  export const Fragment: FC<{ children?: ReactNode }>;
  export const StrictMode: FC<{ children?: ReactNode }>;
  export const createPortal: (children: ReactNode, container: Element) => ReactElement;
  export const createElement: (...args: any[]) => ReactElement;
  export const cloneElement: (el: ReactElement, props?: any, ...children: ReactNode[]) => ReactElement;
  export const isValidElement: (obj: any) => obj is ReactElement;
  export const Children: { map: any; forEach: any; count: any; only: any; toArray: any };
  export const version: string;
  export const startTransition: (cb: () => void) => void;
  // default export is `any` so `import React from 'react'; React.FC` resolves without errors
  const _React: any;
  export default _React;
}

// Global React namespace so files can use React.FC / React.ReactNode without an import
declare namespace React {
  type ReactNode = any;
  type ReactElement = any;
  type FC<P = {}> = any;
  type FunctionComponent<P = {}> = any;
  type ComponentType<P = {}> = any;
  type ComponentClass<P = {}> = any;
  type Component<P = {}, S = {}> = any;
  type PureComponent<P = {}, S = {}> = any;
  type RefObject<T> = any;
  type MutableRefObject<T> = any;
  type Ref<T> = any;
  type Context<T> = any;
  type Dispatch<A> = any;
  type SetStateAction<S> = any;
  type EffectCallback = any;
  type DependencyList = any;
  type CSSProperties = any;
  type HTMLAttributes<T = Element> = any;
  type ComponentPropsWithoutRef<T> = any;
  type ComponentPropsWithRef<T> = any;
  type ComponentProps<T> = any;
  type ElementRef<T> = any;
  type ElementType = any;
  type PropsWithChildren<P = unknown> = any;
  type ForwardRefExoticComponent<P> = any;
  type LazyExoticComponent<T> = any;
  type SyntheticEvent<T = Element, E = Event> = any;
  type MouseEvent<T = Element, E = Event> = any;
  type ChangeEvent<T = Element> = any;
  type KeyboardEvent<T = Element> = any;
  type FocusEvent<T = Element> = any;
  type FormEvent<T = Element> = any;
  type DragEvent<T = Element> = any;
  type ClipboardEvent<T = Element> = any;
  type WheelEvent<T = Element> = any;
  type TouchEvent<T = Element> = any;
  type AnimationEvent<T = Element> = any;
  type TransitionEvent<T = Element> = any;
  type PointerEvent<T = Element> = any;
  type DetailedHTMLProps<E, T> = any;
  type SVGProps<T> = any;
  type ReactPortal = any;
  type ErrorInfo = any;
  type Key = any;
  type ReactChild = any;
  type Fragment = any;
  const Children: any;
  const Fragment: any;
  const StrictMode: any;
  const Suspense: any;
  const version: string;
  function createContext<T>(defaultValue: T): any;
  function createElement(...args: any[]): any;
  function cloneElement(...args: any[]): any;
  function forwardRef(...args: any[]): any;
  function memo(...args: any[]): any;
  function lazy(...args: any[]): any;
  function isValidElement(obj: any): boolean;
  function createRef<T>(): any;
  function startTransition(cb: () => void): void;
  function useState<T>(init: T | (() => T)): [T, any];
  function useEffect(effect: any, deps?: any[]): void;
  function useLayoutEffect(effect: any, deps?: any[]): void;
  function useCallback<T extends (...args: any[]) => any>(cb: T, deps: any[]): T;
  function useMemo<T>(factory: () => T, deps: any[]): T;
  function useRef<T>(initial?: T): any;
  function useContext<T>(ctx: any): T;
  function useReducer<S, A>(reducer: (s: S, a: A) => S, init: S): [S, any];
  function useId(): string;
  class Component<P = {}, S = {}> { props: P; state: S; setState(s: any): void; render(): any; context: any; refs: any; }
  class PureComponent<P = {}, S = {}> extends Component<P, S> {}
}

declare module "react/jsx-runtime" {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export const Fragment: any;
}

declare module "react-dom" {
  export function createRoot(c: Element | null): { render(el: any): void; unmount(): void };
  export function render(el: any, c: Element | null): void;
  export const createPortal: (children: any, c: Element) => any;
  export default ReactDOM;
  namespace ReactDOM {}
}

declare module "react-dom/client" {
  export function createRoot(c: Element | null): { render(el: any): void; unmount(): void };
  export function hydrateRoot(c: Element, el: any): { render(el: any): void; unmount(): void };
}

// ── Packages needing explicit type exports (TS6 bare-module change) ──────────
declare module "lucide-react";
declare module "class-variance-authority" {
  export type VariantProps<T> = any;
  export function cva(...args: any[]): any;
  export const cx: (...args: any[]) => string;
}
declare module "clsx" {
  export type ClassValue = any;
  export function clsx(...args: any[]): string;
  const _: any;
  export default _;
}
declare module "embla-carousel-react" {
  export type UseEmblaCarouselType = any;
  export default function useEmblaCarousel(...args: any[]): any;
}
declare module "@radix-ui/react-dialog" {
  export type DialogProps = any;
  const _: any;
  export default _;
}
declare module "react-hook-form" {
  export type FieldValues = any;
  export type FieldPath<T = any> = any;
  export type FieldPathValue<T, P> = any;
  export type ControllerProps<T = any, N = any> = any;
  export type ControllerRenderProps<T = any, N = any> = any;
  export type ControllerFieldState = any;
  export type UseFormStateReturn<T = any> = any;
  export type UseFormReturn<T = any> = any;
  export type UseFormProps<T = any> = any;
  export type RegisterOptions = any;
  export type DeepPartial<T> = any;
  export type Resolver<T = any> = any;
  export const Controller: any;
  export const FormProvider: any;
  export const useFormContext: (...args: any[]) => any;
  export const useForm: (...args: any[]) => any;
  const _: any;
  export default _;
}
declare module "@hookform/resolvers" { const _: any; export default _; }
declare module "@hookform/resolvers/*" { const _: any; export default _; }
declare module "@paddle/paddle-js" {
  export type Paddle = any;
  export function initializePaddle(...args: any[]): any;
  export function getPaddleInstance(): any;
  const _: any;
  export default _;
}
declare module "socket.io-client" {
  export type Socket = any;
  export function io(...args: any[]): any;
  const _: any;
  export default _;
}
declare module "@tanstack/react-query" {
  export type QueryFunction<T = any, K = any> = any;
  export type QueryKey = any;
  export type UseQueryResult<T = any> = any;
  export type UseMutationResult<T = any> = any;
  export const QueryClient: new (...args: any[]) => any;
  export const QueryClientProvider: any;
  export const useQuery: <T = any, E = unknown>(...args: any[]) => any;
  export const useMutation: <T = any, E = unknown, V = unknown>(...args: any[]) => any;
  export const useQueryClient: () => any;
  const _: any;
  export default _;
}
declare module "recharts" {
  export type LegendProps = any;
  export type TooltipProps<T = any, N = any> = any;
  export type CurveType = any;
  const _: any;
  export default _;
}
declare module "express" {
  export type Express = any;
  export type Request = any;
  export type Response = any;
  export type NextFunction = any;
  export type Router = any;
  export type RequestHandler = any;
  function express(): any;
  export default express;
}

// ── All other packages as bare ambient declarations ───────────────────────────
declare module "wouter";
declare module "wouter/memory-location";
declare module "tailwind-merge";
declare module "cmdk";
declare module "embla-carousel";
declare module "sonner";
declare module "next-themes";
declare module "input-otp";
declare module "vaul";
declare module "react-resizable-panels";
declare module "react-day-picker";
declare module "date-fns";
declare module "date-fns/*";
declare module "zod";
declare module "@tanstack/react-query-devtools";
declare module "@paypal/react-paypal-js";
declare module "react-dropzone";
declare module "react-zoom-pan-pinch";
declare module "react-markdown";
declare module "remark-gfm";
declare module "@radix-ui/react-accordion";
declare module "@radix-ui/react-alert-dialog";
declare module "@radix-ui/react-aspect-ratio";
declare module "@radix-ui/react-avatar";
declare module "@radix-ui/react-checkbox";
declare module "@radix-ui/react-collapsible";
declare module "@radix-ui/react-context-menu";
declare module "@radix-ui/react-dropdown-menu";
declare module "@radix-ui/react-hover-card";
declare module "@radix-ui/react-label";
declare module "@radix-ui/react-menubar";
declare module "@radix-ui/react-navigation-menu";
declare module "@radix-ui/react-popover";
declare module "@radix-ui/react-progress";
declare module "@radix-ui/react-radio-group";
declare module "@radix-ui/react-scroll-area";
declare module "@radix-ui/react-select";
declare module "@radix-ui/react-separator";
declare module "@radix-ui/react-slider";
declare module "@radix-ui/react-slot";
declare module "@radix-ui/react-switch";
declare module "@radix-ui/react-tabs";
declare module "@radix-ui/react-toast";
declare module "@radix-ui/react-toggle";
declare module "@radix-ui/react-toggle-group";
declare module "@radix-ui/react-tooltip";
declare module "@tanstack/react-virtual";
declare module "helmet";
declare module "http-proxy-middleware";
declare module "vite";
declare module "nanoid";
declare module "vitest/config";
declare module "@vitejs/plugin-react";
declare module "express-session";
declare module "passport";
declare module "passport-local";
declare module "express-rate-limit";
declare module "multer";
declare module "connect-pg-simple";

// ── Raw file imports (Vite `?raw` suffix) ────────────────────────────────────
declare module "*.md?raw" { const content: string; export default content; }
declare module "*.txt?raw" { const content: string; export default content; }

// ── Asset imports ─────────────────────────────────────────────────────────────
declare module "*.png" { const src: string; export default src; }
declare module "*.jpg" { const src: string; export default src; }
declare module "*.svg" { const src: string; export default src; }
declare module "*.webp" { const src: string; export default src; }
declare module "*.gif" { const src: string; export default src; }
