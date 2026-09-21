import React, { useState, useEffect, useRef } from 'react';
import {
  WalletOutlined,
  ReloadOutlined,
  SettingOutlined,
  LeftOutlined,
  RightOutlined,
  ScanOutlined,
  AudioOutlined,
  CheckOutlined,
  HolderOutlined,
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
  onUpdateTransaction,
  onRefresh,
  onHaptic,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 8, 1)); // Default to September 2026
  const [categoryMode, setCategoryMode] = useState<'expense' | 'income'>('expense');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRefreshToast, setShowRefreshToast] = useState(false);

  // Drag & Drop states
  const [draggingTx, setDraggingTx] = useState<Transaction | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOverDateKey, setDragOverDateKey] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dragSessionRef = useRef<{
    tx: Transaction;
    sourceDateKey: string;
    startX: number;
    startY: number;
    isDragging: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);

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

    // If today has no transactions yet, also show the previous active day (e.g. Позавчера, 19 сент) so history is immediately visible
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

  const recentTwoDaysGroupsRef = useRef(recentTwoDaysGroups);
  recentTwoDaysGroupsRef.current = recentTwoDaysGroups;

  // Cleanup body drag styles on unmount
  useEffect(() => {
    return () => {
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
    };
  }, []);

  // Drag & Drop action on Dashboard
  const executeDateMove = (txId: string, targetDateKey: string, targetDateLabel: string) => {
    const tx = summary.recent_transactions.find((t) => t.id === txId);
    if (!tx) return;

    const oldDate = tx.created_at ? new Date(tx.created_at) : new Date();
    const currentKey = `${oldDate.getFullYear()}-${String(oldDate.getMonth() + 1).padStart(2, '0')}-${String(oldDate.getDate()).padStart(2, '0')}`;
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
          const targetGroup = recentTwoDaysGroupsRef.current.find((g) => g.key === targetDateKey);
          if (targetGroup) {
            executeDateMove(session.tx.id, targetGroup.key, targetGroup.label);
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
            {recentTwoDaysGroups.map((group) => {
              const isDropTarget = dragOverDateKey === group.key;

              return (
                <div
                  key={group.key}
                  data-date-key={group.key}
                  className={`space-y-2 p-2 rounded-3xl transition-all ${
                    isDropTarget
                      ? 'bg-blue-50/80 dark:bg-blue-950/30 ring-2 ring-[#2B5BFF] ring-dashed'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between pl-1">
                    <span className="text-[13px] font-semibold text-[#6B7280] dark:text-gray-300">
                      {group.label}
                    </span>
                    {isDropTarget && (
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full animate-pulse">
                        Перенести сюда
                      </span>
                    )}
                  </div>

                  {group.transactions.length > 0 ? (
                    <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar pb-1">
                      {group.transactions.map((tx) => {
                        const resolved = resolveCategoryAndSubcategory(tx);
                        const isBeingDragged = draggingTx?.id === tx.id;

                        return (
                          <div
                            key={tx.id}
                            className={`flex-shrink-0 bg-white dark:bg-[#1E1F26] rounded-[22px] px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center space-x-3 min-w-[190px] text-left transition-all ${
                              isBeingDragged
                                ? 'opacity-40 scale-95 border-dashed border-blue-400'
                                : 'hover:border-gray-200 dark:hover:border-gray-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (justDraggedRef.current || draggingTx) return;
                                onHaptic?.('light');
                                onSelectTransaction?.(tx);
                              }}
                              className="flex items-center space-x-3 flex-1 min-w-0 text-left"
                            >
                              <div className="text-2xl flex-shrink-0">{resolved.icon}</div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[14px] font-semibold text-[#111827] dark:text-white leading-tight truncate max-w-[125px]">
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

                            {/* Grip Handle for Drag & Drop between days */}
                            <div
                              onPointerDown={(e) => handlePointerDown(e, tx, group.key)}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                              }}
                              title="Перетащить на другой день"
                              className="w-9 h-9 -mr-1 flex items-center justify-center text-gray-300 dark:text-gray-600 hover:text-[#2B5BFF] dark:hover:text-[#5B82FF] active:text-[#2B5BFF] cursor-grab active:cursor-grabbing touch-none select-none rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                            >
                              <HolderOutlined className="text-[17px]" />
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
                      className={`w-full rounded-[20px] py-2.5 px-4 border border-dashed text-[13px] font-medium flex items-center justify-center space-x-1.5 active:scale-[0.99] transition-all ${
                        isDropTarget
                          ? 'border-[#2B5BFF] bg-blue-50 dark:bg-blue-950/40 text-[#2B5BFF] dark:text-[#5B82FF]'
                          : 'bg-white/60 dark:bg-[#1E1F26]/60 hover:bg-white dark:hover:bg-[#1E1F26] border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      <span>
                        {isDropTarget
                          ? '✨ Отпустите, чтобы перенести на сегодня'
                          : '+ Добавить первую операцию за сегодня'}
                      </span>
                    </button>
                  ) : (
                    <div
                      className={`rounded-[20px] py-2.5 px-4 border border-dashed text-[13px] text-center transition-all ${
                        isDropTarget
                          ? 'border-[#2B5BFF] bg-blue-50 dark:bg-blue-950/40 text-[#2B5BFF] dark:text-[#5B82FF] font-medium'
                          : 'bg-white/40 dark:bg-[#1E1F26]/40 border-gray-100 dark:border-gray-800/80 text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {isDropTarget ? '✨ Отпустите, чтобы перенести сюда' : group.emptyMessage}
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Date Move Feedback Toast */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-[#111827]/90 dark:bg-white/90 text-white dark:text-[#111827] text-xs font-semibold px-4 py-2 rounded-full shadow-lg backdrop-blur-md animate-fade-in flex items-center space-x-2 border border-white/10 dark:border-black/10 pointer-events-none">
          <CheckOutlined className="text-emerald-400 text-sm" />
          <span>{toastMessage}</span>
        </div>
      )}

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
    </div>
  );
};
