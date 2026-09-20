import { Account, Category, Transaction, DashboardSummary } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'https://ai-money-bot-0y05.onrender.com';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4500): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

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
  // 1. Еда (5 подкатегорий)
  {
    id: 'cat-1',
    user_id: 143702968,
    name: 'Еда',
    type: 'expense',
    icon: '🍔',
    color: '#FEE2E2',
    sort_order: 1,
    subcategories: ['Супермаркет', 'Кафе', 'Самокат', 'Кофе', 'НаЛанч'],
  },
  // 2. Транспорт (5 подкатегорий)
  {
    id: 'cat-2',
    user_id: 143702968,
    name: 'Транспорт',
    type: 'expense',
    icon: '🚗',
    color: '#E0F2FE',
    sort_order: 2,
    subcategories: ['Такси', 'Каршеринг', 'Общественный', 'Поезд', 'Метро'],
  },
  // 3. Покупки (4 подкатегорий)
  {
    id: 'cat-3',
    user_id: 143702968,
    name: 'Покупки',
    type: 'expense',
    icon: '🛍️',
    color: '#FCE7F3',
    sort_order: 3,
    subcategories: ['Одежда', 'Электроника', 'Бытовая химия', 'Товары для хобби'],
  },
  // 4. Развлечения (3 подкатегорий)
  {
    id: 'cat-4',
    user_id: 143702968,
    name: 'Развлечения',
    type: 'expense',
    icon: '🎬',
    color: '#EDE9FE',
    sort_order: 4,
    subcategories: ['Кино', 'Игры', 'Вечеринки'],
  },
  // 5. Здоровье (2 подкатегорий)
  {
    id: 'cat-5',
    user_id: 143702968,
    name: 'Здоровье',
    type: 'expense',
    icon: '💊',
    color: '#FEF3C7',
    sort_order: 5,
    subcategories: ['Лекарства', 'Врачи'],
  },
  // 6. Жилье (3 подкатегорий)
  {
    id: 'cat-6',
    user_id: 143702968,
    name: 'Жилье',
    type: 'expense',
    icon: '🏠',
    color: '#E0E7FF',
    sort_order: 6,
    subcategories: ['Аренда', 'ЖКХ', 'Ремонт'],
  },
  // 7. Личное (3 подкатегорий)
  {
    id: 'cat-7',
    user_id: 143702968,
    name: 'Личное',
    type: 'expense',
    icon: '👤',
    color: '#FEE2E2',
    sort_order: 7,
    subcategories: ['Внешний вид', 'Привычки', 'Спорт'],
  },
  // 8. Путешествия (0 подкатегорий)
  {
    id: 'cat-8',
    user_id: 143702968,
    name: 'Путешествия',
    type: 'expense',
    icon: '✈️',
    color: '#E0F2FE',
    sort_order: 8,
    subcategories: [],
  },
  // 9. Кот (2 подкатегорий)
  {
    id: 'cat-9',
    user_id: 143702968,
    name: 'Кот',
    type: 'expense',
    icon: '🐱',
    color: '#FFEDD5',
    sort_order: 9,
    subcategories: ['Корм для кота', 'Здоровье кота'],
  },
  // 10. Машина (4 подкатегорий)
  {
    id: 'cat-10',
    user_id: 143702968,
    name: 'Машина',
    type: 'expense',
    icon: '🚘',
    color: '#DBEAFE',
    sort_order: 10,
    subcategories: ['Бензин', 'ТО авто', 'Парковка', 'Кредит за авто'],
  },
  // 11. Подписки (3 подкатегорий)
  {
    id: 'cat-11',
    user_id: 143702968,
    name: 'Подписки',
    type: 'expense',
    icon: '💿',
    color: '#F3F4F6',
    sort_order: 11,
    subcategories: ['Музыка', 'Кинотеатры', 'Облако'],
  },
  // 12. Подарки (2 подкатегорий)
  {
    id: 'cat-12',
    user_id: 143702968,
    name: 'Подарки',
    type: 'both',
    icon: '🎁',
    color: '#FCE7F3',
    sort_order: 12,
    subcategories: ['Друзьям', 'Семье'],
  },
  // 13. Накопления (2 подкатегорий)
  {
    id: 'cat-13',
    user_id: 143702968,
    name: 'Накопления',
    type: 'expense',
    icon: '🏦',
    color: '#FEF3C7',
    sort_order: 13,
    subcategories: ['Вклад', 'Копилка'],
  },
  // 14. Переводы (3 подкатегорий)
  {
    id: 'cat-14',
    user_id: 143702968,
    name: 'Переводы',
    type: 'both',
    icon: '💸',
    color: '#E0F2FE',
    sort_order: 14,
    subcategories: ['Владу', 'Родителям', 'Себе на карту'],
  },
  // 15. Зарплата (4 подкатегорий)
  {
    id: 'cat-15',
    user_id: 143702968,
    name: 'Зарплата',
    type: 'income',
    icon: '💰',
    color: '#DCFCE7',
    sort_order: 15,
    subcategories: ['Основная', 'Аванс', 'Премия', 'Кешбэк'],
  },
  // 16. Инвестиции (3 подкатегорий)
  {
    id: 'cat-16',
    user_id: 143702968,
    name: 'Инвестиции',
    type: 'income',
    icon: '📈',
    color: '#DCFCE7',
    sort_order: 16,
    subcategories: ['Дивиденды', 'Купоны', 'Проценты'],
  },
];

export const INITIAL_RECENT_TRANSACTIONS: Transaction[] = [
  {
    id: "6548b97b-5fe1-4722-810b-c3a50126dec3",
    user_id: 143702968,
    account_id: "e33efb56-2aa9-4359-8014-1599ad24b7b0",
    category_id: "2c149da2-faf4-4a11-b94b-755dee475f9d",
    amount: 8000.0,
    type: "expense",
    note: "OZON",
    created_at: "2026-09-20 13:05:39.447695",
    account_name: "\u041e\u0437\u043e\u043d \u0411\u0430\u043d\u043a",
    category_name: "\u041f\u043e\u043a\u0443\u043f\u043a\u0438",
    category_icon: "\ud83d\udecd\ufe0f",
  },
  {
    id: "12a62be3-3a1a-40f2-bd4c-3bd01727ef6e",
    user_id: 143702968,
    account_id: "e33efb56-2aa9-4359-8014-1599ad24b7b0",
    category_id: "4747c115-193b-42ec-a5a2-b7e6a742eeef",
    amount: 17600.0,
    type: "expense",
    note: "A",
    created_at: "2026-09-20 13:05:39.444234",
    account_name: "\u041e\u0437\u043e\u043d \u0411\u0430\u043d\u043a",
    category_name: "\u0415\u0434\u0430",
    category_icon: "\ud83c\udf54",
  },
  {
    id: "0b0a01e9-78b4-404a-b8cc-9bf3c8fc7e59",
    user_id: 143702968,
    account_id: "9d73dd50-e4ad-4f79-9cf3-1741a869d96f",
    category_id: "4747c115-193b-42ec-a5a2-b7e6a742eeef",
    amount: 17600.0,
    type: "expense",
    note: "\u0412\u043b\u0430\u0434\u0438\u0441\u043b\u0430\u0432 \u0421.",
    created_at: "2026-09-20 13:05:38.797537",
    account_name: "\u0412\u043b\u0430\u0434 \u0438 \u0410\u043b\u0438\u043d\u0430 - \u0415\u0434\u043e\u043a\u0438 (\u0422-\u0411\u0430\u043d\u043a)",
    category_name: "\u0415\u0434\u0430",
    category_icon: "\ud83c\udf54",
  },
  {
    id: "f2630213-5bf0-4ad6-b026-f1b1ca2cea84",
    user_id: 143702968,
    account_id: "9d73dd50-e4ad-4f79-9cf3-1741a869d96f",
    category_id: "4747c115-193b-42ec-a5a2-b7e6a742eeef",
    amount: 17900.0,
    type: "expense",
    note: "T",
    created_at: "2026-09-20 13:05:38.796023",
    account_name: "\u0412\u043b\u0430\u0434 \u0438 \u0410\u043b\u0438\u043d\u0430 - \u0415\u0434\u043e\u043a\u0438 (\u0422-\u0411\u0430\u043d\u043a)",
    category_name: "\u0415\u0434\u0430",
    category_icon: "\ud83c\udf54",
  },
  {
    id: "4b418914-e868-4e31-ad9d-b78e6916c633",
    user_id: 143702968,
    account_id: "9d73dd50-e4ad-4f79-9cf3-1741a869d96f",
    category_id: "4747c115-193b-42ec-a5a2-b7e6a742eeef",
    amount: 3005.81,
    type: "expense",
    note: "\u041f\u044f\u0442\u0451\u0440\u043e\u0447\u043a\u0430",
    created_at: "2026-09-20 13:05:38.793595",
    account_name: "\u0412\u043b\u0430\u0434 \u0438 \u0410\u043b\u0438\u043d\u0430 - \u0415\u0434\u043e\u043a\u0438 (\u0422-\u0411\u0430\u043d\u043a)",
    category_name: "\u0415\u0434\u0430",
    category_icon: "\ud83c\udf54",
  },
  {
    id: "82593bee-92fd-4e84-a215-6de59d6773de",
    user_id: 143702968,
    account_id: "e33efb56-2aa9-4359-8014-1599ad24b7b0",
    category_id: "2c149da2-faf4-4a11-b94b-755dee475f9d",
    amount: 7896.0,
    type: "expense",
    note: "\u041f\u043e\u043a\u0443\u043f\u043a\u0430 \u043e\u0437\u043e\u043d \u0431\u0430\u043d\u043a\u0430 \u0434\u043b\u044f \u043c\u0430\u0448\u0438\u043d\u044b \u0442\u043e",
    created_at: "2026-09-20 09:30:14.864734",
    account_name: "\u041e\u0437\u043e\u043d \u0411\u0430\u043d\u043a",
    category_name: "\u041f\u043e\u043a\u0443\u043f\u043a\u0438",
    category_icon: "\ud83d\udecd\ufe0f",
  },
  {
    id: "95fbcffa-0f94-46d4-9f3d-77d7c94336c4",
    user_id: 143702968,
    account_id: "e33efb56-2aa9-4359-8014-1599ad24b7b0",
    category_id: "943735f8-c68f-4169-a0a3-17848add06f5",
    amount: 8.0,
    type: "transfer",
    note: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434 \u043c\u0435\u0436\u0434\u0443 \u0441\u0447\u0435\u0442\u0430\u043c\u0438",
    created_at: "2026-09-20 09:17:45.356167",
    account_name: "\u041e\u0437\u043e\u043d \u0411\u0430\u043d\u043a",
    category_name: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434\u044b",
    category_icon: "\ud83d\udcb8",
  },
  {
    id: "f5cd9a1a-f16b-43e4-9bbd-16ca7b86c7cc",
    user_id: 143702968,
    account_id: "9d73dd50-e4ad-4f79-9cf3-1741a869d96f",
    category_id: "aa65e043-5eb6-49c0-bdec-d452975e6385",
    amount: 690.0,
    type: "expense",
    note: "1-st. FOOD FACTORY",
    created_at: "2026-09-19 23:12:02",
    account_name: "\u0412\u043b\u0430\u0434 \u0438 \u0410\u043b\u0438\u043d\u0430 - \u0415\u0434\u043e\u043a\u0438 (\u0422-\u0411\u0430\u043d\u043a)",
    category_name: "\u041a\u0430\u0444\u0435",
    category_icon: "\ud83c\udf7d\ufe0f",
  },
  {
    id: "7b5eb7e4-4e92-47ed-9c6f-e623b4b60791",
    user_id: 143702968,
    account_id: "9d73dd50-e4ad-4f79-9cf3-1741a869d96f",
    category_id: "4747c115-193b-42ec-a5a2-b7e6a742eeef",
    amount: 109.99,
    type: "expense",
    note: "\u041e'\u041a\u0415\u0419",
    created_at: "2026-09-19 23:12:01",
    account_name: "\u0412\u043b\u0430\u0434 \u0438 \u0410\u043b\u0438\u043d\u0430 - \u0415\u0434\u043e\u043a\u0438 (\u0422-\u0411\u0430\u043d\u043a)",
    category_name: "\u0415\u0434\u0430",
    category_icon: "\ud83c\udf54",
  },
  {
    id: "98c8a90e-d6a4-46d2-853a-c96898a0f481",
    user_id: 143702968,
    account_id: "9d73dd50-e4ad-4f79-9cf3-1741a869d96f",
    category_id: "aa65e043-5eb6-49c0-bdec-d452975e6385",
    amount: 498.0,
    type: "expense",
    note: "\u0412\u043a\u0443\u0441\u043d\u043e \u2014 \u0438 \u0442\u043e\u0447\u043a\u0430",
    created_at: "2026-09-19 23:12:00",
    account_name: "\u0412\u043b\u0430\u0434 \u0438 \u0410\u043b\u0438\u043d\u0430 - \u0415\u0434\u043e\u043a\u0438 (\u0422-\u0411\u0430\u043d\u043a)",
    category_name: "\u041a\u0430\u0444\u0435",
    category_icon: "\ud83c\udf7d\ufe0f",
  },
  {
    id: "3782a1ad-af1b-4ab7-a75b-3b305a3273be",
    user_id: 143702968,
    account_id: "e33efb56-2aa9-4359-8014-1599ad24b7b0",
    category_id: "c298f862-3d61-444b-afae-7f9347aa3866",
    amount: 571.0,
    type: "expense",
    note: "Ozon bank +",
    created_at: "2026-09-19 20:45:44.452303",
    account_name: "\u041e\u0437\u043e\u043d \u0411\u0430\u043d\u043a",
    category_name: "\u0422\u041e \u0430\u0432\u0442\u043e",
    category_icon: "\ud83d\udd27",
  },
  {
    id: "7d462fd8-5776-444f-826b-2c9cee5ad7d5",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "6042b1a2-0d36-4fe9-90ed-9bd3646c145b",
    amount: 15.0,
    type: "transfer",
    note: "\u041d\u0430\u043a\u043e\u043f\u043b\u0435\u043d\u0438\u044f \u0441 \u043f\u043e\u043a\u0443\u043f\u043a\u0438",
    created_at: "2026-09-19 20:11:30.867045",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u041d\u0430\u043a\u043e\u043f\u043b\u0435\u043d\u0438\u044f",
    category_icon: "\ud83c\udfe6",
  },
  {
    id: "0cd15549-4544-43da-a1b2-5733109094ed",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "6042b1a2-0d36-4fe9-90ed-9bd3646c145b",
    amount: 37.0,
    type: "transfer",
    note: "\u041d\u0430\u043a\u043e\u043f\u043b\u0435\u043d\u0438\u044f \u0441 \u043f\u043e\u043a\u0443\u043f\u043a\u0438",
    created_at: "2026-09-19 20:11:19.194399",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u041d\u0430\u043a\u043e\u043f\u043b\u0435\u043d\u0438\u044f",
    category_icon: "\ud83c\udfe6",
  },
  {
    id: "24e650ea-a356-40bc-923b-8b3428ce2fac",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "38121d53-7287-4d10-9d6d-671dd2b52c49",
    amount: 504.0,
    type: "income",
    note: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434 \u043e\u0442 \u043f\u043e\u0434\u0440\u0443\u0433\u0438",
    created_at: "2026-09-19 20:10:33.809860",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434\u044b (\u043f\u043e\u043b\u0443\u0447\u0435\u043d\u043e)",
    category_icon: "\ud83d\udcb8",
  },
  {
    id: "b6e5054c-f337-474d-942f-d393c3462883",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "38121d53-7287-4d10-9d6d-671dd2b52c49",
    amount: 500.0,
    type: "income",
    note: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434 \u043e\u0442 \u043f\u043e\u0434\u0440\u0443\u0433\u0438",
    created_at: "2026-09-19 20:10:24.192153",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434\u044b (\u043f\u043e\u043b\u0443\u0447\u0435\u043d\u043e)",
    category_icon: "\ud83d\udcb8",
  },
  {
    id: "76050f1e-c711-41fd-a31d-c7f8f8b1d71c",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "9fef72d7-51af-47ce-8670-c75bd81df9ea",
    amount: 285.0,
    type: "expense",
    note: "Dream kids (\u043a\u043e\u0444\u0435)",
    created_at: "2026-09-19 20:10:02.104868",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u041a\u043e\u0444\u0435",
    category_icon: "\u2615",
  },
  {
    id: "01deadbf-4fda-49ff-8768-07c0834937ed",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "aa65e043-5eb6-49c0-bdec-d452975e6385",
    amount: 1863.0,
    type: "expense",
    note: "\u0422\u0435\u0440\u0435\u043c\u043e\u043a",
    created_at: "2026-09-19 20:09:06.247691",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u041a\u0430\u0444\u0435",
    category_icon: "\ud83c\udf7d\ufe0f",
  },
  {
    id: "89966dde-b03d-47c7-9eca-b160717d5a4d",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "943735f8-c68f-4169-a0a3-17848add06f5",
    amount: 5000.0,
    type: "transfer",
    note: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434 \u043c\u0435\u0436\u0434\u0443 \u0441\u0447\u0435\u0442\u0430\u043c\u0438",
    created_at: "2026-09-19 20:08:01.882952",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434\u044b",
    category_icon: "\ud83d\udcb8",
  },
  {
    id: "09e63854-af0e-4e18-8ee1-1210dcc57e27",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "a26ee8a7-2c1b-453c-a18d-b7082207b524",
    amount: 2074.0,
    type: "expense",
    note: "\u0412 \u0441\u0430\u043c\u043e\u043a\u0430\u0442\u0435 \u0430\u043b\u044c\u0444\u0430-\u0431\u0430\u043d\u043a\u0430",
    created_at: "2026-09-18 16:26:05.086903",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u0421\u0430\u043c\u043e\u043a\u0430\u0442",
    category_icon: "\ud83d\udef4",
  },
  {
    id: "5ef7015e-fedf-4e8b-a211-24957c97ecf4",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "a1b39b90-3ec1-4796-8be3-f9e070764b7f",
    amount: 1104.0,
    type: "expense",
    note: "\u041e\u0437\u043e\u043d \u0435\u0449\u0435 \u0441\u043f\u0438\u0441\u0430\u043b \u0437\u0430 \u043f\u043e\u043a\u0443\u043f\u043a\u0443 1104+1104+137",
    created_at: "2026-09-18 15:29:49.428883",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u041b\u0438\u0447\u043d\u043e\u0435",
    category_icon: "\u2728",
  },
  {
    id: "4aa867e2-a35b-47ff-a8ad-85434bc0332b",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "943735f8-c68f-4169-a0a3-17848add06f5",
    amount: 1000.0,
    type: "transfer",
    note: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434 \u043c\u0435\u0436\u0434\u0443 \u0441\u0447\u0435\u0442\u0430\u043c\u0438",
    created_at: "2026-09-18 15:18:47.856073",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u041f\u0435\u0440\u0435\u0432\u043e\u0434\u044b",
    category_icon: "\ud83d\udcb8",
  },
  {
    id: "35ab9e89-ae9c-410d-b4de-59142271f542",
    user_id: 143702968,
    account_id: "81124408-8e0b-41ed-a7e9-be1f5cdba270",
    category_id: "a1b39b90-3ec1-4796-8be3-f9e070764b7f",
    amount: 2100.0,
    type: "expense",
    note: "\u041c\u0430\u043d\u0438\u043a\u044e\u0440 \u043a\u0430\u0440\u0442\u043e\u0439 \u0430\u043b\u044c\u0444\u0430-\u0431\u0430\u043d\u043a\u0430",
    created_at: "2026-09-18 12:21:13.025686",
    account_name: "\u041a\u0430\u0440\u0442\u0430 \u0410\u043b\u044c\u0444\u0430 (\u041e\u0441\u043d\u043e\u0432\u043d\u043e\u0439)",
    category_name: "\u041b\u0438\u0447\u043d\u043e\u0435",
    category_icon: "\u2728",
  },
];

const LAST_INGESTED_SYNC_KEY = 'ai_money_last_ingested_sync_key';
const STORAGE_SYNC_KEY = 'ai_money_sync_data';
const STORAGE_ACCOUNTS_KEY = 'ai_money_accounts';

export function getStoredSyncData(): { balances?: Record<string, number>; recent_transactions?: any[]; accounts?: Account[] } | null {
  let incomingToken: string | null = null;
  let parsedPayload: any = null;

  try {
    const fullUrl = window.location.href;
    if (fullUrl.includes('sync=')) {
      const syncStr = fullUrl.split('sync=')[1]?.split('&')[0]?.split('#')[0];
      if (syncStr) {
        incomingToken = syncStr;
        const b64 = syncStr.replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = decodeURIComponent(escape(atob(b64)));
        parsedPayload = JSON.parse(jsonStr);
        try {
          if (window.history && window.history.replaceState) {
            const cleanUrl = fullUrl.replace(/[?#&]sync=[^&#]*/, '');
            window.history.replaceState({}, document.title, cleanUrl || window.location.pathname);
          }
        } catch {}
      }
    }
  } catch (e) {
    console.error('Failed to parse URL sync hash:', e);
  }

  if (!parsedPayload) {
    try {
      const startParam = (window as any).Telegram?.WebApp?.initDataUnsafe?.start_param;
      if (startParam && startParam.startsWith('sync_')) {
        incomingToken = startParam;
        const b64 = startParam.replace('sync_', '').replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = decodeURIComponent(escape(atob(b64)));
        parsedPayload = JSON.parse(jsonStr);
      }
    } catch {}
  }

  // Only ingest when this is a NEW incoming token from bot/URL that hasn't been ingested yet!
  const lastIngested = localStorage.getItem(LAST_INGESTED_SYNC_KEY);
  if (incomingToken && parsedPayload && incomingToken !== lastIngested) {
    localStorage.setItem(LAST_INGESTED_SYNC_KEY, incomingToken);

    const existing = (function() {
      try {
        const c = localStorage.getItem(STORAGE_SYNC_KEY);
        return c ? JSON.parse(c) : {};
      } catch {
        return {};
      }
    })();

    const merged = {
      ...existing,
      ...parsedPayload,
      balances: {
        ...(existing.balances || {}),
        ...(parsedPayload.balances || {}),
      },
      recent_transactions: (function () {
        const incoming = parsedPayload.recent_transactions || [];
        const existingList = existing.recent_transactions || [];
        const txMap = new Map<string, any>();
        for (const t of existingList) {
          if (t && t.id) txMap.set(t.id, t);
        }
        for (const t of incoming) {
          if (t && t.id) txMap.set(t.id, t);
        }
        return Array.from(txMap.values()).sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        );
      })(),
    };
    localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(merged));
    return merged;
  }

  // On all subsequent calls: ALWAYS read from localStorage so user's edits are NEVER reverted
  try {
    const cached = localStorage.getItem(STORAGE_SYNC_KEY);
    if (cached) return JSON.parse(cached);
  } catch {}

  return null;
}

export function saveStoredSyncData(data: {
  balances?: Record<string, number>;
  recent_transactions?: any[];
  accounts?: Account[];
}) {
  try {
    const existing = (function () {
      try {
        const c = localStorage.getItem(STORAGE_SYNC_KEY);
        return c ? JSON.parse(c) : {};
      } catch {
        return {};
      }
    })();
    const merged = {
      ...existing,
      ...data,
      balances: {
        ...(existing.balances || {}),
        ...(data.balances || {}),
      },
      recent_transactions:
        data.recent_transactions !== undefined
          ? data.recent_transactions
          : existing.recent_transactions,
      accounts:
        data.accounts !== undefined ? data.accounts : existing.accounts,
    };
    localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(merged));
    if (data.accounts) {
      localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(data.accounts));
    }
  } catch (e) {
    console.error('Failed to saveStoredSyncData:', e);
  }
}

export function saveStoredAccounts(accounts: Account[]) {
  try {
    localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(accounts));
    const balancesMap: Record<string, number> = {};
    for (const a of accounts) {
      balancesMap[a.name] = a.balance;
      balancesMap[a.id] = a.balance;
    }
    saveStoredSyncData({ balances: balancesMap, accounts });
  } catch (e) {
    console.error('Failed to saveStoredAccounts:', e);
  }
}

export async function fetchDashboard(initData: string): Promise<DashboardSummary> {
  try {
    if (API_BASE) {
      const res = await fetchWithTimeout(`${API_BASE}/api/analytics/dashboard`, {
        headers: { Authorization: `tma ${initData}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.recent_transactions) && data.recent_transactions.length > 0) {
          saveStoredSyncData({
            recent_transactions: data.recent_transactions
          });
          return data;
        }
      }
    }
  } catch (e) {
    // Fallback to local cached data
  }

  let currentAccounts = INITIAL_ACCOUNTS;
  try {
    const cached = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) currentAccounts = parsed;
    }
  } catch {}

  const sync = getStoredSyncData();
  const balances = sync?.balances;
  if (balances) {
    currentAccounts = currentAccounts.map(acc => {
      const newBal = balances[acc.name] ?? balances[acc.id];
      return newBal !== undefined ? { ...acc, balance: Number(newBal) } : acc;
    });
  }

  const total = currentAccounts
    .filter(a => a.group_name !== 'Кредиты')
    .reduce((sum, a) => sum + a.balance, 0);

  const rawRecent = sync?.recent_transactions && sync.recent_transactions.length > 0
    ? sync.recent_transactions
    : INITIAL_RECENT_TRANSACTIONS;

  const recent: Transaction[] = rawRecent.map((t: any) => {
    const matchedAcc = currentAccounts.find(
      (a) =>
        a.id === t.account_id ||
        (t.account_name &&
          (a.name.toLowerCase() === t.account_name.toLowerCase() ||
            a.name.toLowerCase().includes(t.account_name.toLowerCase()) ||
            t.account_name.toLowerCase().includes(a.name.toLowerCase()) ||
            (t.account_name.toLowerCase().includes('едок') && a.name.toLowerCase().includes('едок')) ||
            (t.account_name.toLowerCase().includes('влад') && a.name.toLowerCase().includes('влад'))))
    );
    const accId = matchedAcc ? matchedAcc.id : (t.account_id || currentAccounts[0].id);
    const accName = matchedAcc ? matchedAcc.name : (t.account_name || currentAccounts[0].name);

    const foundCat =
      (t.category_name && INITIAL_CATEGORIES.find(c => c.name.toLowerCase() === t.category_name.toLowerCase())) ||
      (t.note && INITIAL_CATEGORIES.find(c => c.name.toLowerCase() === t.note.toLowerCase())) ||
      (t.category_id && INITIAL_CATEGORIES.find(c => c.id === t.category_id)) ||
      (t.type === 'transfer' ? INITIAL_CATEGORIES.find(c => c.name === 'Переводы') : null);

    const catId = foundCat?.id || (t.category_id ? t.category_id : INITIAL_CATEGORIES[0].id);
    const catName = t.category_name || foundCat?.name || (t.type === 'transfer' ? 'Перевод' : 'Расход');
    const catIcon = t.category_icon && t.category_icon !== '📦' ? t.category_icon : (foundCat?.icon || '📦');

    return {
      id: t.id || `tx-${Date.now()}`,
      user_id: t.user_id || 143702968,
      account_id: accId,
      category_id: catId,
      amount: Number(t.amount) || 0,
      type: t.type || 'expense',
      note: t.note || '',
      created_at: t.created_at || new Date().toISOString(),
      account_name: accName,
      category_name: catName,
      category_icon: catIcon,
    };
  });

  const expenseTotal = recent.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const incomeTotal = recent.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

  return {
    total_balance: total,
    period_label: 'Сентябрь 2026',
    period_income: incomeTotal,
    period_expense: expenseTotal,
    categories: INITIAL_CATEGORIES.map(c => {
      const catSpend = recent.filter((t) => (t.category_name?.toLowerCase() === c.name.toLowerCase() || t.category_id === c.id) && t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
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
      const res = await fetchWithTimeout(`${API_BASE}/api/accounts`, {
        headers: { Authorization: `tma ${initData}` }
      });
      if (res.ok) {
        const accs = await res.json();
        if (Array.isArray(accs) && accs.length > 0) {
          saveStoredAccounts(accs);
          return accs;
        }
      }
    }
  } catch (e) {
    // Fallback
  }

  // 1. Load accounts from storage or INITIAL_ACCOUNTS
  let currentAccounts = INITIAL_ACCOUNTS;
  try {
    const cached = localStorage.getItem(STORAGE_ACCOUNTS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) currentAccounts = parsed;
    }
  } catch {}

  // 2. Merge sync accounts if provided
  const sync = getStoredSyncData();
  if (sync?.accounts && sync.accounts.length > 0) {
    currentAccounts = currentAccounts.map((acc) => {
      const match = sync.accounts!.find(
        (sa) => sa.id === acc.id || sa.name.toLowerCase() === acc.name.toLowerCase()
      );
      return match ? { ...acc, ...match } : acc;
    });
  }

  // 3. ALWAYS update balances with latest sync balances!
  const balances = sync?.balances;
  if (balances) {
    currentAccounts = currentAccounts.map((acc) => {
      const newBal = balances[acc.name] ?? balances[acc.id];
      return newBal !== undefined ? { ...acc, balance: Number(newBal) } : acc;
    });
  }

  saveStoredAccounts(currentAccounts);
  return currentAccounts;
}

export const STORAGE_CATEGORIES_KEY = 'ai_money_categories';
export const STORAGE_CATEGORIES_VER_KEY = 'ai_money_categories_v2';

export function saveStoredCategories(categories: Category[]) {
  try {
    localStorage.setItem(STORAGE_CATEGORIES_KEY, JSON.stringify(categories));
    localStorage.setItem(STORAGE_CATEGORIES_VER_KEY, '2');
  } catch (e) {
    console.error('Failed to saveStoredCategories:', e);
  }
}

export async function fetchCategories(_initData?: string): Promise<Category[]> {
  try {
    const ver = localStorage.getItem(STORAGE_CATEGORIES_VER_KEY);
    const cached = localStorage.getItem(STORAGE_CATEGORIES_KEY);
    if (ver === '2' && cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.length < 35) return parsed;
    }
  } catch {}
  saveStoredCategories(INITIAL_CATEGORIES);
  return INITIAL_CATEGORIES;
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
    const res = await fetchWithTimeout(`${API_BASE}/api/transactions`, {
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
    user_id: 143702968,
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
    const res = await fetchWithTimeout(`${API_BASE}/api/transactions/${id}`, {
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
    const res = await fetchWithTimeout(`${API_BASE}/api/transactions/${id}`, {
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
