import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AiPreview } from './AiPreview';
import { ProposalRow } from './ProposalRow';
const account = { id: 'a', user_id: 1, name: 'Test', group_name: 'Personal', currency: 'USD', balance: 100, icon: '💳', color: '#fff', is_default: true, sort_order: 0 };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
test('recognition requires review; a failed unchanged draft retains the retry key', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ transactions: [{ amount: '10', type: 'expense', note: 'synthetic' }] }))));
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  render(<AiPreview auth="signed" kind="voice" accounts={[account]} categories={[]} onClose={() => {}} onSave={save} />);
  fireEvent.change(screen.getByLabelText('Текст операции'), { target: { value: 'кофе 10' } });
  fireEvent.click(screen.getByText('Подготовить черновик'));
  await screen.findByText('Подтвердить и сохранить');
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Подтвердить и сохранить'));
  await screen.findByText(/Статус записи неизвестен/);
  fireEvent.click(screen.getByText('Подтвердить и сохранить'));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[0][0].client_id).toBe(save.mock.calls[1][0].client_id);
  expect(save.mock.calls[0][0].amount).toBe('10.00');
});
test('unknown transfer destination cannot silently become another account', () => {
  const save = vi.fn();
  render(<ProposalRow proposal={{ type: 'transfer', amount: '10', to_account_name: 'Unknown' }} accounts={[account, { ...account, id: 'b', name: 'Other' }]} categories={[]} onSave={save} />);
  fireEvent.click(screen.getByText('Подтвердить и сохранить'));
  expect(screen.getByRole('alert').textContent).toContain('два разных счёта одной валюты');
  expect(save).not.toHaveBeenCalled();
});

test('starting a new recording hides old proposals and an arriving file is not lost while another parse finishes', async () => {
  let finish!: (response: Response) => void;
  const fetch = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ transactions: [{ amount: '250.50', type: 'expense' }] })));
  vi.stubGlobal('fetch', fetch);
  const recorder = { state: 'idle' as const, error: '', seconds: 0, start: vi.fn(async () => {}), stop: vi.fn(), cancel: vi.fn() };
  const props = { auth: 'signed', kind: 'voice' as const, accounts: [account], categories: [], onClose: vi.fn(), onSave: vi.fn(), recorder };
  const view = render(<AiPreview {...props} />);
  fireEvent.change(screen.getByLabelText('Текст операции'), { target: { value: 'кофе 10' } }); fireEvent.click(screen.getByText('Подготовить черновик'));
  const file = new File(['synthetic'], 'voice.m4a', { type: 'audio/mp4' }); view.rerender(<AiPreview {...props} initialFile={file} />);
  finish(new Response(JSON.stringify({ transactions: [{ amount: '10', type: 'expense' }] })));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  await screen.findByText('Подтвердить и сохранить');
  fireEvent.click(screen.getByText('Записать голос')); expect(recorder.start).toHaveBeenCalledOnce();
  expect(screen.queryByText('Подтвердить и сохранить')).toBeNull();
});
