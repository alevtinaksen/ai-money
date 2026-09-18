import React, { useState } from 'react';
import { ArrowLeft, Pencil, Plus, ChevronDown, ChevronUp, ArrowLeftRight } from 'lucide-react';
import { Account } from '../../types';

interface AccountsScreenProps {
  onBack: () => void;
  accounts: Account[];
  onSelectAccount?: (acc: Account) => void;
  onOpenTransfer?: () => void;
  onAddNewAccount?: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export const AccountsScreen: React.FC<AccountsScreenProps> = ({
  onBack,
  accounts,
  onSelectAccount,
  onOpenTransfer,
  onAddNewAccount,
  onHaptic
}) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Личное': true,
    'Общее (с Владом)': true,
    'Кредиты': true,
  });

  const toggleGroup = (group: string) => {
    onHaptic?.('light');
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const assetsBalance = accounts
    .filter((a) => a.group_name !== 'Кредиты')
    .reduce((acc, a) => acc + a.balance, 0);

  const creditBalance = accounts
    .filter((a) => a.group_name === 'Кредиты')
    .reduce((acc, a) => acc + a.balance, 0);

  // Group accounts by group_name
  const groupedAccounts = accounts.reduce((acc, a) => {
    const grp = a.group_name || 'Личное';
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(a);
    return acc;
  }, {} as Record<string, Account[]>);

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col justify-between pb-10 select-none animate-fade-in relative">
      {/* Top Header Bar */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onBack();
            }}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#111827] active:bg-[#F3F4F6]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[26px] font-bold text-[#111827] tracking-tight">Счета</h1>
        </div>

        {/* Header Actions: Edit & Add (+) with Rocket Badge */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => onHaptic?.('light')}
            className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#111827] active:bg-[#F3F4F6]"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                onHaptic?.('light');
                onAddNewAccount?.();
              }}
              className="w-10 h-10 rounded-full bg-[#EDE9FE] text-[#7C3AED] shadow-sm flex items-center justify-center active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
            <span className="absolute -top-1 -right-1 text-[12px]">🚀</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-5 max-w-lg mx-auto w-full">
        {/* Big Total Balance Header */}
        <div className="text-center my-6">
          <h2 className="text-[34px] sm:text-[38px] font-extrabold text-[#111827] tracking-tight">
            {assetsBalance.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ₽
          </h2>
          <p className="text-[14px] text-[#9CA3AF] font-medium mt-1">Доступно на счетах</p>

          {creditBalance > 0 && (
            <div className="inline-flex items-center space-x-1.5 bg-red-50 text-red-600 px-3.5 py-1 rounded-full text-[13px] font-semibold mt-2.5 border border-red-100 shadow-sm">
              <span>📑 Кредиты: -{creditBalance.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</span>
            </div>
          )}

          <p className="text-[12px] text-[#9CA3AF] mt-2 flex items-center justify-center space-x-1">
            <span>ⓘ</span>
            <span>Долгое нажатие для перевода</span>
          </p>
        </div>

        {/* Grouped Account Lists */}
        <div className="space-y-6 mt-6">
          {Object.entries(groupedAccounts).map(([groupName, groupAccs]) => {
            const isOpen = openGroups[groupName] ?? true;
            const isCreditGroup = groupName === 'Кредиты';
            const groupSum = groupAccs.reduce((sum, a) => sum + a.balance, 0);

            return (
              <div key={groupName} className="space-y-3">
                {/* Group Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(groupName)}
                  className="w-full flex items-center justify-between text-left group"
                >
                  <div className="flex items-center space-x-2">
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-[#6B7280]" />
                    )}
                    <span className={`text-[17px] font-bold ${isCreditGroup ? 'text-red-600' : 'text-[#111827]'}`}>
                      {groupName}
                    </span>
                    <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${
                      isCreditGroup ? 'bg-red-100 text-red-700' : 'text-[#6B7280] bg-[#E5E7EB]'
                    }`}>
                      {groupAccs.length}
                    </span>
                  </div>

                  <span className={`text-[14px] font-semibold ${isCreditGroup ? 'text-red-500 font-bold' : 'text-[#6B7280]'}`}>
                    {isCreditGroup ? '-' : ''}{groupSum.toLocaleString('ru-RU', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    ₽
                  </span>
                </button>

                {/* Accounts Horizontal / Vertical Pills */}
                {isOpen && (
                  <div className="flex flex-col items-start gap-2.5">
                    {groupAccs.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => {
                          onHaptic?.('light');
                          onSelectAccount?.(acc);
                        }}
                        className={`inline-flex items-center space-x-2.5 bg-white px-4 py-2.5 rounded-full shadow-sm border active:scale-[0.98] transition-all ${
                          isCreditGroup ? 'border-red-100 hover:border-red-200' : 'border-gray-100/80'
                        }`}
                      >
                        <span className="text-lg">{acc.icon}</span>
                        <span className="text-[15px] font-semibold text-[#111827]">
                          {acc.name}
                        </span>
                        <span className={`text-[15px] font-medium ${isCreditGroup ? 'text-red-600 font-semibold' : 'text-[#6B7280]'}`}>
                          {isCreditGroup ? '-' : ''}{acc.balance.toLocaleString('ru-RU', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}{' '}
                          ₽
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Action Button (FAB) for Transfer (⇄) */}
      <div className="fixed bottom-8 right-6 z-20">
        <button
          type="button"
          onClick={() => {
            onHaptic?.('heavy');
            onOpenTransfer?.();
          }}
          className="w-14 h-14 rounded-full bg-[#2B5BFF] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(43,91,255,0.4)] active:scale-95 transition-all"
        >
          <ArrowLeftRight className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
