import { Account, Category, Transaction, DashboardSummary } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Initial state faithfully matching screenshots
export const INITIAL_ACCOUNTS: Account[] = [
  // Личное (Альфа)
  { id: 'acc-1', user_id: 143702968, name: 'Карта Альфа (Основной)', group_name: 'Личное', balance: 5851.50, currency: 'RUB', icon: '❤️', color: '#FEE2E2', is_default: true, sort_order: 1 },
  { id: 'acc-2', user_id: 143702968, name: 'Альфа-Счёт (накопления)', group_name: 'Личное', balance: 173060.04, currency: 'RUB', icon: '📈', color: '#E0F2FE', is_default: false, sort_order: 2 },
  { id: 'acc-3', user_id: 143702968, name: 'Инвесткопилка (Альфа)', group_name: 'Личное', balance: 66231.54, currency: 'RUB', icon: '🪙', color: '#FEF3C7', is_default: false, sort_order: 3 },
  { id: 'acc-4', user_id: 143702968, name: 'Брокерский счёт (Альфа)', group_name: 'Личное', balance: 51151.13, currency: 'RUB', icon: '🏺', color: '#FDF2E9', is_default: false, sort_order: 4 },
  { id: 'acc-5', user_id: 143702968, name: 'Кредитная карта (Альфа)', group_name: 'Личное', balance: 0.00, currency: 'RUB', icon: '💳', color: '#F3F4F6', is_default: false, sort_order: 5 },
  
  // Личное (Т-Банк, Озон, Наличные)
  { id: 'acc-6', user_id: 143702968, name: 'Т-Банк Black', group_name: 'Личное', balance: 0.00, currency: 'RUB', icon: '💛', color: '#FEF3C7', is_default: false, sort_order: 6 },
  { id: 'acc-7', user_id: 143702968, name: 'Т-Банк USD', group_name: 'Личное', balance: 100.00, currency: 'USD', icon: '💵', color: '#E3F2FD', is_default: false, sort_order: 7 },
  { id: 'acc-8', user_id: 143702968, name: 'Т-Банк Инвестиции', group_name: 'Личное', balance: 15980.39, currency: 'RUB', icon: '📈', color: '#EDE9FE', is_default: false, sort_order: 8 },
  { id: 'acc-9', user_id: 143702968, name: 'Озон Банк', group_name: 'Личное', balance: 2205.99, currency: 'RUB', icon: '💙', color: '#E0F2FE', is_default: false, sort_order: 9 },
  { id: 'acc-10', user_id: 143702968, name: 'Наличные (Психотерапевт)', group_name: 'Личное', balance: 10000.00, currency: 'RUB', icon: '💵', color: '#DCFCE7', is_default: false, sort_order: 10 },

  // Общее (с Владом)
  { id: 'acc-11', user_id: 143702968, name: 'Влад и Алина - Едоки (Т-Банк)', group_name: 'Общее (с Владом)', balance: 24759.86, currency: 'RUB', icon: '👥', color: '#FFEDD5', is_default: false, sort_order: 11 },
  { id: 'acc-12', user_id: 143702968, name: 'Еда (подушка безопасности)', group_name: 'Общее (с Владом)', balance: 46145.89, currency: 'RUB', icon: '🛏️', color: '#FEF3C7', is_default: false, sort_order: 12 },
  { id: 'acc-13', user_id: 143702968, name: 'Совместный с Владом (Альфа)', group_name: 'Общее (с Владом)', balance: 189.50, currency: 'RUB', icon: '👥', color: '#FEE2E2', is_default: false, sort_order: 13 },

  // Кредиты
  { id: 'acc-14', user_id: 143702968, name: 'Кредит наличными (Альфа)', group_name: 'Кредиты', balance: 1290015.13, currency: 'RUB', icon: '📑', color: '#FEE2E2', is_default: false, sort_order: 20 },
];

export const INITIAL_CATEGORIES: Category[] = [
  // Еда
  { id: 'cat-1', user_id: 999999, name: 'Еда', type: 'expense', icon: '🍔', color: '#FEE2E2', sort_order: 1 },
  { id: 'cat-2', user_id: 999999, name: 'Кафе', type: 'expense', icon: '☕', color: '#FEE2E2', sort_order: 2 },
  { id: 'cat-3', user_id: 999999, name: 'Самокат', type: 'expense', icon: '🛴', color: '#FEE2E2', sort_order: 3 },
  { id: 'cat-4', user_id: 999999, name: 'Кофе', type: 'expense', icon: '☕', color: '#FEE2E2', sort_order: 4 },
  { id: 'cat-5', user_id: 999999, name: 'НаЛанч', type: 'expense', icon: '🍱', color: '#FEE2E2', sort_order: 5 },
  
  // Транспорт & Машина
  { id: 'cat-6', user_id: 999999, name: 'Транспорт', type: 'expense', icon: '🚗', color: '#E0F2FE', sort_order: 6 },
  { id: 'cat-7', user_id: 999999, name: 'Такси', type: 'expense', icon: '🚕', color: '#E0F2FE', sort_order: 7 },
  { id: 'cat-8', user_id: 999999, name: 'Каршеринг', type: 'expense', icon: '🚙', color: '#E0F2FE', sort_order: 8 },
  { id: 'cat-9', user_id: 999999, name: 'Общественный', type: 'expense', icon: '🚌', color: '#E0F2FE', sort_order: 9 },
  { id: 'cat-10', user_id: 999999, name: 'Поезд', type: 'expense', icon: '🚆', color: '#E0F2FE', sort_order: 10 },
  { id: 'cat-11', user_id: 999999, name: 'Машина', type: 'expense', icon: '🚘', color: '#DBEAFE', sort_order: 11 },
  { id: 'cat-12', user_id: 999999, name: 'Бензин', type: 'expense', icon: '⛽', color: '#DBEAFE', sort_order: 12 },
  { id: 'cat-13', user_id: 999999, name: 'ТО авто', type: 'expense', icon: '🔧', color: '#DBEAFE', sort_order: 13 },
  { id: 'cat-14', user_id: 999999, name: 'Парковка', type: 'expense', icon: '🅿️', color: '#DBEAFE', sort_order: 14 },
  { id: 'cat-15', user_id: 999999, name: 'Кредит за авто', type: 'expense', icon: '📑', color: '#DBEAFE', sort_order: 15 },

  // Покупки
  { id: 'cat-16', user_id: 999999, name: 'Покупки', type: 'expense', icon: '🛍️', color: '#FCE7F3', sort_order: 16 },
  { id: 'cat-17', user_id: 999999, name: 'Одежда', type: 'expense', icon: '👗', color: '#FCE7F3', sort_order: 17 },
  { id: 'cat-18', user_id: 999999, name: 'Электроника', type: 'expense', icon: '💻', color: '#FCE7F3', sort_order: 18 },
  { id: 'cat-19', user_id: 999999, name: 'Бытовая химия', type: 'expense', icon: '🧼', color: '#FCE7F3', sort_order: 19 },
  { id: 'cat-20', user_id: 999999, name: 'Товары для хобби', type: 'expense', icon: '🎨', color: '#FCE7F3', sort_order: 20 },

  // Развлечения
  { id: 'cat-21', user_id: 999999, name: 'Развлечения', type: 'expense', icon: '🎬', color: '#EDE9FE', sort_order: 21 },
  { id: 'cat-22', user_id: 999999, name: 'Кино', type: 'expense', icon: '🍿', color: '#EDE9FE', sort_order: 22 },
  { id: 'cat-23', user_id: 999999, name: 'Игры', type: 'expense', icon: '🎮', color: '#EDE9FE', sort_order: 23 },
  { id: 'cat-24', user_id: 999999, name: 'Вечеринки', type: 'expense', icon: '🎉', color: '#EDE9FE', sort_order: 24 },

  // Здоровье
  { id: 'cat-25', user_id: 999999, name: 'Здоровье', type: 'expense', icon: '💊', color: '#FEF3C7', sort_order: 25 },
  { id: 'cat-26', user_id: 999999, name: 'Лекарства', type: 'expense', icon: '💊', color: '#FEF3C7', sort_order: 26 },
  { id: 'cat-27', user_id: 999999, name: 'Врачи', type: 'expense', icon: '🩺', color: '#FEF3C7', sort_order: 27 },
  { id: 'cat-28', user_id: 999999, name: 'Психотерапевт', type: 'expense', icon: '🧠', color: '#DCFCE7', sort_order: 28 },

  // Жилье
  { id: 'cat-29', user_id: 999999, name: 'Жилье', type: 'expense', icon: '🏠', color: '#E0E7FF', sort_order: 29 },
  { id: 'cat-30', user_id: 999999, name: 'Аренда', type: 'expense', icon: '🔑', color: '#E0E7FF', sort_order: 30 },
  { id: 'cat-31', user_id: 999999, name: 'ЖКХ', type: 'expense', icon: '💡', color: '#E0E7FF', sort_order: 31 },
  { id: 'cat-32', user_id: 999999, name: 'Ремонт', type: 'expense', icon: '🔨', color: '#E0E7FF', sort_order: 32 },

  // Личное & Кот
  { id: 'cat-33', user_id: 999999, name: 'Личное', type: 'expense', icon: '✨', color: '#FEE2E2', sort_order: 33 },
  { id: 'cat-34', user_id: 999999, name: 'Внешний вид', type: 'expense', icon: '💄', color: '#FEE2E2', sort_order: 34 },
  { id: 'cat-35', user_id: 999999, name: 'Привычки', type: 'expense', icon: '☕', color: '#FEE2E2', sort_order: 35 },
  { id: 'cat-36', user_id: 999999, name: 'Спорт', type: 'expense', icon: '🏃', color: '#FEE2E2', sort_order: 36 },
  { id: 'cat-37', user_id: 999999, name: 'Кот', type: 'expense', icon: '🐱', color: '#FFEDD5', sort_order: 37 },
  { id: 'cat-38', user_id: 999999, name: 'Корм для кота', type: 'expense', icon: '🐟', color: '#FFEDD5', sort_order: 38 },
  { id: 'cat-39', user_id: 999999, name: 'Здоровье кота', type: 'expense', icon: '🐾', color: '#FFEDD5', sort_order: 39 },
  { id: 'cat-40', user_id: 999999, name: 'Путешествия', type: 'expense', icon: '✈️', color: '#E0F2FE', sort_order: 40 },
  { id: 'cat-41', user_id: 999999, name: 'Подписки', type: 'expense', icon: '💿', color: '#F3F4F6', sort_order: 41 },

  // Двусторонние & Доходы
  { id: 'cat-42', user_id: 999999, name: 'Подарки', type: 'expense', icon: '🎁', color: '#FCE7F3', sort_order: 42 },
  { id: 'cat-43', user_id: 999999, name: 'Подарки (получено)', type: 'income', icon: '🎁', color: '#DCFCE7', sort_order: 43 },
  { id: 'cat-44', user_id: 999999, name: 'Переводы', type: 'expense', icon: '💸', color: '#E0F2FE', sort_order: 44 },
  { id: 'cat-45', user_id: 999999, name: 'Переводы (получено)', type: 'income', icon: '💸', color: '#DCFCE7', sort_order: 45 },
  { id: 'cat-46', user_id: 999999, name: 'Накопления', type: 'expense', icon: '🏦', color: '#FEF3C7', sort_order: 46 },
  { id: 'cat-47', user_id: 999999, name: 'Зарплата', type: 'income', icon: '💰', color: '#DCFCE7', sort_order: 47 },
];

export const INITIAL_RECENT_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', user_id: 999999, account_id: 'acc-2', category_id: 'cat-7', amount: 894, type: 'expense', note: 'Самокат', created_at: '2026-05-07T14:30:00Z', account_name: 'Карта Альфа', category_name: 'Самокат', category_icon: '🍔' },
  { id: 'tx-2', user_id: 999999, account_id: 'acc-2', category_id: 'cat-6', amount: 645, type: 'expense', note: 'Подписки', created_at: '2026-05-07T11:15:00Z', account_name: 'Карта Альфа', category_name: 'Подписки', category_icon: '💿' },
];

export function getStoredSyncData(): { balances?: Record<string, number>; recent_transactions?: any[] } | null {
  try {
    const fullUrl = window.location.href;
    if (fullUrl.includes('sync=')) {
      const syncStr = fullUrl.split('sync=')[1]?.split('&')[0]?.split('#')[0];
      if (syncStr) {
        const b64 = syncStr.replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = decodeURIComponent(escape(atob(b64)));
        const data = JSON.parse(jsonStr);
        localStorage.setItem('ai_money_sync_data', JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    console.error('Failed to parse URL sync hash:', e);
  }

  try {
    const startParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (startParam && startParam.startsWith('sync_')) {
      const b64 = startParam.replace('sync_', '').replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = decodeURIComponent(escape(atob(b64)));
      const data = JSON.parse(jsonStr);
      localStorage.setItem('ai_money_sync_data', JSON.stringify(data));
      return data;
    }
  } catch (e) {}

  try {
    const cached = localStorage.getItem('ai_money_sync_data');
    if (cached) return JSON.parse(cached);
  } catch (e) {}

  return null;
}

export async function fetchDashboard(initData: string): Promise<DashboardSummary> {
  try {
    if (API_BASE) {
      const res = await fetch(`${API_BASE}/api/analytics/dashboard`, {
        headers: { Authorization: `tma ${initData}` }
      });
      if (res.ok) return await res.json();
    }
  } catch (e) {
    // Return mock data
  }

  const sync = getStoredSyncData();
  const balances = sync?.balances;
  const currentAccounts = INITIAL_ACCOUNTS.map(acc => {
    if (balances) {
      const newBal = balances[acc.name] ?? balances[acc.id];
      if (newBal !== undefined) return { ...acc, balance: Number(newBal) };
    }
    return acc;
  });

  const total = currentAccounts
    .filter(a => a.group_name !== 'Кредиты')
    .reduce((sum, a) => sum + a.balance, 0);

  const recent = sync?.recent_transactions && sync.recent_transactions.length > 0
    ? sync.recent_transactions
    : INITIAL_RECENT_TRANSACTIONS;

  const expenseTotal = recent.filter((t: any) => t.type === 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);
  const incomeTotal = recent.filter((t: any) => t.type === 'income').reduce((sum: number, t: any) => sum + t.amount, 0);

  return {
    total_balance: total,
    period_label: 'Сентябрь 2026',
    period_income: incomeTotal,
    period_expense: expenseTotal,
    categories: INITIAL_CATEGORIES.map(c => {
      const catSpend = recent.filter((t: any) => (t.category_name?.toLowerCase() === c.name.toLowerCase() || t.category_id === c.id) && t.type === 'expense').reduce((sum: number, t: any) => sum + t.amount, 0);
      return {
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        total_amount: catSpend,
        percentage: expenseTotal > 0 ? Math.round((catSpend / expenseTotal) * 100) : 0
      };
    }),
    recent_transactions: recent
  };
}

export async function fetchAccounts(initData: string): Promise<Account[]> {
  try {
    if (API_BASE) {
      const res = await fetch(`${API_BASE}/api/accounts`, {
        headers: { Authorization: `tma ${initData}` }
      });
      if (res.ok) return await res.json();
    }
  } catch (e) {
    // Fallback
  }

  const sync = getStoredSyncData();
  if (sync && sync.balances) {
    const balances = sync.balances;
    return INITIAL_ACCOUNTS.map(acc => {
      const newBal = balances[acc.name] ?? balances[acc.id];
      return newBal !== undefined ? { ...acc, balance: Number(newBal) } : acc;
    });
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

export async function updateTransactionAPI(
  initData: string,
  id: string,
  data: Partial<Transaction>
): Promise<Transaction | null> {
  try {
    const res = await fetch(`${API_BASE}/api/transactions/${id}`, {
      method: 'PUT',
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
  return null;
}

export async function deleteTransactionAPI(
  initData: string,
  id: string
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/transactions/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `tma ${initData}` }
    });
    return res.ok;
  } catch (e) {
    return true; // local fallback
  }
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
