import React, { useState } from 'react';
import {
  CloseOutlined,
  SwapOutlined,
  CalendarOutlined,
  CheckOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Account, Category, TransactionType } from '../../types';
import { CustomNumpad } from '../keypad/CustomNumpad';

interface AddTransactionScreenProps {
  onClose: () => void;
  accounts: Account[];
  categories: Category[];
  selectedAccount: Account;
  initialType?: TransactionType;
  initialCategoryId?: string;
  onOpenAccountSelect: () => void;
  onSubmit: (tx: {
    account_id: string;
    category_id: string;
    amount: number;
    type: TransactionType;
    note: string;
  }) => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export const AddTransactionScreen: React.FC<AddTransactionScreenProps> = ({
  onClose,
  categories,
  selectedAccount,
  initialType,
  initialCategoryId,
  onOpenAccountSelect,
  onSubmit,
  onHaptic
}) => {
  const [amountStr, setAmountStr] = useState('');
  const [txType, setTxType] = useState<TransactionType>(initialType || 'expense');
  const [selectedCategory, setSelectedCategory] = useState<Category>(() => {
    if (initialType === 'transfer' || initialCategoryId) {
      const match = categories.find(
        (c) =>
          c.id === initialCategoryId ||
          c.name.toLowerCase().includes('перевод') ||
          c.icon === '💸'
      );
      if (match) return match;
    }
    return categories[0] || {
      id: 'cat-1',
      name: 'Еда',
      type: 'expense',
      icon: '🍔',
      color: '#FEE2E2',
      sort_order: 1,
      user_id: 143702968
    };
  });
  const [note, setNote] = useState('');
  const [dateLabel, setDateLabel] = useState('Сегодня');

  // Put selected category at the first place among all badges
  const orderedCategories = React.useMemo(() => {
    const selected = categories.find((c) => c.id === selectedCategory.id);
    const others = categories.filter((c) => c.id !== selectedCategory.id);
    return selected ? [selected, ...others] : categories;
  }, [categories, selectedCategory.id]);

  // Keypad handlers
  const handleDigit = (digit: string) => {
    onHaptic?.('light');
    if (amountStr.length > 9) return;
    if (amountStr === '0') {
      setAmountStr(digit);
    } else {
      setAmountStr((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    onHaptic?.('medium');
    setAmountStr((prev) => prev.slice(0, -1));
  };

  const handleComma = () => {
    onHaptic?.('light');
    if (!amountStr.includes(',')) {
      setAmountStr((prev) => (prev === '' ? '0,' : prev + ','));
    }
  };

  const handleSubmit = () => {
    onHaptic?.('heavy');
    const parsedAmount = parseFloat(amountStr.replace(',', '.')) || 0;
    if (parsedAmount <= 0) return;

    onSubmit({
      account_id: selectedAccount.id,
      category_id: selectedCategory.id,
      amount: parsedAmount,
      type: txType,
      note: note.trim() || selectedCategory.name,
    });
  };

  // Format account balance for pill (e.g. 5,52 тыс. ₽)
  const formatCompactBalance = (bal: number) => {
    if (bal >= 1000) {
      return `${(bal / 1000).toFixed(2).replace('.', ',')} тыс. ₽`;
    }
    return `${bal.toFixed(2).replace('.', ',')} ₽`;
  };

  const displayAmount = amountStr || '0';

  return (
    <div className="fixed inset-0 z-40 bg-[#F6F7FB] dark:bg-[#121318] flex flex-col justify-between animate-fade-in select-none transition-colors">
      {/* Top Bar with Close and Transfer */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onClose();
          }}
          className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1B20] shadow-sm flex items-center justify-center text-[#4B5563] dark:text-[#A0A5B5] active:bg-[#F3F4F6] dark:active:bg-[#252730] border border-gray-100 dark:border-[#252730]"
        >
          <CloseOutlined className="text-[18px]" />
        </button>

        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            const nextType = txType === 'transfer' ? 'expense' : 'transfer';
            setTxType(nextType);
            if (nextType === 'transfer') {
              const transferCat = categories.find(
                (c) => c.name.toLowerCase().includes('перевод') || c.icon === '💸'
              );
              if (transferCat) setSelectedCategory(transferCat);
            }
          }}
          className={`w-10 h-10 rounded-full bg-white dark:bg-[#1A1B20] shadow-sm flex items-center justify-center text-[#4B5563] dark:text-[#A0A5B5] active:bg-[#F3F4F6] dark:active:bg-[#252730] border border-gray-100 dark:border-[#252730] ${
            txType === 'transfer' ? 'ring-2 ring-[#2B5BFF] text-[#2B5BFF]' : ''
          }`}
        >
          <SwapOutlined className="text-[18px]" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-between px-5 pt-2 pb-3 max-w-lg mx-auto w-full">
        <div>
          {/* Account Pill & Date Pill */}
          <div className="flex items-center justify-between gap-3 mb-6">
            {/* Account Selector Pill */}
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                onOpenAccountSelect();
              }}
              className="flex items-center space-x-2.5 bg-white dark:bg-[#1A1B20] px-4 py-2 rounded-[22px] shadow-sm active:scale-[0.98] transition-all border border-gray-100 dark:border-[#252730] max-w-[200px] sm:max-w-[240px] min-w-0"
            >
              <span className="text-xl shrink-0">{selectedAccount.icon || '❤️'}</span>
              <div className="text-left min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-[#111827] dark:text-white leading-tight truncate">
                  {selectedAccount.name}
                </div>
                <div className="text-[12px] text-[#9CA3AF] dark:text-[#8E92A4] font-medium leading-tight whitespace-nowrap">
                  {formatCompactBalance(selectedAccount.balance)}
                </div>
              </div>
            </button>

            {/* Date Pill */}
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setDateLabel(dateLabel === 'Сегодня' ? 'Вчера' : 'Сегодня');
              }}
              className="flex items-center space-x-2 bg-white dark:bg-[#1A1B20] px-4 py-2.5 rounded-[22px] shadow-sm active:scale-[0.98] transition-all border border-gray-100 dark:border-[#252730]"
            >
              <CalendarOutlined className="text-[14px] text-[#6B7280] dark:text-[#8E92A4]" />
              <span className="text-[14px] font-medium text-[#374151] dark:text-white">
                {dateLabel}
              </span>
            </button>
          </div>

          {/* Amount Display with [- +] Toggle */}
          <div className="flex items-center justify-between my-6 px-1">
            {/* [- +] Toggle Pill */}
            <div className="flex items-center bg-white dark:bg-[#1A1B20] rounded-full p-1 shadow-sm border border-gray-100 dark:border-[#252730]">
              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setTxType('expense');
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                  txType === 'expense'
                    ? 'bg-[#FF4B55] text-white shadow-sm'
                    : 'text-[#9CA3AF] dark:text-[#8E92A4] hover:text-[#4B5563]'
                }`}
              >
                −
              </button>

              <button
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setTxType('income');
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                  txType === 'income'
                    ? 'bg-[#34C759] text-white shadow-sm'
                    : 'text-[#9CA3AF] dark:text-[#8E92A4] hover:text-[#4B5563]'
                }`}
              >
                +
              </button>
            </div>

            {/* Big Amount Text with Animated Blue Cursor */}
            <div className="flex items-center space-x-1">
              <span className="w-0.5 h-10 bg-[#2B5BFF] animate-pulse rounded-full" />
              <span className="text-[44px] font-bold tracking-tight text-[#111827] dark:text-white">
                {displayAmount}
              </span>
              <div className="w-10 h-10 rounded-full bg-white dark:bg-[#1A1B20] shadow-sm flex items-center justify-center text-[#6B7280] dark:text-[#8E92A4] font-medium text-lg ml-1 border border-gray-100 dark:border-[#252730]">
                ₽
              </div>
            </div>
          </div>

          {/* Categories Horizontal Carousel */}
          <div className="mb-6 overflow-x-auto no-scrollbar flex items-center space-x-2.5 py-1">
            {orderedCategories.map((cat) => {
              const isSelected = selectedCategory.id === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onHaptic?.('light');
                    setSelectedCategory(cat);
                  }}
                  className={`flex items-center space-x-2 px-4 py-2.5 rounded-full whitespace-nowrap transition-all shadow-sm ${
                    isSelected
                      ? 'bg-white dark:bg-[#1E2337] ring-2 ring-[#2B5BFF] text-[#111827] dark:text-white font-semibold'
                      : 'bg-white dark:bg-[#1A1B20] text-[#4B5563] dark:text-[#A0A5B5] hover:bg-gray-50 dark:hover:bg-[#252730] border border-gray-100 dark:border-[#252730]'
                  }`}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-[14px]">{cat.name}</span>
                  <RightOutlined className="text-[12px] text-[#9CA3AF] dark:text-[#8E92A4]" />
                </button>
              );
            })}
          </div>

          {/* Note Input Row with Blue Submit Check Button */}
          <div className="flex items-center space-x-3 mb-2">
            <div className="flex-1 bg-white dark:bg-[#1A1B20] rounded-[22px] px-5 py-3 shadow-sm border border-gray-100 dark:border-[#252730]">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Описание"
                className="w-full bg-transparent text-[15px] font-normal text-[#111827] dark:text-white placeholder-[#9CA3AF] dark:placeholder-[#5E6272] focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className="w-13 h-13 p-3 rounded-full bg-[#2B5BFF] text-white flex items-center justify-center shadow-[0_4px_16px_rgba(43,91,255,0.4)] active:scale-95 transition-all"
            >
              <CheckOutlined className="text-[22px]" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Keyboard */}
      <CustomNumpad
        onDigit={handleDigit}
        onDelete={handleDelete}
        onComma={handleComma}
        onHaptic={() => onHaptic?.('light')}
      />
    </div>
  );
};
