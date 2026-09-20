import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CloseOutlined,
  SwapOutlined,
  CalendarOutlined,
  CheckOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Account, Category, Transaction, TransactionType } from '../../types';
import { CustomNumpad } from '../keypad/CustomNumpad';
import { AccountSelectSheet } from '../modals/AccountSelectSheet';
import { resolveAccountBankAndName } from '../../utils/bankUtils';

interface AddTransactionScreenProps {
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  selectedAccount: Account;
  initialType?: TransactionType;
  initialCategoryId?: string;
  recentTransactions?: Transaction[];
  onOpenAccountSelect?: () => void;
  onSubmit: (tx: {
    account_id: string;
    to_account_id?: string;
    category_id: string;
    amount: number;
    type: TransactionType;
    note: string;
  }) => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export const AddTransactionScreen: React.FC<AddTransactionScreenProps> = ({
  onClose,
  accounts,
  categories,
  selectedAccount,
  initialType,
  initialCategoryId,
  recentTransactions = [],
  onSubmit,
  onHaptic,
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [txType, setTxType] = useState<TransactionType>(initialType || 'expense');
  const [isAmountError, setIsAmountError] = useState(false);

  // Source and Destination accounts
  const [fromAccount, setFromAccount] = useState<Account>(selectedAccount);
  const [toAccount, setToAccount] = useState<Account>(() => {
    const other = accounts.find((a) => a.id !== selectedAccount.id);
    return other || selectedAccount;
  });

  const fromResolved = useMemo(() => resolveAccountBankAndName(fromAccount), [fromAccount]);
  const toResolved = useMemo(() => resolveAccountBankAndName(toAccount), [toAccount]);

  // Account selector modal state ('from' | 'to' | null)
  const [accountPickerTarget, setAccountPickerTarget] = useState<'from' | 'to' | null>(null);

  // Selected Category
  const [selectedCategory, setSelectedCategory] = useState<Category>(() => {
    if (initialType === 'transfer' || initialCategoryId) {
      const match = categories.find(
        (c) =>
          c.id === initialCategoryId ||
          c.name.toLowerCase().includes('перевод') ||
          c.icon === '💸'
      );
      if (match) return match;
    }
    return categories[0] || {
      id: 'cat-1',
      name: 'Еда',
      type: 'expense',
      icon: '🍔',
      color: '#FEE2E2',
      sort_order: 1,
      user_id: 143702968,
    };
  });

  const [note, setNote] = useState('');
  const [dateLabel, setDateLabel] = useState('Сегодня');

  // Find transfer category helper
  const transferCategory = useMemo(() => {
    return categories.find(
      (c) => c.name.toLowerCase().includes('перевод') || c.icon === '💸'
    );
  }, [categories]);

  // Category popularity & user priority scoring:
  // 1. Food / Groceries (top priority: 3000)
  // 2. Car / Auto / Fuel (right behind Food: 2500)
  // 3. Shopping / Cafe / Daily life (1600 - 1800)
  // + Dynamic weight from actual transaction frequency & volume
  const categoryScores = useMemo(() => {
    const counts: Record<string, number> = {};
    const amounts: Record<string, number> = {};

    recentTransactions.forEach((tx) => {
      if (tx.category_id) {
        counts[tx.category_id] = (counts[tx.category_id] || 0) + 1;
        amounts[tx.category_id] = (amounts[tx.category_id] || 0) + (tx.amount || 0);
      }
    });

    const scores: Record<string, number> = {};

    categories.forEach((cat) => {
      const name = cat.name.toLowerCase();
      let baseScore = 100;

      if (name.includes('еда') || name.includes('продукт') || cat.icon === '🍔' || cat.icon === '🍏') {
        baseScore = 3000;
      } else if (
        name.includes('авто') ||
        name.includes('машин') ||
        name.includes('бензин') ||
        name.includes('то авто') ||
        name.includes('заправк') ||
        cat.icon === '🚗' ||
        cat.icon === '⛽' ||
        cat.icon === '🚘' ||
        cat.icon === '🚙'
      ) {
        // High priority: Car right below Food
        baseScore = 2500;
      } else if (name.includes('покупк') || cat.icon === '🛍️' || cat.icon === '🛒') {
        baseScore = 1800;
      } else if (name.includes('кафе') || name.includes('ресторан') || cat.icon === '☕') {
        baseScore = 1600;
      } else if (name.includes('аптек') || name.includes('здоров')) {
        baseScore = 1300;
      } else if (name.includes('дом') || name.includes('коммун')) {
        baseScore = 1200;
      }

      // Add dynamic usage weight: each transaction adds 100 pts, amount adds up to 1000 pts
      const count = counts[cat.id] || 0;
      const amount = amounts[cat.id] || 0;
      const usageWeight = count * 100 + Math.min(amount / 50, 1000);

      scores[cat.id] = baseScore + usageWeight;
    });

    return scores;
  }, [categories, recentTransactions]);

  // Order categories: selected first, transfer category first if transfer mode, then sorted by popularity
  const orderedCategories = useMemo(() => {
    // Filter matching categories for current mode (expense vs income)
    const matchingCats = categories.filter((c) => {
      if (txType === 'transfer') return true;
      return c.type === txType;
    });

    const targetList = matchingCats.length > 0 ? matchingCats : categories;

    const sorted = [...targetList].sort((a, b) => {
      if (txType === 'transfer') {
        const aIsTransfer = a.name.toLowerCase().includes('перевод') || a.icon === '💸';
        const bIsTransfer = b.name.toLowerCase().includes('перевод') || b.icon === '💸';
        if (aIsTransfer && !bIsTransfer) return -1;
        if (!aIsTransfer && bIsTransfer) return 1;
      }

      const scoreA = categoryScores[a.id] ?? 0;
      const scoreB = categoryScores[b.id] ?? 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });

    const selected = sorted.find((c) => c.id === selectedCategory.id);
    if (!selected) {
      return [selectedCategory, ...sorted.filter((c) => c.id !== selectedCategory.id)];
    }
    const others = sorted.filter((c) => c.id !== selectedCategory.id);
    return [selected, ...others];
  }, [categories, categoryScores, selectedCategory, txType]);

  // Keypad / Typing handlers
  const handleDigit = useCallback((digit: string) => {
    onHaptic?.('light');
    setIsAmountError(false);
    setAmountStr((prev) => {
      if (prev.length > 9) return prev;
      if (prev === '0') return digit;
      return prev + digit;
    });
  }, [onHaptic]);

  const handleDelete = useCallback(() => {
    onHaptic?.('medium');
    setIsAmountError(false);
    setAmountStr((prev) => prev.slice(0, -1));
  }, [onHaptic]);

  const handleComma = useCallback(() => {
    onHaptic?.('light');
    setIsAmountError(false);
    setAmountStr((prev) => {
      if (prev.includes(',')) return prev;
      return prev === '' ? '0,' : prev + ',';
    });
  }, [onHaptic]);

  // Swap accounts for transfers
  const handleSwapAccounts = useCallback(() => {
    onHaptic?.('medium');
    setFromAccount((prevFrom) => {
      const nextFrom = toAccount;
      setToAccount(prevFrom);
      return nextFrom;
    });
  }, [onHaptic, toAccount]);

  // Submit transaction
  const handleSubmit = useCallback(() => {
    const parsedAmount = parseFloat(amountStr.replace(',', '.')) || 0;
    if (parsedAmount <= 0) {
      onHaptic?.('heavy');
      setIsAmountError(true);
      setTimeout(() => setIsAmountError(false), 900);
      return;
    }

    if (txType === 'transfer' && fromAccount.id === toAccount.id) {
      onHaptic?.('heavy');
      // If accounts are identical, pick a different one
      const diff = accounts.find((a) => a.id !== fromAccount.id);
      if (diff) {
        setToAccount(diff);
      } else {
        alert('Пожалуйста, выберите разные счета для перевода');
        return;
      }
    }

    onHaptic?.('heavy');

    const finalNote = note.trim() || (
      txType === 'transfer'
        ? `Перевод на ${toResolved.cleanName}`
        : selectedCategory.name
    );

    const finalCatId = txType === 'transfer' && transferCategory
      ? transferCategory.id
      : selectedCategory.id;

    onSubmit({
      account_id: fromAccount.id,
      to_account_id: txType === 'transfer' ? toAccount.id : undefined,
      category_id: finalCatId,
      amount: parsedAmount,
      type: txType,
      note: finalNote,
    });
  }, [
    amountStr,
    fromAccount.id,
    toAccount.id,
    toResolved.cleanName,
    txType,
    note,
    selectedCategory.name,
    selectedCategory.id,
    transferCategory,
    accounts,
    onSubmit,
    onHaptic,
  ]);

  // Physical keyboard listener for desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        if (e.key === 'Escape') {
          (activeEl as HTMLElement).blur();
        } else if (e.key === 'Enter') {
          handleSubmit();
        }
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        handleComma();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleComma, handleDelete, handleSubmit, onClose]);

  // Mode switcher handler
  const setMode = useCallback((type: TransactionType) => {
    onHaptic?.('light');
    setTxType(type);
    if (type === 'transfer') {
      if (transferCategory) setSelectedCategory(transferCategory);
    } else if (selectedCategory.icon === '💸' || selectedCategory.name.toLowerCase().includes('перевод')) {
      const regularCat = categories.find((c) => c.type === type && !c.name.toLowerCase().includes('перевод'));
      if (regularCat) setSelectedCategory(regularCat);
    }
  }, [categories, onHaptic, selectedCategory, transferCategory]);

  // Category click handler
  const handleCategorySelect = (cat: Category) => {
    onHaptic?.('light');
    setSelectedCategory(cat);
    const isTransferCat = cat.name.toLowerCase().includes('перевод') || cat.icon === '💸';
    if (isTransferCat) {
      setTxType('transfer');
    } else if (txType === 'transfer') {
      setTxType(cat.type === 'income' ? 'income' : 'expense');
    }
  };

  // Format account balance for pill (e.g. 5,52 тыс. ₽)
  const formatCompactBalance = (bal: number) => {
    if (bal >= 1000) {
      return `${(bal / 1000).toFixed(2).replace('.', ',')} тыс. ₽`;
    }
    return `${bal.toFixed(2).replace('.', ',')} ₽`;
  };

  const displayAmount = amountStr || '0';

  return (
    <div className="fixed inset-0 z-40 bg-[#F6F7FB] dark:bg-[#121318] flex flex-col justify-between animate-fade-in select-none transition-colors">
      {/* Top Bar */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onClose();
          }}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1B20] shadow-sm flex items-center justify-center text-[#4B5563] dark:text-[#A0A5B5] active:bg-[#F3F4F6] dark:active:bg-[#252730] border border-gray-100 dark:border-[#252730]"
        >
          <CloseOutlined className="text-[18px]" />
        </button>

        {/* Header Title / Mode Indicator */}
        <div className="text-center">
          <span className="text-[15px] font-semibold text-[#111827] dark:text-white">
            {txType === 'transfer' ? 'Перевод между счетами' : txType === 'income' ? 'Новый доход' : 'Новый расход'}
          </span>
        </div>

        {/* Quick Transfer Toggle at Top-Right */}
        <button
          type="button"
          onClick={() => {
            setMode(txType === 'transfer' ? 'expense' : 'transfer');
          }}
          title={txType === 'transfer' ? 'Перейти к расходу' : 'Перейти к переводу'}
          className={`w-10 h-10 rounded-full bg-white dark:bg-[#1A1B20] shadow-sm flex items-center justify-center text-[#4B5563] dark:text-[#A0A5B5] active:bg-[#F3F4F6] dark:active:bg-[#252730] border border-gray-100 dark:border-[#252730] transition-all ${
            txType === 'transfer' ? 'ring-2 ring-[#2B5BFF] text-[#2B5BFF] bg-blue-50 dark:bg-[#1E2540]' : ''
          }`}
        >
          <SwapOutlined className="text-[18px]" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-between px-5 pt-1 pb-2 max-w-lg mx-auto w-full">
        <div>
          {/* Account Selection Area */}
          {txType === 'transfer' ? (
            /* Dual Account Picker for Transfers */
            <div className="mb-4">
              <div className="flex items-center gap-2">
                {/* Source Account (Откуда) */}
                <button
                  type="button"
                  onClick={() => {
                    onHaptic?.('light');
                    setAccountPickerTarget('from');
                  }}
                  className="flex-1 min-w-0 flex items-center space-x-2.5 bg-white dark:bg-[#1A1B20] px-3.5 py-2.5 rounded-[22px] shadow-sm active:scale-[0.98] transition-all border border-gray-100 dark:border-[#252730]"
                >
                  <span className="text-2xl shrink-0">{fromAccount.icon || '💳'}</span>
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-[10px] text-[#9CA3AF] dark:text-[#8E92A4] font-medium uppercase tracking-wider leading-none mb-1">
                      Списать с
                    </div>
                    <div className="flex items-center gap-1.5 leading-tight truncate">
                      {fromResolved.bank && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#252730] text-[#4B5563] dark:text-[#A0A5B5] shrink-0">
                          {fromResolved.bank.shortName}
                        </span>
                      )}
                      <span className="text-[13px] font-semibold text-[#111827] dark:text-white truncate">
                        {fromResolved.cleanName}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#9CA3AF] dark:text-[#8E92A4] font-medium leading-tight whitespace-nowrap mt-0.5">
                      {formatCompactBalance(fromAccount.balance)}
                    </div>
                  </div>
                </button>

                {/* Swap Button */}
                <button
                  type="button"
                  onClick={handleSwapAccounts}
                  title="Поменять счета местами"
                  className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1B20] border border-gray-100 dark:border-[#252730] flex items-center justify-center text-[#2B5BFF] shadow-sm shrink-0 active:scale-90 hover:bg-blue-50 dark:hover:bg-[#252738] transition-all"
                >
                  <SwapOutlined className="text-[18px]" />
                </button>

                {/* Destination Account (Куда) */}
                <button
                  type="button"
                  onClick={() => {
                    onHaptic?.('light');
                    setAccountPickerTarget('to');
                  }}
                  className="flex-1 min-w-0 flex items-center space-x-2.5 bg-white dark:bg-[#1A1B20] px-3.5 py-2.5 rounded-[22px] shadow-sm active:scale-[0.98] transition-all border border-gray-100 dark:border-[#252730]"
                >
                  <span className="text-2xl shrink-0">{toAccount.icon || '💳'}</span>
                  <div className="text-left min-w-0 flex-1">
                    <div className="text-[10px] text-[#9CA3AF] dark:text-[#8E92A4] font-medium uppercase tracking-wider leading-none mb-1">
                      Перевести на
                    </div>
                    <div className="flex items-center gap-1.5 leading-tight truncate">
                      {toResolved.bank && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#252730] text-[#4B5563] dark:text-[#A0A5B5] shrink-0">
                          {toResolved.bank.shortName}
                        </span>
                      )}
                      <span className="text-[13px] font-semibold text-[#111827] dark:text-white truncate">
                        {toResolved.cleanName}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#9CA3AF] dark:text-[#8E92A4] font-medium leading-tight whitespace-nowrap mt-0.5">
                      {formatCompactBalance(toAccount.balance)}
                    </div>
                  </div>
                </button>
              </div>

              {/* Date button below dual pills */}
              <div className="flex items-center justify-end mt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onHaptic?.('light');
                    setDateLabel(dateLabel === 'Сегодня' ? 'Вчера' : 'Сегодня');
                  }}
                  className="flex items-center space-x-2 bg-white dark:bg-[#1A1B20] px-3.5 py-1.5 rounded-[18px] shadow-sm active:scale-[0.98] transition-all border border-gray-100 dark:border-[#252730]"
                >
                  <CalendarOutlined className="text-[13px] text-[#6B7280] dark:text-[#8E92A4]" />
                  <span className="text-[13px] font-medium text-[#374151] dark:text-white">
                    {dateLabel}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Single Account Pill + Date Pill for Expense/Income */
            <div className="flex items-center justify-between gap-3 mb-5">
              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setAccountPickerTarget('from');
                }}
                className="flex items-center space-x-2.5 bg-white dark:bg-[#1A1B20] px-4 py-2 rounded-[22px] shadow-sm active:scale-[0.98] transition-all border border-gray-100 dark:border-[#252730] max-w-[200px] sm:max-w-[240px] min-w-0"
              >
                <span className="text-xl shrink-0">{fromAccount.icon || '❤️'}</span>
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 leading-tight truncate">
                    {fromResolved.bank && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#252730] text-[#4B5563] dark:text-[#A0A5B5] shrink-0">
                        {fromResolved.bank.shortName}
                      </span>
                    )}
                    <span className="text-[14px] font-semibold text-[#111827] dark:text-white truncate">
                      {fromResolved.cleanName}
                    </span>
                  </div>
                  <div className="text-[12px] text-[#9CA3AF] dark:text-[#8E92A4] font-medium leading-tight whitespace-nowrap mt-0.5">
                    {formatCompactBalance(fromAccount.balance)}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setDateLabel(dateLabel === 'Сегодня' ? 'Вчера' : 'Сегодня');
                }}
                className="flex items-center space-x-2 bg-white dark:bg-[#1A1B20] px-4 py-2.5 rounded-[22px] shadow-sm active:scale-[0.98] transition-all border border-gray-100 dark:border-[#252730]"
              >
                <CalendarOutlined className="text-[14px] text-[#6B7280] dark:text-[#8E92A4]" />
                <span className="text-[14px] font-medium text-[#374151] dark:text-white">
                  {dateLabel}
                </span>
              </button>
            </div>
          )}

          {/* Amount Display with 3-Mode Toggle [− | + | ⇄] */}
          <div className="flex items-center justify-between my-5 px-1">
            {/* Segmented Mode Pill */}
            <div className="flex items-center bg-white dark:bg-[#1A1B20] rounded-full p-1 shadow-sm border border-gray-100 dark:border-[#252730] gap-1">
              <button
                type="button"
                onClick={() => setMode('expense')}
                title="Расход"
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                  txType === 'expense'
                    ? 'bg-[#FF4B55] text-white shadow-sm'
                    : 'text-[#9CA3AF] dark:text-[#8E92A4] hover:text-[#4B5563]'
                }`}
              >
                −
              </button>

              <button
                type="button"
                onClick={() => setMode('income')}
                title="Доход"
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                  txType === 'income'
                    ? 'bg-[#34C759] text-white shadow-sm'
                    : 'text-[#9CA3AF] dark:text-[#8E92A4] hover:text-[#4B5563]'
                }`}
              >
                +
              </button>

              <button
                type="button"
                onClick={() => setMode('transfer')}
                title="Перевод между счетами"
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold transition-all ${
                  txType === 'transfer'
                    ? 'bg-[#2B5BFF] text-white shadow-sm'
                    : 'text-[#9CA3AF] dark:text-[#8E92A4] hover:text-[#4B5563]'
                }`}
              >
                <SwapOutlined />
              </button>
            </div>

            {/* Big Amount Text with Blue Cursor and Shake feedback */}
            <div
              className={`flex items-center space-x-1 cursor-text transition-all ${
                isAmountError ? 'animate-bounce text-red-500 scale-105' : ''
              }`}
              onClick={() => {
                // Focus desktop attention or provide hint
                onHaptic?.('light');
              }}
            >
              <span className="w-0.5 h-10 bg-[#2B5BFF] animate-pulse rounded-full" />
              <span
                className={`text-[42px] sm:text-[46px] font-bold tracking-tight leading-none ${
                  isAmountError
                    ? 'text-red-500'
                    : 'text-[#111827] dark:text-white'
                }`}
              >
                {displayAmount}
              </span>
              <div className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1B20] shadow-sm flex items-center justify-center text-[#6B7280] dark:text-[#8E92A4] font-medium text-lg ml-1 border border-gray-100 dark:border-[#252730]">
                ₽
              </div>
            </div>
          </div>

          {/* Categories Horizontal Carousel */}
          <div className="mb-5 overflow-x-auto no-scrollbar flex items-center space-x-2.5 py-1">
            {orderedCategories.map((cat) => {
              const isSelected = selectedCategory.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat)}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all shadow-sm ${
                    isSelected
                      ? 'bg-white dark:bg-[#1E2337] ring-2 ring-[#2B5BFF] text-[#111827] dark:text-white font-semibold'
                      : 'bg-white dark:bg-[#1A1B20] text-[#4B5563] dark:text-[#A0A5B5] hover:bg-gray-50 dark:hover:bg-[#252730] border border-gray-100 dark:border-[#252730]'
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-[14px]">{cat.name}</span>
                  <RightOutlined className="text-[12px] text-[#9CA3AF] dark:text-[#8E92A4]" />
                </button>
              );
            })}
          </div>

          {/* Note Input Row with Blue Submit Check Button */}
          <div className="flex items-center space-x-3 mb-2">
            <div className="flex-1 bg-white dark:bg-[#1A1B20] rounded-[22px] px-5 py-3 shadow-sm border border-gray-100 dark:border-[#252730]">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={txType === 'transfer' ? `Перевод на ${toResolved.cleanName}` : 'Описание'}
                className="w-full bg-transparent text-[15px] font-normal text-[#111827] dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#5E6272] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className="w-13 h-13 p-3 rounded-full bg-[#2B5BFF] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(43,91,255,0.4)] active:scale-95 transition-all hover:brightness-105"
            >
              <CheckOutlined className="text-[22px]" />
            </button>
          </div>
        </div>
      </div>

      {/* Virtual Keypad */}
      <CustomNumpad
        onDigit={handleDigit}
        onDelete={handleDelete}
        onComma={handleComma}
        onHaptic={() => onHaptic?.('light')}
      />

      {/* Internal Account Picker Sheet */}
      <AccountSelectSheet
        isOpen={accountPickerTarget !== null}
        onClose={() => setAccountPickerTarget(null)}
        accounts={accounts}
        selectedAccountId={accountPickerTarget === 'to' ? toAccount.id : fromAccount.id}
        onSelectAccount={(acc) => {
          if (accountPickerTarget === 'from') {
            setFromAccount(acc);
            // If from == to in transfer mode, auto-switch toAccount to a different account
            if (acc.id === toAccount.id) {
              const alt = accounts.find((a) => a.id !== acc.id);
              if (alt) setToAccount(alt);
            }
          } else if (accountPickerTarget === 'to') {
            setToAccount(acc);
            // If to == from in transfer mode, auto-switch fromAccount to a different account
            if (acc.id === fromAccount.id) {
              const alt = accounts.find((a) => a.id !== acc.id);
              if (alt) setFromAccount(alt);
            }
          }
          setAccountPickerTarget(null);
        }}
        onHaptic={() => onHaptic?.('light')}
      />
    </div>
  );
};

