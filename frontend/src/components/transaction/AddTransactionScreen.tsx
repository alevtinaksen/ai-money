import { CreationOutcome, useCreationAttempt } from '../../hooks/useCreationAttempt';
import { moneyInput } from '../../utils/money';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TransactionEditor, CategoryChoices } from '../design/TransactionEditor';
import { Account, Category, Transaction, TransactionType } from '../../types';
import { AccountSelectSheet } from '../modals/AccountSelectSheet';
import { resolveAccountBankAndName } from '../../utils/bankUtils';

interface AddTransactionScreenProps {
  onClose: () => void;
  onBlockedChange?: (blocked: boolean) => void;
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
    client_id: string;
    created_at?: string;
  }) => Promise<CreationOutcome | boolean>;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}


export const AddTransactionScreen: React.FC<AddTransactionScreenProps> = ({
  onClose,
  onBlockedChange,
  accounts,
  categories,
  selectedAccount,
  initialType,
  initialCategoryId,
  recentTransactions = [],
  onSubmit,
  onHaptic,
}) => {
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [amountStr, setAmountStr] = useState('');
  const [txType, setTxType] = useState<TransactionType>(initialType || 'expense');
  const [isAmountError, setIsAmountError] = useState(false);
  const attempt = useCreationAttempt<Omit<Parameters<typeof onSubmit>[0], 'client_id'>>(onSubmit, onBlockedChange);
  const isSubmitting = attempt.phase === 'pending';
  const close = () => { if (!attempt.blocked()) onClose(); };

  // Source and Destination accounts

  const [fromAccount, setFromAccount] = useState<Account>(selectedAccount);
  const [toAccount, setToAccount] = useState<Account>(() => {
    const other = accounts.find((a) => a.id !== selectedAccount.id);
    return other || selectedAccount;
  });

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
    return categories.find(c => c.type === (initialType || 'expense') || c.type === 'both') || {
      id: '',
      name: 'Без категории',
      type: 'expense',
      icon: '🍔',
      color: '#FEE2E2',
      sort_order: 1,
    };
  });

  const [note, setNote] = useState('');
  // Real date state — defaults to today
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // Format date as human-readable Russian label
  const formatDateLabel = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Сегодня';
    if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  // Format date as yyyy-mm-dd for <input type="date">
  const toInputValue = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };


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
      return c.type === txType || c.type === 'both';
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
    if (attempt.blocked()) return;
    onHaptic?.('light');
    setIsAmountError(false);
    setAmountStr((prev) => {
      if (prev.length > 9) return prev;
      if (prev === '0') return digit;
      return prev + digit;
    });
  }, [onHaptic, attempt]);

  const handleDelete = useCallback(() => {
    if (attempt.blocked()) return;
    onHaptic?.('medium');
    setIsAmountError(false);
    setAmountStr((prev) => prev.slice(0, -1));
  }, [onHaptic, attempt]);

  const handleComma = useCallback(() => {
    if (attempt.blocked()) return;
    onHaptic?.('light');
    setIsAmountError(false);
    setAmountStr((prev) => {
      if (prev.includes(',')) return prev;
      return prev === '' ? '0,' : prev + ',';
    });
  }, [onHaptic, attempt]);

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
  const handleSubmit = useCallback(async () => {
    // Prevent double-tap / double-submit
    if (isSubmitting) return;
    if (attempt.blocked()) { await attempt.retry(); return; }

    let parsedAmount: number;
    try { parsedAmount = Number(moneyInput(amountStr)); }
    catch { setIsAmountError(true); return; }
    if (txType === 'transfer' && (fromAccount.id === toAccount.id || fromAccount.currency !== toAccount.currency)) {
      setIsAmountError(true); return;
    }

    onHaptic?.('heavy');

    const finalNote = note.trim() || (
      txType === 'transfer'
        ? `Перевод на ${toResolved.cleanName}`
        : selectedCategory.name
    );

    const finalCatId = txType === 'transfer' ? '' : selectedCategory.id;

    const payload = {
      account_id: fromAccount.id,
      to_account_id: txType === 'transfer' ? toAccount.id : undefined,
      category_id: finalCatId,
      amount: parsedAmount,
      type: txType,
      note: finalNote,
      created_at: selectedDate.toISOString(),
    };
    await attempt.run(payload);
  }, [

    isSubmitting,
    selectedDate,
    amountStr,
    fromAccount.id,
    fromAccount.currency,
    toAccount.id,
    toAccount.currency,
    toResolved.cleanName,
    txType,
    note,
    selectedCategory.name,
    selectedCategory.id,
    transferCategory,
    accounts,
    onSubmit,
    attempt,
    onHaptic,
  ]);


  // Physical keyboard listener for desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (accountPickerTarget !== null || e.defaultPrevented) return;
      const activeEl = document.activeElement;
      // Native activation must reach the focused control before global shortcuts.
      if (activeEl && ['BUTTON', 'SELECT'].includes(activeEl.tagName) &&
          (e.key === 'Enter' || e.key === ' ')) return;
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
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDigit, handleComma, handleDelete, handleSubmit, close, accountPickerTarget]);

  // Mode switcher handler
  const setMode = useCallback((type: TransactionType) => {
    onHaptic?.('light');
    setTxType(type);
    if (type === 'transfer') {
      if (transferCategory) setSelectedCategory(transferCategory);
    } else if (selectedCategory.type !== type && selectedCategory.type !== 'both') {
      const regularCat = categories.find((c) => c.type === type && !c.name.toLowerCase().includes('перевод'));
      setSelectedCategory(regularCat || { ...selectedCategory, id: '', name: 'Без категории', icon: '📦', type });
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

  const parentCategory = categories.find(c => c.id === selectedCategory.parent_id) || selectedCategory;
  const childCategories = categories.filter(c => c.parent_id === parentCategory.id);
  return <TransactionEditor onClose={close} type={txType} onType={setMode}
    dateValue={toInputValue(selectedDate)} dateLabel={formatDateLabel(selectedDate)} onDate={value => {
      const [y,m,d] = value.split('-').map(Number); const next = new Date(selectedDate); next.setFullYear(y,m-1,d); setSelectedDate(next);
    }} source={fromAccount} destination={toAccount} onSource={() => setAccountPickerTarget('from')}
    onDestination={() => setAccountPickerTarget('to')} onSwap={handleSwapAccounts} amount={amountStr}
    onAmount={value => { if (!attempt.locked) { setAmountStr(value); setIsAmountError(false); } }}
    category={parentCategory} onCategory={() => setCategoryPickerOpen(open => !open)}
    choices={categoryPickerOpen ? <CategoryChoices categories={orderedCategories} selected={selectedCategory.id} onSelect={cat => { handleCategorySelect(cat); setCategoryPickerOpen(false); }} /> : childCategories.length ? <CategoryChoices categories={childCategories} selected={selectedCategory.id} onSelect={handleCategorySelect} /> : null}
    note={note} onNote={setNote} onSave={() => void handleSubmit()} saving={isSubmitting} locked={attempt.locked}
    error={attempt.error || (isAmountError ? 'Проверьте положительную сумму до копеек. Для перевода нужны разные счета одной валюты.' : undefined)}>
    <AccountSelectSheet isOpen={accountPickerTarget !== null} onClose={() => setAccountPickerTarget(null)} accounts={accounts}
      selectedAccountId={accountPickerTarget === 'to' ? toAccount.id : fromAccount.id} onSelectAccount={acc => {
        if (accountPickerTarget === 'from') { setFromAccount(acc); if (acc.id === toAccount.id) { const alt=accounts.find(a=>a.id!==acc.id); if(alt) setToAccount(alt); } }
        else { setToAccount(acc); if (acc.id === fromAccount.id) { const alt=accounts.find(a=>a.id!==acc.id); if(alt) setFromAccount(alt); } }
        setAccountPickerTarget(null);
      }} onHaptic={() => onHaptic?.('light')} />
  </TransactionEditor>;
};
