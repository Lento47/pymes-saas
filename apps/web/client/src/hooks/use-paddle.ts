import { useEffect, useState } from 'react';
import { initializePaddle, getPaddleInstance, type Paddle } from '@paddle/paddle-js';

// Module-level singleton so Paddle is only initialized once across renders
let instance: Paddle | undefined;
let initializing = false;
let initFailed = false;

export function usePaddle() {
  const [paddle, setPaddle] = useState<Paddle | undefined>(instance);

  useEffect(() => {
    // Already have an instance — just sync state
    if (instance) {
      setPaddle(instance);
      return;
    }

    // Currently loading from a previous effect run
    if (initializing) return;

    // Previous attempt failed — allow retry after 5s
    if (initFailed) {
      const retryTimer = setTimeout(() => { initFailed = false; }, 5000);
      return () => clearTimeout(retryTimer);
    }

    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
    if (!token) {
      console.warn('[usePaddle] VITE_PADDLE_CLIENT_TOKEN is not set — Paddle disabled');
      initFailed = true;
      return;
    }

    const env = (import.meta.env.VITE_PADDLE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    console.log(`[usePaddle] Initializing Paddle (${env})...`);

    initializing = true;

    initializePaddle({ environment: env, token })
      .then((p) => {
        instance = p ?? getPaddleInstance();
        initializing = false;

        if (!instance) {
          console.error(
            '[usePaddle] initializePaddle returned undefined — verify VITE_PADDLE_CLIENT_TOKEN ' +
            'and VITE_PADDLE_ENVIRONMENT match your Paddle dashboard (sandbox vs production)',
          );
          initFailed = true;
        } else {
          console.log('[usePaddle] Paddle ready');
        }

        setPaddle(instance ?? undefined);
      })
      .catch((err) => {
        initializing = false;
        initFailed = true;
        console.error('[usePaddle] initializePaddle threw:', err);
      });
  }, []);

  return paddle;
}

export function getPaddle(): Paddle | undefined {
  return instance ?? getPaddleInstance();
}
