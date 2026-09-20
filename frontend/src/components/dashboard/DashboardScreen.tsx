import React, { useState } from 'react';
import {
  WalletOutlined,
  ReloadOutlined,
  SettingOutlined,
  LeftOutlined,
  RightOutlined,
  ScanOutlined,
  AudioOutlined,
  CheckOutlined,
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
  onScanReceipt?: () => void;
  onSelectTransaction?: (tx: Transaction) => void;
  onSelectCategory?: (cat: Category, periodLabel?: string, periodTxs?: Transaction[]) => void;
  onRefresh?: () => void;
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

  // Group transactions for the recent section: strictly the last 2 active days
  const recentTwoDaysGroups = React.useMemo(() => {
    if (monthTransactions.length === 0) return [];

    const dateMap: Map<string, { label: string; transactions: Transaction[] }> = new Map();
    const now = new Date();

    const getDayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    for (const tx of monthTransactions) {
      if (!tx.created_at) continue;
      const d = new Date(tx.created_at);
      if (isNaN(d.getTime())) continue;

      const key = getDayKey(d);
      if (!dateMap.has(key)) {
        const isToday =
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear();

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday =
          d.getDate() === yesterday.getDate() &&
          d.getMonth() === yesterday.getMonth() &&
          d.getFullYear() === yesterday.getFullYear();

        const formattedDayMonth = d
          .toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
          .replace('.', '');

        let label = formattedDayMonth;
        if (isToday) {
          label = `Сегодня, ${formattedDayMonth}`;
        } else if (isYesterday) {
          label = `Вчера, ${formattedDayMonth}`;
        }

        dateMap.set(key, { label, transactions: [] });
      }
      dateMap.get(key)!.transactions.push(tx);
    }

    // Sort keys descending (most recent days first)
    const sortedKeys = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));
    // Take only the 2 most recent days!
    const top2Keys = sortedKeys.slice(0, 2);

    return top2Keys.map((k) => dateMap.get(k)!);
  }, [monthTransactions]);

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

  const formatCompactAmount = (amount: number) => {
    if (amount <= 0) return '0 ₽';
    if (amount >= 1000) {
      const thousands = amount / 1000;
      const formatted = thousands >= 10 ? thousands.toFixed(1) : thousands.toFixed(2);
      return `${formatted.replace('.', ',')} тыс. ₽`;
    }
    return `${amount.toLocaleString('ru-RU')} ₽`;
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#121318] text-[#111827] dark:text-white flex flex-col justify-between pb-24 select-none animate-fade-in relative transition-colors duration-200">
      {/* Top Header Bar */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        {/* Total Balance Wallet Button */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onOpenAccounts();
          }}
          className="flex items-center space-x-2 text-[#111827] dark:text-white active:opacity-75 transition-opacity"
        >
          <WalletOutlined className="text-[22px] text-[#111827] dark:text-white" />
          <span className="text-[17px] font-bold tracking-tight">
            {totalAccountsBalance.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ₽
          </span>
        </button>

        {/* Right Header Action Icons */}
        <div className="flex items-center space-x-3 text-[#374151] dark:text-gray-300">
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
            className="p-1 hover:text-black dark:hover:text-white transition-colors"
            title="Синхронизировать с сервером"
          >
            <ReloadOutlined
              className={`text-[18px] text-[#4B5563] dark:text-gray-300 transition-all ${
                isRefreshing ? 'animate-spin text-[#2B5BFF]' : 'active:rotate-180 duration-300'
              }`}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onOpenSettings?.();
            }}
            className="p-1 hover:text-black dark:hover:text-white transition-colors"
            title="Настройки"
          >
            <SettingOutlined className="text-[18px] text-[#4B5563] dark:text-gray-300" />
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
        <div className="flex items-center justify-center space-x-4 my-2">
          <button
            type="button"
            onClick={prevMonth}
            className="w-8 h-8 rounded-full bg-white dark:bg-[#1E1F26] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center text-[#6B7280] dark:text-gray-300 active:scale-90"
          >
            <LeftOutlined className="text-[14px]" />
          </button>
          <span className="text-[17px] font-bold text-[#111827] dark:text-white min-w-[140px] text-center">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="w-8 h-8 rounded-full bg-white dark:bg-[#1E1F26] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center text-[#6B7280] dark:text-gray-300 active:scale-90"
          >
            <RightOutlined className="text-[14px]" />
          </button>
        </div>

        {/* Big Net Period Amount */}
        <div className="text-center my-4">
          {(() => {
            const sign = periodNet > 0 ? '+' : (periodNet < 0 ? '−' : '');
            return (
              <h2 className="text-[42px] font-extrabold text-[#111827] dark:text-white tracking-tight">
                {sign}{Math.abs(periodNet).toLocaleString('ru-RU', { minimumFractionDigits: 0 })}{' '}
                <span className="font-bold">₽</span>
              </h2>
            );
          })()}

          {/* Stat Badges: Income ↓ and Expense ↑ (Interactive Toggles) */}
          <div className="flex items-center justify-center space-x-3 mt-3">
            {/* Green Income Toggle Button */}
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setCategoryMode('income');
              }}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-full font-bold text-[14px] transition-all active:scale-95 cursor-pointer select-none ${
                categoryMode === 'income'
                  ? 'bg-[#34C759] text-white shadow-sm'
                  : 'bg-[#ECFDF5] dark:bg-[#14231E] text-[#10B981] border border-emerald-200/60 dark:border-emerald-900/30'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold leading-none ${
                  categoryMode === 'income'
                    ? 'bg-white text-[#34C759]'
                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-[#10B981]'
                }`}
              >
                ↓
              </div>
              <span>
                {periodIncome.toLocaleString('ru-RU', {
                  minimumFractionDigits: 0,
                })}{' '}
                ₽
              </span>
            </button>

            {/* Red Expense Toggle Button */}
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setCategoryMode('expense');
              }}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-full font-bold text-[14px] transition-all active:scale-95 cursor-pointer select-none ${
                categoryMode === 'expense'
                  ? 'bg-[#FF4B55] text-white shadow-sm'
                  : 'bg-[#FEE2E2] dark:bg-[#28181E] text-[#EF4444] border border-red-200/60 dark:border-red-900/30'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold leading-none ${
                  categoryMode === 'expense'
                    ? 'bg-white text-[#FF4B55]'
                    : 'bg-red-100 dark:bg-red-950/80 text-[#EF4444]'
                }`}
              >
                ↑
              </div>
              <span>
                {periodExpense.toLocaleString('ru-RU', {
                  minimumFractionDigits: 0,
                })}{' '}
                ₽
              </span>
            </button>
          </div>
        </div>

        {/* Category Circular Tiles (Horizontal scroll, sorted by spending) */}
        <div className="my-6">
          <div className="flex items-center space-x-4 overflow-x-auto no-scrollbar py-2 px-1">
            {topCategories.map((cat) => {
              const radius = 29;
              const circumference = 2 * Math.PI * radius;
              const pct = cat.amount > 0 ? (cat.percentage || 0) : 0;
              const strokeDashoffset = circumference - (pct / 100) * circumference;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onHaptic?.('light');
                    onSelectCategory?.(cat as any, monthLabel, monthTransactions);
                  }}
                  className="flex flex-col items-center flex-shrink-0 group active:scale-95 transition-all min-w-[72px]"
                >
                  {/* Concentric Progress Ring with Emoji Icon inside */}
                  <div className="relative w-[68px] h-[68px] flex items-center justify-center mb-1.5 shrink-0">
                    <svg className="w-[68px] h-[68px] -rotate-90 transform absolute inset-0" viewBox="0 0 68 68">
                      {/* Track */}
                      <circle
                        cx="34"
                        cy="34"
                        r={radius}
                        className="stroke-gray-200"
                        strokeWidth="3.5"
                        fill="none"
                      />
                      {/* Colored Progress Arc */}
                      <circle
                        cx="34"
                        cy="34"
                        r={radius}
                        stroke={cat.color}
                        strokeWidth="3.5"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        fill="none"
                        className="transition-all duration-700"
                      />
                    </svg>

                    {/* Centered Emoji Circle */}
                    <div className="w-[52px] h-[52px] rounded-full bg-white dark:bg-[#1E1F26] shadow-sm flex items-center justify-center text-[26px] z-10 border border-gray-100 dark:border-gray-800 group-hover:scale-105 transition-transform select-none">
                      {cat.icon}
                    </div>
                  </div>

                  {/* Category Name */}
                  <span className="text-[13px] font-semibold text-[#111827] dark:text-gray-200 text-center truncate max-w-[76px] block leading-tight">
                    {cat.name}
                  </span>

                  {/* Formatted Amount (e.g. 11,7 тыс. ₽) */}
                  <span className="text-[11px] font-medium text-[#6B7280] dark:text-gray-400 text-center mt-1 block whitespace-nowrap leading-none">
                    {formatCompactAmount(cat.amount)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Transactions Section («Недавние») */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[18px] font-bold text-[#111827] dark:text-white">Недавние</h3>
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                onOpenTransactions?.();
              }}
              className="text-[13px] font-semibold text-[#2B5BFF] dark:text-[#5B82FF] flex items-center space-x-1 hover:underline active:opacity-75"
            >
              <span>Все транзакции</span>
              <RightOutlined className="text-[12px]" />
            </button>
          </div>

          {/* Transactions List */}
          <div className="space-y-4">
            {recentTwoDaysGroups.length > 0 ? (
              recentTwoDaysGroups.map((group) => (
                <div key={group.label} className="space-y-2">
                  <div className="text-[13px] font-semibold text-[#6B7280] dark:text-gray-300 pl-1">
                    {group.label}
                  </div>
                  <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar pb-1">
                    {group.transactions.map((tx) => {
                      const resolved = resolveCategoryAndSubcategory(tx);
                      return (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => {
                            onHaptic?.('light');
                            onSelectTransaction?.(tx);
                          }}
                          className="flex-shrink-0 bg-white dark:bg-[#1E1F26] rounded-[22px] px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center space-x-3 min-w-[175px] text-left active:scale-[0.98] transition-all"
                        >
                          <div className="text-2xl flex-shrink-0">{resolved.icon}</div>
                          <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold text-[#111827] dark:text-white leading-tight truncate max-w-[155px]">
                              {resolved.displayTitle}
                            </div>
                            <div
                              className={`text-[13px] font-bold mt-1 ${
                                tx.type === 'expense'
                                  ? 'text-[#FF4B55]'
                                  : tx.type === 'income'
                                  ? 'text-[#10B981]'
                                  : 'text-[#6B7280] dark:text-gray-400'
                              }`}
                            >
                              {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
                              {tx.amount.toLocaleString('ru-RU')} ₽
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-400 py-4 text-center w-full">Нет операций за этот месяц</div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Bottom Navigation Bar */}
      <div className="fixed bottom-6 left-0 right-0 z-30 flex items-center justify-center">
        <div className="flex items-center space-x-5">
          {/* Left: Receipt / QR Scanner Button */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('medium');
              onScanReceipt?.();
            }}
            className="w-13 h-13 p-3 rounded-full bg-white dark:bg-[#1E1F26] text-[#111827] dark:text-white shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex items-center justify-center active:scale-90 transition-all border border-gray-100 dark:border-gray-800"
          >
            <ScanOutlined className="text-[22px]" />
          </button>

          {/* Center: Big Elevated Royal Blue Microphone Button */}
          <div className="relative">
            <div className="absolute -inset-1.5 bg-[#2B5BFF]/30 rounded-full blur-md" />
            <button
              type="button"
              onClick={() => {
                onHaptic?.('heavy');
                onOpenVoice();
              }}
              className="relative w-18 h-18 p-4 rounded-full bg-[#2B5BFF] text-white shadow-[0_8px_24px_rgba(43,91,255,0.45)] flex items-center justify-center active:scale-95 transition-all"
            >
              <AudioOutlined className="text-[30px]" />
            </button>
          </div>

          {/* Right: Blue Plus (+) Button (matching media_1789747991545.png) */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('medium');
              onOpenAddTransaction();
            }}
            className="w-13 h-13 p-3 rounded-full bg-[#DCE6FF] dark:bg-[#1E284A] text-[#2B5BFF] dark:text-[#5B82FF] flex items-center justify-center active:scale-90 transition-all border border-[#B3C8FD] dark:border-[#2B5BFF]/40 shadow-sm"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
