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
  const [categories] = useState<Category[]>(INITIAL_CATEGORIES);
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
      const [dash, accs] = await Promise.all([
        fetchDashboard(initData),
        fetchAccounts(initData),
      ]);
      setSummary(dash);
      if (accs && accs.length > 0) {
        setAccounts(accs);
        const defAcc = accs.find((a) => a.is_default) || accs[0];
        if (defAcc) setSelectedAccount(defAcc);
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

    // Heartbeat sync every 8 seconds when app is active/visible
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    }, 8000);

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
    category_id: string;
    amount: number;
    type: TransactionType;
    note: string;
  }) => {
    hapticNotification('success');
    setIsAddTxOpen(false);

    let updatedAccounts: Account[] = [];
    setAccounts((prev) => {
      updatedAccounts = prev.map((acc) => {
        if (acc.id === data.account_id) {
          const newBal =
            data.type === 'expense'
              ? acc.balance - data.amount
              : acc.balance + data.amount;
          return { ...acc, balance: Math.round(newBal * 100) / 100 };
        }
        return acc;
      });
      saveStoredAccounts(updatedAccounts);
      return updatedAccounts;
    });

    const cat = categories.find((c) => c.id === data.category_id);
    const targetAcc = accounts.find((a) => a.id === data.account_id);
    const newTx: Transaction = {
      id: `tx-${Date.now()}`,
      user_id: 143702968,
      account_id: data.account_id,
      category_id: data.category_id,
      amount: data.amount,
      type: data.type,
      note: data.note,
      created_at: new Date().toISOString(),
      account_name: targetAcc?.name || 'Карта Альфа',
      category_name: cat?.name,
      category_icon: cat?.icon || '📦',
    };

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

    await createTransactionAPI(initData, data);
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
    category_id?: string;
    type: 'expense' | 'income' | 'transfer';
    note?: string;
  }) => {
    hapticNotification('success');
    setIsEditTxOpen(false);

    if (!editingTransaction) return;
    const oldTx = editingTransaction;
    const cat = categories.find((c) => c.id === data.category_id);

    let updatedAccounts: Account[] = [];
    setAccounts((prev) => {
      updatedAccounts = prev.map((acc) => {
        let bal = acc.balance;
        if (acc.id === oldTx.account_id) {
          bal = oldTx.type === 'expense' ? bal + oldTx.amount : bal - oldTx.amount;
        }
        if (acc.id === data.account_id) {
          bal = data.type === 'expense' ? bal - data.amount : bal + data.amount;
        }
        return { ...acc, balance: Math.round(bal * 100) / 100 };
      });
      saveStoredAccounts(updatedAccounts);
      return updatedAccounts;
    });

    setSummary((prev) => {
      const updatedTxs = prev.recent_transactions.map((tx) =>
        tx.id === data.id
          ? {
              ...tx,
              amount: data.amount,
              account_id: data.account_id,
              account_name:
                (updatedAccounts.length ? updatedAccounts : accounts).find(
                  (a) => a.id === data.account_id
                )?.name || tx.account_name,
              category_id: data.category_id,
              type: data.type,
              note: data.note,
              category_name: cat?.name || tx.category_name,
              category_icon: cat?.icon || tx.category_icon || '📦',
            }
          : tx
      );

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
          if (acc.id === txToDelete.account_id) {
            const bal =
              txToDelete.type === 'expense'
                ? acc.balance + txToDelete.amount
                : acc.balance - txToDelete.amount;
            return { ...acc, balance: Math.round(bal * 100) / 100 };
          }
          return acc;
        });
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
    await deleteTransactionAPI(initData, id);
  };

  // Handle saving account (edit or create)
  const handleSaveAccount = (updated: Partial<Account> & { id?: string }) => {
    hapticNotification('success');
    if (updated.id) {
      setAccounts((prev) => {
        const next = prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a));
        saveStoredAccounts(next);
        return next;
      });
      if (selectedAccount.id === updated.id) {
        setSelectedAccount((prev) => ({ ...prev, ...updated }));
      }
    } else {
      const newAcc: Account = {
        id: `acc-${Date.now()}`,
        user_id: 143702968,
        name: updated.name || 'Новый счёт',
        group_name: updated.group_name || 'Личное',
        balance: updated.balance || 0,
        currency: 'RUB',
        icon: updated.icon || '💳',
        color: '#E0F2FE',
        is_default: false,
        sort_order: accounts.length + 1,
      };
      setAccounts((prev) => {
        const next = [...prev, newAcc];
        saveStoredAccounts(next);
        return next;
      });
    }
  };

  // Handle deleting account
  const handleDeleteAccount = (id: string) => {
    hapticNotification('warning');
    setAccounts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveStoredAccounts(next);
      if (selectedAccount.id === id && next.length > 0) {
        setSelectedAccount(next[0]);
      }
      return next;
    });
    setIsEditAccountOpen(false);
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
    });
  };

  // Handle reset data
  const handleResetData = () => {
    hapticNotification('success');
    localStorage.clear();
    loadData();
    setCurrentScreen('dashboard');
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
          onOpenAddTransaction={() => setIsAddTxOpen(true)}
          onOpenVoice={() => setIsVoiceOpen(true)}
          onOpenSettings={() => setCurrentScreen('settings')}
          onScanReceipt={() => fileInputRef.current?.click()}
          onSelectTransaction={handleSelectTransaction}
          onSelectCategory={handleSelectCategory}
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
          onOpenAddTransaction={() => setIsAddTxOpen(true)}
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
          onOpenTransfer={() => setIsAddTxOpen(true)}
          onAddNewAccount={() => {
            setEditingAccount(null);
            setIsEditAccountOpen(true);
          }}
          onHaptic={hapticImpact}
        />
      ) : (
        <SettingsScreen
          onBack={() => setCurrentScreen('dashboard')}
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

      {/* Voice Recognition Overlay (Pixel-perfect matching Screenshot 5) */}
      <VoiceOverlay
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        selectedAccount={selectedAccount}
        onVoiceSuccess={(res) => {
          if (res.transactions && res.transactions.length > 0) {
            hapticNotification('success');
            res.transactions.forEach((tx: any) => {
              handleAddTransaction({
                account_id: selectedAccount.id,
                category_id: categories[0].id,
                amount: tx.amount,
                type: tx.type || 'expense',
                note: tx.note || 'Голосовой расход',
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
