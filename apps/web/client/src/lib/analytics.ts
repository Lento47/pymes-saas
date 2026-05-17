declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  gtag: (...args: Record<string, any>[]) => void;
  }
}

function gtag(...args: Record<string, any>[]) {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

/** Call when user accepts cookies — grants GA collection */
export function grantAnalyticsConsent() {
  gtag('consent', 'update', {
    analytics_storage: 'granted',
    ad_storage: 'denied',        // keep ads denied unless you run ad campaigns
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

/** Call when user rejects cookies — already denied by default, this is a no-op */
export function revokeAnalyticsConsent() {
  gtag('consent', 'update', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
}

export function trackPageView(path: string) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', { page_path: path });
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params ?? {});
}
