import { Account, Category, Transaction, DashboardSummary } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Initial state faithfully matching screenshots
export const INITIAL_ACCOUNTS: Account[] = [
  { id: 'acc-1', user_id: 999999, name: 'Наличные', group_name: 'Личное', balance: 16000.00, currency: 'RUB', icon: '💵', color: '#E3F2FD', is_default: false, sort_order: 1 },
  { id: 'acc-2', user_id: 999999, name: 'Карта Альфа', group_name: 'Личное', balance: 5522.16, currency: 'RUB', icon: '❤️', color: '#FEE2E2', is_default: true, sort_order: 2 },
  { id: 'acc-3', user_id: 999999, name: 'Т-Банк', group_name: 'Личное', balance: 6753.51, currency: 'RUB', icon: '💛', color: '#FEF3C7', is_default: false, sort_order: 3 },
  { id: 'acc-4', user_id: 999999, name: 'Озон Банк', group_name: 'Личное', balance: 261.00, currency: 'RUB', icon: '💙', color: '#E0F2FE', is_default: false, sort_order: 4 },
  { id: 'acc-5', user_id: 999999, name: 'Накопительный счет', group_name: 'Личное', balance: 534342.66, currency: 'RUB', icon: '👥', color: '#E2E8F0', is_default: false, sort_order: 5 },
  { id: 'acc-6', user_id: 999999, name: 'Брокерский счет', group_name: 'Личное', balance: 43183.99, currency: 'RUB', icon: '🏺', color: '#FDF2E9', is_default: false, sort_order: 6 },
  { id: 'acc-7', user_id: 999999, name: 'Карта на еду', group_name: 'Общее', balance: 20974.64, currency: 'RUB', icon: '💛', color: '#FEF3C7', is_default: false, sort_order: 7 },
  { id: 'acc-8', user_id: 999999, name: 'Подушка безопасности на еду', group_name: 'Общее', balance: 44803.15, currency: 'RUB', icon: '🛏️', color: '#F3F4F6', is_default: false, sort_order: 8 },
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', user_id: 999999, name: 'Еда', type: 'expense', icon: '🍔', color: '#FEE2E2', sort_order: 1 },
  { id: 'cat-2', user_id: 999999, name: 'Транспорт', type: 'expense', icon: '🚗', color: '#E0F2FE', sort_order: 2 },
  { id: 'cat-3', user_id: 999999, name: 'Покупки', type: 'expense', icon: '🛍️', color: '#FCE7F3', sort_order: 3 },
  { id: 'cat-4', user_id: 999999, name: 'Развлечения', type: 'expense', icon: '🎬', color: '#EDE9FE', sort_order: 4 },
  { id: 'cat-5', user_id: 999999, name: 'Здоровье', type: 'expense', icon: '💊', color: '#FEF3C7', sort_order: 5 },
  { id: 'cat-6', user_id: 999999, name: 'Подписки', type: 'expense', icon: '💿', color: '#F3F4F6', sort_order: 6 },
  { id: 'cat-7', user_id: 999999, name: 'Самокат', type: 'expense', icon: '🍔', color: '#FEE2E2', sort_order: 7 },
];

export const INITIAL_RECENT_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', user_id: 999999, account_id: 'acc-2', category_id: 'cat-7', amount: 894, type: 'expense', note: 'Самокат', created_at: '2026-05-07T14:30:00Z', account_name: 'Карта Альфа', category_name: 'Самокат', category_icon: '🍔' },
  { id: 'tx-2', user_id: 999999, account_id: 'acc-2', category_id: 'cat-6', amount: 645, type: 'expense', note: 'Подписки', created_at: '2026-05-07T11:15:00Z', account_name: 'Карта Альфа', category_name: 'Подписки', category_icon: '💿' },
];

export async function fetchDashboard(initData: string): Promise<DashboardSummary> {
  try {
    const res = await fetch(`${API_BASE}/api/analytics/dashboard`, {
      headers: { Authorization: `tma ${initData}` }
    });
    if (res.ok) return await res.json();
  } catch (e) {
    // Return mock data
  }

  const total = INITIAL_ACCOUNTS.reduce((sum, a) => sum + a.balance, 0);
  return {
    total_balance: total,
    period_label: 'Сентябрь 2026',
    period_income: 0,
    period_expense: 0,
    categories: INITIAL_CATEGORIES.map(c => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      total_amount: 0,
      percentage: 0
    })),
    recent_transactions: INITIAL_RECENT_TRANSACTIONS
  };
}

export async function fetchAccounts(initData: string): Promise<Account[]> {
  try {
    const res = await fetch(`${API_BASE}/api/accounts`, {
      headers: { Authorization: `tma ${initData}` }
    });
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback
  }
  return INITIAL_ACCOUNTS;
}

export async function createTransactionAPI(
  initData: string,
  data: {
    account_id: string;
    category_id?: string;
    amount: number;
    type: 'expense' | 'income' | 'transfer';
    note?: string;
    to_account_id?: string;
  }
): Promise<Transaction> {
  try {
    const res = await fetch(`${API_BASE}/api/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `tma ${initData}`
      },
      body: JSON.stringify(data)
    });
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback
  }
  return {
    id: `tx-${Date.now()}`,
    user_id: 999999,
    account_id: data.account_id,
    category_id: data.category_id,
    amount: data.amount,
    type: data.type,
    note: data.note,
    created_at: new Date().toISOString()
  };
}

export async function parseVoiceAPI(initData: string, audioBlob: Blob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'voice.webm');
  
  const res = await fetch(`${API_BASE}/api/ai/parse-voice`, {
    method: 'POST',
    headers: { Authorization: `tma ${initData}` },
    body: formData
  });
  if (!res.ok) throw new Error('Ошибка распознавания голоса');
  return await res.json();
}
