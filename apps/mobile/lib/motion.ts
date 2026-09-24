/**
 * The motion vocabulary, in one place.
 *
 * `docs/design-mobile.md` names four durations, three springs and a short list of
 * magnitudes, and this file is the only place any of them is written down. The reason is
 * the one that produced `theme/tokens.ts`: a duration typed at a call site is defensible
 * alone and wrong next to the eleven others, and a screen that reaches for `withTiming(200)`
 * is a screen that has quietly invented a fifth step.
 *
 * Nothing here imports reanimated. These are numbers and plain objects, so the same values
 * feed `withSpring`, `withTiming` or React Native's own `Animated` — and the fallback path
 * (see `components/pressable.tsx`) does not need a second copy of them.
 */

/**
 * How long a transition takes, by what it is for.
 *
 * `instant` is press feedback and the visual twin of a haptic; `standard` is one element
 * changing; `entering` is a block arriving; `sheet` is a screen or sheet itself moving.
 * Nothing exceeds 320ms: a transition a person can notice *as a duration* is a transition
 * that is in the way.
 */
export const duration = {
	instant: 120,
	standard: 180,
	entering: 240,
	sheet: 320,
} as const;

/**
 * An exit is 0.7 of its entrance.
 *
 * Leaving slower than arriving is what makes an app feel sticky — the screen the reader
 * has finished with should get out of the way faster than it appeared.
 */
export const EXIT_RATIO = 0.7;

/** The exit length for an entrance of `enter` milliseconds. */
export function exitDuration(enter: number): number {
	return Math.round(enter * EXIT_RATIO);
}

/**
 * A spring, in the four numbers reanimated and `Animated` both understand.
 *
 * Springs rather than durations for anything a finger owns, because a duration cannot be
 * interrupted and a spring can: a press released halfway through has to turn around from
 * where it is, not from where a timeline assumed it would be.
 */
export type SpringConfig = {
	damping: number;
	stiffness: number;
	mass?: number;
};

/**
 * The three presets.
 *
 * `press` carries a mass because a press has weight under a thumb; `sheet` is softer and
 * slower because a sheet is large and a stiff spring on a large surface reads as a snap;
 * `layout` sits between them for anything reordering itself.
 */
export const spring = {
	press: { damping: 18, stiffness: 220, mass: 0.9 },
	sheet: { damping: 22, stiffness: 180 },
	layout: { damping: 20, stiffness: 200 },
} as const satisfies Record<string, SpringConfig>;

/**
 * The press scale for a discrete control — a button, a card, an icon target.
 *
 * `PRESS_SCALE_ROW` is the one for a full-width row: a row that moves 3% looks like the
 * screen shifted under the reader, because its edges are the screen's edges.
 */
export const PRESS_SCALE = 0.97;
export const PRESS_SCALE_ROW = 0.98;

/**
 * The opacity a control settles to while pressed.
 *
 * This is the half of press feedback that survives reduced motion: a 120ms crossfade still
 * answers "did it register" when every transform has been turned off.
 */
export const PRESS_OPACITY = 0.9;

/**
 * How far a *state* toggle overshoots before it settles.
 *
 * A press shrinks (`PRESS_SCALE`) and a state change is the opposite move: the heart that
 * just filled, the tick that just landed, get a moment larger than they will be and then
 * fall back to their real size. It is the only magnitude in this vocabulary that goes past
 * where it is going, and that is why it is reserved for a control whose **state** changed
 * rather than one that was merely touched — an overshoot on a press would make every tap on
 * the screen bounce, which is the tell of an app that animates because it can.
 *
 * The fall back to 1 is `spring.press`, so the settle is interruptible: a second tap
 * halfway through the pop turns around from where the heart is rather than restarting.
 */
export const STATE_POP = 1.15;

/** The gap between two items entering, and the item after which everything enters together. */
export const STAGGER_STEP = 40;
export const STAGGER_MAX_ITEMS = 6;

/**
 * The delay for the item at `index` in a staggered entrance.
 *
 * Items one to six get 0, 40, 80, 120, 160, 200ms; the seventh and every one after it get
 * 200 as well. A twenty-item list that animates for 800ms is a list that is late — the
 * stagger is there to show the reader that a group arrived, and six items already do that.
 */
export function staggerDelay(index: number): number {
	const step = Math.min(Math.max(index, 0), STAGGER_MAX_ITEMS - 1);
	return step * STAGGER_STEP;
}

/** How far an entering item rises, in points. */
export const ENTER_RISE = 8;

/** The crossfade once an image has loaded. No spinner goes inside an image, ever. */
export const IMAGE_FADE = 200;

/** The shimmer sweep across a skeleton block. */
export const SKELETON_SWEEP = 1200;

/**
 * The shortest a skeleton may stay on screen once it has appeared.
 *
 * Below this a flash of grey is worse than nothing: on a fast connection the honest answer
 * is "instant", and a skeleton that appears for 80ms reads as a flicker the reader has to
 * look at twice.
 */
export const SKELETON_MIN_HOLD = 240;
