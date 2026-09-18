import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Account } from '../../types';

interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onSave: (updated: Partial<Account> & { id?: string }) => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

const EMOJI_OPTIONS = ['❤️', '💛', '💙', '💳', '💵', '👥', '📈', '🪙', '🏺', '🛏️', '🏠', '🚗', '📑'];

export const EditAccountModal: React.FC<EditAccountModalProps> = ({
  isOpen,
  onClose,
  account,
  onSave,
  onHaptic,
}) => {
  const [name, setName] = useState('');
  const [balanceStr, setBalanceStr] = useState('');
  const [groupName, setGroupName] = useState('Личное');
  const [icon, setIcon] = useState('💳');

  useEffect(() => {
    if (account) {
      setName(account.name);
      setBalanceStr(account.balance.toString());
      setGroupName(account.group_name || 'Личное');
      setIcon(account.icon || '💳');
    } else {
      setName('');
      setBalanceStr('');
      setGroupName('Личное');
      setIcon('💳');
    }
  }, [account, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onHaptic?.('heavy');
    const bal = parseFloat(balanceStr.replace(',', '.')) || 0;
    onSave({
      id: account?.id,
      name: name.trim() || 'Новый счёт',
      balance: bal,
      group_name: groupName,
      icon,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="bg-white rounded-[28px] w-full max-w-sm p-6 shadow-2xl space-y-5 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-bold text-[#111827]">
            {account ? 'Редактировать счёт' : 'Новый счёт'}
          </h3>
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Inputs */}
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">
              Название счёта
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Карта Альфа"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-[15px] font-medium text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">
              Текущий баланс (₽)
            </label>
            <input
              type="text"
              value={balanceStr}
              onChange={(e) => setBalanceStr(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-[17px] font-bold text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">
              Группа
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setGroupName('Личное')}
                className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all text-center ${
                  groupName === 'Личное'
                    ? 'bg-[#2B5BFF] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                👤 Личное
              </button>

              <button
                type="button"
                onClick={() => setGroupName('Общее (с Владом)')}
                className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all text-center ${
                  groupName === 'Общее (с Владом)'
                    ? 'bg-[#2B5BFF] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                👥 Общее
              </button>

              <button
                type="button"
                onClick={() => setGroupName('Кредиты')}
                className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all text-center ${
                  groupName === 'Кредиты'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                📑 Кредиты
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 block mb-1">
              Иконка
            </label>
            <div className="flex items-center space-x-1.5 overflow-x-auto py-1 no-scrollbar">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-all ${
                    icon === e ? 'bg-blue-50 ring-2 ring-[#2B5BFF]' : 'bg-gray-50'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3.5 rounded-2xl bg-[#2B5BFF] text-white font-semibold text-[15px] flex items-center justify-center space-x-2 shadow-[0_4px_16px_rgba(43,91,255,0.35)] active:scale-[0.98] transition-all"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Сохранить счёт</span>
        </button>
      </div>
    </div>
  );
};
