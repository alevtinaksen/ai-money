export interface BankInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  bg: string;
}

export const KNOWN_BANKS: Record<string, BankInfo> = {
  alfa: {
    id: 'alfa',
    name: 'Альфа-Банк',
    shortName: 'Альфа',
    color: '#EF4444',
    bg: 'bg-red-50 text-red-600 border border-red-200/80 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40',
  },
  tbank: {
    id: 'tbank',
    name: 'Т-Банк',
    shortName: 'Т-Банк',
    color: '#F59E0B',
    bg: 'bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40',
  },
  ozon: {
    id: 'ozon',
    name: 'Озон Банк',
    shortName: 'Озон',
    color: '#3B82F6',
    bg: 'bg-blue-50 text-blue-600 border border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40',
  },
  sber: {
    id: 'sber',
    name: 'СберБанк',
    shortName: 'Сбер',
    color: '#10B981',
    bg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40',
  },
  vtb: {
    id: 'vtb',
    name: 'ВТБ',
    shortName: 'ВТБ',
    color: '#0284C7',
    bg: 'bg-sky-50 text-sky-600 border border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/40',
  },
};

export const BANK_OPTIONS = [
  KNOWN_BANKS.alfa,
  KNOWN_BANKS.tbank,
  KNOWN_BANKS.ozon,
  KNOWN_BANKS.sber,
  KNOWN_BANKS.vtb,
];

function stripBankFromName(name: string): string {
  let cleaned = name
    .replace(/\s*\((альфа|т-банк|тинькофф|озон|сбер|втб)\)/gi, '')
    .replace(/\s*-\s*(альфа|т-банк|тинькофф|озон|сбер|втб)\s*/gi, '')
    .replace(/\s*озон\s*банк\s*/gi, 'Карта Озон')
    .trim();

  const lower = name.toLowerCase();
  if (lower.includes('карта альфа (основной)') || lower === 'карта альфа') return 'Основная карта';
  if (lower.includes('альфа-счёт') || lower.includes('накопления')) return 'Накопительный счёт';
  if (lower.includes('инвесткопилка')) return 'Инвесткопилка';
  if (lower.includes('брокерский счёт')) return 'Брокерский счёт';
  if (lower.includes('кредитная карта')) return 'Кредитная карта';
  if (lower.includes('едоки')) return 'Влад и Алина - Едоки';
  if (lower === 'озон банк') return 'Карта Озон';

  return cleaned || name;
}

export function resolveAccountBankAndName(account: { name: string; bank_name?: string }): {
  bank: BankInfo | null;
  cleanName: string;
} {
  const rawName = account.name;
  const rawBank = account.bank_name?.toLowerCase() || '';

  // 1. If explicit bank_name is set
  if (rawBank.includes('альфа')) return { bank: KNOWN_BANKS.alfa, cleanName: stripBankFromName(rawName) };
  if (rawBank.includes('т-банк') || rawBank.includes('тинькофф')) return { bank: KNOWN_BANKS.tbank, cleanName: stripBankFromName(rawName) };
  if (rawBank.includes('озон')) return { bank: KNOWN_BANKS.ozon, cleanName: stripBankFromName(rawName) };
  if (rawBank.includes('сбер')) return { bank: KNOWN_BANKS.sber, cleanName: stripBankFromName(rawName) };
  if (rawBank.includes('втб')) return { bank: KNOWN_BANKS.vtb, cleanName: stripBankFromName(rawName) };

  // 2. Infer from account name
  const lowerName = rawName.toLowerCase();
  if (lowerName.includes('альфа')) {
    return { bank: KNOWN_BANKS.alfa, cleanName: stripBankFromName(rawName) };
  }
  if (lowerName.includes('т-банк') || lowerName.includes('тинькофф')) {
    return { bank: KNOWN_BANKS.tbank, cleanName: stripBankFromName(rawName) };
  }
  if (lowerName.includes('озон')) {
    return { bank: KNOWN_BANKS.ozon, cleanName: stripBankFromName(rawName) };
  }
  if (lowerName.includes('сбер')) {
    return { bank: KNOWN_BANKS.sber, cleanName: stripBankFromName(rawName) };
  }
  if (lowerName.includes('втб')) {
    return { bank: KNOWN_BANKS.vtb, cleanName: stripBankFromName(rawName) };
  }

  return { bank: null, cleanName: rawName };
}
