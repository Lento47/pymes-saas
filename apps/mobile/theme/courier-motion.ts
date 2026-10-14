/**
 * MOTION UI canvases for the courier tree.
 *
 * Waiting is a dark editorial dispatch surface. Active delivery is a light navigation
 * surface. Those personalities are **state-driven**, not the OS theme: a courier on a
 * run still sees the pale map when the phone is in dark mode, and the waiting board
 * stays dark when the phone is in light mode.
 *
 * Brand, route ink, and primary CTAs still come from `colors.primary`. The spec's
 * indigo (`#4166F5`) is the *role* of that token — never a hardcoded hue that would
 * freeze the theme picker.
 */

import { mixOklab } from "@/lib/color";

import type { ThemeColors } from "./tokens";
import { radius, space } from "./tokens";

export type CourierMotionMode = "waiting" | "active";

export type CourierMotionTokens = {
	canvas: string;
	elevated: string;
	sheet: string;
	/** Type on the dark/light canvas. */
	ink: string;
	muted: string;
	subtle: string;
	/**
	 * Type on `sheet`. The offer and task panels are always white, so this ink stays
	 * dark even when the waiting canvas — and the OS theme — are dark.
	 */
	sheetInk: string;
	sheetMuted: string;
	sheetBorder: string;
	sheetControl: string;
	border: string;
	brand: string;
	brandInk: string;
	brandSoft: string;
	geometry: string;
	handle: string;
	sliderTrack: string;
	sliderInk: string;
};

const WAITING = {
	canvas: "#101827",
	elevated: "#202C45",
	sheet: "#FFFFFF",
	ink: "#FFFFFF",
	muted: "#AEB9CC",
	subtle: "#7C8799",
	sheetInk: "#111827",
	sheetMuted: "#667085",
	sheetBorder: "#E8EBF1",
	sheetControl: "#F3F4F6",
	border: "rgba(255,255,255,0.14)",
	handle: "#D0D5DD",
	sliderTrack: "#111827",
	sliderInk: "#FFFFFF",
} as const;

const ACTIVE = {
	canvas: "#FAFBFD",
	elevated: "#FFFFFF",
	sheet: "#FFFFFF",
	ink: "#111827",
	muted: "#667085",
	subtle: "#98A2B3",
	sheetInk: "#111827",
	sheetMuted: "#667085",
	sheetBorder: "#E8EBF1",
	sheetControl: "#F3F4F6",
	border: "#E8EBF1",
	handle: "#D0D5DD",
	sliderTrack: "#111827",
	sliderInk: "#FFFFFF",
} as const;

export function courierMotionTokens(
	mode: CourierMotionMode,
	colors: ThemeColors,
): CourierMotionTokens {
	const base = mode === "waiting" ? WAITING : ACTIVE;
	return {
		...base,
		brand: colors.primary,
		brandInk: colors.primaryForeground,
		brandSoft: mixOklab(base.sheet, colors.primary, 0.88),
		geometry: mixOklab(base.canvas, colors.primary, 0.9),
	};
}

/** Editorial display sizes for the two courier canvases. Clamped at the call site. */
export const courierDisplay = {
	xl: { fontSize: 32, lineHeight: 36, letterSpacing: -0.8 },
	lg: { fontSize: 36, lineHeight: 40, letterSpacing: -1 },
	metric: { fontSize: 26, lineHeight: 30, letterSpacing: -0.5 },
	sheetTitle: { fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
	eyebrow: { fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
} as const;

export const courierMotionSpace = {
	gutter: space.xxl,
	sheetRadius: radius.xl,
	control: 56,
	thumb: 48,
} as const;
