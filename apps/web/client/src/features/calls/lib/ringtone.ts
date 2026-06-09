export function createRingtone(): { start: () => void; stop: () => void } {
  let ctx: AudioContext | null = null;
  let osc: OscillatorNode | null = null;
  let gain: GainNode | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;

  return {
    start: () => {
      try {
        ctx = new AudioContext();
        osc = ctx.createOscillator();
        gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.value = 0.3;
        osc.start();
        // US-style ring: 2s on, 4s off
        interval = setInterval(() => {
          if (gain) gain.gain.value = gain.gain.value > 0 ? 0 : 0.3;
        }, 2000);
      } catch {
        // Audio not available — silent fallback
      }
    },
    stop: () => {
      if (interval) clearInterval(interval);
      try {
        osc?.stop();
        ctx?.close();
      } catch {
        // Already stopped
      }
      ctx = null;
      osc = null;
      gain = null;
      interval = null;
    },
  };
}
