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

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('app_theme_mode') as ThemeMode) || 'auto';
  });

  const [systemDark, setSystemDark] = useState<boolean>(() => {
    const tgDark = (window as any).Telegram?.WebApp?.colorScheme === 'dark';
    const mediaDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return Boolean(tgDark || mediaDark);
  });

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.onEvent) {
      const handleThemeChanged = () => {
        setSystemDark(tg.colorScheme === 'dark');
      };
      tg.onEvent('themeChanged', handleThemeChanged);
      return () => tg.offEvent?.('themeChanged', handleThemeChanged);
    }
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
    localStorage.setItem('app_theme_mode', newMode);
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
