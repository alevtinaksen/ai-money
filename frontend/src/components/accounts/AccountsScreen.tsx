import React from 'react';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  SwapOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Account } from '../../types';
import { resolveAccountBankAndName } from '../../utils/bankUtils';

interface AccountsScreenProps {
  onBack: () => void;
  accounts: Account[];
  onSelectAccount?: (acc: Account) => void;
  onOpenTransfer?: () => void;
  onAddNewAccount?: () => void;
  onOpenSettings?: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

export const AccountsScreen: React.FC<AccountsScreenProps> = ({
  onBack,
  accounts,
  onSelectAccount,
  onOpenTransfer,
  onAddNewAccount,
  onOpenSettings,
  onHaptic,
}) => {
  // Convert foreign currencies to rubles for total sums
  const toRub = (a: Account) =>
    a.currency === 'USD' ? a.balance * 90 : a.currency === 'EUR' ? a.balance * 98 : a.balance;

  const assetsBalance = accounts
    .filter((a) => a.group_name !== 'Кредиты')
    .reduce((acc, a) => acc + toRub(a), 0);

  // Group accounts by group_name in exact order
  const groupOrder = ['Личное', 'Общее (с Владом)', 'Общее с Владом', 'Кредиты', 'Кредит'];
  const groupedAccounts = accounts.reduce((acc, a) => {
    let grp = a.group_name || 'Личное';
    if (grp === 'Общее (с Владом)') grp = 'Общее с Владом';
    if (grp === 'Кредиты') grp = 'Кредит';
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(a);
    return acc;
  }, {} as Record<string, Account[]>);

  // Sort groups according to groupOrder
  const sortedGroupKeys = Object.keys(groupedAccounts).sort((a, b) => {
    const idxA = groupOrder.indexOf(a);
    const idxB = groupOrder.indexOf(b);
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });

  return (
    <div className="min-h-screen bg-[#F6F7FB] dark:bg-[#121318] text-[#111827] dark:text-white flex flex-col justify-between pb-24 select-none animate-fade-in relative transition-colors duration-200">
      {/* Top Header Bar */}
      <div className="px-4 pt-10 pb-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onBack();
            }}
            className="text-black dark:text-white p-1 active:scale-90 transition-transform"
          >
            <ArrowLeftOutlined className="text-[20px]" />
          </button>
          <div className="bg-[#111827] text-white px-3.5 py-1 rounded-lg font-bold text-[16px] tracking-tight">
            Счета
          </div>
        </div>

        {/* Right Settings Gear Icon */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onOpenSettings?.();
          }}
          className="p-1 text-black dark:text-white hover:text-gray-600 transition-colors"
          title="Настройки"
        >
          <SettingOutlined className="text-[20px]" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-5 max-w-lg mx-auto w-full">
        {/* Big Total Balance Header */}
        <div className="text-center my-6">
          <p className="text-[13px] text-[#6B7280] dark:text-gray-400 font-medium mb-3">
            Доступно на счетах
          </p>
          <h2 className="text-[48px] sm:text-[54px] font-extrabold text-[#111827] dark:text-white tracking-tight leading-none flex items-center justify-center">
            <span>
              {assetsBalance.toLocaleString('ru-RU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[#9CA3AF] dark:text-gray-500 font-normal ml-2">₽</span>
          </h2>
        </div>

        {/* Grouped Account Lists */}
        <div className="space-y-6 mt-6 mb-12">
          {sortedGroupKeys.map((groupName) => {
            const groupAccs = groupedAccounts[groupName];
            const isCreditGroup = groupName === 'Кредит' || groupName === 'Кредиты';

            return (
              <div key={groupName} className="space-y-3">
                {/* Centered Group Title */}
                <div className="text-center text-[14px] font-medium text-gray-600 dark:text-gray-400 my-3">
                  {groupName}
                </div>

                {/* Account Rows */}
                <div className="space-y-1">
                  {groupAccs.map((acc) => {
                    const resolved = resolveAccountBankAndName(acc);
                    const formattedBalance = acc.balance.toLocaleString('ru-RU', {
                      minimumFractionDigits: acc.balance % 1 === 0 ? 0 : (acc.balance * 10) % 1 === 0 ? 1 : 2,
                      maximumFractionDigits: 2,
                    });

                    return (
                      <div
                        key={acc.id}
                        onClick={() => {
                          onHaptic?.('light');
                          onSelectAccount?.(acc);
                        }}
                        className="w-full flex items-center justify-between py-3 px-1 border-b border-gray-100/60 dark:border-gray-800/60 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                      >
                        {/* Left: Icon + Bank & Account Name */}
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <span className="text-2xl shrink-0">{acc.icon}</span>
                          <div className="min-w-0 flex-1">
                            <span className="text-[15px] font-medium text-[#111827] dark:text-white truncate block">
                              {resolved.bank ? `${resolved.bank.shortName} • ` : ''}
                              {resolved.cleanName}
                            </span>
                          </div>
                        </div>

                        {/* Right: Balance */}
                        <div className="text-right shrink-0 font-bold text-[16px] text-[#111827] dark:text-white ml-3 flex items-center">
                          <span>
                            {isCreditGroup ? '-' : ''}
                            {formattedBalance}
                          </span>
                          <span className="text-[#9CA3AF] dark:text-gray-500 font-normal ml-1 text-sm">
                            {acc.currency === 'USD' ? '$' : acc.currency === 'EUR' ? '€' : '₽'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Solid Dock Bottom Navigation Bar (Transfer | Add) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#111827] border-t border-black flex items-stretch h-[72px] shadow-2xl">
        {/* Left: Transfer (Neon Lime) */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('heavy');
            onOpenTransfer?.();
          }}
          className="flex-1 bg-[#8CFF54] hover:bg-[#7CE643] text-black flex items-center justify-center active:opacity-85 transition-all"
          title="Перевести"
        >
          <SwapOutlined className="text-[26px]" />
        </button>

        {/* Right: Add Account (+) (Black) */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('medium');
            onAddNewAccount?.();
          }}
          className="w-[28%] bg-[#111827] hover:bg-black text-white flex items-center justify-center active:opacity-75 transition-all"
          title="Добавить счет"
        >
          <PlusOutlined className="text-[24px]" />
        </button>
      </div>
    </div>
  );
};
