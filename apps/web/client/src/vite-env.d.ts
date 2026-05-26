interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_PADDLE_CLIENT_TOKEN?: string;
  readonly VITE_PADDLE_ENVIRONMENT?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_ELEVEN_LABS_API_KEY?: string;
  readonly [key: string]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
