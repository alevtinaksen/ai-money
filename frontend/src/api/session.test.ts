import { afterEach, expect, test, vi } from 'vitest';
import { request } from './client';
import { authorization, clearSession, localLogin } from './session';

afterEach(() => { clearSession(); vi.unstubAllGlobals(); });
test.each(['', 'signed-old'])('late 401 for request auth %s cannot erase a newer local session', async initData => {
  clearSession();
  let authCalls = 0, finish!: (response: Response) => void;
  const delayed = new Promise<Response>(resolve => { finish = resolve; });
  const sent: (string | null)[] = [];
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    if (path === '/api/auth/local') return new Response(JSON.stringify({ access_token: ++authCalls === 1 ? 'synthetic-old' : 'synthetic-new' }));
    sent.push((options?.headers as Headers).get('Authorization'));
    return path === '/api/stale' ? delayed : new Response('{}');
  }));
  await localLogin();
  const stale = request('/stale', initData).catch(error => error);
  await localLogin(); expect(authorization('')).toBe('Bearer synthetic-new');
  finish(new Response('{"detail":"Old expired"}', { status: 401 }));
  expect(await stale).toMatchObject({ status: 401 });
  expect(authorization('')).toBe('Bearer synthetic-new');
  await request('/probe');
  expect(sent).toEqual([initData ? 'tma signed-old' : 'Bearer synthetic-old', 'Bearer synthetic-new']);
});
test('401 for the current local bearer still clears the expired session', async () => {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => path === '/api/auth/local'
    ? new Response('{"access_token":"synthetic-current"}')
    : new Response('{"detail":"Expired"}', { status: 401 })));
  await localLogin();
  await expect(request('/probe')).rejects.toMatchObject({ status: 401 });
  expect(authorization('')).toBe('');
});
