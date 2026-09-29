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
 * changing; `banner` is a notice arriving over the screen; `entering` is a block arriving;
 * `sheet` is a screen or sheet itself moving. Nothing exceeds 320ms: a transition a person
 * can notice *as a duration* is a transition that is in the way.
 *
 * `banner` is the one step that sits between two others rather than on a round number:
 * `interface.md` §24 writes 220ms for the new-order surface, and §41 files banners under
 * Standard (160-220) rather than Structural (240-320). Running it on `entering` would put a
 * notice the size of a card on the same clock as a whole block arriving.
 *
 * `dialog` is the one value here chosen to satisfy two bands at once rather than one. A
 * question asked in a sheet arrives in 260-300 and leaves in 200-240, and `EXIT_RATIO` is not
 * a constant a surface gets to pick — so the entrance is the only free number, and 300 is what
 * leaves 210 behind it. `sheet` (320) was the nearest existing step and overshoots the arrival
 * band; `entering` (240) leaves 168, out the other side. It is a step here rather than a number
 * at the call site for this file's header: a duration typed at a call site is wrong next to the
 * others.
 */
export const duration = {
	instant: 120,
	standard: 180,
	banner: 220,
	entering: 240,
	dialog: 300,
	sheet: 320,
} as const;

/**
 * The curve a panel that is *talking* to the reader travels on.
 *
 * **Four numbers rather than an `EasingFunction`,** because this file's header promises that
 * nothing here imports reanimated — and an easing curve *is* a reanimated object. The control
 * points live here as a plain object and `./sheet` hands them to `Easing.bezier` at the one
 * place that owns a `withTiming`, so a second surface needing this curve reads these four
 * numbers rather than re-typing a curve nobody can read back.
 *
 * The panel leaves fast and arrives without a bounce: the reader has committed to a question,
 * and a sheet that overshoots its resting position reads as unsettled. The springs below are
 * right for a finger and wrong here — a finger can be turned around mid-flight and a fixed
 * curve cannot, but nothing here is a finger, so there is nothing to interrupt.
 */
export const EASE_DIALOG = { x1: 0.2, y1: 0.8, x2: 0.2, y2: 1 } as const;

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
 *
 * `PRESS_SCALE_DIALOG` is a third and the subtlest of the three, for a control that is the
 * only filled thing in a panel the reader is being asked to think in. 1.5% is below the point
 * where a movement reads as movement and above the point where a press reads as nothing at
 * all — the feedback is meant to say "this registered" without adding a second movement to a
 * surface whose only job is to be still. It is a scale and not an opacity change because
 * `PRESS_OPACITY` below already carries the half of the feedback that has to survive reduced
 * motion, and this is the half that does not.
 */
export const PRESS_SCALE = 0.97;
export const PRESS_SCALE_ROW = 0.98;
export const PRESS_SCALE_DIALOG = 0.985;

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

/**
 * How far the new-order banner falls into place, in points.
 *
 * The mirror of `ENTER_RISE` and a different magnitude because it is a different move:
 * `interface.md` §24's banner drops in from above (`translateY` -12 to 0), which is what a
 * surface arriving *over* the screen does, while a row rising into a list comes up from
 * below. Named here rather than typed at the surface for the reason in this file's header,
 * and 12 is the contract's own number, not a rounding of the rise above it.
 */
export const BANNER_DROP = 12;

/**
 * How long a just-arrived row's highlight takes to fall back to the row's own surface,
 * and how loud that highlight is while it lasts.
 *
 * `interface.md` §43 asks for a lime wash at 8-10% opacity fading back to normal over
 * 800-1200ms, and these two are that pair. They are magnitudes rather than `duration`
 * steps because `duration`'s own rule is that nothing exceeds 320ms — a transition a
 * person can notice *as a duration* is a transition that is in the way — and this is not
 * a transition the reader waits on. It is a decaying mark: the row has already arrived
 * and is already readable, and the wash is the second half of the announcement, the half
 * that says *which* row. `SKELETON_SWEEP` sits outside `duration` for the same reason.
 *
 * 1000 is the middle of §43's band. `HIGHLIGHT_OPACITY` is 0.09, the top of the 8-10%
 * band: a wash that has to survive a near-white row under kitchen lighting is a wash that
 * wants the whole allowance and nothing past it.
 */
export const HIGHLIGHT_FADE = 1000;
export const HIGHLIGHT_OPACITY = 0.09;

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
