import { beforeEach, afterEach, expect, test, vi } from 'vitest';
import { createTransactionAPI, deleteTransactionAPI, fetchAccounts, fetchCategories, fetchDashboard, fetchTransactions, updateTransactionAPI } from './client';
const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
afterEach(() => vi.unstubAllGlobals());
const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 });
test('validation and offline deletion never become successful financial writes', async () => {
  fetchMock.mockResolvedValueOnce(new Response('{"detail":"Invalid"}', { status: 422 }));
  await expect(createTransactionAPI('signed', { account_id: 'a', amount: '12.00', type: 'expense' })).rejects.toMatchObject({ status: 422 });
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await expect(deleteTransactionAPI('signed', 'tx', 2)).rejects.toMatchObject({ status: 0 });
});
test('empty accounts stay empty and categories load with signed authorization', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(ok([])));
  expect(await fetchAccounts('signed')).toEqual([]);
  expect(await fetchCategories('signed')).toEqual([]);
  expect(fetchMock.mock.calls[1][0]).toBe('/api/categories');
  expect(fetchMock.mock.calls[1][1].headers.get('Authorization')).toBe('tma signed');
});
test('latest server revisions and aggregates replace stale local data', async () => {
  const old = { period_expense: 1000, recent_transactions: [{ id: 'tx', amount: 10, revision: 1 }] };
  const next = { period_expense: 2000, recent_transactions: [{ id: 'tx', amount: 20, revision: 2 }] };
  localStorage.setItem('ai_money_sync_data', JSON.stringify(old));
  fetchMock.mockResolvedValueOnce(ok(old)).mockResolvedValueOnce(ok(next));
  await fetchDashboard('signed', -1, 'USD');
  expect(await fetchDashboard('signed', -1, 'USD')).toEqual(next);
  expect(fetchMock.mock.calls[1][0]).toContain('month_offset=-1&currency=USD');
});
test('mutation versions, retry identity and history pagination cross the HTTP boundary', async () => {
  fetchMock.mockImplementation(() => Promise.resolve(ok({ id: 'tx', revision: 2, amount: 10, account_id: 'a', type: 'expense' })));
  const data = { account_id: 'a', amount: '10.00', type: 'expense' as const, client_id: 'stable' };
  await createTransactionAPI('signed', data); await createTransactionAPI('signed', data);
  expect(fetchMock.mock.calls[0][1].body).toBe(fetchMock.mock.calls[1][1].body);
  const { client_id: _key, ...fields } = data;
  await updateTransactionAPI('signed', 'tx', { ...fields, revision: 1 });
  expect(JSON.parse(fetchMock.mock.calls[2][1].body).revision).toBe(1);
  await deleteTransactionAPI('signed', 'tx', 2);
  expect(fetchMock.mock.calls[3][0]).toContain('revision=2');
  await fetchTransactions('signed', 50, undefined, 'USD');
  expect(fetchMock.mock.calls[4][0]).toContain('offset=50&limit=50&currency=USD');
});
test.each([null, {}, { id: '', revision: 1, amount: 10, account_id: 'a', type: 'expense' },
  { id: 'tx', revision: 0, amount: 10, account_id: 'a', type: 'expense' },
  { id: 'tx', revision: 1, amount: '10.00', account_id: 'a', type: 'expense' },
  { id: 'tx', revision: 1, amount: null, account_id: 'a', type: 'expense' },
  { id: 'tx', revision: 1, amount: 20, account_id: 'a', type: 'expense' },
  { id: 'tx', revision: 1, amount: 10, account_id: 'other', type: 'expense' },
  { id: 'tx', revision: 1, amount: 10, account_id: 'a', type: 'unknown' },
])('invalid transaction acknowledgement %j remains ambiguous', async body => {
  fetchMock.mockResolvedValueOnce(ok(body));
  await expect(createTransactionAPI('signed', { account_id: 'a', amount: '10.00', type: 'expense', client_id: 'stable' }))
    .rejects.toMatchObject({ status: 0 });
});
test('401 with a null error body still reports auth expiry instead of a network failure', async () => {
  fetchMock.mockResolvedValueOnce(new Response('null', { status: 401 }));
  await expect(createTransactionAPI('signed', { account_id: 'a', amount: '10.00', type: 'expense' }))
    .rejects.toMatchObject({ status: 401 });
});
