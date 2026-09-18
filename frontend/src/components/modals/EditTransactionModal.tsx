import React, { useState } from 'react';
import {
  CloseOutlined,
  DeleteOutlined,
  CalendarOutlined,
  DownOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { Transaction, Account, Category } from '../../types';

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  accounts: Account[];
  categories: Category[];
  onSave: (updated: {
    id: string;
    amount: number;
    account_id: string;
    category_id?: string;
    type: 'expense' | 'income' | 'transfer';
    note?: string;
    created_at?: string;
  }) => void;
  onDelete: (id: string) => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export interface CategoryCatalogItem {
  name: string;
  icon: string;
  type: 'expense' | 'income' | 'transfer';
  subcategories: string[];
}

export const CATEGORIES_CATALOG: CategoryCatalogItem[] = [
  {
    name: 'Еда',
    icon: '🍔',
    type: 'expense',
    subcategories: ['Кафе', 'Самокат', 'Кофе', 'НаЛанч'],
  },
  {
    name: 'Транспорт',
    icon: '🚗',
    type: 'expense',
    subcategories: ['Такси', 'Каршеринг', 'Общественный', 'Поезд', 'Метро'],
  },
  {
    name: 'Покупки',
    icon: '🛍️',
    type: 'expense',
    subcategories: ['Одежда', 'Электроника', 'Бытовая химия', 'Товары для хобби'],
  },
  {
    name: 'Развлечения',
    icon: '🎬',
    type: 'expense',
    subcategories: ['Кино', 'Игры', 'Вечеринки'],
  },
  {
    name: 'Здоровье',
    icon: '💊',
    type: 'expense',
    subcategories: ['Лекарства', 'Врачи'],
  },
  {
    name: 'Жилье',
    icon: '🏠',
    type: 'expense',
    subcategories: ['Аренда', 'ЖКХ', 'Ремонт'],
  },
  {
    name: 'Личное',
    icon: '👤',
    type: 'expense',
    subcategories: ['Внешний вид', 'Привычки', 'Спорт'],
  },
  {
    name: 'Путешествия',
    icon: '✈️',
    type: 'expense',
    subcategories: [],
  },
  {
    name: 'Кот',
    icon: '🐱',
    type: 'expense',
    subcategories: ['Корм для кота', 'Здоровье кота'],
  },
  {
    name: 'Машина',
    icon: '🚘',
    type: 'expense',
    subcategories: ['Бензин', 'ТО авто', 'Парковка', 'Кредит за авто'],
  },
  {
    name: 'Подписки',
    icon: '💿',
    type: 'expense',
    subcategories: ['Музыка', 'Кинотеатры', 'Облако'],
  },
  {
    name: 'Подарки',
    icon: '🎁',
    type: 'expense',
    subcategories: ['Друзьям', 'Семье'],
  },
  {
    name: 'Накопления',
    icon: '🏦',
    type: 'expense',
    subcategories: ['Вклад', 'Копилка'],
  },
  {
    name: 'Переводы',
    icon: '💸',
    type: 'transfer',
    subcategories: ['Владу', 'Родителям', 'Себе на карту'],
  },
  {
    name: 'Зарплата',
    icon: '💰',
    type: 'income',
    subcategories: ['Основная', 'Аванс', 'Премия', 'Кешбэк'],
  },
  {
    name: 'Инвестиции',
    icon: '📈',
    type: 'income',
    subcategories: ['Дивиденды', 'Купоны', 'Проценты'],
  },
];

export function evaluateMathSum(expr: string): number {
  if (!expr) return 0;
  const clean = expr.replace(/,/g, '.').replace(/\s+/g, '');
  const parts = clean.split('+');
  let sum = 0;
  let hasValid = false;
  for (const part of parts) {
    const num = parseFloat(part);
    if (!isNaN(num)) {
      sum += num;
      hasValid = true;
    }
  }
  return hasValid ? Math.round(sum * 100) / 100 : 0;
}

export const SUBCATEGORY_ICONS: Record<string, string> = {
  // Еда
  'Самокат': '🛴',
  'Кафе': '🍽️',
  'Кофе': '☕',
  'НаЛанч': '🍱',
  'Супермаркет': '🛒',

  // Транспорт & Машина
  'Такси': '🚕',
  'Каршеринг': '🚙',
  'Общественный': '🚌',
  'Поезд': '🚆',
  'Бензин': '⛽',
  'ТО авто': '🔧',
  'Парковка': '🅿️',
  'Кредит за авто': '📑',

  // Покупки
  'Одежда': '👗',
  'Электроника': '💻',
  'Бытовая химия': '🧼',
  'Товары для хобби': '🎨',

  // Развлечения
  'Кино': '🍿',
  'Игры': '🎮',
  'Вечеринки': '🎉',

  // Здоровье
  'Лекарства': '💊',
  'Врачи': '🩺',
  'Психотерапевт': '🧠',

  // Жилье
  'Аренда': '🔑',
  'ЖКХ': '💡',
  'Ремонт': '🔨',

  // Личное & Кот
  'Внешний вид': '💄',
  'Привычки': '🧘',
  'Спорт': '🏃',
  'Корм для кота': '🐟',
  'Здоровье кота': '🐾',

  // Путешествия
  'Отели': '🏨',
  'Билеты': '🎫',
  'Экскурсии': '🗺️',

  // Подписки
  'Музыка': '🎵',
  'Кинотеатры': '🎬',
  'Облако': '☁️',

  // Подарки & Накопления & Доходы
  'Друзьям': '🎁',
  'Семье': '👨‍👩‍👧',
  'Вклад': '🏦',
  'Копилка': '🪙',
  'Владу': '💸',
  'Родителям': '💸',
  'Себе на карту': '💳',
  'Основная': '💰',
  'Аванс': '💵',
  'Премия': '🏆',
  'Кешбэк': '🪙',
};

export interface ResolvedCategoryInfo {
  mainCategory: string;
  subcategory: string | null;
  displayTitle: string;
  icon: string;
}

export function resolveCategoryAndSubcategory(tx: {
  category_name?: string | null;
  note?: string | null;
  category_icon?: string | null;
  type?: string | null;
}): ResolvedCategoryInfo {
  const rawCat = (tx.category_name || '').trim();
  const rawNote = (tx.note || '').trim();

  // 1. Check if rawCat is an official subcategory in any catalog group
  // (e.g. rawCat === "Самокат" -> parent is "Еда", subcategory is "Самокат")
  for (const cat of CATEGORIES_CATALOG) {
    const matchingSub = cat.subcategories.find(
      (sc) => sc.toLowerCase() === rawCat.toLowerCase()
    );
    if (matchingSub) {
      const icon =
        tx.category_icon && tx.category_icon !== '📦'
          ? tx.category_icon
          : SUBCATEGORY_ICONS[matchingSub] || cat.icon;
      return {
        mainCategory: cat.name,
        subcategory: matchingSub,
        displayTitle: `${cat.name} · ${matchingSub}`,
        icon,
      };
    }
  }

  // 2. Check if rawCat is an official main category in catalog
  const catalogItem = CATEGORIES_CATALOG.find(
    (c) => c.name.toLowerCase() === rawCat.toLowerCase()
  );

  if (catalogItem) {
    // Check if rawNote matches an official subcategory of THIS category
    if (rawNote) {
      const exactSub = catalogItem.subcategories.find(
        (sc) => sc.toLowerCase() === rawNote.toLowerCase()
      );
      if (exactSub) {
        const icon =
          tx.category_icon && tx.category_icon !== '📦'
            ? tx.category_icon
            : SUBCATEGORY_ICONS[exactSub] || catalogItem.icon;
        return {
          mainCategory: catalogItem.name,
          subcategory: exactSub,
          displayTitle: `${catalogItem.name} · ${exactSub}`,
          icon,
        };
      }

      // Check if rawNote contains a subcategory name (e.g. "в самокате" -> "Самокат")
      const partialSub = catalogItem.subcategories.find((sc) =>
        rawNote.toLowerCase().includes(sc.toLowerCase())
      );
      if (partialSub) {
        const icon =
          tx.category_icon && tx.category_icon !== '📦'
            ? tx.category_icon
            : SUBCATEGORY_ICONS[partialSub] || catalogItem.icon;
        return {
          mainCategory: catalogItem.name,
          subcategory: partialSub,
          displayTitle: `${catalogItem.name} · ${partialSub}`,
          icon,
        };
      }
    }

    // No official subcategory match! Do NOT append arbitrary comment.
    return {
      mainCategory: catalogItem.name,
      subcategory: null,
      displayTitle: catalogItem.name,
      icon: tx.category_icon && tx.category_icon !== '📦' ? tx.category_icon : catalogItem.icon,
    };
  }

  // 3. If rawCat wasn't matched, check if rawNote matches any subcategory in catalog
  if (rawNote) {
    for (const cat of CATEGORIES_CATALOG) {
      const matched = cat.subcategories.find(
        (sc) =>
          sc.toLowerCase() === rawNote.toLowerCase() ||
          rawNote.toLowerCase().includes(sc.toLowerCase())
      );
      if (matched) {
        const icon =
          tx.category_icon && tx.category_icon !== '📦'
            ? tx.category_icon
            : SUBCATEGORY_ICONS[matched] || cat.icon;
        return {
          mainCategory: cat.name,
          subcategory: matched,
          displayTitle: `${cat.name} · ${matched}`,
          icon,
        };
      }
    }
  }

  // 4. Transfers
  if (tx.type === 'transfer') {
    return {
      mainCategory: 'Переводы',
      subcategory: null,
      displayTitle: rawCat || 'Перевод',
      icon: tx.category_icon || '🔄',
    };
  }

  // 5. Fallback: return rawCat or generic label, without arbitrary comment
  const fallbackName = rawCat || (tx.type === 'income' ? 'Доход' : 'Расход');
  return {
    mainCategory: fallbackName,
    subcategory: null,
    displayTitle: fallbackName,
    icon: tx.category_icon || (tx.type === 'income' ? '💰' : '📦'),
  };
}

interface EditTransactionContentProps {
  transaction: Transaction;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSave: (data: {
    id: string;
    amount: number;
    account_id: string;
    category_id?: string;
    type: 'expense' | 'income' | 'transfer';
    note?: string;
  }) => void;
  onDelete: (id: string) => void;
  onHaptic?: (type: 'light' | 'medium' | 'heavy') => void;
}

const EditTransactionModalContent: React.FC<EditTransactionContentProps> = ({
  onClose,
  transaction,
  accounts,
  categories,
  onSave,
  onDelete,
  onHaptic,
}) => {
  const resolveInitialAcc = () =>
    transaction.account_id ||
    accounts.find((a) => a.name === transaction.account_name)?.id ||
    accounts[0]?.id;

  const resolveInitialCat = () => {
    // 1. Check if category_name matches a category in categories
    if (transaction.category_name) {
      const catName = transaction.category_name.toLowerCase();
      const byName = categories.find((c) => c.name.toLowerCase() === catName);
      if (byName) return byName.id;
    }
    // 2. Check if note matches a category name directly
    if (transaction.note) {
      const noteStr = transaction.note.toLowerCase();
      const byNote = categories.find((c) => c.name.toLowerCase() === noteStr);
      if (byNote) return byNote.id;

      // 3. Check if note is a subcategory in catalog
      for (const cat of CATEGORIES_CATALOG) {
        if (cat.subcategories.some((sc) => sc.toLowerCase() === noteStr)) {
          const matchCat = categories.find((c) => c.name.toLowerCase() === cat.name.toLowerCase());
          if (matchCat) return matchCat.id;
        }
      }
    }
    // 4. Check if category_id exists in categories list
    if (transaction.category_id) {
      const byId = categories.find((c) => c.id === transaction.category_id);
      if (byId) return byId.id;
    }
    // 5. Transfer check
    if (transaction.type === 'transfer') {
      const tc = categories.find((c) => c.name === 'Переводы' || c.name.toLowerCase().includes('перевод'));
      if (tc) return tc.id;
    }
    return categories[0]?.id;
  };

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(
    transaction.type || 'expense'
  );
  const [amountStr, setAmountStr] = useState<string>(transaction.amount.toString());
  const [accountId, setAccountId] = useState<string>(resolveInitialAcc());
  const [categoryId, setCategoryId] = useState<string | undefined>(resolveInitialCat());
  const [note, setNote] = useState<string>(transaction.note || '');
  const [selectedSubcat, setSelectedSubcat] = useState<string>(() => {
    const initCat = categories.find((c) => c.id === resolveInitialCat());
    const catalog = CATEGORIES_CATALOG.find(
      (c) => c.name.toLowerCase() === initCat?.name?.toLowerCase()
    );
    const noteVal = transaction.note;
    if (
      noteVal &&
      catalog?.subcategories.some(
        (sc) => sc.toLowerCase() === noteVal.toLowerCase()
      )
    ) {
      return noteVal;
    }
    return '';
  });

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isAccPickerOpen, setIsAccPickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync state when transaction changes
  React.useEffect(() => {
    const initialAccId = resolveInitialAcc();
    const initialCatId = resolveInitialCat();
    setType(transaction.type || 'expense');
    setAmountStr(transaction.amount.toString());
    setAccountId(initialAccId);
    setCategoryId(initialCatId);
    setNote(transaction.note || '');

    const resolvedCat = categories.find((c) => c.id === initialCatId);
    const catCatalog = CATEGORIES_CATALOG.find(
      (c) => c.name.toLowerCase() === resolvedCat?.name?.toLowerCase()
    );
    const noteVal = transaction.note;
    if (
      noteVal &&
      catCatalog?.subcategories.some(
        (sc) => sc.toLowerCase() === noteVal.toLowerCase()
      )
    ) {
      setSelectedSubcat(noteVal);
    } else {
      setSelectedSubcat('');
    }

    setIsPickerOpen(false);
    setIsAccPickerOpen(false);
    setShowDeleteConfirm(false);
  }, [transaction]);

  const transferCat = categories.find((c) => c.name === 'Переводы' || c.name.toLowerCase().includes('перевод'));
  const defaultCat = (type === 'transfer' || transaction.type === 'transfer')
    ? (transferCat || categories[0])
    : categories[0];
  const selectedAcc = accounts.find((a) => a.id === accountId) || accounts[0];
  const selectedCat = categories.find((c) => c.id === categoryId) || defaultCat;

  // Resolve matching catalog entry for categories and subcategories
  const activeCatalog =
    CATEGORIES_CATALOG.find((c) => c.name.toLowerCase() === selectedCat?.name?.toLowerCase()) ||
    CATEGORIES_CATALOG.find((c) => selectedCat?.name?.toLowerCase().includes(c.name.toLowerCase())) ||
    CATEGORIES_CATALOG[0];

  const currentSubcategories = activeCatalog.subcategories;

  const orderedSubcategories = React.useMemo(() => {
    if (!selectedSubcat) return currentSubcategories;
    const match = currentSubcategories.find((s) => s === selectedSubcat);
    const others = currentSubcategories.filter((s) => s !== selectedSubcat);
    return match ? [match, ...others] : currentSubcategories;
  }, [currentSubcategories, selectedSubcat]);

  const filteredCatalog = CATEGORIES_CATALOG.filter((c) => {
    if (type === 'income') return c.type === 'income' || c.name === 'Подарки' || c.name === 'Переводы';
    if (type === 'transfer') return c.type === 'transfer' || c.name === 'Накопления';
    return c.type === 'expense';
  });

  const liveSum = amountStr.includes('+') ? evaluateMathSum(amountStr) : null;

  const handleAmountBlur = () => {
    if (amountStr.includes('+')) {
      const calculated = evaluateMathSum(amountStr);
      if (calculated > 0) {
        setAmountStr(calculated.toString());
      }
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAmountBlur();
    }
  };

  const handleSave = () => {
    onHaptic?.('heavy');
    const evaluated = evaluateMathSum(amountStr);
    const parsedAmount = evaluated > 0 ? evaluated : (parseFloat(amountStr) || transaction.amount);
    const finalNote = note.trim() || selectedSubcat || undefined;
    onSave({
      id: transaction.id,
      amount: parsedAmount,
      account_id: accountId,
      category_id: categoryId,
      type,
      note: finalNote,
    });
  };

  const handleDelete = () => {
    onHaptic?.('heavy');
    onDelete(transaction.id);
    onClose();
  };

  // Format date for pill: "7 мая"
  const dateObj = transaction.created_at ? new Date(transaction.created_at) : new Date();
  const dateLabel = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#F6F7FB] dark:bg-[#121318] px-5 pt-12 pb-8 animate-fade-in select-none transition-colors duration-200">
      {/* Top Bar: Close (X) & Delete (Trash) */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onClose();
          }}
          className="w-11 h-11 rounded-full bg-white dark:bg-[#1E1F26] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center text-[#111827] dark:text-white active:bg-gray-100 dark:active:bg-gray-800"
        >
          <CloseOutlined className="text-[18px]" />
        </button>

        <button
          type="button"
          onClick={() => {
            onHaptic?.('medium');
            setShowDeleteConfirm(true);
          }}
          className="w-11 h-11 rounded-full bg-white dark:bg-[#1E1F26] border border-gray-100 dark:border-gray-800 shadow-sm flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-red-500 active:bg-red-50 dark:active:bg-red-950/30 transition-colors"
        >
          <DeleteOutlined className="text-[18px]" />
        </button>
      </div>

      {/* Center Form Area */}
      <div className="space-y-6 max-w-sm mx-auto w-full mt-auto mb-auto">
        {/* Row 1: Account Pill & Date Pill */}
        <div className="flex items-center justify-between">
          {/* Account Pill */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              setIsAccPickerOpen(!isAccPickerOpen);
            }}
            className="inline-flex items-center space-x-2 bg-white dark:bg-[#1E1F26] px-4 py-2.5 rounded-full shadow-sm border border-gray-100 dark:border-gray-800 active:scale-[0.98] transition-all"
          >
            <span className="text-lg">{selectedAcc?.icon || '💳'}</span>
            <div className="text-left">
              <span className="text-[14px] font-semibold text-[#111827] dark:text-white block leading-tight">
                {selectedAcc?.name || 'Счёт'}
              </span>
              <span className="text-[11px] text-[#9CA3AF] dark:text-gray-400 block leading-none mt-0.5">
                {selectedAcc ? (selectedAcc.balance / 1000).toFixed(2) : 0} тыс. ₽
              </span>
            </div>
          </button>

          {/* Date Pill */}
          <div className="inline-flex items-center space-x-2 bg-white dark:bg-[#1E1F26] px-4 py-2.5 rounded-full shadow-sm border border-gray-100 dark:border-gray-800 text-[#111827] dark:text-white">
            <CalendarOutlined className="text-[14px] text-[#9CA3AF] dark:text-gray-400" />
            <span className="text-[14px] font-semibold">{dateLabel}</span>
          </div>
        </div>

        {/* Row 2: Amount & Type Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* [- + ⇄] Toggle button */}
            <div className="bg-white dark:bg-[#1E1F26] rounded-full p-1 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center space-x-1">
              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setType('expense');
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                  type === 'expense'
                    ? 'bg-[#FF4B55] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                −
              </button>
              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setType('income');
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                  type === 'income'
                    ? 'bg-[#10B981] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setType('transfer');
                  if (transferCat) setCategoryId(transferCat.id);
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  type === 'transfer'
                    ? 'bg-[#2B5BFF] text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                ⇄
              </button>
            </div>

            {/* Amount Input with Live Calculation hint */}
            <div className="flex flex-col flex-1 min-w-0">
              <input
                type="text"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                onBlur={handleAmountBlur}
                onKeyDown={handleAmountKeyDown}
                placeholder="0"
                className={`text-[36px] font-extrabold bg-transparent w-full tracking-tight focus:outline-none truncate ${
                  type === 'expense'
                    ? 'text-[#FF4B55]'
                    : type === 'income'
                    ? 'text-[#10B981]'
                    : 'text-[#2B5BFF]'
                }`}
              />
              {liveSum !== null && liveSum > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountStr(liveSum.toString())}
                  className="text-[13px] font-bold text-[#2B5BFF] hover:underline text-left -mt-1"
                >
                  = {liveSum.toLocaleString('ru-RU')} ₽
                </button>
              )}
            </div>
          </div>

          {/* Currency Pill */}
          <div className="w-10 h-10 rounded-full bg-white dark:bg-[#1E1F26] shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-300 font-bold text-[18px] flex-shrink-0">
            ₽
          </div>
        </div>

        {/* Row 3: Category & Subcategories Horizontal Strip (matching Screenshot 2) */}
        <div className="flex items-center space-x-2.5 overflow-x-auto no-scrollbar py-1 w-full">
          {/* Main Category Dropdown Pill */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              setIsPickerOpen(!isPickerOpen);
              setIsAccPickerOpen(false);
            }}
            className="inline-flex items-center space-x-2 bg-[#2B5BFF] text-white px-4 py-2.5 rounded-full font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-all flex-shrink-0"
          >
            <span>{selectedCat?.icon || activeCatalog.icon || '📦'}</span>
            <span>{selectedCat?.name || activeCatalog.name}</span>
            <DownOutlined className="text-[14px] ml-0.5" />
          </button>

          {/* Subcategories Horizontal Pills (matching Screenshot 2: • Одежда, • Электроника...) */}
          {orderedSubcategories.map((sc) => {
            const isSelected = selectedSubcat === sc;
            return (
              <button
                key={sc}
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  if (isSelected) {
                    setSelectedSubcat('');
                  } else {
                    setSelectedSubcat(sc);
                    if (!note || currentSubcategories.includes(note)) {
                      setNote(sc);
                    }
                  }
                }}
                className={`inline-flex items-center space-x-2 px-4 py-2.5 rounded-full font-semibold text-[14px] flex-shrink-0 transition-all active:scale-95 ${
                  isSelected
                    ? 'bg-[#EFF6FF] dark:bg-[#1E293B] text-[#2B5BFF] dark:text-[#60A5FA] border border-[#2B5BFF] shadow-sm'
                    : 'bg-white dark:bg-[#1E1F26] text-[#111827] dark:text-gray-200 border border-gray-100 dark:border-gray-800 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSelected ? 'bg-[#2B5BFF]' : 'bg-[#9CA3AF]'
                  }`}
                />
                <span>{sc}</span>
              </button>
            );
          })}
        </div>

        {/* Category & Subcategory Picker Popup Sheet */}
        {isPickerOpen && (
          <div className="bg-white dark:bg-[#1E1F26] rounded-3xl p-4 shadow-xl border border-gray-100 dark:border-gray-800 max-h-[340px] overflow-y-auto space-y-3.5 animate-slide-up">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-[13px] font-bold text-gray-400 uppercase tracking-wider">
                Категории и подкатегории
              </span>
              <button
                type="button"
                onClick={() => setIsPickerOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
              >
                <CloseOutlined className="text-[14px]" />
              </button>
            </div>

            {filteredCatalog.map((catItem) => {
              const isCatActive =
                selectedCat?.name.toLowerCase() === catItem.name.toLowerCase();

              return (
                <div key={catItem.name} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onHaptic?.('light');
                      const found = categories.find(
                        (c) => c.name.toLowerCase() === catItem.name.toLowerCase()
                      );
                      if (found) setCategoryId(found.id);
                      setSelectedSubcat('');
                      setIsPickerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors ${
                      isCatActive
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-[#2B5BFF] font-bold'
                        : 'text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-xl">{catItem.icon}</span>
                      <span className="text-[15px] font-semibold">{catItem.name}</span>
                    </div>
                    {isCatActive && <CheckOutlined className="text-[14px] text-[#2B5BFF]" />}
                  </button>

                  {/* Subcategories Chips inside picker */}
                  <div className="flex flex-wrap gap-1.5 pl-8">
                    {catItem.subcategories.map((sub) => {
                      const isSubSelected =
                        isCatActive &&
                        (selectedSubcat === sub || note.toLowerCase() === sub.toLowerCase());

                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => {
                            onHaptic?.('light');
                            const found = categories.find(
                              (c) => c.name.toLowerCase() === catItem.name.toLowerCase()
                            );
                            if (found) setCategoryId(found.id);
                            setSelectedSubcat(sub);
                            setNote(sub);
                            setIsPickerOpen(false);
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            isSubSelected
                              ? 'bg-[#2B5BFF] text-white shadow-xs'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Account Picker Dropdown Sheet */}
        {isAccPickerOpen && (
          <div className="bg-white dark:bg-[#1E1F26] rounded-2xl p-3 shadow-lg border border-gray-100 dark:border-gray-800 max-h-52 overflow-y-auto space-y-1 animate-slide-up">
            {accounts
              .filter((a) => a.group_name !== 'Кредиты')
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    onHaptic?.('light');
                    setAccountId(a.id);
                    setIsAccPickerOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-[14px] font-semibold text-gray-800 dark:text-white">{a.name}</span>
                  </div>
                  <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
                    {a.balance.toLocaleString('ru-RU')} ₽
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Bottom Bar: Description Input & Big Blue Checkmark (✓) */}
      <div className="flex items-center space-x-3 max-w-sm mx-auto w-full">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Описание"
          className="flex-1 bg-white dark:bg-[#1E1F26] rounded-[22px] px-4 py-4 shadow-sm border border-gray-100 dark:border-gray-800 text-[15px] font-medium text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-[#2B5BFF]"
        />

        <button
          type="button"
          onClick={handleSave}
          className="w-14 h-14 rounded-full bg-[#2B5BFF] text-white flex items-center justify-center shadow-[0_8px_20px_rgba(43,91,255,0.4)] active:scale-95 transition-all flex-shrink-0"
        >
          <CheckOutlined className="text-[26px]" />
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-5">
          <div className="bg-white dark:bg-[#1E1F26] rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4 animate-scale-up border border-transparent dark:border-gray-800">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 text-red-500 mx-auto flex items-center justify-center">
              <DeleteOutlined className="text-[22px]" />
            </div>
            <div>
              <h4 className="text-[17px] font-bold text-gray-900 dark:text-white">Удалить операцию?</h4>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-1">
                Баланс счёта будет автоматически восстановлен.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-[14px]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold text-[14px] shadow-sm"
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const EditTransactionModal: React.FC<EditTransactionModalProps> = (props) => {
  if (!props.isOpen || !props.transaction) return null;
  return (
    <EditTransactionModalContent
      {...props}
      transaction={props.transaction}
    />
  );
};

