import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DateLabel } from './Primitives';
import { AccountsScreen } from '../accounts/AccountsScreen';
import { TransactionsScreen } from '../transactions/TransactionsScreen';
import { Account, Transaction } from '../../types';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const account: Account = { id: 'a', user_id: 1, name: 'Основной', group_name: 'Личное', balance: 150, currency: 'RUB', icon: '💳', color: '#fff', is_default: true, sort_order: 0 };
const tx: Transaction = { id: 't', user_id: 1, account_id: 'a', amount: 12.5, currency: 'RUB', type: 'expense', created_at: '2026-10-08T12:00:00Z', revision: 1, category_name: 'Кофе', category_icon: '☕', note: 'Синтетическая проверка' };
it('labels local calendar today and yesterday across midnight', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-08T22:30:00Z'));
  const now = new Date();
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const previous = new Date(now); previous.setDate(previous.getDate()-1);
  render(<><DateLabel day={key(now)} /><DateLabel day={key(previous)} /></>);
  expect(screen.getByText('[Сегодня]')).toBeTruthy(); expect(screen.getByText('[Вчера]')).toBeTruthy();
});
it('keeps currencies separate and account group collapse and selection working', () => {
  const select = vi.fn(), create = vi.fn(), transfer = vi.fn();
  render(<AccountsScreen accounts={[account, { ...account, id: 'b', name: 'Доллары', currency: 'USD', balance: 20 }]} onBack={vi.fn()} onSelectAccount={select} onAddNewAccount={create} onOpenTransfer={transfer} />);
  expect(screen.getByLabelText('Остатки по валютам').textContent).toContain('150');
  expect(screen.getByLabelText('Остатки по валютам').textContent).toContain('20');
  fireEvent.click(screen.getByRole('button', { name: /Основной/ })); expect(select).toHaveBeenCalledWith(account);
  fireEvent.click(screen.getByRole('button', { name: 'Личное' })); expect(screen.queryByRole('button', { name: /Основной/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Создать счёт' })); expect(create).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Перевести между счетами' })); expect(transfer).toHaveBeenCalledOnce();
});
it('keeps history editing, search and reset without presenting unavailable reordering', () => {
  const select = vi.fn();
  const view = render(<TransactionsScreen transactions={[tx]} accounts={[account]} categories={[]} onBack={vi.fn()} onSelectTransaction={select} onOpenAddTransaction={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Синтетическая проверка/ })); expect(select).toHaveBeenCalledWith(tx);
  expect(view.container.querySelector('.design-drag-slot')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Поиск и фильтры' }));
  fireEvent.change(screen.getByPlaceholderText('Категория, счёт, комментарий или сумма'), { target: { value: 'несуществующая запись' } });
  expect(screen.getByText('Ничего не найдено')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  expect(screen.getByRole('button', { name: /Синтетическая проверка/ })).toBeTruthy();
});
