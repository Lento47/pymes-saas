/**
 * The shared rAF ticker.
 *
 * Everything that animates from scroll on the public marketing surface reads the same
 * loop: the sticky stack's recede, the canvas scenes, the route trace, the contour
 * field. If each of them owned a `requestAnimationFrame` they would read `scrollY` at
 * slightly different moments in the frame and visibly disagree, so there is exactly
 * one loop and everything subscribes to it.
 *
 * A subscriber declares a *framerate threshold in milliseconds*, not a target Hz. The
 * loop calls it only once `time - last` has exceeded that threshold, so:
 *
 *   - `0`   runs on every frame (the default; what scroll-driven work wants)
 *   - `8`   runs about every other frame on a 60Hz screen
 *   - `1000 / 60 - 2`  runs every frame on a 60Hz screen and every second frame at 120Hz
 *
 * The loop starts when the first subscriber arrives and cancels when the last one
 * leaves, so a page with no animation on it schedules no frames at all.
 */

export type TickCallback = (time: number, delta: number) => void;

/** Minimum milliseconds between two calls. `0` means "every frame". */
export type GetFramerate = () => number;

type Subscriber = {
  callback: TickCallback;
  getFramerate: GetFramerate;
  last: number;
};

const subscribers = new Set<Subscriber>();

let frame = 0;
let previousTime = 0;

function loop(time: number): void {
  frame = requestAnimationFrame(loop);

  // A tab that was backgrounded reports a single enormous delta. Clamping keeps a
  // canvas that integrates over `delta` from teleporting across the whole field.
  const delta = Math.min(time - previousTime, 64);
  previousTime = time;

  // Iterate a snapshot: a callback is allowed to subscribe or unsubscribe, and
  // mutating the live Set mid-iteration would otherwise skip or double a subscriber.
  for (const subscriber of Array.from(subscribers)) {
    if (time - subscriber.last > subscriber.getFramerate()) {
      subscriber.last = time;
      subscriber.callback(time, delta);
    }
  }
}

function start(): void {
  if (frame || subscribers.size > 1) return;
  previousTime = 0;
  frame = requestAnimationFrame(loop);
}

function stop(): void {
  if (frame) cancelAnimationFrame(frame);
  frame = 0;
}

/**
 * Register a per-frame callback. Returns the unsubscribe function.
 *
 * `getFramerate` is read every frame rather than captured once, so a subscriber can
 * back off its own rate — a scene that has finished its entrance and is now only
 * waiting on the cursor can drop to a coarse threshold without re-subscribing.
 */
export function subscribe(callback: TickCallback, getFramerate: GetFramerate = () => 0): () => void {
  const subscriber: Subscriber = { callback, getFramerate, last: Number.NEGATIVE_INFINITY };

  subscribers.add(subscriber);
  start();

  return () => {
    subscribers.delete(subscriber);
    if (subscribers.size === 0) stop();
  };
}

/** Live subscriber count. Exported for tests that assert the loop parks itself. */
export function subscriberCount(): number {
  return subscribers.size;
}
