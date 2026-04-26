import { useEffect, useState } from 'react';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';

export function usePaddle(): Paddle | undefined {
  const [paddle, setPaddle] = useState<Paddle>();

  useEffect(() => {
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
    if (!token) return;

    const env = (import.meta.env.VITE_PADDLE_ENVIRONMENT ?? 'sandbox') as 'sandbox' | 'production';
    initializePaddle({ environment: env, token }).then((p) => {
      if (p) setPaddle(p);
    });
  }, []);

  return paddle;
}
