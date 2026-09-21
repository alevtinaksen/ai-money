import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { Account, Category, DashboardSummary, Transaction, TransactionType } from './types';
import {
  fetchDashboard,
  fetchAccounts,
  createTransactionAPI,
  updateTransactionAPI,
  deleteTransactionAPI,
  saveStoredSyncData,
  saveStoredAccounts,
  saveStoredCategories,
  fetchCategories,
  recordUserTxMod,
  deleteUserTxMod,
  recordUserAccountMod,
  createAccountAPI,
  updateAccountAPI,
  deleteAccountAPI,
  INITIAL_ACCOUNTS,
  INITIAL_CATEGORIES,
} from './api/client';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { AccountsScreen } from './components/accounts/AccountsScreen';
import { AddTransactionScreen } from './components/transaction/AddTransactionScreen';
import { AccountSelectSheet } from './components/modals/AccountSelectSheet';
import { EditAccountModal } from './components/modals/EditAccountModal';
import { EditTransactionModal } from './components/modals/EditTransactionModal';
import { CategoryDetailModal } from './components/modals/CategoryDetailModal';
import { VoiceOverlay } from './components/voice/VoiceOverlay';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { TransactionsScreen } from './components/transactions/TransactionsScreen';

export const App: React.FC = () => {
  const { initData, hapticImpact, hapticNotification } = useTelegram();

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'accounts' | 'settings' | 'transactions'>('dashboard');
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [addTxInitialType, setAddTxInitialType] = useState<TransactionType>('expense');
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  // Category Detail Statistics Modal State (matching media_1789746985465.png)
  const [detailCategory, setDetailCategory] = useState<any | null>(null);
  const [detailPeriodLabel, setDetailPeriodLabel] = useState<string>('Сентябрь 2026');
  const [detailPeriodTxs, setDetailPeriodTxs] = useState<Transaction[]>([]);

  // Edit / View Transaction Modal State (matching media_1789730678657.png)
  const [isEditTxOpen, setIsEditTxOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const handleSelectCategory = (cat: Category, periodLabel?: string, periodTxs?: Transaction[]) => {
    setDetailCategory(cat);
    if (periodLabel) setDetailPeriodLabel(periodLabel);
    if (periodTxs) setDetailPeriodTxs(periodTxs);
  };

  // Hidden file input for receipt scanner
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Core financial state
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [selectedAccount, setSelectedAccount] = useState<Account>(INITIAL_ACCOUNTS[0]);
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const ver = localStorage.getItem('ai_money_categories_v2');
      const cached = localStorage.getItem('ai_money_categories');
      if (ver === '2' && cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.length < 35) return parsed;
      }
    } catch {}
    saveStoredCategories(INITIAL_CATEGORIES);
    return INITIAL_CATEGORIES;
  });
  const [summary, setSummary] = useState<DashboardSummary>({
    total_balance: 297771.53,
    period_label: 'Сентябрь 2026',
    period_income: 0,
    period_expense: 1539,
    categories: [],
    recent_transactions: [
      {
        id: 'tx-1',
        user_id: 143702968,
        account_id: 'acc-1',
        amount: 894,
        type: 'expense',
        note: 'Самокат',
        created_at: '2026-05-07T14:30:00Z',
        category_icon: '🍔',
        category_name: 'Самокат',
      },
      {
        id: 'tx-2',
        user_id: 143702968,
        account_id: 'acc-1',
        amount: 645,
        type: 'expense',
        note: 'Подписки',
        created_at: '2026-05-07T11:15:00Z',
        category_icon: '💿',
        category_name: 'Подписки',
      },
    ],
  });

  const loadData = useCallback(async () => {
    try {
      const [dash, accs, cats] = await Promise.all([
        fetchDashboard(initData),
        fetchAccounts(initData),
        fetchCategories(initData),
      ]);
      setSummary(dash);
      if (accs && accs.length > 0) {
        setAccounts(accs);
        const defAcc = accs.find((a) => a.is_default) || accs[0];
        if (defAcc) setSelectedAccount(defAcc);
      }
      if (cats && cats.length > 0) {
        setCategories(cats);
      }
    } catch (e) {
      console.warn('Using local state');
    }
  }, [initData]);

  useEffect(() => {
    loadData();

    const handleSync = () => {
      loadData();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    window.addEventListener('hashchange', handleSync);
    window.addEventListener('focus', handleSync);
    window.addEventListener('pageshow', handleSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Heartbeat sync every 3 seconds when app is active/visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    }, 3000);

    return () => {
      window.removeEventListener('hashchange', handleSync);
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('pageshow', handleSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [loadData]);

  // Handle adding transaction
  const handleAddTransaction = async (data: {
    account_id: string;
    to_account_id?: string;
    category_id: string;
    amount: number;
    type: TransactionType;
    note: string;
    client_id: string;
    created_at?: string;
  }) => {
    hapticNotification('success');
    setIsAddTxOpen(false);

    let updatedAccounts: Account[] = [];
    setAccounts((prev) => {
      updatedAccounts = prev.map((acc) => {
        if (data.type === 'transfer') {
          if (acc.id === data.account_id) {
            return { ...acc, balance: Math.round((acc.balance - data.amount) * 100) / 100 };
          }
          if (acc.id === data.to_account_id) {
            return { ...acc, balance: Math.round((acc.balance + data.amount) * 100) / 100 };
          }
        } else if (acc.id === data.account_id) {
          const newBal =
            data.type === 'expense'
              ? acc.balance - data.amount
              : acc.balance + data.amount;
          return { ...acc, balance: Math.round(newBal * 100) / 100 };
        }
        return acc;
      });
      for (const a of updatedAccounts) {
        if (a.id === data.account_id || a.id === data.to_account_id) {
          recordUserAccountMod(a.id, a, 'updated');
        }
      }
      saveStoredAccounts(updatedAccounts);
      return updatedAccounts;
    });

    const cat = categories.find((c) => c.id === data.category_id);
    const targetAcc = accounts.find((a) => a.id === data.account_id);
    const toAcc = data.to_account_id ? accounts.find((a) => a.id === data.to_account_id) : undefined;
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      user_id: 143702968,
      account_id: data.account_id,
      to_account_id: data.to_account_id,
      category_id: data.category_id,
      amount: data.amount,
      type: data.type,
      note: data.note || (data.type === 'transfer' && toAcc ? toAcc.name : (cat?.name || '')),
      created_at: data.created_at || new Date().toISOString(),
      account_name: targetAcc?.name || 'Карта Альфа',
      category_name: data.type === 'transfer' ? 'Переводы' : (cat?.name || 'Расход'),
      category_icon: data.type === 'transfer' ? '💸' : (cat?.icon || '📦'),
    };

    recordUserTxMod(newTx.id, newTx, 'created');

    setSummary((prev) => {
      const updatedTxs = [newTx, ...prev.recent_transactions];
      const newExp = updatedTxs.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const newInc = updatedTxs.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

      const balancesMap: Record<string, number> = {};
      for (const a of (updatedAccounts.length ? updatedAccounts : accounts)) {
        balancesMap[a.name] = a.balance;
        balancesMap[a.id] = a.balance;
      }
      saveStoredSyncData({ balances: balancesMap, recent_transactions: updatedTxs });

      return {
        ...prev,
        period_expense: newExp,
        period_income: newInc,
        recent_transactions: updatedTxs,
      };
    });

    const serverTx = await createTransactionAPI(initData, data);
    if (serverTx && serverTx.id && serverTx.id !== newTx.id) {
      deleteUserTxMod(newTx.id);
      setSummary((prev) => {
        const updated = prev.recent_transactions.map((t) =>
          t.id === newTx.id ? { ...t, id: serverTx.id } : t
        );
        saveStoredSyncData({ recent_transactions: updated });
        return { ...prev, recent_transactions: updated };
      });
      recordUserTxMod(serverTx.id, { ...newTx, id: serverTx.id }, 'created');
    }
    try {
      const freshAccs = await fetchAccounts(initData);
      if (freshAccs && freshAccs.length > 0) {
        setAccounts(freshAccs);
      }
    } catch {}
  };



  // Handle click on a transaction to view/edit (matching media_1789730678657.png)
  const handleSelectTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsEditTxOpen(true);
  };

  // Save changes to existing transaction
  const handleSaveEditedTransaction = async (data: {
    id: string;
    amount: number;
    account_id: string;
    to_account_id?: string | null;
    category_id?: string | null;
    type: 'expense' | 'income' | 'transfer';
    note?: string | null;
    created_at?: string;
  }) => {
    hapticNotification('success');
    setIsEditTxOpen(false);

    const oldTx =
      editingTransaction ||
      summary.recent_transactions.find((t) => t.id === data.id);
    if (!oldTx) return;
    const cat = categories.find((c) => c.id === data.category_id);

    let updatedAccounts: Account[] = [];
    setAccounts((prev) => {
      updatedAccounts = prev.map((acc) => {
        let bal = acc.balance;
        const isOldMatch =
          acc.id === oldTx.account_id ||
          (oldTx.account_name && acc.name.toLowerCase() === oldTx.account_name.toLowerCase());
        const isOldToMatch = acc.id === oldTx.to_account_id;
        const isNewMatch = acc.id === data.account_id;
        const isNewToMatch = acc.id === data.to_account_id;

        // Revert old transaction effect
        if (oldTx.type === 'expense' && isOldMatch) {
          bal += oldTx.amount;
        } else if (oldTx.type === 'income' && isOldMatch) {
          bal -= oldTx.amount;
        } else if (oldTx.type === 'transfer') {
          if (isOldMatch) bal += oldTx.amount;
          if (isOldToMatch) bal -= oldTx.amount;
        }

        // Apply new transaction effect
        if (data.type === 'expense' && isNewMatch) {
          bal -= data.amount;
        } else if (data.type === 'income' && isNewMatch) {
          bal += data.amount;
        } else if (data.type === 'transfer') {
          if (isNewMatch) bal -= data.amount;
          if (isNewToMatch) bal += data.amount;
        }

        return { ...acc, balance: Math.round(bal * 100) / 100 };
      });
      for (const a of updatedAccounts) {
        if (
          a.id === data.account_id ||
          a.id === data.to_account_id ||
          a.id === oldTx.account_id ||
          a.id === oldTx.to_account_id
        ) {
          recordUserAccountMod(a.id, a, 'updated');
        }
      }
      saveStoredAccounts(updatedAccounts);
      return updatedAccounts;
    });

    setSummary((prev) => {
      let modifiedTx: Transaction | null = null;
      const updatedTxs = prev.recent_transactions.map((tx) => {
        if (tx.id === data.id) {
          modifiedTx = {
            ...tx,
            amount: data.amount,
            account_id: data.account_id,
            to_account_id: data.to_account_id ?? tx.to_account_id,
            account_name:
              (updatedAccounts.length ? updatedAccounts : accounts).find(
                (a) => a.id === data.account_id
              )?.name || tx.account_name,
            category_id: data.category_id,
            type: data.type,
            note: data.note,
            created_at: data.created_at || tx.created_at,
            category_name: cat?.name || tx.category_name,
            category_icon: cat?.icon || tx.category_icon || '📦',
          };
          return modifiedTx;

        }
        return tx;
      });

      if (modifiedTx) {
        recordUserTxMod(data.id, modifiedTx, 'updated');
      }

      const newExp = updatedTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const newInc = updatedTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const balancesMap: Record<string, number> = {};
      for (const a of (updatedAccounts.length ? updatedAccounts : accounts)) {
        balancesMap[a.name] = a.balance;
        balancesMap[a.id] = a.balance;
      }
      saveStoredSyncData({ balances: balancesMap, recent_transactions: updatedTxs });

      return {
        ...prev,
        period_expense: newExp,
        period_income: newInc,
        recent_transactions: updatedTxs,
      };
    });

    setEditingTransaction(null);
    await updateTransactionAPI(initData, data.id, data);
    try {
      const freshAccs = await fetchAccounts(initData);
      if (freshAccs && freshAccs.length > 0) {
        setAccounts(freshAccs);
      }
    } catch {}
  };

  // Delete transaction and restore balance
  const handleDeleteTransaction = async (id: string) => {
    hapticNotification('warning');
    setIsEditTxOpen(false);

    const txToDelete = summary.recent_transactions.find((tx) => tx.id === id);
    let updatedAccounts: Account[] = [];
    if (txToDelete) {
      setAccounts((prev) => {
        updatedAccounts = prev.map((acc) => {
          const isMatch =
            acc.id === txToDelete.account_id ||
            (txToDelete.account_name && acc.name.toLowerCase() === txToDelete.account_name.toLowerCase());
          if (isMatch) {
            const bal =
              txToDelete.type === 'expense'
                ? acc.balance + txToDelete.amount
                : acc.balance - txToDelete.amount;
            return { ...acc, balance: Math.round(bal * 100) / 100 };
          }
          if (txToDelete.type === 'transfer') {
            if (acc.id === txToDelete.to_account_id) {
              return { ...acc, balance: Math.round((acc.balance - txToDelete.amount) * 100) / 100 };
            }
          }
          return acc;
        });
        for (const a of updatedAccounts) {
          if (a.id === txToDelete.account_id || a.id === txToDelete.to_account_id) {
            recordUserAccountMod(a.id, a, 'updated');
          }
        }
        saveStoredAccounts(updatedAccounts);
        return updatedAccounts;
      });
    }

    setSummary((prev) => {
      const updatedTxs = prev.recent_transactions.filter((tx) => tx.id !== id);
      const newExp = updatedTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const newInc = updatedTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const balancesMap: Record<string, number> = {};
      for (const a of (updatedAccounts.length ? updatedAccounts : accounts)) {
        balancesMap[a.name] = a.balance;
        balancesMap[a.id] = a.balance;
      }
      saveStoredSyncData({ balances: balancesMap, recent_transactions: updatedTxs });

      return {
        ...prev,
        period_expense: newExp,
        period_income: newInc,
        recent_transactions: updatedTxs,
      };
    });

    setEditingTransaction(null);
    recordUserTxMod(id, null, 'deleted');
    await deleteTransactionAPI(initData, id);
    try {
      const freshAccs = await fetchAccounts(initData);
      if (freshAccs && freshAccs.length > 0) {
        setAccounts(freshAccs);
      }
    } catch {}
  };

  // Handle saving account (edit or create)
  const handleSaveAccount = async (updated: Partial<Account> & { id?: string }) => {
    hapticNotification('success');
    if (updated.id) {
      recordUserAccountMod(updated.id, updated, 'updated');
      setAccounts((prev) => {
        const next = prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a));
        saveStoredAccounts(next);
        return next;
      });
      if (selectedAccount.id === updated.id) {
        setSelectedAccount((prev) => ({ ...prev, ...updated }));
      }
      await updateAccountAPI(initData, updated.id, updated);
    } else {
      const newAcc: Account = {
        id: `acc-${Date.now()}`,
        user_id: 143702968,
        name: updated.name || 'Новый счёт',
        group_name: updated.group_name || 'Личное',
        bank_name: updated.bank_name,
        balance: updated.balance || 0,
        currency: 'RUB',
        icon: updated.icon || '💳',
        color: '#E0F2FE',
        is_default: false,
        sort_order: accounts.length + 1,
      };
      recordUserAccountMod(newAcc.id, newAcc, 'created');
      setAccounts((prev) => {
        const next = [...prev, newAcc];
        saveStoredAccounts(next);
        return next;
      });
      await createAccountAPI(initData, newAcc);
    }
  };

  // Handle deleting account
  const handleDeleteAccount = async (id: string) => {
    hapticNotification('warning');
    recordUserAccountMod(id, null, 'deleted');
    setAccounts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveStoredAccounts(next);
      if (selectedAccount.id === id && next.length > 0) {
        setSelectedAccount(next[0]);
      }
      return next;
    });
    setIsEditAccountOpen(false);
    await deleteAccountAPI(initData, id);
  };

  // Handle receipt photo pick
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    hapticNotification('success');
    handleAddTransaction({
      account_id: selectedAccount.id,
      category_id: categories[0].id,
      amount: 850,
      type: 'expense',
      note: 'Чек: Продукты',
      client_id: crypto.randomUUID(),
    });
  };

  // Handle reset data
  const handleResetData = () => {
    hapticNotification('success');
    localStorage.clear();
    setCategories(INITIAL_CATEGORIES);
    setSummary({
      total_balance: 0,
      period_label: 'Сентябрь',
      period_income: 0,
      period_expense: 0,
      categories: [],
      recent_transactions: [],
    });
    loadData();
    setCurrentScreen('dashboard');
  };

  // Category management handlers
  const handleSaveCategory = (categoryData: Partial<Category> & { id?: string }) => {
    hapticNotification('success');
    setCategories((prev) => {
      let updated: Category[];
      if (categoryData.id) {
        // Edit existing category
        updated = prev.map((cat) =>
          cat.id === categoryData.id
            ? ({ ...cat, ...categoryData } as Category)
            : cat
        );
      } else {
        // Create new category
        const newCat: Category = {
          id: `cat-${Date.now()}`,
          user_id: 143702968,
          name: categoryData.name || 'Новая категория',
          type: (categoryData.type as 'expense' | 'income') || 'expense',
          icon: categoryData.icon || '🏷️',
          color: categoryData.color || '#EDE9FE',
          sort_order: prev.length + 1,
          subcategories: categoryData.subcategories || [],
        };
        updated = [...prev, newCat];
      }
      saveStoredCategories(updated);
      return updated;
    });
  };

  const handleDeleteCategory = (categoryId: string) => {
    hapticNotification('warning');
    setCategories((prev) => {
      const updated = prev.filter((cat) => cat.id !== categoryId);
      saveStoredCategories(updated);
      return updated;
    });
  };

  const handleReorderCategories = (newCategories: Category[]) => {
    hapticImpact('medium');
    setCategories(newCategories);
    saveStoredCategories(newCategories);
  };

  return (
    <main className="w-full min-h-screen bg-[#F6F7FB] dark:bg-[#121318] text-[#111827] dark:text-white transition-colors">
      {/* Hidden file input for receipt scanner */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleReceiptFileChange}
        className="hidden"
      />

      {currentScreen === 'dashboard' ? (
        <DashboardScreen
          summary={summary}
          accounts={accounts}
          categories={categories}
          onOpenAccounts={() => setCurrentScreen('accounts')}
          onOpenTransactions={() => setCurrentScreen('transactions')}
          onOpenAddTransaction={() => {
            setAddTxInitialType('expense');
            setIsAddTxOpen(true);
          }}
          onOpenVoice={() => setIsVoiceOpen(true)}
          onOpenSettings={() => setCurrentScreen('settings')}
          onScanReceipt={() => fileInputRef.current?.click()}
          onSelectTransaction={handleSelectTransaction}
          onSelectCategory={handleSelectCategory}
          onUpdateTransaction={handleSaveEditedTransaction}
          onRefresh={loadData}
          onHaptic={hapticImpact}
        />
      ) : currentScreen === 'transactions' ? (
        <TransactionsScreen
          onBack={() => setCurrentScreen('dashboard')}
          transactions={summary.recent_transactions}
          accounts={accounts}
          categories={categories}
          onSelectTransaction={handleSelectTransaction}
          onUpdateTransaction={handleSaveEditedTransaction}
          onOpenAddTransaction={() => {
            setAddTxInitialType('expense');
            setIsAddTxOpen(true);
          }}
          onHaptic={hapticImpact}
        />
      ) : currentScreen === 'accounts' ? (
        <AccountsScreen
          onBack={() => setCurrentScreen('dashboard')}
          accounts={accounts}
          onSelectAccount={(acc) => {
            setEditingAccount(acc);
            setIsEditAccountOpen(true);
          }}
          onOpenTransfer={() => {
            setAddTxInitialType('transfer');
            setIsAddTxOpen(true);
          }}
          onAddNewAccount={() => {
            setEditingAccount(null);
            setIsEditAccountOpen(true);
          }}
          onOpenSettings={() => setCurrentScreen('settings')}
          onHaptic={hapticImpact}
        />
      ) : (
        <SettingsScreen
          onBack={() => setCurrentScreen('dashboard')}
          categories={categories}
          onSaveCategory={handleSaveCategory}
          onDeleteCategory={handleDeleteCategory}
          onReorderCategories={handleReorderCategories}
          onRecalculateBalances={loadData}
          onResetData={handleResetData}
          onHaptic={hapticImpact}
        />
      )}

      {/* Add Transaction Modal */}
      {isAddTxOpen && (
        <AddTransactionScreen
          onClose={() => setIsAddTxOpen(false)}
          accounts={accounts}
          categories={categories}
          selectedAccount={selectedAccount}
          initialType={addTxInitialType}
          recentTransactions={summary?.recent_transactions || []}
          onOpenAccountSelect={() => setIsAccountSheetOpen(true)}
          onSubmit={handleAddTransaction}
          onHaptic={hapticImpact}
        />
      )}

      {/* Account Selection Bottom Sheet */}
      <AccountSelectSheet
        isOpen={isAccountSheetOpen}
        onClose={() => setIsAccountSheetOpen(false)}
        accounts={accounts}
        selectedAccountId={selectedAccount.id}
        onSelectAccount={(acc) => setSelectedAccount(acc)}
        onAddNewAccount={() => {
          setIsAccountSheetOpen(false);
          setEditingAccount(null);
          setIsEditAccountOpen(true);
        }}
        onHaptic={() => hapticImpact('light')}
      />

      {/* Edit or Add Account Modal */}
      <EditAccountModal
        isOpen={isEditAccountOpen}
        onClose={() => setIsEditAccountOpen(false)}
        account={editingAccount}
        onSave={handleSaveAccount}
        onDelete={handleDeleteAccount}
        onHaptic={hapticImpact}
      />

      {/* Edit Transaction Modal (Pixel-perfect matching media_1789730678657.png) */}
      {isEditTxOpen && editingTransaction && (
        <EditTransactionModal
          isOpen={isEditTxOpen}
          onClose={() => setIsEditTxOpen(false)}
          transaction={editingTransaction}
          accounts={accounts}
          categories={categories}
          onSave={handleSaveEditedTransaction}
          onDelete={handleDeleteTransaction}
          onHaptic={hapticImpact}
        />
      )}

      {/* Category Detail Statistics Modal (matching media_1789746985465.png) */}
      <CategoryDetailModal
        isOpen={!!detailCategory}
        onClose={() => setDetailCategory(null)}
        category={detailCategory}
        periodLabel={detailPeriodLabel}
        transactions={detailPeriodTxs.length > 0 ? detailPeriodTxs : summary.recent_transactions}
        onOpenAddTransaction={() => {
          setDetailCategory(null);
          setIsAddTxOpen(true);
        }}
        onSelectTransaction={(tx) => {
          setDetailCategory(null);
          setEditingTransaction(tx);
          setIsEditTxOpen(true);
        }}
        onHaptic={hapticImpact}
      />

      {/* Voice Recognition Overlay */}
      <VoiceOverlay
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        selectedAccount={selectedAccount}
        accounts={accounts}
        categories={categories}
        onVoiceSuccess={(res) => {
          if (res.transactions && res.transactions.length > 0) {
            hapticNotification('success');
            res.transactions.forEach((tx: any) => {
              // Resolve category
              let matchedCatId = categories[0]?.id;
              if (tx.category_id) {
                matchedCatId = tx.category_id;
              } else if (tx.category_name) {
                const found = categories.find(
                  (c) =>
                    c.name.toLowerCase() === tx.category_name.toLowerCase() ||
                    c.name.toLowerCase().includes(tx.category_name.toLowerCase()) ||
                    tx.category_name.toLowerCase().includes(c.name.toLowerCase())
                );
                if (found) matchedCatId = found.id;
              }

              // Resolve source account
              let matchedAccId = selectedAccount.id;
              if (tx.account_id) {
                matchedAccId = tx.account_id;
              } else if (tx.account_name) {
                const foundAcc = accounts.find(
                  (a) =>
                    a.name.toLowerCase() === tx.account_name.toLowerCase() ||
                    a.name.toLowerCase().includes(tx.account_name.toLowerCase()) ||
                    tx.account_name.toLowerCase().includes(a.name.toLowerCase())
                );
                if (foundAcc) matchedAccId = foundAcc.id;
              }

              // Resolve destination account for transfers
              let matchedToAccId: string | undefined = undefined;
              if (tx.type === 'transfer') {
                if (tx.to_account_id) {
                  matchedToAccId = tx.to_account_id;
                } else if (tx.to_account_name) {
                  const foundTo = accounts.find(
                    (a) =>
                      a.id !== matchedAccId &&
                      (a.name.toLowerCase().includes(tx.to_account_name.toLowerCase()) ||
                       tx.to_account_name.toLowerCase().includes(a.name.toLowerCase()))
                  );
                  if (foundTo) matchedToAccId = foundTo.id;
                }
                if (!matchedToAccId) {
                  matchedToAccId = accounts.find((a) => a.id !== matchedAccId)?.id;
                }
              }

              handleAddTransaction({
                account_id: matchedAccId,
                to_account_id: matchedToAccId,
                category_id: matchedCatId,
                amount: tx.amount,
                type: tx.type || 'expense',
                note: tx.note || 'Голосовой ввод',
                client_id: crypto.randomUUID(),
              });
            });
          }
        }}
        initData={initData}
        onHaptic={hapticImpact}
        onOpenAccountSelect={() => setIsAccountSheetOpen(true)}
      />
    </main>
  );
};

export default App;
