import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'auto',
  isDark: false,
  setMode: () => {},
  toggleTheme: () => {},
});

function savedMode(): ThemeMode {
  try {
    const value = localStorage.getItem('app_theme_mode');
    return value === 'dark' || value === 'light' ? value : 'auto';
  } catch { return 'auto'; }
}

function automaticDark(): boolean {
  const tg = (window as any).Telegram?.WebApp;
  const scheme = tg?.colorScheme;
  // The SDK also exists in ordinary browsers with empty initData and default light.
  if (tg?.initData && (scheme === 'dark' || scheme === 'light')) return scheme === 'dark';
  return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(savedMode);
  const [systemDark, setSystemDark] = useState<boolean>(automaticDark);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleThemeChanged = () => setSystemDark(automaticDark());
    media?.addEventListener?.('change', handleThemeChanged);
    if (tg?.onEvent) {
      tg.onEvent('themeChanged', handleThemeChanged);
    }
    return () => { tg?.offEvent?.('themeChanged', handleThemeChanged); media?.removeEventListener?.('change', handleThemeChanged); };
  }, []);

  const isDark = mode === 'dark' || (mode === 'auto' && systemDark);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    try { localStorage.setItem('app_theme_mode', newMode); } catch { /* Keep theme usable when storage is blocked. */ }
  };

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setMode(next);
  };

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
