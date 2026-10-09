import { useMemo, useState } from 'react';
import { Account } from '../../types';
import { resolveAccountBankAndName } from '../../utils/bankUtils';
import { Amount, Icon, IconButton } from '../design/Primitives';
import { Dialog } from '../shared/Dialog';
interface AccountSelectSheetProps {
  isOpen: boolean; onClose: () => void; accounts: Account[]; selectedAccountId: string;
  onSelectAccount: (acc: Account) => void; onAddNewAccount?: () => void; onHaptic?: () => void;
}
export function AccountSelectSheet({isOpen,onClose,accounts,selectedAccountId,onSelectAccount,onAddNewAccount,onHaptic}: AccountSelectSheetProps) {
  const [searchQuery,setSearchQuery] = useState('');
  const filtered = useMemo(() => accounts.filter(acc => {
    const resolved=resolveAccountBankAndName(acc), q=searchQuery.toLowerCase().trim();
    return [acc.name,resolved.cleanName,resolved.bank?.name,resolved.bank?.shortName,acc.bank_name,acc.group_name].some(value=>value?.toLowerCase().includes(q));
  }),[accounts,searchQuery]);
  if(!isOpen) return null;
  return <div className="design-sheet"><Dialog title="Выберите счёт" onClose={onClose}>
    <header className="design-support-header"><IconButton icon="close" label="Закрыть выбор счёта" onClick={onClose}/><h1>Выберите счёт</h1>
      {onAddNewAccount && <IconButton icon="add" label="Добавить счёт" onClick={()=>{onHaptic?.();onAddNewAccount();}}/>}</header>
    <div className="design-sheet-search"><input aria-label="Поиск счёта" placeholder="Поиск счёта или банка..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)}/>
      {searchQuery && <IconButton icon="close" label="Очистить поиск" onClick={()=>setSearchQuery('')}/>}</div>
    {filtered.map(acc=>{const resolved=resolveAccountBankAndName(acc);return <button type="button" key={acc.id} className="design-account-field" aria-pressed={acc.id===selectedAccountId}
      onClick={()=>{onHaptic?.();onSelectAccount(acc);onClose();}}><span className="design-row-emoji">{acc.icon||'💳'}</span><span className="design-row-title">{resolved.bank ? resolved.bank.shortName+' • ' : ''}{resolved.cleanName}</span>
      <Amount value={acc.balance} currency={acc.currency}/>{acc.id===selectedAccountId && <Icon name="check"/>}</button>;})}
    {!filtered.length && <p className="design-empty">Счёт не найден</p>}
  </Dialog></div>;
}
