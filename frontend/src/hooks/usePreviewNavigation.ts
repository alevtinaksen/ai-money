import { useEffect, useRef } from 'react';

const routes = ['dashboard', 'transactions', 'accounts', 'analytics', 'add-expense', 'categories',
  'currencies', 'settings', 'ai-review', 'backup'] as const;
export type PreviewRoute = typeof routes[number];
export interface PreviewNavigationResult { status: 'applied' | 'blocked'; message: string; }

/** This bridge is available only to the local design stand's same-origin parent. */
export function usePreviewNavigation(navigate: (route: PreviewRoute) => PreviewNavigationResult) {
  const current = useRef(navigate); current.current = navigate;
  useEffect(() => {
    if (window.parent === window || location.pathname !== '/frontend/dist/index.html' ||
      !['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname)) return;
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== location.origin) return;
      const data = event.data;
      if (!data || data.type !== 'ai-money:preview:navigate' || typeof data.requestId !== 'string' ||
        !data.requestId || data.requestId.length > 100) return;
      const result = routes.includes(data.route)
        ? current.current(data.route)
        : { status: 'unsupported', message: 'Этот сценарий стенда не поддерживается.' };
      window.parent.postMessage({ type: 'ai-money:preview:navigation-result', requestId: data.requestId,
        route: data.route, ...result }, location.origin);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
}
