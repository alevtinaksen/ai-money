import { useState } from 'react';
import { Account } from '../../types';
import { resolveAccountBankAndName } from '../../utils/bankUtils';
import { ActionBar, Amount, IconButton, ScreenHeader } from '../design/Primitives';

interface AccountsScreenProps {
  onBack: () => void; accounts: Account[];
  onSelectAccount?: (account: Account) => void; onOpenTransfer?: () => void;
  onAddNewAccount?: () => void; onOpenSettings?: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}
export function AccountsScreen({ onBack, accounts, onSelectAccount, onOpenTransfer, onAddNewAccount, onOpenSettings, onHaptic }: AccountsScreenProps) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const totals = Object.entries(accounts.reduce<Record<string, number>>((map, account) => {
    map[account.currency] = (map[account.currency] || 0) + account.balance; return map;
  }, {}));
  const groups = accounts.reduce<Record<string, Account[]>>((map, account) => {
    (map[account.group_name || 'Личное'] ||= []).push(account); return map;
  }, {});
  return <section className="design-screen" aria-label="Счета">
    <ScreenHeader title="Счета" onBack={onBack} action={<IconButton icon="settings" label="Настройки" onClick={onOpenSettings} />} />
    {totals.length <= 1 ? <div className="design-hero design-accounts-hero">
      <p className="design-accounts-subtitle">Доступно на счетах</p>
      <h2><Amount value={totals[0]?.[1] || 0} currency={totals[0]?.[0] || 'RUB'} /></h2>
    </div> : <div className="design-multiple-totals" aria-label="Остатки по валютам">
      <p className="design-accounts-subtitle">Доступно на счетах</p>
      {totals.map(([currency, value]) => <Amount key={currency} value={value} currency={currency} />)}
    </div>}
    <div className="design-accounts-groups">
      {Object.entries(groups).map(([name, items]) => <section className="design-day" key={name}>
        <button className="design-group-toggle" aria-expanded={!closed[name]} onClick={() => {
          onHaptic?.('light'); setClosed(prev => ({ ...prev, [name]: !prev[name] }));
        }}>{name}</button>
        {!closed[name] && <div className="design-rows">{items.map(account => {
          const resolved = resolveAccountBankAndName(account);
          return <button className="design-row design-account-row" key={account.id} onClick={() => {
            onHaptic?.('light'); onSelectAccount?.(account);
          }}>
            <span className="design-row-emoji">{account.icon}</span>
            <span className="design-row-title">{resolved.bank ? `${resolved.bank.shortName} • ` : ''}{resolved.cleanName}</span>
            <Amount value={account.balance} currency={account.currency} />
          </button>;
        })}</div>}
      </section>)}
      {!accounts.length && <p className="design-empty">Счетов пока нет</p>}
    </div>
    <ActionBar>
      <IconButton icon="exchange" label="Перевести между счетами" onClick={onOpenTransfer} className="design-action-primary" />
      <IconButton icon="plus" label="Создать счёт" onClick={onAddNewAccount} />
    </ActionBar>
  </section>;
}
