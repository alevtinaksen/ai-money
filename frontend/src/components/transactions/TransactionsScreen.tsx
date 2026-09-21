import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  SearchOutlined,
  SwapOutlined,
  DownOutlined,
  CloseOutlined,
  CheckOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import { Transaction, Account, Category, TransactionType } from '../../types';
import { resolveCategoryAndSubcategory, formatTransactionSubtitleNote } from '../modals/EditTransactionModal';

interface TransactionsScreenProps {
  onBack: () => void;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAddTransaction: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
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
}


export const TransactionsScreen: React.FC<TransactionsScreenProps> = ({
  onBack,
  transactions,
  accounts: _accounts,
  categories,
  onSelectTransaction,
  onOpenAddTransaction,
  onHaptic,
  onUpdateTransaction,
}) => {
  // Drag & Drop states
  const [draggingTx, setDraggingTx] = useState<Transaction | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dragSessionRef = React.useRef<{
    tx: Transaction;
    sourceDateKey: string;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const justDraggedRef = React.useRef(false);

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
        const resolved = resolveCategoryAndSubcategory(tx);
        const matchNote = tx.note?.toLowerCase().includes(q);
        const matchCat =
          tx.category_name?.toLowerCase().includes(q) ||
          resolved.displayTitle.toLowerCase().includes(q) ||
          (resolved.subcategory && resolved.subcategory.toLowerCase().includes(q));
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
        const resolved = resolveCategoryAndSubcategory(tx);
        const catTarget = selectedCategory.toLowerCase();
        if (
          tx.category_id !== selectedCategory &&
          tx.category_name?.toLowerCase() !== catTarget &&
          resolved.mainCategory.toLowerCase() !== catTarget &&
          resolved.subcategory?.toLowerCase() !== catTarget
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

  const getDayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Group transactions by formatted date (e.g. "7 мая", "18 сент.")
  const groupedByDate = useMemo(() => {
    const map = new Map<string, { label: string; items: Transaction[]; expense: number }>();

    for (const tx of filteredTransactions) {
      const d = tx.created_at ? new Date(tx.created_at) : new Date();
      const dateKey = getDayKey(d);
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

    const groups: {
      dateKey: string;
      dateLabel: string;
      items: Transaction[];
      totalExpense: number;
      isPlaceholder?: boolean;
    }[] = [];

    const now = new Date();
    const todayKey = getDayKey(now);
    const todayLabel = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

    // If today has no transactions yet, add a clean drop zone target at the top!
    if (!map.has(todayKey) && selectedPeriod !== '7days') {
      groups.push({
        dateKey: todayKey,
        dateLabel: `Сегодня, ${todayLabel}`,
        items: [],
        totalExpense: 0,
        isPlaceholder: true,
      });
    }

    for (const [dateKey, val] of map.entries()) {
      let label = val.label;
      if (dateKey === todayKey) {
        label = `Сегодня, ${val.label}`;
      }
      groups.push({
        dateKey,
        dateLabel: label,
        items: val.items,
        totalExpense: val.expense,
        isPlaceholder: false,
      });
    }

    // Sort descending by actual calendar date
    groups.sort((a, b) => {
      const [yA, mA, dA] = a.dateKey.split('-').map(Number);
      const [yB, mB, dB] = b.dateKey.split('-').map(Number);
      return new Date(yB, mB - 1, dB).getTime() - new Date(yA, mA - 1, dA).getTime();
    });

    return groups;
  }, [filteredTransactions, selectedPeriod]);

  const groupedByDateRef = useRef(groupedByDate);
  groupedByDateRef.current = groupedByDate;

  // Cleanup body drag styles on unmount
  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
    };
  }, []);

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

  // Drag & Drop action
  const executeDateMove = (txId: string, targetDateKey: string, targetDateLabel: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx) return;

    const oldDate = tx.created_at ? new Date(tx.created_at) : new Date();
    const currentKey = getDayKey(oldDate);
    if (currentKey === targetDateKey) return;

    const [year, month, day] = targetDateKey.split('-').map(Number);
    const hours = isNaN(oldDate.getHours()) ? 12 : oldDate.getHours();
    const minutes = isNaN(oldDate.getMinutes()) ? 0 : oldDate.getMinutes();
    const seconds = isNaN(oldDate.getSeconds()) ? 0 : oldDate.getSeconds();
    const newDate = new Date(year, month - 1, day, hours, minutes, seconds);

    onHaptic?.('heavy');
    onUpdateTransaction?.({
      id: tx.id,
      amount: tx.amount,
      account_id: tx.account_id,
      to_account_id: tx.to_account_id,
      category_id: tx.category_id,
      type: tx.type,
      note: tx.note,
      created_at: newDate.toISOString(),
    });

    setToastMessage(`✓ Перенесено на ${targetDateLabel}`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Universal Pointer Drag (Mobile Touch, iOS Telegram WebApp, Desktop Mouse)
  const handlePointerDown = (e: React.PointerEvent, tx: Transaction, sourceDateKey: string) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (!e.isPrimary) return;
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    dragSessionRef.current = {
      tx,
      sourceDateKey,
      startX,
      startY,
      isDragging: false,
    };

    const handleWindowPointerMove = (ev: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session) return;

      const dx = ev.clientX - session.startX;
      const dy = ev.clientY - session.startY;

      if (!session.isDragging) {
        if (Math.hypot(dx, dy) > 6) {
          session.isDragging = true;
          setDraggingTx(session.tx);
          onHaptic?.('medium');
          document.body.style.userSelect = 'none';
          document.body.style.touchAction = 'none';
        } else {
          return;
        }
      }

      // Active dragging: prevent mobile scroll
      ev.preventDefault();
      setDragPos({ x: ev.clientX, y: ev.clientY });

      // Edge auto-scrolling
      if (ev.clientY < 90) {
        window.scrollBy({ top: -12, behavior: 'auto' });
      } else if (ev.clientY > window.innerHeight - 90) {
        window.scrollBy({ top: 12, behavior: 'auto' });
      }

      // Inspect drop zone underneath pointer
      const elem = document.elementFromPoint(ev.clientX, ev.clientY);
      const dropZone = elem?.closest('[data-date-key]');
      const foundDateKey = dropZone?.getAttribute('data-date-key') || null;

      const validTarget = foundDateKey && foundDateKey !== session.sourceDateKey ? foundDateKey : null;

      setDragOverDateKey((prev) => {
        if (prev !== validTarget) {
          if (validTarget) {
            onHaptic?.('light');
          }
          return validTarget;
        }
        return prev;
      });
    };

    const cleanupWindowListeners = () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('pointercancel', handleWindowPointerCancel);
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
    };

    const handleWindowPointerUp = (ev: PointerEvent) => {
      cleanupWindowListeners();

      const session = dragSessionRef.current;
      if (!session) return;

      if (session.isDragging) {
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 300);

        const elem = document.elementFromPoint(ev.clientX, ev.clientY);
        const dropZone = elem?.closest('[data-date-key]');
        const targetDateKey = dropZone?.getAttribute('data-date-key') || dragOverDateKey;

        if (targetDateKey && targetDateKey !== session.sourceDateKey) {
          const targetGroup = groupedByDateRef.current.find((g) => g.dateKey === targetDateKey);
          if (targetGroup) {
            executeDateMove(session.tx.id, targetGroup.dateKey, targetGroup.dateLabel);
          }
        }
      }

      dragSessionRef.current = null;
      setDraggingTx(null);
      setDragPos(null);
      setDragOverDateKey(null);
    };

    const handleWindowPointerCancel = () => {
      cleanupWindowListeners();
      const session = dragSessionRef.current;
      if (session?.isDragging) {
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 300);
      }
      dragSessionRef.current = null;
      setDraggingTx(null);
      setDragPos(null);
      setDragOverDateKey(null);
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    window.addEventListener('pointerup', handleWindowPointerUp);
    window.addEventListener('pointercancel', handleWindowPointerCancel);
  };


  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#121318] text-[#111827] dark:text-white flex flex-col pb-24 select-none animate-fade-in transition-colors duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#111827]/90 dark:bg-white/90 text-white dark:text-[#111827] backdrop-blur-md px-4 py-2 rounded-full shadow-lg text-[13px] font-semibold flex items-center space-x-2 animate-bounce">
          <span>{toastMessage}</span>
        </div>
      )}

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
          groupedByDate.map((group) => {
            const isDropTarget = dragOverDateKey === group.dateKey;

            return (
              <div
                key={group.dateKey}
                data-date-key={group.dateKey}
                className={`space-y-2.5 p-2 rounded-3xl transition-all ${
                  isDropTarget
                    ? 'bg-blue-50/80 dark:bg-blue-950/30 ring-2 ring-blue-500 ring-dashed'
                    : ''
                }`}
              >
                {/* Date Header + Day Expense Badge */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-[14px] font-bold text-gray-500 dark:text-gray-400">
                      {group.dateLabel}
                    </span>
                    {isDropTarget && (
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full animate-pulse">
                        Перенести сюда
                      </span>
                    )}
                  </div>

                  {group.totalExpense > 0 && (
                    <span className="text-[13px] font-bold text-[#EF4444] bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 rounded-full">
                      −{group.totalExpense.toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </div>

                {/* Empty Placeholder Day (e.g. drop target for Today) */}
                {group.isPlaceholder && group.items.length === 0 && (
                  <div
                    className={`border-2 border-dashed rounded-2xl p-4 text-center text-[13px] font-medium transition-all ${
                      isDropTarget
                        ? 'border-[#2B5BFF] bg-blue-50 dark:bg-blue-950/40 text-[#2B5BFF] dark:text-[#5B82FF] shadow-sm'
                        : 'border-gray-200 dark:border-gray-800 bg-white/40 dark:bg-[#1E1F26]/40 text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {isDropTarget ? '✨ Отпустите, чтобы перенести сюда' : '📥 Перетащите операцию сюда, чтобы назначить на сегодня'}
                  </div>
                )}

                {/* Transactions Cards for this date */}
                <div className="space-y-2">
                  {group.items.map((tx) => {
                    const isTransfer = tx.type === 'transfer';
                    const isIncome = tx.type === 'income';
                    const isExpense = tx.type === 'expense';
                    const resolved = resolveCategoryAndSubcategory(tx);
                    const displayNote = formatTransactionSubtitleNote(tx.note, resolved);
                    const isBeingDragged = draggingTx?.id === tx.id;

                    return (
                      <div
                        key={tx.id}
                        onClick={() => {
                          if (justDraggedRef.current || draggingTx) return;
                          onHaptic?.('light');
                          onSelectTransaction(tx);
                        }}
                        className={`bg-white dark:bg-[#1E1F26] border border-gray-100 dark:border-gray-800/80 rounded-2xl p-3.5 flex items-center justify-between shadow-xs active:scale-[0.99] transition-all cursor-pointer select-none ${
                          isBeingDragged
                            ? 'opacity-40 scale-95 border-dashed border-blue-400'
                            : 'hover:border-gray-200 dark:hover:border-gray-700'
                        }`}
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
                                    {displayNote ? `${displayNote} • ` : ''}
                                    {tx.account_name || 'Карта Альфа'}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Right Amount + Drag Handle */}
                        <div className="flex items-center space-x-2 flex-shrink-0 ml-3">
                          <div className="text-right">
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

                          {/* Grip Handle for Drag & Drop with Pointer Events */}
                          <div
                            onPointerDown={(e) => handlePointerDown(e, tx, group.dateKey)}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                            }}
                            title="Перетащить на другую дату"
                            className="w-10 h-10 -mr-1 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-[#2B5BFF] dark:hover:text-[#5B82FF] active:text-[#2B5BFF] cursor-grab active:cursor-grabbing touch-none select-none rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                          >
                            <HolderOutlined className="text-[19px]" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Drag Preview Clone that follows finger */}
      {draggingTx && dragPos && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-[55px] shadow-2xl rounded-2xl bg-white dark:bg-[#1E1F26] border-2 border-[#2B5BFF] p-3.5 flex items-center space-x-3 w-[290px] opacity-95 scale-105 transition-transform"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl bg-blue-50 dark:bg-blue-950/60 text-[#2B5BFF] flex-shrink-0">
            {resolveCategoryAndSubcategory(draggingTx).icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-bold text-[#111827] dark:text-white truncate">
              {resolveCategoryAndSubcategory(draggingTx).displayTitle}
            </div>
            <div className="text-[12px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {draggingTx.account_name || 'Счёт'}
            </div>
          </div>
          <div className="text-[14px] font-extrabold text-[#EF4444] flex-shrink-0">
            {draggingTx.type === 'expense' ? '−' : draggingTx.type === 'income' ? '+' : ''}
            {draggingTx.amount.toLocaleString('ru-RU')} ₽
          </div>
        </div>
      )}

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
