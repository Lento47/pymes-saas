import { useEffect, useState } from 'react';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';

// Module-level singleton so Paddle is only initialized once across renders
let instance: Paddle | undefined;
let initializing = false;

export function usePaddle() {
  const [paddle, setPaddle] = useState<Paddle | undefined>(instance);

  useEffect(() => {
    if (instance || initializing) {
      if (instance) setPaddle(instance);
      return;
    }

    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
    if (!token) return;

    initializing = true;

    initializePaddle({
      environment: (import.meta.env.VITE_PADDLE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
      token,
    }).then((p) => {
      instance = p;
      initializing = false;
      setPaddle(p);
    });
  }, []);

  return paddle;
}
