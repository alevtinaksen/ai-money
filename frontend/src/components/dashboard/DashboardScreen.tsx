import React, { useState } from 'react';
import {
  WalletOutlined,
  ReloadOutlined,
  SettingOutlined,
  AudioOutlined,
  CheckOutlined,
  CameraOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { DashboardSummary, Account, Category, Transaction } from '../../types';

import { CATEGORIES_CATALOG, resolveCategoryAndSubcategory } from '../modals/EditTransactionModal';

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
  onRefresh?: () => Promise<void>;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  summary,
  accounts,
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
  onHaptic,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 8, 1)); // Default to September 2026
  const [categoryMode, setCategoryMode] = useState<'expense' | 'income'>('expense');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshToast, setShowRefreshToast] = useState(false);

  const totalAccountsBalance = accounts
    .filter((acc) => acc.group_name !== 'Кредиты')
    .reduce((sum, acc) => sum + acc.balance, 0);

  const monthLabel = React.useMemo(() => {
    const raw = selectedDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    const cleaned = raw.replace(/\sг\.?$/i, '');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }, [selectedDate]);

  const prevMonth = () => {
    onHaptic?.('light');
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    onHaptic?.('light');
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Filter transactions strictly for the selected month and year
  const monthTransactions = React.useMemo(() => {
    const targetYear = selectedDate.getFullYear();
    const targetMonth = selectedDate.getMonth();

    return summary.recent_transactions.filter((tx) => {
      if (!tx.created_at) {
        return targetYear === 2026 && targetMonth === 8;
      }
      const d = new Date(tx.created_at);
      if (isNaN(d.getTime())) {
        return targetYear === 2026 && targetMonth === 8;
      }
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });
  }, [summary.recent_transactions, selectedDate]);

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

  const periodExpense = React.useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [monthTransactions]);

  const periodIncome = React.useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [monthTransactions]);

  const periodNet = periodIncome - periodExpense;

  // Top categories sorted by real spending or income for the selected month
  const topCategories = React.useMemo(() => {
    const spendMap: Record<string, number> = {};

    const resolveMainCatName = (tx: Transaction): string => {
      const foundById = categories.find((c) => c.id === tx.category_id);
      const nameToCheck = (foundById?.name || tx.category_name || tx.note || '').trim();

      for (const catItem of CATEGORIES_CATALOG) {
        if (catItem.name.toLowerCase() === nameToCheck.toLowerCase()) {
          return catItem.name;
        }
        if (catItem.subcategories.some((sc) => sc.toLowerCase() === nameToCheck.toLowerCase())) {
          return catItem.name;
        }
        if (tx.note && catItem.subcategories.some((sc) => sc.toLowerCase() === tx.note?.toLowerCase())) {
          return catItem.name;
        }
      }

      if (foundById) return foundById.name;
      const foundByName = categories.find((c) => c.name.toLowerCase() === nameToCheck.toLowerCase());
      if (foundByName) return foundByName.name;

      return nameToCheck || (categoryMode === 'income' ? 'Прочее' : 'Другое');
    };

    for (const tx of monthTransactions) {
      if (tx.type === categoryMode) {
        const catName = resolveMainCatName(tx);
        spendMap[catName] = (spendMap[catName] || 0) + tx.amount;
      }
    }

    const list: Array<{
      id: string;
      name: string;
      icon: string;
      color: string;
      amount: number;
      percentage: number;
    }> = [];

    const processed = new Set<string>();

    for (const [name, amt] of Object.entries(spendMap)) {
      const foundInCat = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      const foundInCatalog = CATEGORIES_CATALOG.find((c) => c.name.toLowerCase() === name.toLowerCase());
      list.push({
        id: foundInCat?.id || `cat-${name}`,
        name,
        icon: foundInCat?.icon || foundInCatalog?.icon || (categoryMode === 'income' ? '💰' : '📦'),
        color: foundInCat?.color || (categoryMode === 'income' ? '#10B981' : '#FF7A00'),
        amount: amt,
        percentage: 0,
      });
      processed.add(name.toLowerCase());
    }

    const defaultExpenseCategories = [
      { name: 'Еда', icon: '🍔', color: '#FF7A00' },
      { name: 'Транспорт', icon: '🚗', color: '#EF4444' },
      { name: 'Здоровье', icon: '💊', color: '#F59E0B' },
      { name: 'Покупки', icon: '🛍️', color: '#EC4899' },
      { name: 'Личное', icon: '✨', color: '#FEE2E2' },
    ];

    const defaultIncomeCategories = [
      { name: 'Зарплата', icon: '💰', color: '#10B981' },
      { name: 'Переводы', icon: '🥧', color: '#3B82F6' },
      { name: 'Накопления', icon: '🪙', color: '#9CA3AF' },
      { name: 'Подарки', icon: '🎁', color: '#EC4899' },
      { name: 'Прочее', icon: '🥖', color: '#8B5CF6' },
    ];

    const defaultCategories = categoryMode === 'income' ? defaultIncomeCategories : defaultExpenseCategories;

    for (const def of defaultCategories) {
      if (!processed.has(def.name.toLowerCase())) {
        const found = categories.find((c) => c.name.toLowerCase() === def.name.toLowerCase());
        list.push({
          id: found?.id || `cat-${def.name}`,
          name: def.name,
          icon: found?.icon || def.icon,
          color: found?.color || def.color,
          amount: 0,
          percentage: 0,
        });
        processed.add(def.name.toLowerCase());
      }
    }

    list.sort((a, b) => b.amount - a.amount);

    const currentTotal = categoryMode === 'expense' ? periodExpense : periodIncome;

    return list.map((c) => ({
      ...c,
      percentage: currentTotal > 0 ? Math.min(100, Math.round((c.amount / currentTotal) * 100)) : 0,
    }));
  }, [monthTransactions, categories, categoryMode, periodExpense, periodIncome]);

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#121318] text-[#111827] dark:text-white flex flex-col justify-between pb-24 select-none animate-fade-in relative transition-colors duration-200">
      {/* Top Header Bar */}
      <div className="px-4 pt-10 pb-3 flex items-center justify-between">
        {/* Total Balance Lime Pill Button */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onOpenAccounts();
          }}
          className="bg-[#8CFF54] hover:bg-[#7CE643] text-black px-3.5 py-1.5 rounded-lg flex items-center space-x-2 font-bold text-[16px] shadow-sm active:scale-95 transition-all"
        >
          <WalletOutlined className="text-[17px] text-black" />
          <span>
            {totalAccountsBalance.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ₽
          </span>
        </button>

        {/* Right Header Action Icons */}
        <div className="flex items-center space-x-3 text-black dark:text-white">
          <button
            type="button"
            disabled={isRefreshing}
            onClick={async () => {
              onHaptic?.('light');
              setIsRefreshing(true);
              try {
                await onRefresh?.();
                setShowRefreshToast(true);
                setTimeout(() => setShowRefreshToast(false), 2200);
              } finally {
                setTimeout(() => setIsRefreshing(false), 700);
              }
            }}
            className="p-1 hover:text-gray-600 transition-colors"
            title="Синхронизировать с сервером"
          >
            <ReloadOutlined
              className={`text-[18px] text-gray-700 dark:text-gray-300 transition-all ${
                isRefreshing ? 'animate-spin text-black dark:text-white' : 'active:rotate-180 duration-300'
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onOpenSettings?.();
            }}
            className="p-1 text-black dark:text-white hover:text-gray-600 transition-colors"
            title="Настройки"
          >
            <SettingOutlined className="text-[20px]" />
          </button>
        </div>
      </div>

      {/* Refresh Feedback Toast */}
      {showRefreshToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-[#111827]/90 dark:bg-white/90 text-white dark:text-[#111827] text-xs font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-md animate-fade-in flex items-center space-x-2 border border-white/10 dark:border-black/10 pointer-events-none">
          <CheckOutlined className="text-emerald-400 text-sm" />
          <span>Данные синхронизированы</span>
        </div>
      )}

      {/* Main Center Content */}
      <div className="flex-1 px-5 max-w-lg mx-auto w-full">
        {/* Month / Period Selector */}
        <div className="flex items-center justify-center space-x-6 my-2">
          <button
            type="button"
            onClick={prevMonth}
            className="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white active:scale-90 transition-transform text-[16px] font-bold"
          >
            ←
          </button>
          <span className="text-[17px] font-semibold text-[#111827] dark:text-white tracking-wide">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="text-gray-600 hover:text-black dark:text-gray-400 dark:hover:text-white active:scale-90 transition-transform text-[16px] font-bold"
          >
            →
          </button>
        </div>

        {/* Big Net Period Amount */}
        <div className="text-center my-6">
          {(() => {
            const netFormatted = (periodNet < 0 ? '-' : '') + Math.abs(periodNet).toFixed(2);
            return (
              <h2 className="text-[48px] sm:text-[54px] font-extrabold text-[#111827] dark:text-white tracking-tight leading-none flex items-center justify-center">
                <span>{netFormatted}</span>
                <span className="text-[#9CA3AF] dark:text-gray-500 font-normal ml-2">₽</span>
              </h2>
            );
          })()}

          {/* Stat Tabs: [ ↓ 0₽ ] [ ↑ 5278₽ ] */}
          <div className="flex items-center justify-center w-full max-w-sm mx-auto mt-6 rounded-2xl overflow-hidden shadow-sm">
            {/* Income tab */}
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setCategoryMode('income');
              }}
              className={`flex-1 py-3 px-4 font-bold text-[15px] flex items-center justify-center space-x-1.5 transition-all ${
                categoryMode === 'income'
                  ? 'bg-[#111827] text-white'
                  : 'bg-[#E5E7EB] dark:bg-[#1E1F26] text-[#111827] dark:text-gray-300'
              }`}
            >
              <span>↓</span>
              <span>{Math.round(periodIncome)}₽</span>
            </button>

            {/* Expense tab */}
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setCategoryMode('expense');
              }}
              className={`flex-1 py-3 px-4 font-bold text-[15px] flex items-center justify-center space-x-1.5 transition-all ${
                categoryMode === 'expense'
                  ? 'bg-[#111827] text-white'
                  : 'bg-[#E5E7EB] dark:bg-[#1E1F26] text-[#111827] dark:text-gray-300'
              }`}
            >
              <span>↑</span>
              <span>{Math.round(periodExpense)}₽</span>
            </button>
          </div>

          {/* Lime Green Banner: «Все транзакции» */}
          <div className="mt-4 w-full max-w-sm mx-auto">
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                onOpenTransactions?.();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-[#8CFF54] hover:bg-[#7CE643] text-black font-bold text-[15px] shadow-sm flex items-center justify-center active:scale-[0.99] transition-all"
            >
              Все транзакции
            </button>
          </div>
        </div>

        {/* Category Minimalist Square Cards (Horizontal scroll) */}
        <div className="my-6">
          <div className="flex items-stretch space-x-3 overflow-x-auto no-scrollbar py-2">
            {topCategories.map((cat) => {
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onHaptic?.('light');
                    onSelectCategory?.(cat as any, monthLabel, monthTransactions);
                  }}
                  className="bg-white dark:bg-[#1E1F26] rounded-2xl p-3 min-w-[96px] w-[96px] flex flex-col justify-between items-start border border-gray-100 dark:border-gray-800 shadow-sm active:scale-95 transition-transform text-left shrink-0"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800/80 flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
                    {cat.icon}
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-[#111827] dark:text-white leading-tight flex items-center">
                      <span>{Math.round(cat.amount)}</span>
                      <span className="text-[#9CA3AF] dark:text-gray-500 font-normal text-xs ml-0.5">₽</span>
                    </div>
                    <span className="text-[12px] font-medium text-[#6B7280] dark:text-gray-400 block mt-0.5 truncate max-w-[74px]">
                      {cat.name}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions Section */}
        <div className="mt-6 mb-12">
          <div className="space-y-6">
            {recentTwoDaysGroups.map((group) => {
              const dateMatch = group.label.match(/^([^,]+),\s*(.+)$/);
              const dayNumMonth = dateMatch ? dateMatch[2] : group.label;
              const relativeTag = dateMatch ? `[${dateMatch[1]}]` : '';

              return (
                <div key={group.key} className="space-y-3">
                  {/* Centered Date Header: e.g. 18 сентября [Сегодня] */}
                  <div className="text-center text-[13px] font-medium text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{dayNumMonth}</span>{' '}
                    <span>{relativeTag}</span>
                  </div>

                  {group.transactions.length > 0 ? (
                    <div className="space-y-1">
                      {group.transactions.map((tx) => {
                        const resolved = resolveCategoryAndSubcategory(tx);
                        const isIncome = tx.type === 'income';

                        return (
                          <div
                            key={tx.id}
                            onClick={() => {
                              onHaptic?.('light');
                              onSelectTransaction?.(tx);
                            }}
                            className="w-full flex items-center justify-between py-3 px-1 border-b border-gray-100/60 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                              <span className="text-2xl shrink-0">{resolved.icon}</span>
                              <div className="min-w-0 flex-1">
                                <span className="text-[15px] font-medium text-[#111827] dark:text-white truncate block">
                                  {resolved.displayTitle}
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0 font-bold text-[16px] text-[#111827] dark:text-white ml-3 flex items-center">
                              <span>{isIncome ? '+' : '-'}{Math.round(tx.amount)}</span>
                              <span className="text-[#9CA3AF] dark:text-gray-500 font-normal ml-1 text-sm">₽</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : group.isToday ? (
                    <button
                      type="button"
                      onClick={() => {
                        onHaptic?.('light');
                        onOpenAddTransaction();
                      }}
                      className="w-full rounded-2xl py-3 px-4 border border-dashed text-[13px] font-medium flex items-center justify-center space-x-1.5 active:scale-[0.99] transition-all bg-white/60 dark:bg-[#1E1F26]/60 hover:bg-white dark:hover:bg-[#1E1F26] border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-500"
                    >
                      <span>+ Добавить первую операцию за сегодня</span>
                    </button>
                  ) : (
                    <div className="rounded-2xl py-3 px-4 border border-dashed text-[13px] text-center bg-white/40 dark:bg-[#1E1F26]/40 border-gray-100 dark:border-gray-800/80 text-gray-400 dark:text-gray-500">
                      {group.emptyMessage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Solid Dock Bottom Navigation Bar (Camera | Voice | Plus) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#111827] border-t border-black flex items-stretch h-[72px] shadow-2xl">
        {/* Left: Scan/Camera (Black) */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('medium');
            onScanReceipt?.();
          }}
          className="w-[28%] bg-[#111827] hover:bg-black text-white flex items-center justify-center active:opacity-75 transition-all"
          title="Сканировать чек"
        >
          <CameraOutlined className="text-[24px]" />
        </button>

        {/* Center: Voice (Neon Lime) */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('heavy');
            onOpenVoice();
          }}
          className="flex-1 bg-[#8CFF54] hover:bg-[#7CE643] text-black flex items-center justify-center active:opacity-85 transition-all"
          title="Голосовой ввод"
        >
          <AudioOutlined className="text-[26px]" />
        </button>

        {/* Right: Add (+) (Black) */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('medium');
            onOpenAddTransaction();
          }}
          className="w-[28%] bg-[#111827] hover:bg-black text-white flex items-center justify-center active:opacity-75 transition-all"
          title="Добавить операцию"
        >
          <PlusOutlined className="text-[24px]" />
        </button>
      </div>
    </div>
  );
};
