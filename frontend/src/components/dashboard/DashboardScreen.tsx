import React, { useState } from 'react';
import { ActionBar, Amount, DateLabel, IconButton, TransactionRow } from '../design/Primitives';
import { currencyLabel } from '../../utils/money';
import { DashboardSummary, Account, Category, Transaction } from '../../types';


interface DashboardScreenProps {
  summary: DashboardSummary;
  accounts: Account[];
  categories: Category[];
  onOpenAccounts: () => void;
  onOpenAddTransaction: () => void;
  onOpenVoice: () => void;
  onOpenTransactions?: () => void;
  onOpenSettings?: () => void;
  onScanReceipt: () => void;
  onSelectTransaction?: (tx: Transaction) => void;
  onSelectCategory?: (cat: Category, periodLabel?: string, periodTxs?: Transaction[]) => void;
  onUpdateTransaction?: (data: {
    id: string;
    amount: number;
    account_id: string;
    to_account_id?: string | null;
    category_id?: string | null;
    type: 'expense' | 'income' | 'transfer';
    note?: string | null;
    created_at?: string;
  }) => void;
  monthOffset: number;
  onMonthChange: (offset: number) => void;
  onRefresh?: () => Promise<void>;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  summary,
  accounts: _accounts,
  categories,
  onOpenAccounts,
  onOpenAddTransaction,
  onOpenVoice,
  onOpenTransactions,
  onOpenSettings,
  onScanReceipt,
  onSelectTransaction,
  onSelectCategory,
  onUpdateTransaction: _onUpdateTransaction,
  onRefresh,
  monthOffset,
  onMonthChange,
  onHaptic,
}) => {
  const selectedDate = new Date(`${summary.period_label}-01T00:00:00Z`);
  const [categoryMode, setCategoryMode] = useState<'expense' | 'income'>('expense');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const totalAccountsBalance = summary.total_balance;
  const symbol = summary.currency;
  const monthLabel = selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const prevMonth = () => onMonthChange(Math.max(-120, monthOffset - 1));
  const nextMonth = () => onMonthChange(Math.min(120, monthOffset + 1));
  const monthTransactions = summary.recent_transactions;

  // Group transactions for the recent section: strictly output two days (Сегодня и Вчера)
  const recentTwoDaysGroups = React.useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const getDayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const todayKey = getDayKey(now);
    const yesterdayKey = getDayKey(yesterday);

    const formatLabel = (d: Date, prefix: string) => {
      const dm = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
      return `${prefix}, ${dm}`;
    };

    const todayTxs: Transaction[] = [];
    const yesterdayTxs: Transaction[] = [];
    const olderDaysMap = new Map<string, { label: string; transactions: Transaction[] }>();

    for (const tx of summary.recent_transactions) {
      if (!tx.created_at) continue;
      const d = new Date(tx.created_at);
      if (isNaN(d.getTime())) continue;

      const key = getDayKey(d);
      if (key === todayKey) {
        todayTxs.push(tx);
      } else if (key === yesterdayKey) {
        yesterdayTxs.push(tx);
      } else {
        if (!olderDaysMap.has(key)) {
          const formatted = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
          olderDaysMap.set(key, { label: formatted, transactions: [] });
        }
        olderDaysMap.get(key)!.transactions.push(tx);
      }
    }

    const groups: {
      key: string;
      label: string;
      isToday?: boolean;
      transactions: Transaction[];
      emptyMessage?: string;
    }[] = [
      {
        key: todayKey,
        label: formatLabel(now, 'Сегодня'),
        isToday: true,
        transactions: todayTxs,
        emptyMessage: 'Нет операций за сегодня',
      },
      {
        key: yesterdayKey,
        label: formatLabel(yesterday, 'Вчера'),
        transactions: yesterdayTxs,
        emptyMessage: 'Нет операций за вчера',
      },
    ];

    if (todayTxs.length === 0 && olderDaysMap.size > 0) {
      const sortedOlderKeys = Array.from(olderDaysMap.keys()).sort((a, b) => b.localeCompare(a));
      const latestOlder = olderDaysMap.get(sortedOlderKeys[0]);
      if (latestOlder && latestOlder.transactions.length > 0) {
        groups.push({
          key: sortedOlderKeys[0],
          label: latestOlder.label,
          transactions: latestOlder.transactions,
        });
      }
    }

    return groups;
  }, [summary.recent_transactions]);

  const periodExpense = summary.period_expense;
  const periodIncome = summary.period_income;
  const periodNet = periodIncome - periodExpense;
  const topCategories = (categoryMode === 'expense' ? summary.categories : summary.income_categories || [])
    .map(stat => ({ ...stat, amount: stat.total_amount }))
    .sort((a, b) => b.amount - a.amount);


  return <section className="design-screen" aria-label="Главная">
    <header className="design-header">
      <button className="design-wallet" onClick={onOpenAccounts} aria-label="Открыть счета">
        <span className="design-icon-button"><img className="design-icon" src="/design/wallet.svg" alt="" /></span>
        <Amount value={totalAccountsBalance} currency={symbol} />
      </button>
      <IconButton icon="settings" label="Настройки" onClick={onOpenSettings} />
    </header>
    <div className="design-hero">
      <div className="design-calendar">
        <button aria-label="Предыдущий месяц" onClick={prevMonth}>←</button>
        <span>{monthLabel.replace(' г.', '').replace(/^./, letter => letter.toUpperCase())}</span>
        <button aria-label="Следующий месяц" onClick={nextMonth}>→</button>
      </div>
      <h2 aria-label="Итог за месяц"><Amount value={periodNet} currency={symbol} /></h2>
    </div>
    <div className="design-flow-tabs">
      <button aria-label="Доходы за месяц" aria-pressed={categoryMode === 'income'} onClick={() => setCategoryMode('income')}>↓ {periodIncome}{currencyLabel(symbol)}</button>
      <button aria-label="Расходы за месяц" aria-pressed={categoryMode === 'expense'} onClick={() => setCategoryMode('expense')}>↑ {periodExpense}{currencyLabel(symbol)}</button>
    </div>
    <button className="design-all-transactions" onClick={onOpenTransactions}>Все транзакции</button>
    <div className="design-categories">
      {topCategories.map(stat => <button className="design-category" key={stat.id} onClick={() => {
        onHaptic?.('light');
        const category = categories.find(c => c.id === stat.id);
        if (category) onSelectCategory?.(category, summary.period_label, monthTransactions);
      }}>
        <span className="design-category-icon">{stat.icon}</span>
        <span className="design-category-description"><Amount value={stat.amount} currency={symbol} /><br />{stat.name}</span>
      </button>)}
      {!topCategories.length && <p className="design-empty">Нет операций в выбранном месяце</p>}
    </div>
    <div className="design-recent">
      {recentTwoDaysGroups.map(group => <section className="design-day" key={group.key}>
        <h3 className="design-day-label"><DateLabel day={group.key} /></h3>
        <div className="design-rows">
          {group.transactions.map(tx => <TransactionRow key={tx.id} tx={tx} onSelect={() => onSelectTransaction?.(tx)} />)}
          {!group.transactions.length && (group.isToday
            ? <button className="design-empty" onClick={onOpenAddTransaction}>+ Добавить первую операцию за сегодня</button>
            : <p className="design-empty">{group.emptyMessage}</p>)}
        </div>
      </section>)}
    </div>
    <button className="design-empty" disabled={isRefreshing} onClick={async () => {
      setIsRefreshing(true);
      try { await onRefresh?.(); } catch { /* useLedger renders the server error */ }
      finally { setIsRefreshing(false); }
    }}>{isRefreshing ? 'Синхронизация…' : 'Синхронизировать данные'}</button>
    <ActionBar>
      <IconButton icon="camera" label="Распознать фото чека" onClick={onScanReceipt} />
      <IconButton icon="microphone" label="Голос и текст" onClick={onOpenVoice} className="design-action-primary" />
      <IconButton icon="plus" label="Добавить операцию" onClick={onOpenAddTransaction} />
    </ActionBar>
  </section>;
};
