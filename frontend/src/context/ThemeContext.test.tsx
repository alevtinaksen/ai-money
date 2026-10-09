import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from './ThemeContext';
import { SettingsScreen } from '../components/settings/SettingsScreen';

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); document.documentElement.classList.remove('dark'); document.body.classList.remove('dark'); });
function settings() {
  return render(<ThemeProvider><SettingsScreen categories={[]} onBack={vi.fn()} onSaveCategory={vi.fn(async () => true)} onDeleteCategory={vi.fn()} /></ThemeProvider>);
}
it('manual light/dark persists across reopening settings', () => {
  localStorage.clear();
  const view = settings();
  fireEvent.click(screen.getByRole('radio', { name: 'Тёмная' }));
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  expect(localStorage.getItem('app_theme_mode')).toBe('dark');
  view.unmount(); settings();
  expect((screen.getByRole('radio', { name: 'Тёмная' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: 'Светлая' }));
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});
it('auto respects Telegram light even when the system is dark, and follows themeChanged', () => {
  localStorage.clear();
  let changed = () => {};
  const webApp = { initData: 'synthetic-launch', colorScheme: 'light', onEvent: (_event: string, handler: () => void) => { changed = handler; }, offEvent: vi.fn() };
  vi.stubGlobal('Telegram', { WebApp: webApp });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  settings();
  expect(document.documentElement.classList.contains('dark')).toBe(false);
  act(() => { webApp.colorScheme = 'dark'; changed(); });
  expect(document.documentElement.classList.contains('dark')).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: /Как в Telegram/ }));
  act(() => { webApp.colorScheme = 'light'; changed(); });
  expect(document.documentElement.classList.contains('dark')).toBe(false);
});
it('auto follows the browser system theme when the Telegram SDK is loaded outside a Mini App', () => {
  localStorage.clear();
  vi.stubGlobal('Telegram', { WebApp: { initData: '', colorScheme: 'light' } });
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  settings();
  expect(document.documentElement.classList.contains('dark')).toBe(true);
});
