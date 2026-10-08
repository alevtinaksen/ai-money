import { render, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { it, expect, vi, afterEach } from 'vitest';
import { AddTransactionScreen } from './AddTransactionScreen';
import { EditAccountModal } from '../modals/EditAccountModal';
import { Dialog } from '../shared/Dialog';
import { Account, Category } from '../../types';

const account: Account = { id: 'a', user_id: 1, name: 'Test', currency: 'USD', balance: 100,
  icon: '💳', color: '#fff', group_name: 'Own', is_default: true, sort_order: 0 };
const categories = [{ id: 'e', name: 'Expense', type: 'expense' },
  { id: 'i', name: 'Income', type: 'income' }].map(c => ({ ...c, user_id: 1, icon: '📦', color: '#fff', sort_order: 0 })) as Category[];
afterEach(cleanup);
function setup() {
  const onSubmit = vi.fn(async (_data: { created_at?: string; category_id: string; client_id: string }) => false);
  const view = render(<AddTransactionScreen accounts={[account]} selectedAccount={account}
    categories={categories} onClose={() => {}} onSubmit={onSubmit} />);
  fireEvent.keyDown(window, { key: '1' });
  return { ...view, onSubmit };
}
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
