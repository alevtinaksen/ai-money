import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Dialog } from './Dialog';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
test('dialog traps keyboard focus and makes its background inert', () => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  render(<main><button>Фон</button><Dialog title="Редактор" onClose={() => {}}><button>Первый</button><button>Последний</button></Dialog></main>);
  const first = screen.getByText('Первый'), last = screen.getByText('Последний');
  expect(document.activeElement).toBe(first);
  last.focus(); fireEvent.keyDown(document, { key: 'Tab' }); expect(document.activeElement).toBe(first);
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(last);
  expect((screen.getByText('Фон') as HTMLElement).inert).toBe(true);
  expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
});
test('nested dialog receives Escape without closing its parent', () => {
  const outer = vi.fn(), inner = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  render(<Dialog title="Родитель" onClose={outer}><button>Родительский контрол</button><Dialog title="Вложенный" onClose={inner}><button>Вложенный контрол</button></Dialog></Dialog>);
  expect(document.activeElement).toBe(screen.getByText('Вложенный контрол'));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(inner).toHaveBeenCalledOnce(); expect(outer).not.toHaveBeenCalled();
});
test('a frozen draft keeps Tab and Shift+Tab on its enabled retry control', () => {
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  render(<Dialog title="Неопределённая запись" onClose={() => {}}><button>Повторить</button>
    <fieldset disabled><input aria-label="Замороженная сумма" /><button>Изменить счёт</button></fieldset></Dialog>);
  const retry = screen.getByText('Повторить');
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(retry);
  fireEvent.keyDown(document, { key: 'Tab' }); expect(document.activeElement).toBe(retry);
});
