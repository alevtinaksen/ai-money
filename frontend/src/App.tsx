import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { Account, Category, DashboardSummary, Transaction, TransactionType } from './types';
import {
  fetchDashboard,
  fetchAccounts,
  createTransactionAPI,
  INITIAL_ACCOUNTS,
  INITIAL_CATEGORIES,
} from './api/client';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { AccountsScreen } from './components/accounts/AccountsScreen';
import { AddTransactionScreen } from './components/transaction/AddTransactionScreen';
import { AccountSelectSheet } from './components/modals/AccountSelectSheet';
import { EditAccountModal } from './components/modals/EditAccountModal';
import { VoiceOverlay } from './components/voice/VoiceOverlay';
import { SettingsScreen } from './components/settings/SettingsScreen';

export const App: React.FC = () => {
  const { initData, hapticImpact, hapticNotification } = useTelegram();

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'accounts' | 'settings'>('dashboard');
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  // Hidden file input for receipt scanner
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [categories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [selectedAccount, setSelectedAccount] = useState<Account>(INITIAL_ACCOUNTS[0]);
  const [summary, setSummary] = useState<DashboardSummary>({
    total_balance: INITIAL_ACCOUNTS.reduce((sum, a) => sum + a.balance, 0),
    period_label: 'Сентябрь 2026',
    period_income: 0,
    period_expense: 0,
    categories: INITIAL_CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      total_amount: 0,
      percentage: 0,
    })),
    recent_transactions: [
      {
        id: 'tx-1',
        user_id: 143702968,
        account_id: 'acc-1',
        category_id: 'cat-7',
        amount: 894,
        type: 'expense',
        note: 'Самокат',
        created_at: '2026-05-07T14:30:00Z',
        category_icon: '🍔',
      },
      {
        id: 'tx-2',
        user_id: 143702968,
        account_id: 'acc-1',
        category_id: 'cat-6',
        amount: 645,
        type: 'expense',
        note: 'Подписки',
        created_at: '2026-05-07T11:15:00Z',
        category_icon: '💿',
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

    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === data.account_id) {
          const newBal =
            data.type === 'expense'
              ? acc.balance - data.amount
              : acc.balance + data.amount;
          return { ...acc, balance: newBal };
        }
        return acc;
      })
    );

    setSummary((prev) => {
      const cat = categories.find((c) => c.id === data.category_id);
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        user_id: 143702968,
        account_id: data.account_id,
        category_id: data.category_id,
        amount: data.amount,
        type: data.type,
        note: data.note,
        created_at: new Date().toISOString(),
        category_name: cat?.name,
        category_icon: cat?.icon || '📦',
      };

      return {
        ...prev,
        period_expense:
          data.type === 'expense' ? prev.period_expense + data.amount : prev.period_expense,
        period_income:
          data.type === 'income' ? prev.period_income + data.amount : prev.period_income,
        recent_transactions: [newTx, ...prev.recent_transactions],
      };
    });

    await createTransactionAPI(initData, data);
  };

  // Handle saving account (edit or create)
  const handleSaveAccount = (updated: Partial<Account> & { id?: string }) => {
    hapticNotification('success');
    if (updated.id) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
      );
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
      setAccounts((prev) => [...prev, newAcc]);
    }
  };

  // Handle receipt photo pick
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    hapticNotification('success');
    // Add scanned receipt
    handleAddTransaction({
      account_id: selectedAccount.id,
      category_id: categories[0].id,
      amount: 850,
      type: 'expense',
      note: 'Чек: Продукты',
    });
  };

  return (
    <main className="w-full min-h-screen bg-[#F6F7FB] text-[#111827]">
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
          onOpenAddTransaction={() => setIsAddTxOpen(true)}
          onOpenVoice={() => setIsVoiceOpen(true)}
          onRefresh={loadData}
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
        onOpenSettings={() => {
          setIsVoiceOpen(false);
          setCurrentScreen('settings');
        }}
      />
    </main>
  );
};

export default App;
