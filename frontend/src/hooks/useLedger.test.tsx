import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useLedger } from './useLedger';
import { ApiError } from '../api/client';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
test.each([
  [0, 'uncertain'], [408, 'uncertain'], [500, 'uncertain'], [422, 'rejected'], [401, 'rejected'],
])('creation reports status %s without discarding the open draft', async (status, expected) => {
  const { result } = renderHook(() => useLedger('signed', false, 0, 'RUB'));
  let outcome;
  await act(async () => { outcome = await result.current.mutateCreation(async () => { throw new ApiError(Number(status), 'synthetic'); }); });
  expect(outcome).toBe(expected); expect(result.current.error).toBe('synthetic'); expect(result.current.expired).toBe(false);
});
test('deleting a transfer refreshes server balances without a second local debit', async () => {
  const account = { id: 'a', balance: 900, currency: 'RUB' }; let removed = false;
  localStorage.setItem('ai_money_accounts', JSON.stringify([{ ...account, balance: 800 }]));
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path.includes('/accounts')) return new Response(JSON.stringify([{ ...account, balance: removed ? 1000 : 900 }]));
    if (path.includes('/analytics')) return new Response(JSON.stringify({ total_balance: removed ? 1000 : 900 }));
    return new Response('[]');
  }));
  const { result } = renderHook(() => useLedger('signed', true, 0, 'RUB'));
  await waitFor(() => expect(result.current.accounts[0]?.balance).toBe(900));
  await act(async () => { await result.current.mutate(async () => { removed = true; }); });
  expect(result.current.accounts[0].balance).toBe(1000);
});
test('newest period wins when earlier reads complete after navigation', async () => {
  let resolveOld: (response: Response) => void = () => {};
  const old = new Promise<Response>(resolve => { resolveOld = resolve; });
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path.includes('/analytics') && path.includes('month_offset=0')) return old;
    if (path.includes('/analytics')) return new Response(JSON.stringify({ period_label: '2026-09' }));
    return new Response('[]');
  }));
  const { result, rerender } = renderHook(({ month }) => useLedger('signed', true, month, 'RUB'), { initialProps: { month: 0 } });
  rerender({ month: -1 });
  await waitFor(() => expect(result.current.summary?.period_label).toBe('2026-09'));
  await act(async () => { resolveOld(new Response(JSON.stringify({ period_label: '2026-10' }))); });
  expect(result.current.summary?.period_label).toBe('2026-09');
});

test.each([
  { month: -1, currency: 'RUB', label: '2026-09', expectedCurrency: 'RUB' },
  { month: 0, currency: 'USD', label: '2026-10', expectedCurrency: 'USD' },
])('pending write refreshes current period and currency: $month / $currency', async selected => {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (!path.includes('/analytics')) return new Response('[]');
    const query = new URL(path, 'http://localhost').searchParams;
    return new Response(JSON.stringify({
      period_label: query.get('month_offset') === '-1' ? '2026-09' : '2026-10',
      currency: query.get('currency'),
    }));
  }));
  let finishWrite!: () => void;
  const pendingWrite = new Promise<void>(resolve => { finishWrite = resolve; });
  const { result, rerender } = renderHook(
    ({ month, currency }) => useLedger('signed', true, month, currency),
    { initialProps: { month: 0, currency: 'RUB' } },
  );
  await waitFor(() => expect(result.current.summary?.period_label).toBe('2026-10'));
  let mutation!: Promise<boolean>;
  act(() => { mutation = result.current.mutate(() => pendingWrite); });
  rerender({ month: selected.month, currency: selected.currency });
  await waitFor(() => {
    expect(result.current.summary?.period_label).toBe(selected.label);
    expect(result.current.summary?.currency).toBe(selected.expectedCurrency);
  });
  await act(async () => { finishWrite(); await mutation; });
  expect(result.current.summary?.period_label).toBe(selected.label);
  expect(result.current.summary?.currency).toBe(selected.expectedCurrency);
});
