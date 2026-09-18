import React, { useState, useMemo } from 'react';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  SearchOutlined,
  SwapOutlined,
  DownOutlined,
  CloseOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { Transaction, Account, Category, TransactionType } from '../../types';
import { resolveCategoryAndSubcategory } from '../modals/EditTransactionModal';

interface TransactionsScreenProps {
  onBack: () => void;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAddTransaction: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  onBack,
  transactions,
  accounts: _accounts,
  categories,
  onSelectTransaction,
  onOpenAddTransaction,
  onHaptic,
}) => {
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'month' | '7days'>('all');

  // Filter picker dropdown sheet states
  const [activePicker, setActivePicker] = useState<'period' | 'type' | 'category' | null>(null);

  // Group and filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNote = tx.note?.toLowerCase().includes(q);
        const matchCat = tx.category_name?.toLowerCase().includes(q);
        const matchAcc = tx.account_name?.toLowerCase().includes(q);
        const matchAmt = tx.amount.toString().includes(q);
        if (!matchNote && !matchCat && !matchAcc && !matchAmt) return false;
      }

      // 2. Type filter
      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      // 3. Category filter
      if (selectedCategory !== 'all') {
        if (
          tx.category_id !== selectedCategory &&
          tx.category_name?.toLowerCase() !== selectedCategory.toLowerCase()
        ) {
          return false;
        }
      }

      // 4. Period filter
      if (selectedPeriod !== 'all' && tx.created_at) {
        const txDate = new Date(tx.created_at);
        const now = new Date();
        if (selectedPeriod === 'month') {
          if (
            txDate.getMonth() !== now.getMonth() ||
            txDate.getFullYear() !== now.getFullYear()
          ) {
            return false;
          }
        } else if (selectedPeriod === '7days') {
          const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 3600 * 24);
          if (diffDays > 7) return false;
        }
      }

      return true;
    });
  }, [transactions, searchQuery, selectedType, selectedCategory, selectedPeriod]);

  // Group transactions by formatted date (e.g. "7 мая", "18 сент.")
  const groupedByDate = useMemo(() => {
    const groups: {
      dateKey: string;
      dateLabel: string;
      items: Transaction[];
      totalExpense: number;
    }[] = [];

    const map = new Map<string, { label: string; items: Transaction[]; expense: number }>();

    for (const tx of filteredTransactions) {
      const d = tx.created_at ? new Date(tx.created_at) : new Date();
      const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const dateLabel = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

      if (!map.has(dateKey)) {
        map.set(dateKey, { label: dateLabel, items: [], expense: 0 });
      }

      const entry = map.get(dateKey)!;
      entry.items.push(tx);
      if (tx.type === 'expense') {
        entry.expense += tx.amount;
      }
    }

    for (const [dateKey, val] of map.entries()) {
      groups.push({
        dateKey,
        dateLabel: val.label,
        items: val.items,
        totalExpense: val.expense,
      });
    }

    return groups;
  }, [filteredTransactions]);

  const typeLabelMap: Record<string, string> = {
    all: 'Все типы',
    expense: 'Расходы',
    income: 'Доходы',
    transfer: 'Переводы',
  };

  const periodLabelMap: Record<string, string> = {
    all: 'Все время',
    month: 'Этот месяц',
    '7days': 'За 7 дней',
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#121318] text-[#111827] dark:text-white flex flex-col pb-24 select-none animate-fade-in transition-colors duration-200">
      {/* Top Header Bar (matching media_1789747928430.png) */}
      <div className="sticky top-0 z-30 bg-[#F6F7FB]/95 dark:bg-[#121318]/95 backdrop-blur-md px-5 pt-12 pb-3 border-b border-gray-100 dark:border-gray-800/60">
        <div className="flex items-center justify-between">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onBack();
            }}
            className="w-11 h-11 rounded-full bg-white dark:bg-[#1E1F26] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center text-[#111827] dark:text-white active:scale-95 transition-all"
          >
            <ArrowLeftOutlined className="text-[18px]" />
          </button>

          {/* Title */}
          <h1 className="text-[20px] font-bold text-[#111827] dark:text-white tracking-tight">
            Транзакции
          </h1>

          {/* Action Buttons Right */}
          <div className="flex items-center space-x-2">
            {/* Quick Filter: Transfers Only */}
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setSelectedType((prev) => (prev === 'transfer' ? 'all' : 'transfer'));
              }}
              className={`w-11 h-11 rounded-full border shadow-sm flex items-center justify-center transition-all relative ${
                selectedType === 'transfer'
                  ? 'bg-[#2B5BFF] text-white border-transparent'
                  : 'bg-white dark:bg-[#1E1F26] border-gray-100 dark:border-gray-800 text-[#111827] dark:text-white'
              }`}
            >
              <SwapOutlined className="text-[18px]" />
              <span className="absolute -top-1 -right-1 text-[11px]">🚀</span>
            </button>

            {/* Calendar / Period Filter Button */}
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setActivePicker(activePicker === 'period' ? null : 'period');
              }}
              className={`w-11 h-11 rounded-full border shadow-sm flex items-center justify-center transition-all ${
                selectedPeriod !== 'all'
                  ? 'bg-[#2B5BFF] text-white border-transparent'
                  : 'bg-white dark:bg-[#1E1F26] border-gray-100 dark:border-gray-800 text-[#111827] dark:text-white'
              }`}
            >
              <CalendarOutlined className="text-[18px]" />
            </button>

            {/* Search Button */}
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setIsSearchOpen(!isSearchOpen);
                if (isSearchOpen) setSearchQuery('');
              }}
              className={`w-11 h-11 rounded-full border shadow-sm flex items-center justify-center transition-all ${
                isSearchOpen || searchQuery
                  ? 'bg-[#2B5BFF] text-white border-transparent'
                  : 'bg-white dark:bg-[#1E1F26] border-gray-100 dark:border-gray-800 text-[#111827] dark:text-white'
              }`}
            >
              <SearchOutlined className="text-[18px]" />
            </button>
          </div>
        </div>

        {/* Expandable Search Input */}
        {isSearchOpen && (
          <div className="mt-3 relative animate-slide-down">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по сумме, категории, счёту..."
              autoFocus
              className="w-full bg-white dark:bg-[#1E1F26] border border-gray-200 dark:border-gray-700/80 rounded-2xl px-4 py-2.5 text-[14px] text-[#111827] dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#2B5BFF]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-200"
              >
                <CloseOutlined className="text-[14px]" />
              </button>
            )}
          </div>
        )}

        {/* Filter Pills Row (matching media_1789747928430.png: Все время ⌵, Все типы ⌵, Все категории ⌵) */}
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pt-3.5 pb-1">
          {/* Period Pill */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              setActivePicker(activePicker === 'period' ? null : 'period');
            }}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold border shadow-sm flex-shrink-0 transition-all ${
              selectedPeriod !== 'all'
                ? 'bg-[#2B5BFF] text-white border-transparent'
                : 'bg-white dark:bg-[#1E1F26] text-[#111827] dark:text-gray-300 border-gray-100 dark:border-gray-800'
            }`}
          >
            <span>{periodLabelMap[selectedPeriod]}</span>
            <DownOutlined className="text-[10px]" />
          </button>

          {/* Type Pill */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              setActivePicker(activePicker === 'type' ? null : 'type');
            }}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold border shadow-sm flex-shrink-0 transition-all ${
              selectedType !== 'all'
                ? 'bg-[#2B5BFF] text-white border-transparent'
                : 'bg-white dark:bg-[#1E1F26] text-[#111827] dark:text-gray-300 border-gray-100 dark:border-gray-800'
            }`}
          >
            <span>{typeLabelMap[selectedType]}</span>
            <DownOutlined className="text-[10px]" />
          </button>

          {/* Category Pill */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              setActivePicker(activePicker === 'category' ? null : 'category');
            }}
            className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold border shadow-sm flex-shrink-0 transition-all ${
              selectedCategory !== 'all'
                ? 'bg-[#2B5BFF] text-white border-transparent'
                : 'bg-white dark:bg-[#1E1F26] text-[#111827] dark:text-gray-300 border-gray-100 dark:border-gray-800'
            }`}
          >
            <span>{selectedCategory === 'all' ? 'Все категории' : selectedCategory}</span>
            <DownOutlined className="text-[10px]" />
          </button>
        </div>

        {/* Dropdown Sheets for Filter Pills */}
        {activePicker === 'period' && (
          <div className="mt-2.5 bg-white dark:bg-[#1E1F26] rounded-2xl p-2 border border-gray-100 dark:border-gray-800 shadow-xl flex flex-col space-y-1 animate-scale-up">
            {(['all', 'month', '7days'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setSelectedPeriod(p);
                  setActivePicker(null);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-[14px] font-medium text-left ${
                  selectedPeriod === p
                    ? 'bg-[#2B5BFF]/10 text-[#2B5BFF] dark:text-[#5B82FF] font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <span>{periodLabelMap[p]}</span>
                {selectedPeriod === p && <CheckOutlined className="text-[14px]" />}
              </button>
            ))}
          </div>
        )}

        {activePicker === 'type' && (
          <div className="mt-2.5 bg-white dark:bg-[#1E1F26] rounded-2xl p-2 border border-gray-100 dark:border-gray-800 shadow-xl flex flex-col space-y-1 animate-scale-up">
            {(['all', 'expense', 'income', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setSelectedType(t);
                  setActivePicker(null);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-[14px] font-medium text-left ${
                  selectedType === t
                    ? 'bg-[#2B5BFF]/10 text-[#2B5BFF] dark:text-[#5B82FF] font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <span>{typeLabelMap[t]}</span>
                {selectedType === t && <CheckOutlined className="text-[14px]" />}
              </button>
            ))}
          </div>
        )}

        {activePicker === 'category' && (
          <div className="mt-2.5 bg-white dark:bg-[#1E1F26] rounded-2xl p-2 border border-gray-100 dark:border-gray-800 shadow-xl max-h-60 overflow-y-auto flex flex-col space-y-1 animate-scale-up">
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setSelectedCategory('all');
                setActivePicker(null);
              }}
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-[14px] font-medium text-left ${
                selectedCategory === 'all'
                  ? 'bg-[#2B5BFF]/10 text-[#2B5BFF] dark:text-[#5B82FF] font-semibold'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <span>Все категории</span>
              {selectedCategory === 'all' && <CheckOutlined className="text-[14px]" />}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setSelectedCategory(c.name);
                  setActivePicker(null);
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-[14px] font-medium text-left ${
                  selectedCategory === c.name
                    ? 'bg-[#2B5BFF]/10 text-[#2B5BFF] dark:text-[#5B82FF] font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span>{c.icon}</span>
                  <span>{c.name}</span>
                </div>
                {selectedCategory === c.name && <CheckOutlined className="text-[14px]" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grouped Transactions List */}
      <div className="px-5 pt-4 space-y-6 flex-1">
        {groupedByDate.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mx-auto flex items-center justify-center text-3xl">
              📂
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Транзакций не найдено
            </p>
          </div>
        ) : (
          groupedByDate.map((group) => (
            <div key={group.dateKey} className="space-y-2.5">
              {/* Date Header + Day Expense Badge */}
              <div className="flex items-center justify-between px-1">
                <span className="text-[14px] font-bold text-gray-500 dark:text-gray-400">
                  {group.dateLabel}
                </span>

                {group.totalExpense > 0 && (
                  <span className="text-[13px] font-bold text-[#EF4444] bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 rounded-full">
                    −{group.totalExpense.toLocaleString('ru-RU')} ₽
                  </span>
                )}
              </div>

              {/* Transactions Cards for this date */}
              <div className="space-y-2">
                {group.items.map((tx) => {
                  const isTransfer = tx.type === 'transfer';
                  const isIncome = tx.type === 'income';
                  const isExpense = tx.type === 'expense';
                  const resolved = resolveCategoryAndSubcategory(tx);

                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        onHaptic?.('light');
                        onSelectTransaction(tx);
                      }}
                      className="bg-white dark:bg-[#1E1F26] border border-gray-100 dark:border-gray-800/80 rounded-2xl p-3.5 flex items-center justify-between shadow-xs active:scale-[0.99] transition-all cursor-pointer"
                    >
                      {/* Left Icon */}
                      <div className="flex items-center space-x-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 text-[20px] ${
                            isTransfer
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-[#3B82F6]'
                              : isIncome
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-[#10B981]'
                              : 'bg-gray-100 dark:bg-[#282933]'
                          }`}
                        >
                          {isTransfer ? (
                            <SwapOutlined className="text-[18px]" />
                          ) : (
                            resolved.icon
                          )}
                        </div>

                        {/* Middle Titles */}
                        <div className="min-w-0 flex-1">
                          {isTransfer ? (
                            <div>
                              <span className="text-[14px] font-bold text-[#111827] dark:text-white block leading-tight truncate">
                                {tx.account_name || 'Счёт'}
                              </span>
                              <span className="text-[12px] text-gray-500 dark:text-gray-400 block leading-tight truncate mt-0.5">
                                → {tx.note || 'Перевод'}
                              </span>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center space-x-1.5 truncate">
                                <span className="text-[15px] font-bold text-[#111827] dark:text-white leading-tight truncate">
                                  {resolved.displayTitle}
                                </span>
                              </div>

                              <div className="flex items-center space-x-1.5 text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                <span className="truncate">
                                  {tx.note &&
                                  !resolved.subcategory &&
                                  tx.note.toLowerCase() !== resolved.mainCategory.toLowerCase()
                                    ? `${tx.note} • `
                                    : ''}
                                  {tx.account_name || 'Карта Альфа'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Amount */}
                      <div className="text-right flex-shrink-0 ml-3">
                        <span
                          className={`text-[16px] font-extrabold tracking-tight ${
                            isExpense
                              ? 'text-[#EF4444]'
                              : isIncome
                              ? 'text-[#10B981]'
                              : 'text-[#3B82F6]'
                          }`}
                        >
                          {tx.type === 'expense'
                            ? `−${tx.amount.toLocaleString('ru-RU')}`
                            : tx.type === 'income'
                            ? `+${tx.amount.toLocaleString('ru-RU')}`
                            : `${tx.amount.toLocaleString('ru-RU')}`}{' '}
                          ₽
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Action Button (FAB) Blue Plus (matching media_1789747991545.png) */}
      <button
        type="button"
        onClick={() => {
          onHaptic?.('medium');
          onOpenAddTransaction();
        }}
        className="fixed bottom-6 right-5 w-14 h-14 rounded-full bg-[#DCE6FF] dark:bg-[#1E284A] text-[#2B5BFF] dark:text-[#5B82FF] flex items-center justify-center active:scale-90 transition-all border border-[#B3C8FD] dark:border-[#2B5BFF]/40 shadow-[0_4px_16px_rgba(43,91,255,0.2)] z-40"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-7 h-7"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
};
