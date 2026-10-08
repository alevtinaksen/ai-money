import { useEffect, useRef, useState } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { useLedger } from './hooks/useLedger';
import { usePreviewNavigation } from './hooks/usePreviewNavigation';
import { Account, Category, Transaction, TransactionType } from './types';
import * as api from './api/client';
import { localLogin, clearLegacyCache, exportLegacyCache } from './api/session';
import { moneyInput } from './utils/money';
import { DashboardScreen } from './components/dashboard/DashboardScreen';
import { AccountsScreen } from './components/accounts/AccountsScreen';
import { AddTransactionScreen } from './components/transaction/AddTransactionScreen';
import { EditAccountModal } from './components/modals/EditAccountModal';
import { EditTransactionModal } from './components/modals/EditTransactionModal';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { TransactionsScreen } from './components/transactions/TransactionsScreen';
import { Dialog } from './components/shared/Dialog';
import { AiPreview } from './components/ai/AiPreview';

export const App = () => {
  const { initData, hapticImpact } = useTelegram();
  const [local, setLocal] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [screen, setScreen] = useState<'dashboard' | 'accounts' | 'transactions' | 'settings'>('dashboard');
  const [month, setMonth] = useState(0);
  const [currency, setCurrency] = useState('RUB');
  const [adding, setAdding] = useState<TransactionType | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null | undefined>(undefined);
  const [ai, setAi] = useState<'voice' | 'receipt' | null>(null);
  const creationBlocked = useRef(false);
  const [hasUnconfirmedCreation, setHasUnconfirmedCreation] = useState(false);
  const updateCreationBlocked = (blocked: boolean) => {
    creationBlocked.current = blocked; setHasUnconfirmedCreation(blocked);
  };
  const closeModal = () => {
    if (ledger.busy || creationBlocked.current) return;
    setAdding(null); setEditingTx(null); setEditingAccount(undefined); setAi(null);
  };
  const ledger = useLedger(initData, Boolean(initData) || local, month, currency);
  const [visibleNotice, setVisibleNotice] = useState('');
  useEffect(() => {
    setVisibleNotice(ledger.notice);
    const timer = window.setTimeout(() => setVisibleNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [ledger.notice]);
  const active = ledger.accounts.filter(account => !account.is_archived);
  const selected = active.find(account => account.is_default) || active[0];
  const draftAccount = useRef<Account | null>(null);
  if (!adding && selected) draftAccount.current = selected;
  const currencies = [...new Set([currency, ...ledger.accounts.map(account => account.currency),
    ...Object.keys(ledger.summary?.balances_by_currency || {})])];
  const login = async () => {
    if (loginPending) return;
    setLoginPending(true);
    try { await localLogin(); setLocal(true); ledger.restoreSession(); setLoginError(''); }
    catch (error) { setLoginError((error as Error).message); }
    finally { setLoginPending(false); }
  };
  const accountFields = (data: Partial<Account>): api.AccountInput => ({
    name: data.name?.trim() || 'Новый счёт', group_name: data.group_name || 'Личное',
    icon: data.icon || '💳', bank_name: data.bank_name || null, color: data.color,
  });
  const saveAccount = async (data: Partial<Account> & { id?: string }) => {
    const success = await ledger.mutate(() => data.id
      ? api.updateAccountAPI(initData, data.id, accountFields(data))
      : api.createAccountAPI(initData, { ...accountFields(data), currency: data.currency || 'RUB', balance: moneyInput(data.balance ?? 0, true) }));
    if (success) setEditingAccount(undefined);
    return success;
  };
  const saveCategory = (data: Partial<Category> & { id?: string }) => ledger.mutate(() => api.saveCategoryAPI(initData, {
    name: data.name || 'Категория', type: data.type || 'expense', icon: data.icon || '📦', color: data.color || '#F3F4F6',
    sort_order: data.sort_order, parent_id: data.parent_id,
    budget_limit: data.budget_limit == null ? null : moneyInput(data.budget_limit, true),
  }, data.id));
  const addTx = async (data: { account_id: string; to_account_id?: string; category_id?: string;
    amount: number | string; type: TransactionType; note: string; client_id: string; created_at?: string }) => {
    const success = await ledger.mutateCreation(() => api.createTransactionAPI(initData, { ...data, amount: moneyInput(data.amount),
      category_id: data.type === 'transfer' ? null : data.category_id || null }));
    if (success === 'saved') setAdding(null);
    return success;
  };
  const saveTx = async (data: { id: string; amount: number; account_id: string; to_account_id?: string | null;
    category_id?: string | null; type: TransactionType; note?: string | null; created_at?: string }) => {
    const original = editingTx || ledger.transactions.find(tx => tx.id === data.id);
    if (!original) return false;
    const { id, ...fields } = data;
    const success = await ledger.mutate(() => api.updateTransactionAPI(initData, id, { ...fields,
      revision: original.revision, amount: moneyInput(fields.amount),
      category_id: data.type === 'transfer' ? null : data.category_id || null,
      to_account_id: data.type === 'transfer' ? data.to_account_id : null }));
    if (success) setEditingTx(null);
    return success;
  };
  const removeTx = async (id: string) => {
    const original = editingTx || ledger.transactions.find(tx => tx.id === id);
    if (!original) return false;
    const success = await ledger.mutate(() => api.deleteTransactionAPI(initData, id, original.revision));
    if (success) setEditingTx(null);
    return success;
  };
  const reorder = (categories: Category[]) => {
    void ledger.mutate(async () => {
      for (let index = 0; index < categories.length; index++) {
        const cat = categories[index];
        await api.saveCategoryAPI(initData, { name: cat.name, type: cat.type, icon: cat.icon, color: cat.color, sort_order: index }, cat.id);
      }
    });
  };
  usePreviewNavigation(route => {
    if ((!initData && !local) || ledger.expired) return { status: 'blocked', message: 'Сначала войдите в приложение.' };
    if (ledger.busy || creationBlocked.current) return { status: 'blocked', message: 'Сначала подтвердите сохранение текущей операции.' };
    if (adding || editingTx || editingAccount !== undefined || ai) return { status: 'blocked', message: 'Закройте текущую форму перед сменой сценария.' };
    if (ledger.loading) return { status: 'blocked', message: 'Дождитесь загрузки данных.' };
    if (route === 'add-expense') {
      if (!selected) return { status: 'blocked', message: 'Для новой операции сначала создайте активный счёт.' };
      setAdding('expense');
    } else if (route === 'ai-review') setAi('voice');
    else if (route === 'categories' || route === 'backup' || route === 'settings') setScreen('settings');
    else if (route === 'accounts' || route === 'transactions') setScreen(route);
    else setScreen('dashboard');
    const details: Partial<Record<typeof route, string>> = {
      categories: 'Открыты настройки. Откройте управление категориями.',
      backup: 'Открыты настройки. Экспорт выполняется только вручную.',
      analytics: 'Аналитика показана на главной странице.',
      currencies: 'Открыта главная страница. Валюты показаны раздельно при наличии счетов разных валют.',
    };
    return { status: 'applied', message: details[route] || 'Сценарий открыт.' };
  });
  if ((!initData && !local) || (ledger.expired && !hasUnconfirmedCreation)) return <main className="design-shell design-support design-login">
    <h1 className="design-login-title">AI Финансы</h1>
    <p className="my-6">{initData ? 'Сессия истекла. Откройте приложение заново из Telegram.' : 'Откройте приложение из Telegram или войдите в локальный профиль.'}</p>
    {!initData && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname) &&
      <button className="design-primary" onClick={() => { setLocal(false); void login(); }}>Войти локально</button>}
    {loginError && <p role="alert">{loginError}</p>}
  </main>;
  const modal = adding || editingTx || editingAccount !== undefined || ai;
  return <main className="design-shell">
    <div>
        {currencies.length > 1 && <label className="design-currency-select">Валюта <select aria-label="Валюта отчёта" value={currency} onChange={e => setCurrency(e.target.value)} className="bg-transparent">
          {currencies.map(code => <option key={code}>{code}</option>)}</select></label>}
      <div className="design-status">
        {ledger.error && <p role="alert" className="text-red-600">{ledger.error} <button onClick={() => void ledger.refresh().catch(() => {})}>Обновить данные</button></p>}
        {visibleNotice && <p role="status">{visibleNotice}</p>}
        {(ledger.loading || ledger.busy) && <p role="status">{ledger.busy ? 'Сохраняем…' : 'Загружаем…'}</p>}

        {!active.length && !ledger.loading && <p>Активных счетов нет. <button onClick={() => setEditingAccount(null)}>Создать счёт</button>
          {' '}<button onClick={() => void ledger.mutate(() => api.request('/onboarding', initData, { method: 'POST' }))}>Создать начальные категории и счёт</button></p>}
      </div>
      {screen === 'dashboard' && ledger.summary && <DashboardScreen summary={ledger.summary} accounts={active} categories={ledger.categories}
        onOpenAccounts={() => setScreen('accounts')} onOpenTransactions={() => setScreen('transactions')}
        onOpenAddTransaction={() => selected ? setAdding('expense') : setEditingAccount(null)}
        onOpenVoice={() => setAi('voice')} onScanReceipt={() => setAi('receipt')} onOpenSettings={() => setScreen('settings')}
        onSelectTransaction={setEditingTx} onSelectCategory={() => setScreen('transactions')}
        onRefresh={ledger.refresh} onHaptic={hapticImpact} monthOffset={month} onMonthChange={setMonth} />}
      {screen === 'accounts' && <AccountsScreen accounts={active} onBack={() => setScreen('dashboard')}
        onSelectAccount={setEditingAccount} onOpenTransfer={() => selected && setAdding('transfer')}
        onAddNewAccount={() => setEditingAccount(null)} onOpenSettings={() => setScreen('settings')} onHaptic={hapticImpact} />}
      {screen === 'transactions' && <><TransactionsScreen transactions={ledger.transactions} accounts={ledger.accounts} categories={ledger.categories}
        onBack={() => setScreen('dashboard')} onSelectTransaction={setEditingTx} onOpenAddTransaction={() => selected && setAdding('expense')}
        onHaptic={hapticImpact} />
        <p className="design-pagination">Поиск и фильтры применяются к загруженным операциям.</p>
        {ledger.more && <button className="block mx-auto p-4" disabled={ledger.loading} onClick={() => void ledger.loadMore()}>Загрузить ещё</button>}</>}
      {screen === 'settings' && <><SettingsScreen onBack={() => setScreen('dashboard')} categories={ledger.categories}
        onSaveCategory={saveCategory} onDeleteCategory={id => void ledger.mutate(() => api.deleteCategoryAPI(initData, id))}
        onReorderCategories={reorder} onExportData={exportLegacyCache} onRecalculateBalances={ledger.refresh} onResetData={clearLegacyCache} onHaptic={hapticImpact} /></>}
    </div>
    {modal && <Dialog title={adding ? 'Новая операция' : editingTx ? 'Редактирование операции' : ai ? 'Проверка распознавания' : 'Счёт'}
      onClose={closeModal}>
      {(ledger.error || ledger.authRequired) && <div role="alert" className="design-server-error">{ledger.error}
        {ledger.authRequired && !initData && ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname) && <>
          <p>Сессия истекла. Войдите снова, затем повторите сохранение текущего черновика.</p>
          <button className="design-primary" disabled={loginPending} onClick={() => void login()}>Войти снова локально</button>
          {loginError && <p>{loginError}</p>}
        </>}
        {ledger.authRequired && initData && <p>Сессия Telegram истекла. Здесь удерживается текущий черновик. Новый запуск из Telegram даст свежую сессию, но потеряет черновик: сначала проверьте историю, прежде чем вводить эту операцию заново.</p>}
      </div>}
      {adding && draftAccount.current && <AddTransactionScreen accounts={active} categories={ledger.categories} selectedAccount={draftAccount.current}
        initialType={adding} onClose={closeModal} onBlockedChange={updateCreationBlocked} onSubmit={addTx} onHaptic={hapticImpact} />}
      {editingTx && <EditTransactionModal isOpen transaction={editingTx} accounts={ledger.accounts} categories={ledger.categories}
        onClose={closeModal} onSave={saveTx} onDelete={removeTx} onHaptic={hapticImpact} />}
      {editingAccount !== undefined && <EditAccountModal isOpen account={editingAccount} onClose={closeModal}
        onSave={saveAccount} onDelete={async id => { const success = await ledger.mutate(() => api.deleteAccountAPI(initData, id));
          if (success) setEditingAccount(undefined); return success; }} onHaptic={hapticImpact} />}
      {ai && <AiPreview auth={initData} kind={ai} accounts={active} categories={ledger.categories} onClose={closeModal}
        onBlockedChange={updateCreationBlocked}
        onSave={async payload => ledger.mutateCreation(() => api.createTransactionAPI(initData, payload))} />}
    </Dialog>}
  </main>;
};
export default App;
