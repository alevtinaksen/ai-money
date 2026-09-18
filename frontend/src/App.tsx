import React, { useState, useEffect, useCallback } from 'react';
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
import { VoiceOverlay } from './components/voice/VoiceOverlay';

export const App: React.FC = () => {
  const { initData, hapticImpact, hapticNotification } = useTelegram();

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'accounts'>('dashboard');
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);

  // Data state
  const [accounts, setAccounts] = useState<Account[]>(INITIAL_ACCOUNTS);
  const [categories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [selectedAccount, setSelectedAccount] = useState<Account>(INITIAL_ACCOUNTS[1]); // Default to 'Карта Альфа'
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
        user_id: 999999,
        account_id: 'acc-2',
        category_id: 'cat-7',
        amount: 894,
        type: 'expense',
        note: 'Самокат',
        created_at: '2026-05-07T14:30:00Z',
        category_icon: '🍔',
      },
      {
        id: 'tx-2',
        user_id: 999999,
        account_id: 'acc-2',
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
      setAccounts(accs);
      const defAcc = accs.find((a) => a.is_default) || accs[0];
      if (defAcc) setSelectedAccount(defAcc);
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

    // Optimistic balance update
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

    // Optimistic summary update
    setSummary((prev) => {
      const cat = categories.find((c) => c.id === data.category_id);
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        user_id: 999999,
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

    // Send to backend
    await createTransactionAPI(initData, data);
  };

  // Handle voice result
  const handleVoiceSuccess = (parsedResult: any) => {
    if (parsedResult.transactions && parsedResult.transactions.length > 0) {
      hapticNotification('success');
      parsedResult.transactions.forEach((tx: any) => {
        const cat =
          categories.find(
            (c) => c.name.toLowerCase() === (tx.category_name || '').toLowerCase()
          ) || categories[0];

        handleAddTransaction({
          account_id: selectedAccount.id,
          category_id: cat.id,
          amount: tx.amount,
          type: tx.type || 'expense',
          note: tx.note || cat.name,
        });
      });
    }
  };

  return (
    <main className="w-full min-h-screen bg-[#F6F7FB] text-[#111827]">
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
      ) : (
        <AccountsScreen
          onBack={() => setCurrentScreen('dashboard')}
          accounts={accounts}
          onSelectAccount={(acc) => {
            setSelectedAccount(acc);
            setCurrentScreen('dashboard');
          }}
          onOpenTransfer={() => setIsAddTxOpen(true)}
          onAddNewAccount={() => setIsAccountSheetOpen(true)}
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
        onHaptic={() => hapticImpact('light')}
      />

      {/* Voice Recognition Overlay */}
      <VoiceOverlay
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        selectedAccount={selectedAccount}
        onVoiceSuccess={handleVoiceSuccess}
        initData={initData}
        onHaptic={() => hapticImpact('medium')}
      />
    </main>
  );
};

export default App;
