import React from 'react';
import { X, Plus, Pencil, Check } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      {/* Backdrop click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet Container */}
      <div className="relative w-full max-w-lg bg-white rounded-t-[32px] pt-3 pb-8 px-5 shadow-2xl z-10 max-h-[85vh] flex flex-col animate-slide-up">
        {/* Handle Bar */}
        <div className="w-10 h-1 bg-[#D1D5DB] rounded-full mx-auto mb-3" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3">
          <button
            type="button"
            onClick={() => {
              onHaptic?.();
              onAddNewAccount?.();
            }}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#4B5563] active:bg-[#E5E7EB]"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              onHaptic?.();
              onClose();
            }}
            className="w-9 h-9 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#4B5563] active:bg-[#E5E7EB]"
          >
            <X className="w-5 h-5" />
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
                    ? 'border-[#2B5BFF] bg-[#F5F8FF] ring-2 ring-[#2B5BFF]/10'
                    : 'border-[#F0F2F5] bg-[#FAFAFC] hover:bg-[#F3F4F6]'
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
                    <h4 className="text-[15px] font-semibold text-[#111827] leading-tight">
                      {acc.name}
                    </h4>
                    <p className="text-[13px] text-[#6B7280] mt-0.5 font-medium">
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
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#EEF2FF] text-[#4338CA]">
                    {acc.currency || 'RUB'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onHaptic?.();
                    }}
                    className="text-[#9CA3AF] hover:text-[#4B5563] p-1"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-[#2B5BFF] text-white shadow-sm'
                        : 'border-2 border-[#D1D5DB]'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
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
