import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';
import { Account, Category, Transaction } from './types';

const account: Account = { id: 'a', user_id: 1, name: 'Synthetic', group_name: 'Own', balance: 1000,
  currency: 'RUB', icon: '💳', color: '#fff', is_default: true, sort_order: 0 };
const category: Category = { id: 'c', name: 'Еда', type: 'expense', icon: '🍔', color: '#fff' };
const tx: Transaction = { id: 't', user_id: 1, account_id: 'a', amount: 10, currency: 'RUB',
  type: 'expense', category_id: 'c', category_name: 'Еда', revision: 1, created_at: '2026-10-08T10:00:00Z' };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); delete window.Telegram; history.replaceState(null, '', '/'); });

/** The synthetic adapter commits before losing the response, just like the audit probe. */
function server(firstAck?: unknown) {
  window.Telegram = { WebApp: { initData: 'signed', ready() {}, expand() {}, initDataUnsafe: {}, disableVerticalSwipes() {} } } as any;
  let reject!: (cause: Error) => void;
  const lost = new Promise<Response>((_resolve, rejectResponse) => { reject = rejectResponse; });
  const committed = new Map<string, Transaction>();
  const payloads: any[] = [];
  let balance = 1000, parses = 0;
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    if (path === '/api/ai/parse-text') {
      parses++;
      return new Response(JSON.stringify({ transactions: [{ type: 'expense', amount: '10', account_name: 'Synthetic', category_name: 'Еда' }] }));
    }
    if (path === '/api/transactions' && options?.method === 'POST') {
      const payload = JSON.parse(options.body as string); payloads.push(payload);
      if (!committed.has(payload.client_id)) { balance -= Number(payload.amount); committed.set(payload.client_id, { ...tx, ...payload, amount: Number(payload.amount) }); }
      if (payloads.length === 1) return firstAck === undefined ? lost : new Response(JSON.stringify(firstAck));
      return new Response(JSON.stringify(committed.get(payload.client_id)));
    }
    if (path.includes('/accounts')) return new Response(JSON.stringify([{ ...account, balance }]));
    if (path.includes('/categories')) return new Response(JSON.stringify([category]));
    if (path.includes('/analytics')) return new Response(JSON.stringify({ currency: 'RUB', balances_by_currency: { RUB: balance },
      totals_by_currency: { RUB: { income: 0, expense: 1000 - balance } }, total_balance: balance, period_label: '2026-10',
      period_income: 0, period_expense: 1000 - balance, categories: [], recent_transactions: [] }));
    return new Response(JSON.stringify([...committed.values()]));
  }));
  return { payloads, committed, loseResponse: () => reject(new Error('committed; response lost')), balance: () => balance, parses: () => parses };
}

it('manual close/Escape during pending and after lost response cannot discard the request or debit twice', async () => {
  const backend = server(); render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить операцию' }));
  fireEvent.change(screen.getByLabelText('Сумма'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(backend.balance()).toBe(990));
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' })); fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'Новая операция' })).toBeTruthy();
  await act(async () => backend.loseResponse());
  await screen.findByText(/Статус записи неизвестен/);
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' })); fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'Новая операция' })).toBeTruthy();
  expect((screen.getByLabelText('Комментарий') as HTMLInputElement).disabled).toBe(true);
  fireEvent.keyDown(window, { key: '2' });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Новая операция' })).toBeNull());
  expect(backend.payloads).toHaveLength(2); expect(backend.payloads[1]).toEqual(backend.payloads[0]);
  expect(backend.committed.size).toBe(1); expect(backend.balance()).toBe(990);
});
it.each([null, {}])('HTTP200 with incomplete acknowledgement %j retains the exact draft and does not debit twice', async body => {
  const backend = server(body); render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить операцию' }));
  fireEvent.change(screen.getByLabelText('Сумма'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await screen.findByText(/Статус записи неизвестен/);
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
  expect(screen.getByRole('dialog', { name: 'Новая операция' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Новая операция' })).toBeNull());
  expect(backend.payloads[1]).toEqual(backend.payloads[0]); expect(backend.committed.size).toBe(1); expect(backend.balance()).toBe(990);
});

it('inline local reauthentication preserves unknown payload/key and requires explicit retry with the new bearer', async () => {
  const payloads: any[] = [], headers: (string | null)[] = [];
  const committed = new Map<string, Transaction>();
  let authCalls = 0, balance = 1000;
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    if (path === '/api/auth/local') {
      authCalls++;
      if (authCalls === 2) return new Response('{"detail":"Temporary denial"}', { status: 403 });
      return new Response(JSON.stringify({ access_token: authCalls === 1 ? 'synthetic-old' : 'synthetic-new' }));
    }
    if (path === '/api/transactions' && options?.method === 'POST') {
      const payload = JSON.parse(options.body as string); payloads.push(payload);
      headers.push((options.headers as Headers).get('Authorization'));
      if (payloads.length === 2) return new Response('{"detail":"Local session expired"}', { status: 401 });
      if (!committed.has(payload.client_id)) { balance -= Number(payload.amount); committed.set(payload.client_id, { ...tx, ...payload, amount: Number(payload.amount) }); }
      if (payloads.length === 1) throw new Error('committed; response lost');
      return new Response(JSON.stringify(committed.get(payload.client_id)));
    }
    if (path.includes('/accounts')) return new Response(JSON.stringify([{ ...account, balance }]));
    if (path.includes('/categories')) return new Response(JSON.stringify([category]));
    if (path.includes('/analytics')) return new Response(JSON.stringify({ currency: 'RUB', balances_by_currency: { RUB: balance },
      total_balance: balance, period_label: '2026-10', period_income: 0, period_expense: 1000 - balance, categories: [], recent_transactions: [] }));
    return new Response(JSON.stringify([...committed.values()]));
  }));
  render(<App />); fireEvent.click(screen.getByRole('button', { name: 'Войти локально' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Добавить операцию' }));
  fireEvent.change(screen.getByLabelText('Сумма'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' })); await screen.findByText(/Статус записи неизвестен/);
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Войти снова локально' }));
  await screen.findByText('Локальный вход запрещён или сервер недоступен');
  expect(screen.getByRole('dialog', { name: 'Новая операция' })).toBeTruthy(); expect(payloads).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Войти снова локально' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Войти снова локально' })).toBeNull());
  expect(payloads).toHaveLength(2); expect(authCalls).toBe(3);
  expect(screen.getByRole('dialog', { name: 'Новая операция' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
  expect(screen.getByRole('dialog', { name: 'Новая операция' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Новая операция' })).toBeNull());
  expect(headers).toEqual(['Bearer synthetic-old', 'Bearer synthetic-old', 'Bearer synthetic-new']);
  expect(payloads).toEqual(Array(3).fill(payloads[0])); expect(committed.size).toBe(1); expect(balance).toBe(990);
});

it('AI pending/lost response blocks close, reparse and file replacement; retry commits only once', async () => {
  const backend = server(); render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Голос и текст' }));
  fireEvent.change(screen.getByLabelText('Текст операции'), { target: { value: 'еда 10' } });
  fireEvent.click(screen.getByText('Подготовить черновик'));
  fireEvent.click(await screen.findByText('Подтвердить и сохранить'));
  await waitFor(() => expect(backend.balance()).toBe(990));
  const parse = screen.getByRole('button', { name: 'Подготовить черновик' }) as HTMLButtonElement;
  expect(parse.disabled).toBe(true); fireEvent.click(parse);
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' })); fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'Проверка распознавания' })).toBeTruthy();
  await act(async () => backend.loseResponse()); await screen.findByText(/Статус записи неизвестен/);
  fireEvent.click(parse); fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
  expect(parse.disabled).toBe(true); expect((screen.getByLabelText('Файл для распознавания') as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByRole('dialog', { name: 'Проверка распознавания' })).toBeTruthy();
  fireEvent.click(screen.getByText('Подтвердить и сохранить'));
  await screen.findByText('Операция сохранена на сервере');
  expect(backend.payloads[1]).toEqual(backend.payloads[0]); expect(backend.committed.size).toBe(1); expect(backend.balance()).toBe(990);
  expect(parse.disabled).toBe(false); expect(backend.parses()).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
  expect(screen.queryByRole('dialog', { name: 'Проверка распознавания' })).toBeNull();
});
it('preview parent gets a refusal while pending or uncertain and cannot replace the draft', async () => {
  const parent = { postMessage: vi.fn() };
  vi.spyOn(window, 'parent', 'get').mockReturnValue(parent as unknown as Window);
  history.replaceState(null, '', '/frontend/dist/index.html');
  const backend = server(); render(<App />);
  await screen.findByRole('button', { name: 'Добавить операцию' });
  const navigate = (route: string) => act(() => { window.dispatchEvent(new MessageEvent('message', {
    source: parent as unknown as Window, origin: location.origin,
    data: { type: 'ai-money:preview:navigate', requestId: route, route },
  })); });
  navigate('add-expense');
  expect(parent.postMessage.mock.lastCall?.[0]).toMatchObject({ status: 'applied' });
  fireEvent.change(screen.getByLabelText('Сумма'), { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(backend.balance()).toBe(990));
  navigate('settings'); expect(parent.postMessage.mock.lastCall?.[0]).toMatchObject({ status: 'blocked' });
  expect(screen.getByRole('dialog', { name: 'Новая операция' })).toBeTruthy();
  await act(async () => backend.loseResponse()); await screen.findByText(/Статус записи неизвестен/);
  navigate('accounts'); expect(parent.postMessage.mock.lastCall?.[0]).toMatchObject({ status: 'blocked' });
  expect(screen.getByRole('dialog', { name: 'Новая операция' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Новая операция' })).toBeNull());
  navigate('categories');
  expect(parent.postMessage.mock.lastCall?.[0]).toMatchObject({ status: 'applied', message: 'Открыты настройки. Откройте управление категориями.' });
  expect(screen.getByRole('button', { name: /Управление категориями/ })).toBeTruthy();
  expect(backend.committed.size).toBe(1);
});

it('camera action immediately invokes native capture and sends the chosen photo only for review', async () => {
  const backend = server(); const fetch = globalThis.fetch;
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => path === '/api/ai/parse-receipt'
    ? new Response(JSON.stringify({ transactions: [{ amount: '250.50', type: 'expense' }] })) : fetch(path, options)));
  render(<App />);
  const capture = screen.getByLabelText('Снять чек') as HTMLInputElement;
  const click = vi.spyOn(capture, 'click').mockImplementation(() => {});
  fireEvent.click(await screen.findByLabelText('Распознать фото чека'));
  expect(click).toHaveBeenCalledOnce(); expect(capture.getAttribute('capture')).toBe('environment');
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.change(capture, { target: { files: [new File(['synthetic image'], 'receipt.jpg', { type: 'image/jpeg' })] } });
  await screen.findByText('Подтвердить и сохранить'); expect(backend.payloads).toHaveLength(0);
});

it('microphone action requests recording immediately; closing releases a late permission grant', async () => {
  server(); let grant!: (stream: unknown) => void; const stop = vi.fn();
  const getUserMedia = vi.fn(() => new Promise(resolve => { grant = resolve; }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } }); vi.stubGlobal('MediaRecorder', class {});
  render(<App />); fireEvent.click(await screen.findByLabelText('Голос и текст'));
  expect(getUserMedia).toHaveBeenCalledOnce(); expect(screen.getByText(/Разрешите доступ/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Закрыть'));
  await act(async () => { grant({ getTracks: () => [{ stop }] }); });
  expect(stop).toHaveBeenCalledOnce(); expect(screen.queryByRole('dialog')).toBeNull();
});

it('session expiry stops a recording even when the login page replaces its controls', async () => {
  server(); const original = globalThis.fetch;
  let expire!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn((path: string, options?: RequestInit) => path.includes('/accounts')
    ? new Promise<Response>(resolve => { expire = resolve; }) : original(path, options)));
  let recording = false; const stop = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) } });
  vi.stubGlobal('MediaRecorder', class {
    static isTypeSupported = () => true; state = 'inactive';
    start() { recording = true; this.state = 'recording'; }
    stop() { recording = false; this.state = 'inactive'; }
  });
  // First release the initial account read, then hold the month-change refresh.
  render(<App />); await act(async () => { expire(new Response(JSON.stringify([account]))); });
  fireEvent.click(await screen.findByLabelText('Предыдущий месяц'));
  fireEvent.click(screen.getByLabelText('Голос и текст')); await screen.findByText(/Запись ·/); expect(recording).toBe(true);
  await act(async () => { expire(new Response('{"detail":"Expired"}', { status: 401 })); });
  await screen.findByText(/Сессия истекла/); expect(recording).toBe(false); expect(stop).toHaveBeenCalledOnce();
});
