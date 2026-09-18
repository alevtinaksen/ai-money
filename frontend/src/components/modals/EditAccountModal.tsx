import React, { useState, useEffect } from 'react';
import { CloseOutlined, EditOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { Account } from '../../types';

interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onSave: (updated: Partial<Account> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

const EMOJI_OPTIONS = ['❤️', '💛', '💙', '💳', '💵', '👥', '📈', '🪙', '🏺', '🛏️', '🏠', '🚗', '📑'];

export const EditAccountModal: React.FC<EditAccountModalProps> = ({
  isOpen,
  onClose,
  account,
  onSave,
  onDelete,
  onHaptic,
}) => {
  const [name, setName] = useState('');
  const [balanceStr, setBalanceStr] = useState('');
  const [groupName, setGroupName] = useState('Личное');
  const [icon, setIcon] = useState('💳');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleDelete = () => {
    if (account && onDelete) {
      onHaptic?.('heavy');
      onDelete(account.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in select-none transition-colors">
      <div className="bg-white dark:bg-[#1A1B20] rounded-[32px] w-full max-w-sm p-6 shadow-2xl space-y-5 animate-slide-up border border-gray-100 dark:border-[#252730]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#252730] flex items-center justify-center text-gray-500 dark:text-[#A0A5B5] active:bg-gray-200 dark:active:bg-[#2E313D]"
          >
            <CloseOutlined className="text-[18px]" />
          </button>
          <h3 className="text-[18px] font-bold text-[#111827] dark:text-white">
            {account ? 'Редактировать счёт' : 'Новый счёт'}
          </h3>
          <div className="w-9" /> {/* Spacer */}
        </div>

        {/* Center Circular Icon with Edit Pen */}
        <div className="flex justify-center my-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                setShowEmojiPicker(!showEmojiPicker);
              }}
              className="w-20 h-20 rounded-full bg-red-50/80 dark:bg-red-950/40 flex items-center justify-center text-3xl shadow-sm border border-red-100 dark:border-red-900/40 active:scale-95 transition-all"
            >
              {icon}
            </button>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-sm"
            >
              <EditOutlined className="text-[10px]" />
            </button>
          </div>
        </div>

        {/* Emoji Selector Carousel (if open) */}
        {showEmojiPicker && (
          <div className="bg-gray-50 dark:bg-[#20222A] p-2.5 rounded-2xl flex items-center space-x-2 overflow-x-auto no-scrollbar animate-fade-in border border-gray-100 dark:border-[#252730]">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setIcon(e);
                  setShowEmojiPicker(false);
                }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-all ${
                  icon === e ? 'bg-white dark:bg-[#2E313D] shadow-sm ring-2 ring-blue-500' : 'hover:bg-white dark:hover:bg-[#252730]'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Form Inputs */}
        <div className="space-y-3.5">
          {/* Account Name with Pen Icon */}
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название счёта"
              className="w-full bg-white dark:bg-[#20222A] border border-gray-200/90 dark:border-[#2E313D] rounded-2xl pl-10 pr-4 py-3 text-[15px] font-semibold text-gray-900 dark:text-white shadow-2xs focus:outline-none focus:border-blue-500"
            />
            <EditOutlined className="text-[14px] text-gray-400 absolute left-3.5 top-3.5" />
          </div>

          {/* Current Balance */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 dark:text-[#8E92A4] uppercase tracking-wider block mb-1">
              Текущий баланс (₽)
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={balanceStr}
              onChange={(e) => setBalanceStr(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-50 dark:bg-[#20222A] border border-gray-200/80 dark:border-[#2E313D] rounded-2xl px-4 py-3 text-[18px] font-bold text-gray-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Group Selector */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 dark:text-[#8E92A4] uppercase tracking-wider block mb-1">
              Группа счёта
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setGroupName('Личное')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center ${
                  groupName === 'Личное'
                    ? 'bg-[#2B5BFF] text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#252730] text-gray-600 dark:text-[#A0A5B5]'
                }`}
              >
                👤 Личное
              </button>

              <button
                type="button"
                onClick={() => setGroupName('Общее (с Владом)')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center ${
                  groupName === 'Общее (с Владом)'
                    ? 'bg-[#2B5BFF] text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#252730] text-gray-600 dark:text-[#A0A5B5]'
                }`}
              >
                👥 Общее
              </button>

              <button
                type="button"
                onClick={() => setGroupName('Кредиты')}
                className={`py-2 px-1 rounded-xl text-xs font-bold transition-all text-center ${
                  groupName === 'Кредиты'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-[#252730] text-gray-600 dark:text-[#A0A5B5]'
                }`}
              >
                📑 Кредиты
              </button>
            </div>
          </div>
        </div>

        {/* Delete Button (if editing existing account) */}
        {account && onDelete && (
          <button
            type="button"
            onClick={() => {
              onHaptic?.('medium');
              setShowDeleteConfirm(true);
            }}
            className="w-full py-2.5 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-[14px] font-semibold flex items-center justify-center space-x-1.5 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            <DeleteOutlined className="text-[14px]" />
            <span>Удалить счёт</span>
          </button>
        )}

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3.5 rounded-2xl bg-[#FF4B55] text-white font-bold text-[16px] shadow-[0_6px_20px_rgba(255,75,85,0.35)] active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
        >
          <CheckOutlined className="text-[18px]" />
          <span>Сохранить</span>
        </button>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-5">
          <div className="bg-white dark:bg-[#1A1B20] rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4 animate-scale-up border border-gray-100 dark:border-[#252730]">
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 mx-auto flex items-center justify-center">
              <DeleteOutlined className="text-[22px]" />
            </div>
            <div>
              <h4 className="text-[17px] font-bold text-gray-900 dark:text-white">Удалить этот счёт?</h4>
              <p className="text-[13px] text-gray-500 dark:text-[#8E92A4] mt-1">
                Все связанные операции останутся в истории.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-[#252730] text-gray-700 dark:text-white font-semibold text-[14px]"
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
