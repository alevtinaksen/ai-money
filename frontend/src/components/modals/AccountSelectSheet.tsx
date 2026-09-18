import React from 'react';
import { CloseOutlined, PlusOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';
import { Account } from '../../types';

interface AccountSelectSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
  selectedAccountId: string;
  onSelectAccount: (acc: Account) => void;
  onAddNewAccount?: () => void;
  onHaptic?: () => void;
}

export const AccountSelectSheet: React.FC<AccountSelectSheetProps> = ({
  isOpen,
  onClose,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onAddNewAccount,
  onHaptic
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Container */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1A1B20] rounded-t-[32px] pt-3 pb-8 px-5 shadow-2xl z-10 max-h-[85vh] flex flex-col animate-slide-up transition-colors">
        {/* Handle Bar */}
        <div className="w-10 h-1 bg-[#D1D5DB] dark:bg-[#343744] rounded-full mx-auto mb-3" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3">
          <button
            type="button"
            onClick={() => {
              onHaptic?.();
              onAddNewAccount?.();
            }}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] dark:bg-[#252730] flex items-center justify-center text-[#4B5563] dark:text-[#A0A5B5] active:bg-[#E5E7EB] dark:active:bg-[#2F323D]"
          >
            <PlusOutlined className="text-[18px]" />
          </button>

          <button
            type="button"
            onClick={() => {
              onHaptic?.();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] dark:bg-[#252730] flex items-center justify-center text-[#4B5563] dark:text-[#A0A5B5] active:bg-[#E5E7EB] dark:active:bg-[#2F323D]"
          >
            <CloseOutlined className="text-[18px]" />
          </button>
        </div>

        {/* Accounts List */}
        <div className="overflow-y-auto space-y-2.5 pr-0.5 py-1">
          {accounts.map((acc) => {
            const isSelected = acc.id === selectedAccountId;
            return (
              <div
                key={acc.id}
                onClick={() => {
                  onHaptic?.();
                  onSelectAccount(acc);
                  onClose();
                }}
                className={`flex items-center justify-between p-3.5 rounded-[20px] border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#2B5BFF] bg-[#F5F8FF] dark:bg-[#1C233B] ring-2 ring-[#2B5BFF]/10'
                    : 'border-[#F0F2F5] dark:border-[#252730] bg-[#FAFAFC] dark:bg-[#20222A] hover:bg-[#F3F4F6] dark:hover:bg-[#252732]'
                }`}
              >
                {/* Left: Icon + Info */}
                <div className="flex items-center space-x-3.5">
                  <div
                    className="w-12 h-12 rounded-[16px] flex items-center justify-center text-2xl shadow-sm"
                    style={{ backgroundColor: acc.color || '#F3F4F6' }}
                  >
                    {acc.icon || '💳'}
                  </div>

                  <div>
                    <h4 className="text-[15px] font-semibold text-[#111827] dark:text-white leading-tight">
                      {acc.name}
                    </h4>
                    <p className="text-[13px] text-[#6B7280] dark:text-[#8E92A4] mt-0.5 font-medium">
                      {acc.balance.toLocaleString('ru-RU', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      ₽
                    </p>
                  </div>
                </div>

                {/* Right: RUB badge, Pencil, Radio */}
                <div className="flex items-center space-x-2.5">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#EEF2FF] dark:bg-[#252B48] text-[#4338CA] dark:text-[#818CF8]">
                    {acc.currency || 'RUB'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onHaptic?.();
                    }}
                    className="text-[#9CA3AF] dark:text-[#8E92A4] hover:text-[#4B5563] p-1"
                  >
                    <EditOutlined className="text-[14px]" />
                  </button>

                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-[#2B5BFF] text-white shadow-sm'
                        : 'border-2 border-[#D1D5DB] dark:border-[#4B5563]'
                    }`}
                  >
                    {isSelected && <CheckOutlined className="text-[12px]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
