import React, { useState } from 'react';
import {
  Wallet,
  Calendar,
  RotateCw,
  Settings,
  ChevronLeft,
  ChevronRight,
  ScanLine,
  Mic,
  Plus,
} from 'lucide-react';
import { DashboardSummary, Account, Category, Transaction } from '../../types';

interface DashboardScreenProps {
  summary: DashboardSummary;
  accounts: Account[];
  categories: Category[];
  onOpenAccounts: () => void;
  onOpenAddTransaction: () => void;
  onOpenVoice: () => void;
  onOpenSettings?: () => void;
  onScanReceipt?: () => void;
  onSelectTransaction?: (tx: Transaction) => void;
  onSelectCategory?: (cat: Category) => void;
  onRefresh?: () => void;
  onHaptic?: (style?: 'light' | 'medium' | 'heavy') => void;
}

const MONTHS = ['Июль 2026', 'Август 2026', 'Сентябрь 2026', 'Октябрь 2026', 'Ноябрь 2026'];

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  summary,
  accounts,
  categories,
  onOpenAccounts,
  onOpenAddTransaction,
  onOpenVoice,
  onOpenSettings,
  onScanReceipt,
  onSelectTransaction,
  onSelectCategory,
  onRefresh,
  onHaptic
}) => {
  const [monthIdx, setMonthIdx] = useState(2); // 'Сентябрь 2026'

  const totalAccountsBalance = accounts
    .filter((a) => a.group_name !== 'Кредиты')
    .reduce((acc, a) => acc + a.balance, 0);

  const prevMonth = () => {
    onHaptic?.('light');
    setMonthIdx((prev) => Math.max(0, prev - 1));
  };

  const nextMonth = () => {
    onHaptic?.('light');
    setMonthIdx((prev) => Math.min(MONTHS.length - 1, prev + 1));
  };

  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col justify-between pb-24 select-none animate-fade-in relative">
      {/* Top Header Bar */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        {/* Total Balance Wallet Button */}
        <button
          type="button"
          onClick={() => {
            onHaptic?.('light');
            onOpenAccounts();
          }}
          className="flex items-center space-x-2 text-[#111827] active:opacity-75 transition-opacity"
        >
          <Wallet className="w-6 h-6 text-[#111827]" strokeWidth={2.2} />
          <span className="text-[17px] font-bold tracking-tight">
            {totalAccountsBalance.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ₽
          </span>
        </button>

        {/* Right Header Action Icons */}
        <div className="flex items-center space-x-3 text-[#374151]">
          <button
            type="button"
            onClick={() => onHaptic?.('light')}
            className="p-1 hover:text-black transition-colors"
          >
            <Calendar className="w-5 h-5 text-[#4B5563]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onRefresh?.();
            }}
            className="p-1 hover:text-black transition-colors active:rotate-180 transition-transform duration-300"
          >
            <RotateCw className="w-5 h-5 text-[#4B5563]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={() => {
              onHaptic?.('light');
              onOpenSettings?.();
            }}
            className="p-1 hover:text-black transition-colors"
          >
            <Settings className="w-5 h-5 text-[#4B5563]" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {/* Main Center Content */}
      <div className="flex-1 px-5 max-w-lg mx-auto w-full">
        {/* Month / Period Selector */}
        <div className="flex items-center justify-center space-x-4 my-2">
          <button
            type="button"
            onClick={prevMonth}
            className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#6B7280] active:scale-90"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[17px] font-bold text-[#111827] min-w-[140px] text-center">
            {MONTHS[monthIdx]}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#6B7280] active:scale-90"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Big Net Period Amount */}
        <div className="text-center my-4">
          {(() => {
            const net = summary.period_income - summary.period_expense;
            const sign = net > 0 ? '+' : (net < 0 ? '−' : '');
            return (
              <h2 className="text-[42px] font-extrabold text-[#111827] tracking-tight">
                {sign}{Math.abs(net).toLocaleString('ru-RU', { minimumFractionDigits: 0 })}{' '}
                <span className="font-bold">₽</span>
              </h2>
            );
          })()}

          {/* Stat Badges: Income ↓ and Expense ↑ */}
          <div className="flex items-center justify-center space-x-3 mt-3">
            <div className="flex items-center space-x-1.5 px-4 py-1.5 rounded-full bg-[#ECFDF5] text-[#10B981] font-bold text-[14px]">
              <span>↓</span>
              <span>
                {summary.period_income.toLocaleString('ru-RU', {
                  minimumFractionDigits: 0,
                })}{' '}
                ₽
              </span>
            </div>

            <div className="flex items-center space-x-1.5 px-4 py-1.5 rounded-full bg-[#FEE2E2] text-[#EF4444] font-bold text-[14px]">
              <span>↑</span>
              <span>
                {summary.period_expense.toLocaleString('ru-RU', {
                  minimumFractionDigits: 0,
                })}{' '}
                ₽
              </span>
            </div>
          </div>
        </div>

        {/* Category Circular Tiles (Horizontal or Grid) */}
        <div className="my-6">
          <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-2 gap-3 px-1">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onHaptic?.('light');
                  onSelectCategory?.(cat);
                }}
                className="flex flex-col items-center flex-shrink-0 group active:scale-95 transition-all"
              >
                {/* Elevated Circle Icon with Emoji */}
                <div className="w-16 h-16 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.06)] flex items-center justify-center text-3xl border border-gray-100 group-hover:border-blue-200 transition-all">
                  {cat.icon}
                </div>
                {/* Category Name */}
                <span className="text-[13px] font-semibold text-[#111827] mt-2 leading-none">
                  {cat.name}
                </span>
                {/* Amount */}
                <span className="text-[11px] font-medium text-[#9CA3AF] mt-1">
                  0 ₽
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Transactions Section («Недавние») */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[18px] font-bold text-[#111827]">Недавние</h3>
            <button
              type="button"
              onClick={() => onHaptic?.('light')}
              className="text-[13px] font-semibold text-[#2B5BFF] flex items-center space-x-0.5"
            >
              <span>Все транзакции</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Transactions List */}
          <div className="space-y-2">
            {/* Centered Date Header above cards */}
            <div className="text-center text-[12px] font-medium text-[#9CA3AF]">
              {summary.recent_transactions.length > 0 && summary.recent_transactions[0].created_at
                ? new Date(summary.recent_transactions[0].created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                  })
                : new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </div>

            {/* Horizontal / Stacked Transaction Cards */}
            <div className="flex items-center space-x-3 overflow-x-auto no-scrollbar pb-2">
              {summary.recent_transactions.length > 0 ? (
                summary.recent_transactions.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => {
                      onHaptic?.('light');
                      onSelectTransaction?.(tx);
                    }}
                    className="flex-shrink-0 bg-white rounded-[22px] px-4 py-3 shadow-sm border border-gray-100 flex items-center space-x-3 min-w-[170px] text-left active:scale-[0.98] transition-all"
                  >
                    <div className="text-2xl">{tx.category_icon || (tx.type === 'transfer' ? '🔄' : '📦')}</div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#111827] leading-tight truncate max-w-[120px]">
                        {tx.category_name || tx.note || (tx.type === 'transfer' ? 'Перевод' : 'Расход')}
                      </div>
                      <div
                        className={`text-[13px] font-bold mt-0.5 ${
                          tx.type === 'expense'
                            ? 'text-[#FF4B55]'
                            : tx.type === 'income'
                            ? 'text-[#10B981]'
                            : 'text-[#6B7280]'
                        }`}
                      >
                        {tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
                        {tx.amount.toLocaleString('ru-RU')} ₽
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-gray-400 py-4 text-center w-full">Нет операций за период</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Navigation Bar */}
      <div className="fixed bottom-6 left-0 right-0 z-30 flex items-center justify-center">
        <div className="flex items-center space-x-5">
          {/* Left: Receipt / QR Scanner Button */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('medium');
              onScanReceipt?.();
            }}
            className="w-13 h-13 p-3 rounded-full bg-white text-[#111827] shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex items-center justify-center active:scale-90 transition-all border border-gray-100"
          >
            <ScanLine className="w-6 h-6 stroke-[2]" />
          </button>

          {/* Center: Big Elevated Royal Blue Microphone Button */}
          <div className="relative">
            <div className="absolute -inset-1.5 bg-[#2B5BFF]/30 rounded-full blur-md" />
            <button
              type="button"
              onClick={() => {
                onHaptic?.('heavy');
                onOpenVoice();
              }}
              className="relative w-18 h-18 p-4 rounded-full bg-[#2B5BFF] text-white shadow-[0_8px_24px_rgba(43,91,255,0.45)] flex items-center justify-center active:scale-95 transition-all"
            >
              <Mic className="w-8 h-8 stroke-[2.2]" />
            </button>
          </div>

          {/* Right: Plus (+) Button */}
          <button
            type="button"
            onClick={() => {
              onHaptic?.('medium');
              onOpenAddTransaction();
            }}
            className="w-13 h-13 p-3 rounded-full bg-white text-[#111827] shadow-[0_4px_16px_rgba(0,0,0,0.08)] flex items-center justify-center active:scale-90 transition-all border border-gray-100"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
