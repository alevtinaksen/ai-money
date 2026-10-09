import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DashboardScreen } from './DashboardScreen';
import { DashboardSummary, Transaction } from '../../types';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const summary: DashboardSummary = { currency: 'RUB', balances_by_currency: { RUB: 100 }, totals_by_currency: { RUB: { income: 0, expense: 0 } },
  total_balance: 100, period_label: '2026-10', period_income: 0, period_expense: 0, categories: [], recent_transactions: [] };
function show(transactions: Transaction[]) {
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 9, 12));
  return render(<DashboardScreen summary={{ ...summary, recent_transactions: transactions }} accounts={[]} categories={[]}
    onOpenAccounts={vi.fn()} onOpenAddTransaction={vi.fn()} onOpenVoice={vi.fn()} onScanReceipt={vi.fn()} monthOffset={0} onMonthChange={vi.fn()} />);
}
it('omits yesterday entirely when empty while keeping the today action', () => {
  show([]);
  expect(screen.queryByText('[Вчера]')).toBeNull();
  expect(screen.queryByText('Нет операций за вчера')).toBeNull();
  expect(screen.getByRole('button', { name: /Добавить первую операцию/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Синхронизировать данные' })).toBeNull();
});
it('shows yesterday when it contains an operation', () => {
  show([{ id: 't', user_id: 1, account_id: 'a', amount: 25, currency: 'RUB', type: 'expense',
    revision: 1, created_at: new Date(2026, 9, 8, 12).toISOString(), note: 'Synthetic yesterday' }]);
  expect(screen.getByText('[Вчера]')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Synthetic yesterday/ })).toBeTruthy();
});
