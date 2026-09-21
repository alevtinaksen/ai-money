import { useEffect, useMemo, useCallback } from 'react';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
          start_param?: string;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
      };
    };
  }
}

export function useTelegram() {
  const tg = useMemo(() => window.Telegram?.WebApp, []);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      try {
        (tg as any).disableVerticalSwipes?.();
      } catch (e) {}
    }
  }, [tg]);

  const hapticImpact = useCallback(
    (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
      try {
        tg?.HapticFeedback?.impactOccurred(style);
      } catch (e) {
        // Fallback for vibration API in browsers
        if ('vibrate' in navigator) {
          navigator.vibrate(20);
        }
      }
    },
    [tg]
  );

  const hapticNotification = useCallback(
    (type: 'error' | 'success' | 'warning' = 'success') => {
      try {
        tg?.HapticFeedback?.notificationOccurred(type);
      } catch (e) {
        if ('vibrate' in navigator) {
          navigator.vibrate([30, 50, 30]);
        }
      }
    },
    [tg]
  );

  const user = tg?.initDataUnsafe?.user || {
    id: 999999,
    first_name: 'Пользователь',
    username: 'demo_user',
  };

  const initData = tg?.initData || 'demo:999999';

  return {
    tg,
    user,
    initData,
    hapticImpact,
    hapticNotification,
    isInsideTelegram: Boolean(window.Telegram?.WebApp?.initData),
  };
}
