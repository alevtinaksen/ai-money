import React, { useState } from 'react';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  DownOutlined,
  UpOutlined,
  SwapOutlined,
} from '@ant-design/icons';
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
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#121318] text-[#111827] dark:text-white flex flex-col justify-between pb-10 select-none animate-fade-in relative transition-colors duration-200">
      {/* Top Header Bar */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onBack();
            }}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#1E1F26] shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-center text-[#111827] dark:text-white active:bg-gray-100 dark:active:bg-gray-800"
          >
            <ArrowLeftOutlined className="text-[18px]" />
          </button>
          <h1 className="text-[26px] font-bold text-[#111827] dark:text-white tracking-tight">Счета</h1>
        </div>

        {/* Header Actions: Add (+) semi-blue button without rocket */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onAddNewAccount?.();
            }}
            className="w-10 h-10 rounded-full bg-[#DCE6FF] dark:bg-[#1E284A] text-[#2B5BFF] border border-[#B3C8FD] dark:border-[#2B5BFF]/40 shadow-sm flex items-center justify-center active:scale-95 transition-transform"
          >
            <PlusOutlined className="text-[18px] text-[#2B5BFF]" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-5 max-w-lg mx-auto w-full">
        {/* Big Total Balance Header */}
        <div className="text-center my-6">
          <h2 className="text-[34px] sm:text-[38px] font-extrabold text-[#111827] dark:text-white tracking-tight">
            {assetsBalance.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ₽
          </h2>
          <p className="text-[14px] text-[#9CA3AF] dark:text-gray-400 font-medium mt-1">Доступно на счетах</p>

          {creditBalance > 0 && (
            <div className="inline-flex items-center space-x-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 px-3.5 py-1 rounded-full text-[13px] font-semibold mt-2.5 border border-red-100 dark:border-red-900/40 shadow-sm">
              <span>📑 Кредиты: -{creditBalance.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</span>
            </div>
          )}
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
                      <DownOutlined className="text-[14px] text-[#6B7280] dark:text-gray-400" />
                    ) : (
                      <UpOutlined className="text-[14px] text-[#6B7280] dark:text-gray-400" />
                    )}
                    <span className={`text-[17px] font-bold ${isCreditGroup ? 'text-red-600 dark:text-red-400' : 'text-[#111827] dark:text-white'}`}>
                      {groupName}
                    </span>
                    <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-full ${
                      isCreditGroup ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : 'text-[#6B7280] dark:text-gray-300 bg-[#E5E7EB] dark:bg-gray-800'
                    }`}>
                      {groupAccs.length}
                    </span>
                  </div>

                  <span className={`text-[14px] font-semibold ${isCreditGroup ? 'text-red-500 dark:text-red-400 font-bold' : 'text-[#6B7280] dark:text-gray-400'}`}>
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
                        title={acc.name}
                        className={`inline-flex items-center max-w-full space-x-2.5 bg-white dark:bg-[#1E1F26] px-4 py-2.5 rounded-full shadow-sm border active:scale-[0.98] transition-all ${
                          isCreditGroup ? 'border-red-100 dark:border-red-900/40 hover:border-red-200' : 'border-gray-100/80 dark:border-gray-800/80'
                        }`}
                      >
                        <span className="text-base shrink-0">{acc.icon}</span>
                        <span className="text-[14px] font-semibold text-[#111827] dark:text-white truncate max-w-[170px] sm:max-w-[280px] text-left">
                          {acc.name}
                        </span>
                        <span className={`text-[14px] font-medium shrink-0 whitespace-nowrap ${isCreditGroup ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-[#6B7280] dark:text-gray-400'}`}>
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

      {/* Centered Transfer Button (⇄ Перевести) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20">
        <button
          type="button"
          onClick={() => {
            onHaptic?.('heavy');
            onOpenTransfer?.();
          }}
          className="px-6 py-3.5 rounded-full bg-[#2B5BFF] hover:bg-[#1E4BEB] text-white flex items-center space-x-2 shadow-[0_8px_24px_rgba(43,91,255,0.4)] active:scale-95 transition-all font-semibold text-[15px]"
        >
          <SwapOutlined className="text-[18px]" />
          <span>Перевести</span>
        </button>
      </div>
    </div>
  );
};
