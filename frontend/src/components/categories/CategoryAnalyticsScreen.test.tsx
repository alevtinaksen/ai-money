import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CategoryAnalyticsScreen } from './CategoryAnalyticsScreen';
import { CategoryAnalytics } from '../../types';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const category = { id: 'parent', name: 'Food', icon: '🍔', color: '#fff', type: 'expense' as const };
const props = { auth: 'signed', category, initialMonth: 0, currency: 'RUB', kind: 'expense' as const, onClose: vi.fn(), onSelectTransaction: vi.fn() };
const tx = { id: 'tx', account_id: 'a', user_id: 1, revision: 1, amount: 1, type: 'expense' as const, currency: 'RUB', created_at: '2026-10-01T00:00:00Z' };
const data: CategoryAnalytics = { category_id: 'parent', currency: 'RUB', kind: 'expense', period_label: '2026-10', total_amount: 62.5, transaction_count: 61, breakdown: [], transactions: [tx] };
test('shows full server total even when only part of history is loaded and preserves filters for pagination', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(data)))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...data, transactions: [{ ...tx, id: 'next' }] })));
  vi.stubGlobal('fetch', fetch); render(<CategoryAnalyticsScreen {...props} />);
  await screen.findByText('62.5'); fireEvent.click(screen.getByText('Загрузить ещё'));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  const params = new URL(fetch.mock.calls[1][0], 'http://localhost').searchParams;
  expect(params.get('offset')).toBe('1'); expect(params.get('kind')).toBe('expense'); expect(params.get('currency')).toBe('RUB');
  expect(screen.getByText('62.5')).toBeTruthy();
});
test('a late response for the previous month cannot replace current empty statistics', async () => {
  let finish!: (response: Response) => void;
  const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...data, total_amount: 0, transaction_count: 0, transactions: [] })));
  vi.stubGlobal('fetch', fetch); render(<CategoryAnalyticsScreen {...props} />);
  fireEvent.click(screen.getByLabelText('Предыдущий месяц')); await screen.findByText('Нет операций в выбранном месяце');
  await act(async () => { finish(new Response(JSON.stringify(data))); });
  expect(screen.queryByText('62.5')).toBeNull(); expect(screen.getByText('Нет операций в выбранном месяце')).toBeTruthy();
});
test('errors provide retry without showing fabricated totals', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"detail":"Try again"}', { status: 503 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ ...data, total_amount: 0, transaction_count: 0, transactions: [] }))));
  render(<CategoryAnalyticsScreen {...props} />); await screen.findByRole('alert');
  expect(screen.queryByText('62.5')).toBeNull(); fireEvent.click(screen.getByText('Повторить'));
  await screen.findByText('Нет операций в выбранном месяце');
});
