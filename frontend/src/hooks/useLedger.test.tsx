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

test.each(['mutation','pagination'])('old HTTP401 from %s cannot expire a restored local session',async kind=>{
 const {localLogin,authorization,clearSession}=await import('../api/session');
 const {request}=await import('../api/client');
 let finish!:(r:Response)=>void;const pending=new Promise<Response>(r=>finish=r);let logins=0;
 vi.stubGlobal('fetch',vi.fn(async(path:string,opts?:RequestInit)=>{
  if(path==='/api/auth/local')return new Response(JSON.stringify({access_token:++logins===1?'old':'new'}));
  if(opts?.method==='PUT'||path.includes('offset=50'))return pending;
  if(path.includes('/transactions'))return new Response(JSON.stringify(Array.from({length:50},(_,i)=>({id:String(i)}))));
  if(path.includes('/analytics'))return new Response('{}');return new Response('[]');
 }));
 await localLogin();const {result}=renderHook(()=>useLedger('',true,0,'RUB'));
 await waitFor(()=>expect(result.current.more).toBe(true));let operation!:Promise<unknown>;
 act(()=>{operation=kind==='mutation'?result.current.mutate(()=>request('/accounts/a','',{method:'PUT',body:'{}'})):result.current.loadMore();});
 await localLogin();act(()=>result.current.restoreSession());
 await act(async()=>{finish(new Response('{"detail":"old expired"}',{status:401}));await operation;});
 expect(authorization('')).toBe('Bearer new');expect(result.current.expired).toBe(false);expect(result.current.authRequired).toBe(false);expect(result.current.error).toBe('');clearSession();
});
