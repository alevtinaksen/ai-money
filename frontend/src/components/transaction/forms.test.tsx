import { act, render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import { AddTransactionScreen } from './AddTransactionScreen';
import { EditAccountModal } from '../modals/EditAccountModal';
import { Dialog } from '../shared/Dialog';
import { Account, Category } from '../../types';

const account: Account = { id: 'a', user_id: 1, name: 'Test', currency: 'USD', balance: 100,
  icon: '💳', color: '#fff', group_name: 'Own', is_default: true, sort_order: 0 };
const categories = [{ id: 'e', name: 'Expense', type: 'expense' },
  { id: 'i', name: 'Income', type: 'income' }].map(c => ({ ...c, user_id: 1, icon: '📦', color: '#fff', sort_order: 0 })) as Category[];
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup() {
  const onSubmit = vi.fn(async (_data: { created_at?: string; category_id: string; client_id: string }) => false);
  const view = render(<AddTransactionScreen accounts={[account]} selectedAccount={account}
    categories={categories} onClose={() => {}} onSubmit={onSubmit} />);
  fireEvent.keyDown(window, { key: '1' });
  return { ...view, onSubmit };
}
it('uses a native decimal amount input and saves exact kopecks without a custom keypad', async () => {
  const submit = vi.fn(async (_data: { amount: number }) => true);
  const view = render(<AddTransactionScreen accounts={[account]} selectedAccount={account} categories={categories} onClose={() => {}} onSubmit={submit} />);
  const input = view.getByLabelText('Сумма') as HTMLInputElement;
  expect(input.tagName).toBe('INPUT'); expect(input.inputMode).toBe('decimal');
  expect(view.container.querySelector('.design-numpad')).toBeNull();
  fireEvent.change(input, { target: { value: '250,50' } });
  fireEvent.click(view.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(submit).toHaveBeenCalledOnce());
  expect(submit.mock.calls[0][0].amount).toBe(250.5);
});
it('keeps the editor inside the visible viewport when the native keyboard opens', () => {
  const visible = Object.assign(new EventTarget(), { height: 874, offsetTop: 0 });
  vi.stubGlobal('visualViewport', visible);
  const view = setup();
  const editor = view.getByRole('region', { name: 'Новая операция' });
  expect(editor.style.height).toBe('874px');
  act(() => { visible.height = 380; visible.offsetTop = 12; visible.dispatchEvent(new Event('resize')); });
  expect(editor.style.height).toBe('380px'); expect(editor.style.top).toBe('12px');
  expect(view.getByRole('button', { name: 'Сохранить' })).toBeTruthy();
});
it('selected date reaches submit', async () => {
  const view = setup();
  fireEvent.change(view.container.querySelector('input[type="date"]')!, { target: { value: '2024-01-02' } });
  fireEvent.click(view.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(view.onSubmit).toHaveBeenCalled());
  const date = new Date(view.onSubmit.mock.calls[0][0].created_at!);
  expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2024, 1, 2]);
});
it('income uses income category', async () => {
  const view = setup();
  fireEvent.click(view.getByTitle('Доход'));
  fireEvent.click(view.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(view.onSubmit).toHaveBeenCalled());
  expect(view.onSubmit.mock.calls[0][0].category_id).toBe('i');
});
it.each(['1 500', 'abc', '12abc', '0.001'])('invalid initial balance %s cannot silently truncate', value => {
  const save = vi.fn(async () => false);
  const view = render(<EditAccountModal isOpen account={null} onClose={() => {}} onSave={save} />);
  fireEvent.change(view.getByPlaceholderText('0.00'), { target: { value } });
  fireEvent.click(view.getByRole('button', { name: 'Сохранить' }));
  expect(save).not.toHaveBeenCalled();
  expect(view.getByRole('alert')).toBeTruthy();
});
it('uncertain form blocks keyboard edits and retries the exact original request', async () => {
  const view = setup();
  const submit = () => fireEvent.click(view.getByRole('button', { name: 'Сохранить' }));
  submit(); await waitFor(() => expect(view.onSubmit).toHaveBeenCalledTimes(1));
  submit(); await waitFor(() => expect(view.onSubmit).toHaveBeenCalledTimes(2));
  expect(view.onSubmit.mock.calls[0][0].client_id).toBe(view.onSubmit.mock.calls[1][0].client_id);
  fireEvent.keyDown(window, { key: '2' });
  submit(); await waitFor(() => expect(view.onSubmit).toHaveBeenCalledTimes(3));
  expect(view.onSubmit.mock.calls[2][0]).toEqual(view.onSubmit.mock.calls[0][0]);
});
it('Escape cancels account archive confirmation while keeping the editor open', () => {
  const close=vi.fn();
  const view=render(<Dialog title="Счёт" onClose={close}><EditAccountModal isOpen account={account} onClose={close} onSave={vi.fn(async()=>false)} onDelete={vi.fn(async()=>false)} /></Dialog>);
  fireEvent.click(view.getByRole('button',{name:'Архивировать'}));
  expect(view.getByRole('dialog',{name:'Архивировать счёт?'})).toBeTruthy();
  fireEvent.keyDown(document,{key:'Escape'});
  expect(close).not.toHaveBeenCalled(); expect(view.queryByRole('dialog',{name:'Архивировать счёт?'})).toBeNull();
  expect(view.getByPlaceholderText('0.00')).toBeTruthy();
});

it('opening Other bank settings preserves an existing custom bank and currency/balance', async () => {
  const save = vi.fn(async (_data: Partial<Account>) => false);
  const view = render(<EditAccountModal isOpen account={{ ...account, bank_name: 'Custom bank' }} onClose={() => {}} onSave={save} />);
  fireEvent.click(view.getByText('Другое'));
  expect((view.getByLabelText('Название банка') as HTMLInputElement).value).toBe('Custom bank');
  fireEvent.click(view.getByLabelText('Сохранить')); await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][0].bank_name).toBe('Custom bank');
  expect(save.mock.calls[0][0].balance).toBe(100); expect(save.mock.calls[0][0].currency).toBe('USD');
});
