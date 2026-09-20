import { Account, Category, TransactionType } from '../types';

export interface ParsedVoiceResult {
  amount: number;
  type: TransactionType;
  category: Category;
  category_name: string;
  account?: Account;
  account_name?: string;
  to_account?: Account;
  to_account_name?: string;
  note: string;
}

const NUMBER_WORDS: Record<string, number> = {
  ноль: 0,
  один: 1,
  одна: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
  семьдесят: 70,
  восемьдесят: 80,
  девяносто: 90,
  сто: 100,
  двести: 200,
  триста: 300,
  четыреста: 400,
  пятьсот: 500,
  шестьсот: 600,
  семьсот: 700,
  восемьсот: 800,
  девятьсот: 900,
};

export function parseRussianNumberWords(text: string): number | null {
  const clean = text.toLowerCase();

  // Special shortcuts
  if (clean.includes('полторы тысячи') || clean.includes('полторы')) return 1500;
  if (clean.includes('две с половиной тысячи') || clean.includes('две с половиной')) return 2500;
  if (clean.includes('три с половиной')) return 3500;
  if (clean.includes('четыре с половиной')) return 4500;
  if (clean.includes('пять с половиной')) return 5500;

  // Extract explicit digits first (e.g. "250", "1500", "250.50", "250,50")
  const digitMatch = clean.match(/(\d+[\d\s]*([.,]\d{1,2})?)/);
  if (digitMatch) {
    const rawNum = digitMatch[1].replace(/\s+/g, '').replace(',', '.');
    const parsed = parseFloat(rawNum);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Parse words like "двести пятьдесят"
  const tokens = clean.split(/[\s,]+/);
  let total = 0;
  let currentGroup = 0;
  let foundAny = false;

  for (const token of tokens) {
    if (NUMBER_WORDS[token] !== undefined) {
      currentGroup += NUMBER_WORDS[token];
      foundAny = true;
    } else if (token.startsWith('тысяч')) {
      if (currentGroup === 0) currentGroup = 1;
      total += currentGroup * 1000;
      currentGroup = 0;
      foundAny = true;
    }
  }

  total += currentGroup;
  return foundAny && total > 0 ? total : null;
}

export function parseFinancialSpeech(
  rawTranscript: string,
  categories: Category[],
  accounts: Account[],
  selectedAccount: Account
): ParsedVoiceResult {
  const text = rawTranscript.trim();
  const lower = text.toLowerCase();

  // 1. Detect Amount
  const amount = parseRussianNumberWords(text) || 0;

  // 2. Detect Type
  let type: TransactionType = 'expense';
  if (
    lower.includes('перевод') ||
    lower.includes('перевела') ||
    lower.includes('перевел') ||
    lower.includes('скинула') ||
    lower.includes('скинул') ||
    lower.includes('отправила') ||
    lower.includes('отправил')
  ) {
    type = 'transfer';
  } else if (
    lower.includes('зарплат') ||
    lower.includes('доход') ||
    lower.includes('аванс') ||
    lower.includes('кешбэк') ||
    lower.includes('кэшбэк') ||
    lower.includes('получила') ||
    lower.includes('получил') ||
    lower.includes('пришло')
  ) {
    type = 'income';
  }

  // 3. Detect Category
  let matchedCat: Category | undefined;

  if (type === 'transfer') {
    matchedCat = categories.find(
      (c) => c.name.toLowerCase().includes('перевод') || c.icon === '💸'
    );
  } else if (type === 'income') {
    if (lower.includes('зарплат')) {
      matchedCat = categories.find((c) => c.name.toLowerCase().includes('зарплат'));
    } else if (lower.includes('аванс')) {
      matchedCat = categories.find((c) => c.name.toLowerCase().includes('аванс'));
    } else if (lower.includes('кешбэк') || lower.includes('кэшбэк')) {
      matchedCat = categories.find((c) => c.name.toLowerCase().includes('кешбэк'));
    }
    if (!matchedCat) {
      matchedCat = categories.find((c) => c.type === 'income');
    }
  } else {
    // Expense keywords
    if (
      lower.includes('авто') ||
      lower.includes('машин') ||
      lower.includes('бензин') ||
      lower.includes('заправк') ||
      lower.includes('то авто') ||
      lower.includes('шиномонтаж') ||
      lower.includes('мойк') ||
      lower.includes('парковк')
    ) {
      matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('авто') ||
          c.name.toLowerCase().includes('машин') ||
          c.name.toLowerCase().includes('бензин') ||
          c.icon === '🚗' ||
          c.icon === '🚘'
      );
    } else if (
      lower.includes('кофе') ||
      lower.includes('кафе') ||
      lower.includes('ресторан') ||
      lower.includes('вкусно и точка') ||
      lower.includes('макдоналдс') ||
      lower.includes('бургер') ||
      lower.includes('пицц')
    ) {
      matchedCat =
        categories.find((c) => c.name.toLowerCase().includes('кафе')) ||
        categories.find((c) => c.name.toLowerCase().includes('еда')) ||
        categories.find((c) => c.icon === '🍔' || c.icon === '☕');
    } else if (
      lower.includes('еда') ||
      lower.includes('продукт') ||
      lower.includes('спар') ||
      lower.includes('spar') ||
      lower.includes('магнит') ||
      lower.includes('пятёрочк') ||
      lower.includes('пятерочк') ||
      lower.includes('перекрёсток') ||
      lower.includes('перекресток') ||
      lower.includes('вкусвилл') ||
      lower.includes('лента') ||
      lower.includes('ашан') ||
      lower.includes('окей')
    ) {
      matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('еда') ||
          c.name.toLowerCase().includes('продукт') ||
          c.icon === '🍔' ||
          c.icon === '🍏'
      );
    } else if (
      lower.includes('такси') ||
      lower.includes('яндекс го') ||
      lower.includes('uber') ||
      lower.includes('метро') ||
      lower.includes('автобус')
    ) {
      matchedCat =
        categories.find((c) => c.name.toLowerCase().includes('такси')) ||
        categories.find((c) => c.name.toLowerCase().includes('транспорт')) ||
        categories.find((c) => c.name.toLowerCase().includes('авто'));
    } else if (
      lower.includes('аптек') ||
      lower.includes('лекарств') ||
      lower.includes('врач') ||
      lower.includes('здоровь') ||
      lower.includes('клиник')
    ) {
      matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('здоров') ||
          c.name.toLowerCase().includes('аптек') ||
          c.icon === '💊'
      );
    } else if (
      lower.includes('одежд') ||
      lower.includes('покупк') ||
      lower.includes('обувь') ||
      lower.includes('вайлдберриз') ||
      lower.includes('wildberries') ||
      lower.includes('wb') ||
      lower.includes('озон')
    ) {
      matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('покупк') ||
          c.name.toLowerCase().includes('одежд') ||
          c.icon === '🛍️'
      );
    } else if (
      lower.includes('жкх') ||
      lower.includes('аренд') ||
      lower.includes('квартир') ||
      lower.includes('коммунал')
    ) {
      matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('жиль') ||
          c.name.toLowerCase().includes('дом') ||
          c.name.toLowerCase().includes('жкх') ||
          c.icon === '🏠'
      );
    } else if (
      lower.includes('кино') ||
      lower.includes('билет') ||
      lower.includes('концерт') ||
      lower.includes('игр') ||
      lower.includes('развлечен')
    ) {
      matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('развлечен') ||
          c.icon === '🍿' ||
          c.icon === '🎉'
      );
    } else if (
      lower.includes('кот') ||
      lower.includes('корм') ||
      lower.includes('питом') ||
      lower.includes('собак')
    ) {
      matchedCat = categories.find(
        (c) =>
          c.name.toLowerCase().includes('кот') ||
          c.name.toLowerCase().includes('питом') ||
          c.name.toLowerCase().includes('личн') ||
          c.icon === '🐾'
      );
    }
  }

  // Fallback category
  if (!matchedCat) {
    matchedCat = categories.find((c) => c.type === type) || categories[0];
  }

  // 4. Generate clean Note
  // Remove numbers, currencies, and filler verbs
  let cleanNote = text
    .replace(/\b\d+([.,]\d+)?\b/g, '')
    .replace(/\b(рублей|рубля|рубль|руб|р|тысяч[а-я]*|сотен|сот)\b/gi, '')
    .replace(/\b(я\s+)?(потратила|потратил|купила|купил|оплатила|оплатил|перевела|перевел|скинула|скинул)\b/gi, '')
    .replace(/\b(на|в|за|по|из|с|со|для)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // If clean note became empty or too short, use category name or original keywords
  if (!cleanNote || cleanNote.length < 2) {
    if (lower.includes('кофе')) cleanNote = 'Кофе';
    else if (lower.includes('бензин')) cleanNote = 'Бензин';
    else if (lower.includes('такси')) cleanNote = 'Такси';
    else if (lower.includes('спар') || lower.includes('spar')) cleanNote = 'Спар продукты';
    else if (lower.includes('продукты')) cleanNote = 'Продукты';
    else if (lower.includes('обед')) cleanNote = 'Обед';
    else cleanNote = matchedCat.name;
  } else {
    // Capitalize first letter
    cleanNote = cleanNote.charAt(0).toUpperCase() + cleanNote.slice(1);
  }

  // 5. Detect Accounts
  let matchedAcc: Account = selectedAccount;
  let matchedToAcc: Account | undefined;

  for (const acc of accounts) {
    const accLower = acc.name.toLowerCase();
    if (lower.includes('альфа') && accLower.includes('альфа')) {
      matchedAcc = acc;
    } else if ((lower.includes('т-банк') || lower.includes('тинькофф') || lower.includes('тинькоф')) && (accLower.includes('т-банк') || accLower.includes('тинькофф'))) {
      matchedAcc = acc;
    } else if (lower.includes('озон') && accLower.includes('озон')) {
      matchedAcc = acc;
    } else if (lower.includes('сбер') && accLower.includes('сбер')) {
      matchedAcc = acc;
    }
  }

  if (type === 'transfer') {
    if (lower.includes('влад') || lower.includes('едок')) {
      matchedToAcc = accounts.find((a) => a.name.toLowerCase().includes('едок') || a.name.toLowerCase().includes('влад'));
    }
    if (!matchedToAcc) {
      matchedToAcc = accounts.find((a) => a.id !== matchedAcc.id);
    }
  }

  return {
    amount,
    type,
    category: matchedCat,
    category_name: matchedCat.name,
    account: matchedAcc,
    account_name: matchedAcc.name,
    to_account: matchedToAcc,
    to_account_name: matchedToAcc?.name,
    note: cleanNote,
  };
}
