import React, { useState } from 'react';
import { X, Trash2, Calendar, ChevronDown, Check } from 'lucide-react';
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

const SUBCATEGORIES_MAP: Record<string, string[]> = {
  'Еда': ['Самокат', 'Кафе', 'Кофе', 'НаЛанч', 'Супермаркет'],
  'Машина': ['Бензин', 'ТО авто', 'Парковка', 'Кредит за авто'],
  'Транспорт': ['Такси', 'Каршеринг', 'Общественный', 'Поезд'],
  'Покупки': ['Одежда', 'Электроника', 'Бытовая химия', 'Товары для хобби'],
  'Развлечения': ['Кино', 'Игры', 'Вечеринки'],
  'Здоровье': ['Лекарства', 'Врачи', 'Психотерапевт'],
  'Жилье': ['Аренда', 'ЖКХ', 'Ремонт'],
  'Личное': ['Внешний вид', 'Привычки', 'Спорт'],
  'Кот': ['Корм', 'Здоровье кота'],
};

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  isOpen,
  onClose,
  transaction,
  accounts,
  categories,
  onSave,
  onDelete,
  onHaptic,
}) => {
  if (!isOpen || !transaction) return null;

  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(
    transaction.type || 'expense'
  );
  const [amountStr, setAmountStr] = useState<string>(transaction.amount.toString());
  const [accountId, setAccountId] = useState<string>(transaction.account_id);
  const [categoryId, setCategoryId] = useState<string | undefined>(() => {
    if (transaction.category_id) return transaction.category_id;
    if (transaction.type === 'transfer') {
      const tc = categories.find((c) => c.name === 'Переводы' || c.name.toLowerCase().includes('перевод'));
      return tc?.id;
    }
    return undefined;
  });
  const [note, setNote] = useState<string>(transaction.note || '');
  const [subcat, setSubcat] = useState<string>(() => {
    return transaction.note || '';
  });

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSubcatPickerOpen, setIsSubcatPickerOpen] = useState(false);
  const [isAccPickerOpen, setIsAccPickerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const transferCat = categories.find((c) => c.name === 'Переводы' || c.name.toLowerCase().includes('перевод'));
  const defaultCat = (type === 'transfer' || transaction.type === 'transfer')
    ? (transferCat || categories[0])
    : categories[0];
  const selectedAcc = accounts.find((a) => a.id === accountId) || accounts[0];
  const selectedCat = categories.find((c) => c.id === categoryId) || defaultCat;

  const currentSubcategories = selectedCat ? SUBCATEGORIES_MAP[selectedCat.name] || [] : [];

  const handleSave = () => {
    onHaptic?.('heavy');
    const parsedAmount = parseFloat(amountStr.replace(',', '.')) || transaction.amount;
    onSave({
      id: transaction.id,
      amount: parsedAmount,
      account_id: accountId,
      category_id: categoryId,
      type,
      note: note.trim() || subcat || undefined,
    });
    onClose();
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
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#F6F7FB] px-5 pt-12 pb-8 animate-fade-in select-none">
      {/* Top Bar: Close (X) & Delete (Trash) */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onClose();
          }}
          className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-[#111827] active:bg-[#F3F4F6]"
        >
          <X className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => {
            onHaptic?.('medium');
            setShowDeleteConfirm(true);
          }}
          className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 hover:text-red-500 active:bg-red-50 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
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
            className="inline-flex items-center space-x-2 bg-white px-4 py-2.5 rounded-full shadow-sm border border-gray-100 active:scale-[0.98] transition-all"
          >
            <span className="text-lg">{selectedAcc?.icon || '💳'}</span>
            <div className="text-left">
              <span className="text-[14px] font-semibold text-[#111827] block leading-tight">
                {selectedAcc?.name || 'Счёт'}
              </span>
              <span className="text-[11px] text-[#9CA3AF] block leading-none mt-0.5">
                {selectedAcc ? (selectedAcc.balance / 1000).toFixed(2) : 0} тыс. ₽
              </span>
            </div>
          </button>

          {/* Date Pill */}
          <div className="inline-flex items-center space-x-2 bg-white px-4 py-2.5 rounded-full shadow-sm border border-gray-100 text-[#111827]">
            <Calendar className="w-4 h-4 text-[#9CA3AF]" />
            <span className="text-[14px] font-semibold">{dateLabel}</span>
          </div>
        </div>

        {/* Row 2: Amount & Type Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* [- + ⇄] Toggle button */}
            <div className="bg-white rounded-full p-1 shadow-sm border border-gray-100 flex items-center space-x-1">
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

            {/* Large Amount Input */}
            <input
              type="text"
              inputMode="decimal"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className={`text-[40px] font-extrabold bg-transparent w-36 tracking-tight focus:outline-none ${
                type === 'expense'
                  ? 'text-[#FF4B55]'
                  : type === 'income'
                  ? 'text-[#10B981]'
                  : 'text-[#2B5BFF]'
              }`}
            />
          </div>

          {/* Currency Pill */}
          <div className="w-10 h-10 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-400 font-bold text-[18px]">
            ₽
          </div>
        </div>

        {/* Row 3: Category & Subcategory Tags */}
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
          {/* Main Category */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              setIsPickerOpen(!isPickerOpen);
              setIsSubcatPickerOpen(false);
            }}
            className="inline-flex items-center space-x-2 bg-[#2B5BFF] text-white px-4 py-2.5 rounded-full font-semibold text-[15px] shadow-sm active:scale-[0.98] transition-all"
          >
            <span>{selectedCat?.icon || '📦'}</span>
            <span>{selectedCat?.name || 'Категория'}</span>
            <ChevronDown className="w-4 h-4 ml-0.5" />
          </button>

          {/* Subcategory */}
          {currentSubcategories.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setIsSubcatPickerOpen(!isSubcatPickerOpen);
                setIsPickerOpen(false);
              }}
              className="inline-flex items-center space-x-2 bg-[#EFF6FF] text-[#2B5BFF] border border-[#BFDBFE] px-4 py-2.5 rounded-full font-semibold text-[15px] active:scale-[0.98] transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-[#2B5BFF]" />
              <span>{subcat || currentSubcategories[0]}</span>
            </button>
          )}
        </div>

        {/* Category Picker Dropdown Sheet */}
        {isPickerOpen && (
          <div className="bg-white rounded-2xl p-3 shadow-lg border border-gray-100 max-h-48 overflow-y-auto grid grid-cols-2 gap-1.5 animate-slide-up">
            {categories
              .filter((c) => c.type === type)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onHaptic?.('light');
                    setCategoryId(c.id);
                    const subList = SUBCATEGORIES_MAP[c.name] || [];
                    if (subList.length > 0) setSubcat(subList[0]);
                    setIsPickerOpen(false);
                  }}
                  className="flex items-center space-x-2 px-3 py-2 rounded-xl text-left hover:bg-gray-50 text-[14px] font-semibold text-gray-800"
                >
                  <span>{c.icon}</span>
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
          </div>
        )}

        {/* Subcategory Picker Dropdown Sheet */}
        {isSubcatPickerOpen && currentSubcategories.length > 0 && (
          <div className="bg-white rounded-2xl p-3 shadow-lg border border-gray-100 flex flex-wrap gap-1.5 animate-slide-up">
            {currentSubcategories.map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  setSubcat(sc);
                  setIsSubcatPickerOpen(false);
                }}
                className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
                  subcat === sc
                    ? 'bg-[#2B5BFF] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {sc}
              </button>
            ))}
          </div>
        )}

        {/* Account Picker Dropdown Sheet */}
        {isAccPickerOpen && (
          <div className="bg-white rounded-2xl p-3 shadow-lg border border-gray-100 max-h-52 overflow-y-auto space-y-1 animate-slide-up">
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
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className="text-lg">{a.icon}</span>
                    <span className="text-[14px] font-semibold text-gray-800">{a.name}</span>
                  </div>
                  <span className="text-[13px] font-medium text-gray-500">
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
          className="flex-1 bg-white rounded-[22px] px-4 py-4 shadow-sm border border-gray-100 text-[15px] font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400"
        />

        <button
          type="button"
          onClick={handleSave}
          className="w-14 h-14 rounded-full bg-[#2B5BFF] text-white flex items-center justify-center shadow-[0_8px_20px_rgba(43,91,255,0.4)] active:scale-95 transition-all flex-shrink-0"
        >
          <Check className="w-7 h-7 stroke-[2.5]" />
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-xs p-5">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 mx-auto flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-[17px] font-bold text-gray-900">Удалить операцию?</h4>
              <p className="text-[13px] text-gray-500 mt-1">
                Баланс счёта будет автоматически восстановлен.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-[14px]"
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
