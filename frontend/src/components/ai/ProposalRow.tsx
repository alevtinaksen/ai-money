import { useState } from 'react';
import { Account, Category } from '../../types';
import { Proposal, TransactionInput } from '../../api/client';
import { moneyInput } from '../../utils/money';
import { CreationOutcome, useCreationAttempt } from '../../hooks/useCreationAttempt';

export function ProposalRow({ proposal, accounts, categories, onSave, onBlockedChange }: {
  proposal: Proposal; accounts: Account[]; categories: Category[]; onSave: (data: TransactionInput) => Promise<CreationOutcome | boolean>;
  onBlockedChange?: (blocked: boolean) => void;
}) {
  const named = (name?: string) => { const matches = accounts.filter(account => account.name === name); return matches.length === 1 ? matches[0].id : ''; };
  const compatible = categories.filter(c => c.type === proposal.type || c.type === 'both');
  const categoryMatches = compatible.filter(c => c.name === proposal.category_name);
  const [account, setAccount] = useState(proposal.account_name ? named(proposal.account_name) : (accounts.find(a => a.is_default) || accounts[0])?.id || '');
  const [target, setTarget] = useState(named(proposal.to_account_name));
  const [category, setCategory] = useState(categoryMatches.length === 1 ? categoryMatches[0].id : '');
  const [amount, setAmount] = useState(String(proposal.amount));
  const [note, setNote] = useState(proposal.note || '');
  const attempt = useCreationAttempt<TransactionInput>(onSave, onBlockedChange);
  const [error, setError] = useState('');
  const save = async () => {
    if (attempt.blocked()) { await attempt.retry(); return; }
    setError('');
    try {
      const source = accounts.find(a => a.id === account), destination = accounts.find(a => a.id === target);
      if (!source) throw new Error('Выберите счёт списания');
      if (proposal.type === 'transfer' && (!destination || source.id === destination.id || source.currency !== destination.currency)) {
        throw new Error('Для перевода выберите два разных счёта одной валюты');
      }
      if (category && proposal.type !== 'transfer' && !compatible.some(c => c.id === category)) throw new Error('Выберите подходящую категорию');
      const payload: TransactionInput = { account_id: account, to_account_id: proposal.type === 'transfer' ? target : null,
        category_id: proposal.type === 'transfer' ? null : category || null,
        amount: moneyInput(amount), note, type: proposal.type };
      if (await attempt.run(payload) === 'rejected') setError('Не удалось сохранить. Проверьте сообщение сервера и исправьте черновик.');
    } catch (cause) { setError((cause as Error).message); }
  };
  if (attempt.phase === 'saved') return <p role="status" className="design-success">Операция сохранена на сервере</p>;
  return <fieldset className="design-proposal">
    <legend>{proposal.type === 'expense' ? 'Расход' : proposal.type === 'income' ? 'Доход' : 'Перевод'} — черновик</legend>
    <fieldset disabled={attempt.locked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
    <label className="block">Сумма <input value={amount} inputMode="decimal" onChange={e => setAmount(e.target.value)} className="w-full" /></label>
    <label className="block">Счёт <select value={account} onChange={e => setAccount(e.target.value)} className="bg-transparent">
      <option value="">Выберите счёт</option>{accounts.map(a => <option value={a.id} key={a.id}>{a.name} ({a.currency})</option>)}</select></label>
    {proposal.type === 'transfer' ? <label className="block">Счёт зачисления <select value={target} onChange={e => setTarget(e.target.value)} className="bg-transparent">
      <option value="">Уточните получателя</option>{accounts.map(a => <option value={a.id} key={a.id}>{a.name} ({a.currency})</option>)}</select></label>
      : <label className="block">Категория <select value={category} onChange={e => setCategory(e.target.value)} className="bg-transparent">
        <option value="">Без категории</option>{compatible.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>}
    <label className="block">Комментарий <input value={note} onChange={e => setNote(e.target.value)} className="w-full" /></label>
    </fieldset>{(attempt.error || error) && <p role="alert" className="design-error">{attempt.error || error}</p>}
    <button disabled={attempt.phase === 'pending'} className="design-primary" onClick={() => void save()}>{attempt.phase === 'pending' ? 'Сохраняем…' : 'Подтвердить и сохранить'}</button>
  </fieldset>;
}
