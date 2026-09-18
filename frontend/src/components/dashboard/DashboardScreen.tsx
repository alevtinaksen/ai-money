import React, { useState } from 'react';
import {
  WalletOutlined,
  ReloadOutlined,
  SettingOutlined,
  LeftOutlined,
  RightOutlined,
  ScanOutlined,
  AudioOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { DashboardSummary, Account, Category, Transaction } from '../../types';

import { CATEGORIES_CATALOG } from '../modals/EditTransactionModal';

interface DashboardScreenProps {
  summary: DashboardSummary;
  accounts: Account[];
  categories: Category[];
  onOpenAccounts: () => void;
  onOpenAddTransaction: () => void;
  onOpenVoice: () => void;
  onOpenSettings?: () => void;
  onScanReceipt?: () => void;
  onSelectTransaction?: (tx: Transaction) => void;
  onSelectCategory?: (cat: Category) => void;
  onRefresh?: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

const MONTHS = [
  'Январь 2026',
  'Февраль 2026',
  'Март 2026',
  'Апрель 2026',
  'Май 2026',
  'Июнь 2026',
  'Июль 2026',
  'Август 2026',
  'Сентябрь 2026',
  'Октябрь 2026',
  'Ноябрь 2026',
  'Декабрь 2026',
];

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  summary,
  accounts,
  categories,
  onOpenAccounts,
  onOpenAddTransaction,
  onOpenVoice,
  onOpenSettings,
  onScanReceipt,
  onSelectTransaction,
  onSelectCategory,
  onRefresh,
  onHaptic,
}) => {
  const [monthIdx, setMonthIdx] = useState(8); // Default to "Сентябрь 2026"

  const totalAccountsBalance = accounts.reduce((sum, acc) => {
    if (acc.group_name === 'Кредиты') return sum - acc.balance;
    return sum + acc.balance;
  }, 0);

  const prevMonth = () => {
    onHaptic?.('light');
    setMonthIdx((prev) => (prev > 0 ? prev - 1 : 11));
  };

  const nextMonth = () => {
    onHaptic?.('light');
    setMonthIdx((prev) => (prev < 11 ? prev + 1 : 0));
  };

  // Top categories sorted by real spending for the period dynamically calculated from transactions
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

      return nameToCheck || 'Другое';
    };

    for (const tx of summary.recent_transactions) {
      if (tx.type === 'expense') {
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
        icon: foundInCat?.icon || foundInCatalog?.icon || '📦',
        color: foundInCat?.color || '#FF7A00',
        amount: amt,
        percentage: 0,
      });
      processed.add(name.toLowerCase());
    }

    const defaultCategories = [
      { name: 'Еда', icon: '🍔', color: '#FF7A00' },
      { name: 'Транспорт', icon: '🚗', color: '#EF4444' },
      { name: 'Здоровье', icon: '💊', color: '#F59E0B' },
      { name: 'Покупки', icon: '🛍️', color: '#EC4899' },
      { name: 'Машина', icon: '🚘', color: '#3B82F6' },
    ];

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

    const totalExp = list.reduce((sum, c) => sum + c.amount, 0);

    return list.map((c) => ({
      ...c,
      percentage: totalExp > 0 ? Math.min(100, Math.round((c.amount / totalExp) * 100)) : 0,
    }));
  }, [summary.recent_transactions, categories]);

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
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col justify-between pb-24 select-none animate-fade-in relative">
      {/* Top Header Bar */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        {/* Total Balance Wallet Button */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onOpenAccounts();
          }}
          className="flex items-center space-x-2 text-[#111827] active:opacity-75 transition-opacity"
        >
          <WalletOutlined className="text-[22px] text-[#111827]" />
          <span className="text-[17px] font-bold tracking-tight">
            {totalAccountsBalance.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ₽
          </span>
        </button>

        {/* Right Header Action Icons */}
        <div className="flex items-center space-x-3 text-[#374151]">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onRefresh?.();
            }}
            className="p-1 hover:text-black transition-colors active:rotate-180 transition-transform duration-300"
            title="Обновить"
          >
            <ReloadOutlined className="text-[18px] text-[#4B5563]" />
          </button>
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onOpenSettings?.();
            }}
            className="p-1 hover:text-black transition-colors"
            title="Настройки"
          >
            <SettingOutlined className="text-[18px] text-[#4B5563]" />
          </button>
        </div>
      </div>

      {/* Main Center Content */}
      <div className="flex-1 px-5 max-w-lg mx-auto w-full">
        {/* Month / Period Selector */}
        <div className="flex items-center justify-center space-x-4 my-2">
          <button
            type="button"
            onClick={prevMonth}
            className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#6B7280] active:scale-90"
          >
            <LeftOutlined className="text-[14px]" />
          </button>
          <span className="text-[17px] font-bold text-[#111827] min-w-[140px] text-center">
            {MONTHS[monthIdx]}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#6B7280] active:scale-90"
          >
            <RightOutlined className="text-[14px]" />
          </button>
        </div>

        {/* Big Net Period Amount */}
        <div className="text-center my-4">
          {(() => {
            const net = summary.period_income - summary.period_expense;
            const sign = net > 0 ? '+' : (net < 0 ? '−' : '');
            return (
              <h2 className="text-[42px] font-extrabold text-[#111827] tracking-tight">
                {sign}{Math.abs(net).toLocaleString('ru-RU', { minimumFractionDigits: 0 })}{' '}
                <span className="font-bold">₽</span>
              </h2>
            );
          })()}

          {/* Stat Badges: Income ↓ and Expense ↑ */}
          <div className="flex items-center justify-center space-x-3 mt-3">
            <div className="flex items-center space-x-1.5 px-4 py-1.5 rounded-full bg-[#ECFDF5] text-[#10B981] font-bold text-[14px]">
              <span>↓</span>
              <span>
                {summary.period_income.toLocaleString('ru-RU', {
                  minimumFractionDigits: 0,
                })}{' '}
                ₽
              </span>
            </div>

            <div className="flex items-center space-x-1.5 px-4 py-1.5 rounded-full bg-[#FEE2E2] text-[#EF4444] font-bold text-[14px]">
              <span>↑</span>
              <span>
                {summary.period_expense.toLocaleString('ru-RU', {
                  minimumFractionDigits: 0,
                })}{' '}
                ₽
              </span>
            </div>
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
                    onSelectCategory?.(cat as any);
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
                    <div className="w-[52px] h-[52px] rounded-full bg-white shadow-sm flex items-center justify-center text-[26px] z-10 border border-gray-100 group-hover:scale-105 transition-transform select-none">
                      {cat.icon}
                    </div>
                  </div>

                  {/* Category Name */}
                  <span className="text-[13px] font-semibold text-[#111827] text-center truncate max-w-[76px] block leading-tight">
                    {cat.name}
                  </span>

                  {/* Formatted Amount (e.g. 11,7 тыс. ₽) */}
                  <span className="text-[11px] font-medium text-[#6B7280] text-center mt-1 block whitespace-nowrap leading-none">
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
            <h3 className="text-[18px] font-bold text-[#111827]">Недавние</h3>
            <button
              type="button"
              onClick={() => onHaptic?.('light')}
              className="text-[13px] font-semibold text-[#2B5BFF] flex items-center space-x-1"
            >
              <span>Все транзакции</span>
              <RightOutlined className="text-[12px]" />
            </button>
          </div>

          {/* Transactions List */}
          <div className="space-y-2">
            {/* Centered Date Header above cards */}
            <div className="text-center text-[12px] font-medium text-[#9CA3AF]">
              {summary.recent_transactions.length > 0 && summary.recent_transactions[0].created_at
                ? new Date(summary.recent_transactions[0].created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                  })
                : new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </div>

            {/* Horizontal / Stacked Transaction Cards */}
            <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar pb-2">
              {summary.recent_transactions.length > 0 ? (
                summary.recent_transactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => {
                      onHaptic?.('light');
                      onSelectTransaction?.(tx);
                    }}
                    className="flex-shrink-0 bg-white rounded-[22px] px-4 py-3 shadow-sm border border-gray-100 flex items-center space-x-3 min-w-[170px] text-left active:scale-[0.98] transition-all"
                  >
                    <div className="text-2xl">{tx.category_icon || (tx.type === 'transfer' ? '🔄' : '📦')}</div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#111827] leading-tight truncate max-w-[120px]">
                        {tx.category_name || tx.note || (tx.type === 'transfer' ? 'Перевод' : 'Расход')}
                      </div>
                      <div
                        className={`text-[13px] font-bold mt-0.5 ${
                          tx.type === 'expense'
                            ? 'text-[#FF4B55]'
                            : tx.type === 'income'
                            ? 'text-[#10B981]'
                            : 'text-[#6B7280]'
                        }`}
                      >
                        {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
                        {tx.amount.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-gray-400 py-4 text-center w-full">Нет операций за период</div>
              )}
            </div>
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
            className="w-13 h-13 p-3 rounded-full bg-white text-[#111827] shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex items-center justify-center active:scale-90 transition-all border border-gray-100"
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

          {/* Right: Blue Plus (+) Button */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('medium');
              onOpenAddTransaction();
            }}
            className="w-13 h-13 p-3 rounded-full bg-[#2B5BFF]/15 text-[#2B5BFF] flex items-center justify-center active:scale-90 transition-all border border-[#2B5BFF]/25 shadow-sm"
          >
            <PlusOutlined className="text-[22px]" />
          </button>
        </div>
      </div>
    </div>
  );
};
